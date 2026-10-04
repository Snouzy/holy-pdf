import Foundation
import PDFKit
import Testing
@testable import PDFToolbox

@MainActor
struct HalvesSessionTests {
    @Test func showsTheCutThenSavesTwoPagesForEachPage() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let source = folder.appendingPathComponent("Book.pdf")
        try demoPDF(title: "Book", pages: 2, color: 0).write(to: source)
        let original = try Data(contentsOf: source)
        let session = HalvesSession()
        session.file.open(source)
        try await waitUntil { session.file.state == .ready && session.file.preview != nil }
        let leftRight = try #require(session.file.preview?.dataProvider?.data)
        session.cut = .topBottom
        // The dashed line moves on the page.
        try await waitUntil { session.file.preview.map { $0.dataProvider?.data != leftRight } ?? false }

        let output = folder.appendingPathComponent("Book-halves.pdf")
        await session.saveCopy(to: output)
        #expect(session.file.errorMessage == nil)
        #expect(session.file.lastSavedURL == output)
        let copy = try #require(PDFDocument(url: output))
        #expect(copy.pageCount == 4)
        let whole = try #require(PDFDocument(data: original)?.page(at: 0)?.bounds(for: .cropBox).size)
        #expect(copy.page(at: 0)?.bounds(for: .cropBox).size == CGSize(width: whole.width, height: whole.height / 2))
        #expect(try Data(contentsOf: source) == original)

        session.cut = .leftRight
        #expect(session.file.lastSavedURL == nil, "Another cut: the saved copy is no longer what the settings give")
    }
}
