import Foundation
import PDFKit
import Testing
@testable import PDFToolbox

@MainActor
struct FlattenSessionTests {
    @Test func flattensTheFieldsAndSaysHowMany() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let source = folder.appendingPathComponent("Form.pdf")
        try formPDF(title: "Form", value: "Ada Lovelace").write(to: source)
        let original = try Data(contentsOf: source)
        let session = FlattenSession()
        session.file.open(source)
        try await waitUntil { session.file.state == .ready }
        #expect(session.file.notices.count == 1, "The screen says how many fields and annotations it found")
        let output = folder.appendingPathComponent("Form-flattened.pdf")
        await session.saveCopy(to: output)
        #expect(session.file.errorMessage == nil)
        let copy = try #require(PDFDocument(url: output))
        #expect(copy.page(at: 0)?.annotations.isEmpty == true)
        #expect(copy.page(at: 0)?.string?.contains("Ada Lovelace") == true)
        #expect(try Data(contentsOf: source) == original)
    }

    @Test func aPDFWithNothingToFlattenIsRefusedAtTheOpening() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let source = folder.appendingPathComponent("Letter.pdf")
        try demoPDF(title: "Letter", pages: 2, color: 0).write(to: source)
        let session = FlattenSession()
        session.file.open(source)
        try await waitUntil { session.file.errorMessage != nil }
        #expect(session.file.state == .empty)
    }
}
