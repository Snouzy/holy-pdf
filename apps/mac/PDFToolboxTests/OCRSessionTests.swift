import Foundation
import PDFKit
import Testing
@testable import PDFToolbox

@MainActor
struct OCRSessionTests {
    private func opened(_ data: Data) async throws -> (session: OCRSession, source: URL, folder: URL) {
        let folder = try temporaryFolder()
        let source = folder.appendingPathComponent("Scan.pdf")
        try data.write(to: source)
        let session = OCRSession()
        session.file.open(source)
        try await waitUntil { session.file.state == .ready && session.file.preview != nil }
        return (session, source, folder)
    }

    @Test func readsAScanThenSavesACopyThatCanBeSearched() async throws {
        let (session, source, folder) = try await opened(try scannedPDF(pages: ["FACTURE 2026", "TOTAL 480 EUR"]))
        defer { try? FileManager.default.removeItem(at: folder) }
        let original = try Data(contentsOf: source)
        #expect(PDFDocument(data: original)?.string?.isEmpty != false)
        #expect(session.outcome == nil && !session.canSave)
        let plain = try #require(session.file.preview?.dataProvider?.data)

        await session.read()
        #expect(session.file.errorMessage == nil)
        #expect(session.outcome == .added(pages: 2))
        #expect(session.file.step == nil)
        #expect(session.canSave)
        #expect(session.file.hasUnsavedEdits, "Minutes of reading are not dropped without a question")
        // The lines read are highlighted on the page.
        try await waitUntil { session.file.preview.map { $0.dataProvider?.data != plain } ?? false }

        let output = folder.appendingPathComponent("Scan-ocr.pdf")
        await session.saveCopy(to: output)
        let copy = try #require(PDFDocument(url: output))
        // Vision may change a letter's case from one macOS to the next: the words must be found, not their exact form.
        #expect(!copy.findString("facture", withOptions: .caseInsensitive).isEmpty)
        #expect(copy.page(at: 1)?.string?.contains("480") == true)
        #expect(try Data(contentsOf: source) == original)
        #expect(session.outcome == .added(pages: 2), "The result stays on screen after the save")
        #expect(!session.file.hasUnsavedEdits)
    }

    // Latin letters read the same in every language: only another script tells the languages apart.
    @Test func theNextReadingUsesTheChosenLanguageAndTheOneOnScreenStays() async throws {
        let (session, _, folder) = try await opened(try scannedPDF(pages: ["請求書 2026年"]))
        defer { try? FileManager.default.removeItem(at: folder) }
        #expect(session.language == nil, "The three languages of the Scanner, until the user chooses one")
        await session.read()
        let usual = folder.appendingPathComponent("usual.pdf")
        await session.saveCopy(to: usual)
        #expect(PDFDocument(url: usual)?.findString("請求書", withOptions: []).isEmpty != false)

        let before = session.outcome
        session.language = "ja-JP"
        #expect(session.outcome == before, "Minutes of reading are not thrown away by a click on the list")
        await session.read()
        #expect(session.outcome == .added(pages: 1))
        let japanese = folder.appendingPathComponent("japanese.pdf")
        await session.saveCopy(to: japanese)
        #expect(PDFDocument(url: japanese)?.findString("請求書", withOptions: []).isEmpty == false)
    }

    @Test func aPDFThatHasItsTextHasNothingToRead() async throws {
        let (session, _, folder) = try await opened(try demoPDF(title: "Letter", pages: 2, color: 0))
        defer { try? FileManager.default.removeItem(at: folder) }
        await session.read()
        #expect(session.outcome == .nothing)
        #expect(!session.canSave)
        #expect(!session.file.hasUnsavedEdits)
        #expect(session.file.errorMessage == nil)
        await session.saveCopy(to: folder.appendingPathComponent("never.pdf"))
        #expect(!FileManager.default.fileExists(atPath: folder.appendingPathComponent("never.pdf").path))
    }

    @Test func anotherPDFDropsWhatWasRead() async throws {
        let (session, source, folder) = try await opened(try scannedPDF(pages: ["FACTURE 2026"]))
        defer { try? FileManager.default.removeItem(at: folder) }
        await session.read()
        #expect(session.canSave)
        session.file.open(source)
        #expect(session.outcome == nil && !session.canSave)
    }
}
