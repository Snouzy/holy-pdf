import Foundation
import PDFKit
import Testing
@testable import PDFToolbox

@MainActor
struct RedactSessionTests {
    private func opened(pages: Int = 3) async throws -> (session: RedactSession, source: URL, folder: URL) {
        let folder = try temporaryFolder()
        let source = folder.appendingPathComponent("Contract.pdf")
        try demoPDF(title: "Contract", pages: pages, color: 0).write(to: source)
        let session = RedactSession()
        session.file.open(source)
        try await waitUntil { session.file.state == .ready }
        return (session, source, folder)
    }

    @Test func areasBelongToThePageOnScreen() async throws {
        let (session, _, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        #expect(!session.canSave && !session.file.hasUnsavedEdits)
        session.add(CGRect(x: 0.1, y: 0.1, width: 0.3, height: 0.05))
        session.add(CGRect(x: 0.8, y: 0.9, width: 0.5, height: 0.4))
        let kept = try #require(session.areasOnPage.first)
        #expect(abs(kept.minX - 0.1) < 1e-9 && abs(kept.width - 0.3) < 1e-9 && abs(kept.height - 0.05) < 1e-9)
        let cut = try #require(session.areasOnPage.last)
        #expect(abs(cut.minX - 0.8) < 1e-9 && abs(cut.minY - 0.9) < 1e-9 && cut.maxX == 1 && cut.maxY == 1, "An area that leaves the page is cut at its edge")
        session.add(CGRect(x: 0.5, y: 0.5, width: 0, height: 0.2))
        session.add(CGRect(x: 1.2, y: 0.5, width: 0.2, height: 0.2))
        #expect(session.areasOnPage.count == 2)
        #expect(session.file.hasUnsavedEdits)
        session.file.goToPage(2)
        #expect(session.areasOnPage.isEmpty)
        session.add(CGRect(x: 0, y: 0, width: 1, height: 0.2))
        #expect(session.areaCount == 3 && session.pageCount == 2)
        session.remove(at: 0)
        session.remove(at: 4)
        #expect(session.areaCount == 2 && session.pageCount == 1)
        session.file.goToPage(0)
        session.removeAllOnPage()
        #expect(session.areaCount == 0 && !session.canSave)
        #expect(!session.file.hasUnsavedEdits, "Without area, there is nothing to lose")
    }

    @Test func undoTakesBackOneStepAtATimeOnWhateverPage() async throws {
        let (session, _, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        let first = CGRect(x: 0.1, y: 0.1, width: 0.2, height: 0.1), second = CGRect(x: 0.5, y: 0.5, width: 0.2, height: 0.1)
        #expect(!session.canUndo)
        session.add(first)
        session.add(second)
        let onePage = session.areas
        session.file.goToPage(1)
        session.add(first)
        let twoPages = session.areas
        session.file.goToPage(0)
        session.remove(at: 0)
        #expect(session.areaCount == 2 && session.canUndo)
        session.undo()
        #expect(session.areas == twoPages, "The removed area is back")
        session.undo()
        #expect(session.areas == onePage, "The area of the other page goes, though it is not on screen")
        session.undo()
        session.undo()
        #expect(session.areas.isEmpty && !session.canUndo)
        #expect(!session.file.hasUnsavedEdits, "Nothing is left to lose")
        session.undo()
        #expect(session.areas.isEmpty)
        session.add(first)
        let one = session.areas
        session.removeAllOnPage()
        session.undo()
        #expect(session.areas == one && session.file.hasUnsavedEdits)
        for step in 0..<150 { session.add(CGRect(x: 0.001 * Double(step), y: 0, width: 0.1, height: 0.1)) }
        var steps = 0
        while session.canUndo {
            session.undo()
            steps += 1
        }
        #expect(steps == 100, "A hundred steps back, as in the watermark")
    }

    @Test func theRedactedCopyLosesWhatTheAreaCovers() async throws {
        let (session, source, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        let original = try Data(contentsOf: source)
        await session.saveCopy(to: folder.appendingPathComponent("never.pdf"))
        #expect(!FileManager.default.fileExists(atPath: folder.appendingPathComponent("never.pdf").path))
        session.file.goToPage(1)
        session.add(CGRect(x: 0, y: 0, width: 1, height: 0.15))
        let output = folder.appendingPathComponent("Contract-redacted.pdf")
        await session.saveCopy(to: output)
        #expect(session.file.errorMessage == nil)
        let copy = try #require(PDFDocument(url: output))
        #expect(copy.pageCount == 3)
        #expect(copy.page(at: 0)?.string?.contains("EXAMPLE 1") == true)
        #expect(copy.page(at: 1)?.string?.contains("EXAMPLE") != true, "The page that carries the area is an image")
        #expect(copy.page(at: 2)?.string?.contains("EXAMPLE 3") == true)
        #expect(try Data(contentsOf: source) == original)
        #expect(!session.file.hasUnsavedEdits)
        #expect(session.areaCount == 1, "The areas stay on screen after the save")
    }

    @Test func anotherPDFDropsTheAreas() async throws {
        let (session, source, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        session.add(CGRect(x: 0.1, y: 0.1, width: 0.3, height: 0.05))
        session.file.open(source)
        #expect(session.areaCount == 0 && !session.canSave)
    }
}
