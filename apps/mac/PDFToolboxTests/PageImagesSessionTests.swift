import Foundation
import ImageIO
import PDFKit
import Testing
@testable import PDFToolbox

@MainActor
struct PageImagesSessionTests {
    private func opened(pages: Int) async throws -> (session: PageImagesSession, source: URL, folder: URL) {
        let folder = try temporaryFolder()
        let source = folder.appendingPathComponent("Report.pdf")
        try demoPDF(title: "Report", pages: pages, color: 0).write(to: source)
        let session = PageImagesSession()
        session.file.open(source)
        try await waitUntil { session.file.state == .ready }
        return (session, source, folder)
    }

    private func width(of url: URL) throws -> Int {
        let source = try #require(CGImageSourceCreateWithURL(url as CFURL, nil))
        return try #require(CGImageSourceCreateImageAtIndex(source, 0, nil)).width
    }

    @Test func writesOneJPEGPerPageAndNeverReplacesAFile() async throws {
        let (session, source, folder) = try await opened(pages: 3)
        defer { try? FileManager.default.removeItem(at: folder) }
        let original = try Data(contentsOf: source)
        let mine = folder.appendingPathComponent("Report-2.jpg")
        try Data("mine".utf8).write(to: mine)
        await session.save(into: folder, mode: .pages)
        #expect(session.file.errorMessage == nil)
        #expect(session.savedURLs.map(\.lastPathComponent) == ["Report-1.jpg", "Report-2-2.jpg", "Report-3.jpg"])
        #expect(try Data(contentsOf: mine) == Data("mine".utf8))
        // An A4 page at 150 dots per inch.
        #expect(abs(try width(of: session.savedURLs[0]) - 1239) <= 1)
        #expect(session.file.step == nil)
        #expect(try Data(contentsOf: source) == original)

        session.quality = .high
        #expect(session.savedURLs.isEmpty, "Another quality: the files on screen are no longer what the settings give")
        let sharp = folder.appendingPathComponent("sharp", isDirectory: true)
        try FileManager.default.createDirectory(at: sharp, withIntermediateDirectories: true)
        await session.save(into: sharp, mode: .pages)
        // At 300 dots per inch.
        #expect(abs(try width(of: session.savedURLs[0]) - 2479) <= 1)
    }

    @Test func aSinglePageKeepsTheNameOfThePDF() async throws {
        let (session, _, folder) = try await opened(pages: 1)
        defer { try? FileManager.default.removeItem(at: folder) }
        await session.save(into: folder, mode: .pages)
        #expect(session.savedURLs.map(\.lastPathComponent) == ["Report.jpg"])
    }

    @Test func aFolderThatRefusesFilesSaysSo() async throws {
        let (session, _, folder) = try await opened(pages: 2)
        defer { try? FileManager.default.removeItem(at: folder) }
        let locked = folder.appendingPathComponent("locked", isDirectory: true)
        try FileManager.default.createDirectory(at: locked, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o555])
        defer { try? FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: locked.path) }
        await session.save(into: locked, mode: .pages)
        #expect(session.savedURLs.isEmpty)
        #expect(session.file.errorMessage != nil)
        #expect(session.file.state == .ready)
    }

    @Test func thePhotosOfThePDFComeOutInTheirOwnFiles() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let source = folder.appendingPathComponent("Album.pdf")
        try photoPDF(title: "Album", side: 400).write(to: source)
        let session = PageImagesSession()
        session.file.open(source)
        try await waitUntil { session.file.state == .ready }
        try await waitUntil { session.photoCount != nil }
        #expect(session.photoCount == 1, "The screen says how many photos the PDF has, counted after the PDF opened")
        session.mode = .photos
        await session.save(into: folder, mode: .photos)
        #expect(session.file.errorMessage == nil)
        #expect(session.savedURLs.map(\.lastPathComponent) == ["Album-photo-1.jpg"])
        #expect(try width(of: session.savedURLs[0]) == 400, "The photo at its own pixels, not the page")
        session.mode = .pages
        #expect(session.savedURLs.isEmpty, "Another mode: the files on screen are no longer what the settings give")

        let letter = folder.appendingPathComponent("Letter.pdf")
        try demoPDF(title: "Letter", pages: 1, color: 0).write(to: letter)
        session.mode = .photos
        session.file.open(letter)
        try await waitUntil { session.photoCount != nil }
        #expect(session.photoCount == 0 && session.mode == .pages, "Without a photo, the pages are what is left to convert")
        session.file.reset()
        #expect(session.photoCount == nil)
    }

    @Test func aPhotosRunThatWritesNothingSaysSo() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        // A picture drawn off the page: counted, but nothing to cut.
        let source = folder.appendingPathComponent("Hidden.pdf")
        try photoPDF(title: "Hidden", side: 400, at: CGPoint(x: 2_000, y: 2_000)).write(to: source)
        let session = PageImagesSession()
        session.file.open(source)
        try await waitUntil { session.photoCount != nil }
        #expect(session.photoCount == 1)
        session.mode = .photos
        await session.save(into: folder, mode: .photos)
        #expect(session.savedURLs.isEmpty)
        #expect(session.file.errorMessage == String(localized: "No photo could be taken out of this PDF: convert its pages instead."))
        #expect(session.file.state == .ready)

        // « Extract images » chosen, a PDF without a photo opened, Convert clicked before the count ends.
        let letter = folder.appendingPathComponent("Letter.pdf")
        try demoPDF(title: "Letter", pages: 1, color: 0).write(to: letter)
        session.file.open(letter)
        try await waitUntil { session.file.state == .ready }
        await session.save(into: folder, mode: .photos)
        #expect(session.savedURLs.isEmpty, "What the user asked for, not the pages: \(session.savedURLs.map(\.lastPathComponent))")
        #expect(session.file.errorMessage != nil)
    }

    @Test func aCancelledConversionLeavesNoImageBehind() async throws {
        let (session, _, folder) = try await opened(pages: 80)
        defer { try? FileManager.default.removeItem(at: folder) }
        let output = folder.appendingPathComponent("images", isDirectory: true)
        try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
        session.quality = .high
        async let done: Void = session.save(into: output, mode: .pages)
        try await waitUntil { (try? FileManager.default.contentsOfDirectory(atPath: output.path).isEmpty) == false }
        session.file.cancelWork()
        await done
        #expect(session.savedURLs.isEmpty)
        #expect(try FileManager.default.contentsOfDirectory(atPath: output.path).isEmpty, "Half a conversion is of no use: its images are removed")
        #expect(session.file.step == nil)
    }

    @Test func anotherPDFForgetsTheImagesOnScreen() async throws {
        let (session, source, folder) = try await opened(pages: 1)
        defer { try? FileManager.default.removeItem(at: folder) }
        await session.save(into: folder, mode: .pages)
        #expect(!session.savedURLs.isEmpty)
        session.file.open(source)
        #expect(session.savedURLs.isEmpty)
    }
}
