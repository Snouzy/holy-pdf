import Foundation
import PDFKit
import Testing
@testable import PDFToolbox

@MainActor
struct CompressSessionTests {
    private func opened(_ data: Data) async throws -> (session: CompressSession, source: URL, folder: URL) {
        let folder = try temporaryFolder()
        let source = folder.appendingPathComponent("Album.pdf")
        try data.write(to: source)
        let session = CompressSession()
        session.file.open(source)
        try await waitUntil { session.file.state == .ready }
        return (session, source, folder)
    }

    @Test func compressesThenSavesTheLighterCopy() async throws {
        let (session, source, folder) = try await opened(try photoPDF(title: "Album"))
        defer { try? FileManager.default.removeItem(at: folder) }
        let original = try Data(contentsOf: source)
        #expect(session.outcome == nil && !session.canSave)
        await session.saveCopy(to: folder.appendingPathComponent("never.pdf"))
        #expect(!FileManager.default.fileExists(atPath: folder.appendingPathComponent("never.pdf").path))

        try await waitUntil { session.file.preview != nil }
        let sharp = try #require(session.file.preview?.dataProvider?.data)
        await session.compress()
        // The page on screen is now the compressed one, and the original is one click away.
        try await waitUntil { session.file.preview.map { $0.dataProvider?.data != sharp } ?? false }
        session.showsCopy = false
        try await waitUntil { session.file.preview?.dataProvider?.data == sharp }
        session.showsCopy = true
        guard case .lighter(let from, let bytes) = session.outcome else {
            Issue.record("Expected a lighter copy, got \(String(describing: session.outcome)), \(session.file.errorMessage ?? "no message")")
            return
        }
        #expect(from == original.count)
        #expect(bytes < original.count / 2)
        #expect(session.canSave)

        let output = folder.appendingPathComponent("Album-compressed.pdf")
        await session.saveCopy(to: output)
        #expect(session.file.lastSavedURL == output)
        #expect(try Data(contentsOf: output).count == bytes)
        #expect(PDFDocument(url: output)?.page(at: 0)?.string?.contains("Album") == true)
        #expect(try Data(contentsOf: source) == original)
        #expect(session.outcome == .lighter(from: from, to: bytes), "The gain stays on screen after the save")
    }

    @Test func aPDFWithoutPhotosIsAlreadyLight() async throws {
        let (session, _, folder) = try await opened(try demoPDF(title: "Letter", pages: 2, color: 0))
        defer { try? FileManager.default.removeItem(at: folder) }
        await session.compress()
        #expect(session.outcome == .alreadyLight)
        #expect(!session.canSave)
        #expect(session.file.errorMessage == nil)
    }

    @Test func aBlackAndWhiteScanIsAnnouncedAtTheOpening() async throws {
        let (session, _, folder) = try await opened(try scanPDF())
        defer { try? FileManager.default.removeItem(at: folder) }
        #expect(session.file.notices.count == 1)
        let photo = folder.appendingPathComponent("Photo.pdf")
        try photoPDF(title: "Photo").write(to: photo)
        session.file.open(photo)
        try await waitUntil { session.file.state == .ready }
        #expect(session.file.notices.isEmpty)
    }

    /// One page that is a one-bit image, as an office scanner saves a letter.
    private func scanPDF(side: Int = 800) throws -> Data {
        let bytes = [UInt8](repeating: 0b1010_1010, count: side * side / 8)
        let provider = try #require(CGDataProvider(data: Data(bytes) as CFData))
        let scan = try #require(CGImage(width: side, height: side, bitsPerComponent: 1, bitsPerPixel: 1, bytesPerRow: side / 8,
                                        space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.none.rawValue),
                                        provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent))
        let data = NSMutableData()
        let consumer = try #require(CGDataConsumer(data: data))
        var page = CGRect(x: 0, y: 0, width: 595, height: 842)
        let context = try #require(CGContext(consumer: consumer, mediaBox: &page, nil))
        context.beginPDFPage(nil)
        context.draw(scan, in: CGRect(x: 0, y: 0, width: 595, height: 595))
        context.endPDFPage()
        context.closePDF()
        return data as Data
    }

    @Test func anotherLevelOrAnotherPDFDropsTheResult() async throws {
        let (session, source, folder) = try await opened(try photoPDF(title: "Album"))
        defer { try? FileManager.default.removeItem(at: folder) }
        await session.compress()
        #expect(session.canSave)
        session.level = .recommended
        #expect(session.canSave, "The same level keeps the result")
        await session.saveCopy(to: folder.appendingPathComponent("Album-compressed.pdf"))
        #expect(session.file.lastSavedURL != nil)
        session.level = .extreme
        #expect(session.outcome == nil && !session.canSave)
        await session.compress()
        #expect(session.canSave)
        #expect(session.file.lastSavedURL == nil, "The new copy is not the one on disk")
        session.file.open(source)
        #expect(session.outcome == nil && !session.canSave)
        #expect(session.level == .extreme, "The level stays from one PDF to the next")
    }
}
