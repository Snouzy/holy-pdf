import Foundation
import PDFKit
import Testing
@testable import PDFToolbox

@MainActor
struct SheetsSessionTests {
    @Test func savesThePagesOnSheets() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let source = folder.appendingPathComponent("Report.pdf")
        try demoPDF(title: "Report", pages: 5, color: 0).write(to: source)
        let original = try Data(contentsOf: source)
        let session = SheetsSession()
        session.file.open(source)
        try await waitUntil { session.file.state == .ready }
        let output = folder.appendingPathComponent("Report-per-sheet.pdf")
        await session.saveCopy(to: output)
        #expect(session.file.errorMessage == nil)
        #expect(session.file.lastSavedURL == output)
        #expect(session.file.step == nil)
        let four = try #require(PDFDocument(url: output))
        #expect(four.pageCount == 2)
        #expect(four.page(at: 0)?.string?.contains("Report") == true, "The text of the pages stays text")
        #expect(try Data(contentsOf: source) == original)

        session.perSheet = 2
        #expect(session.file.lastSavedURL == nil, "Another number: the saved copy is no longer what the settings give")
        let wide = folder.appendingPathComponent("Report-two.pdf")
        await session.saveCopy(to: wide)
        let two = try #require(PDFDocument(url: wide))
        #expect(two.pageCount == 3)
        let sheet = try #require(two.page(at: 0)?.bounds(for: .mediaBox).size)
        #expect(sheet.width > sheet.height)
    }
}
