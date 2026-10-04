import Foundation
import PDFKit
import Testing
@testable import PDFToolbox

@MainActor
struct PixelizeSessionTests {
    @Test func savesACopyMadeOfPictures() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let source = folder.appendingPathComponent("Report.pdf")
        try demoPDF(title: "Report", pages: 2, color: 0).write(to: source)
        let original = try Data(contentsOf: source)
        #expect(PDFDocument(data: original)?.string?.contains("Report") == true)
        let session = PixelizeSession()
        session.file.open(source)
        try await waitUntil { session.file.state == .ready }
        let output = folder.appendingPathComponent("Report-pixelized.pdf")
        await session.saveCopy(to: output)
        #expect(session.file.errorMessage == nil)
        #expect(session.file.lastSavedURL == output)
        #expect(session.file.step == nil)
        let copy = try #require(PDFDocument(url: output))
        #expect(copy.pageCount == 2)
        #expect(copy.string?.contains { !$0.isWhitespace } != true, "No text is left to select")
        #expect(try Data(contentsOf: source) == original)

        session.quality = .high
        #expect(session.file.lastSavedURL == nil, "Another resolution: the saved copy is no longer what the settings give")
        #expect(!session.file.hasUnsavedEdits)
        let sharp = folder.appendingPathComponent("Report-sharp.pdf")
        await session.saveCopy(to: sharp)
        #expect(try Data(contentsOf: sharp).count > Data(contentsOf: output).count)
    }
}
