import Foundation
import PDFCore
import PDFKit
import Testing
@testable import PDFToolbox

@MainActor
struct PageNumberSessionTests {
    private func opened(pages: Int = 4) async throws -> (session: PageNumberSession, folder: URL) {
        let folder = try temporaryFolder()
        let url = folder.appendingPathComponent("Report.pdf")
        try demoPDF(title: "Report", pages: pages, color: 0).write(to: url)
        let session = PageNumberSession()
        session.file.open(url)
        try await waitUntil { session.file.state == .ready }
        return (session, folder)
    }

    @Test func numbersEveryPageByDefault() async throws {
        let (session, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        #expect(session.numbering == PageNumbering(pages: 0...3))
        #expect(!session.file.hasUnsavedEdits)
    }

    @Test func keepsTheSettingsInsideTheDocument() async throws {
        let (session, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        session.update {
            $0.allPages = false
            $0.firstPage = 2
            $0.lastPage = 9
            $0.first = -4
            $0.fontSize = 80
            $0.format = .numberOfTotal
        }
        let numbering = try #require(session.numbering)
        #expect(numbering.pages == 2...3)
        #expect(numbering.first == 0)
        #expect(numbering.fontSize == 36)
        #expect(numbering.text(forPage: 3) == "1 / 1")
        #expect(session.file.hasUnsavedEdits)
        session.update { $0.firstPage = 3; $0.lastPage = 1 }
        #expect(session.numbering?.pages == 3...3)
    }

    @Test func savesANumberedCopy() async throws {
        let (session, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        session.update { $0.format = .page; $0.first = 10 }
        let output = folder.appendingPathComponent("Report-numbered.pdf")
        await session.saveCopy(to: output)
        #expect(session.file.errorMessage == nil)
        let saved = try #require(PDFDocument(url: output))
        #expect((0..<4).allSatisfy { saved.page(at: $0)?.string?.contains("Page \(10 + $0)") == true })
        #expect(!session.file.hasUnsavedEdits)
    }

    @Test func aShorterDocumentNarrowsTheRange() async throws {
        let (session, folder) = try await opened(pages: 6)
        defer { try? FileManager.default.removeItem(at: folder) }
        session.update { $0.allPages = false; $0.firstPage = 1; $0.lastPage = 5 }
        let short = folder.appendingPathComponent("Short.pdf")
        try demoPDF(title: "Short", pages: 2, color: 1).write(to: short)
        session.file.open(short)
        try await waitUntil { session.file.state == .ready && session.file.pageSizes.count == 2 }
        #expect(session.numbering?.pages == 1...1)
    }

    @Test func showsTheNumberOnThePreview() async throws {
        let (session, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        try await waitUntil { session.file.preview != nil }
        let plain = session.file.preview
        session.update { $0.fontSize = 30 }
        try await waitUntil { session.file.preview != nil && session.file.preview !== plain }
        #expect(session.file.preview?.dataProvider?.data != plain?.dataProvider?.data)
    }
}
