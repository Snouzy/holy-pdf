import Foundation
import PDFKit
import Testing
@testable import PDFToolbox

@MainActor
struct OverlaySessionTests {
    private func files() throws -> (letter: URL, head: URL, folder: URL) {
        let folder = try temporaryFolder()
        let letter = folder.appendingPathComponent("Letter.pdf"), head = folder.appendingPathComponent("Letterhead.pdf")
        try demoPDF(title: "Letter", pages: 3, color: 0).write(to: letter)
        try demoPDF(title: "Letterhead", pages: 1, color: 1).write(to: head)
        return (letter, head, folder)
    }

    @Test func laysTheChosenPDFOnEveryPageAndShowsItOnThePreview() async throws {
        let (letter, head, folder) = try files()
        defer { try? FileManager.default.removeItem(at: folder) }
        let original = try Data(contentsOf: letter)
        let session = OverlaySession()
        session.file.open(letter)
        try await waitUntil { session.file.state == .ready && session.file.preview != nil }
        let plain = try #require(session.file.preview?.dataProvider?.data)
        let output = folder.appendingPathComponent("Letter-overlaid.pdf")
        await session.saveCopy(to: output)
        #expect(!FileManager.default.fileExists(atPath: output.path), "Nothing to lay yet: nothing to save")

        await session.setLayer(head)
        #expect(session.layer?.name == "Letterhead.pdf" && session.layer?.pages == 1)
        #expect(session.file.errorMessage == nil)
        try await waitUntil { session.file.preview.map { $0.dataProvider?.data != plain } ?? false }
        await session.saveCopy(to: output)
        #expect(session.file.lastSavedURL == output)
        let copy = try #require(PDFDocument(url: output))
        #expect(copy.pageCount == 3)
        #expect((0..<3).allSatisfy { copy.page(at: $0)?.string?.contains("Letterhead") == true }, "The single page of the layer goes on every page")
        #expect(copy.page(at: 2)?.string?.contains("EXAMPLE 3") == true, "The page that receives keeps its own text")
        #expect(try Data(contentsOf: letter) == original)

        session.position = .under
        #expect(session.file.lastSavedURL == nil, "Another position: the saved copy is no longer what the settings give")
        session.file.reset()
        #expect(session.layer != nil, "The layer waits for the next document")
    }

    @Test func aProtectedOrUnreadableLayerIsRefusedWithTheWayOut() async throws {
        let (letter, head, folder) = try files()
        defer { try? FileManager.default.removeItem(at: folder) }
        let locked = folder.appendingPathComponent("Locked.pdf")
        try #require(PDFDocument(url: head)?.dataRepresentation(options: [
            PDFDocumentWriteOption.userPasswordOption: "open", PDFDocumentWriteOption.ownerPasswordOption: "owner",
        ])).write(to: locked)
        let text = folder.appendingPathComponent("Notes.pdf")
        try Data("not a PDF".utf8).write(to: text)
        let session = OverlaySession()
        session.file.open(letter)
        try await waitUntil { session.file.state == .ready }
        await session.setLayer(locked)
        let protected = try #require(session.file.errorMessage)
        #expect(session.layer == nil)
        await session.setLayer(text)
        #expect(session.layer == nil)
        #expect(session.file.errorMessage != nil && session.file.errorMessage != protected)
        await session.setLayer(head)
        #expect(session.layer != nil && session.file.errorMessage == nil)
    }
}
