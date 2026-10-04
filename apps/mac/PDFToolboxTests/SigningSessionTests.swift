import CoreGraphics
import Foundation
import ImageIO
import PDFCore
import PDFKit
import Testing
import UniformTypeIdentifiers
@testable import PDFToolbox

@MainActor
struct SigningSessionTests {
    @Test func openingAnotherDocumentClearsThePreviousSignatureAndUndoHistory() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let original = try makePDF(in: folder)
        let session = try await readySession(original)
        try await addSignature(to: session)
        #expect(session.hasUnexportedChanges)

        let replacement = folder.appendingPathComponent("replacement.pdf")
        try blankPDF(widths: [400, 400]).write(to: replacement)
        session.open(replacement)
        try await waitUntil { session.state != .opening }

        #expect(session.state == .ready)
        #expect(session.sourceName == "replacement.pdf")
        #expect(session.marks.isEmpty)
        #expect(session.placements.isEmpty)
        #expect(!session.canUndo)
        #expect(!session.canExport)
        #expect(!session.hasUnexportedChanges)
    }

    @Test func severalMarksLiveTogetherAndEachGoesWhereTheUserClicks() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let session = try await readySession(makePDF(in: folder))
        session.addText("Ada Lovelace", style: SignatureImage.TextStyle.handwritten)
        try await waitUntil { session.marks.count == 1 }
        #expect(session.placements.count == 1 && session.marks.first?.title == "Ada Lovelace")
        session.addText("AL", style: SignatureImage.TextStyle.plain)
        try await waitUntil { session.marks.count == 2 }
        #expect(session.placements.count == 2, "The first mark stays on the page")
        #expect(session.currentMarkID == session.marks[1].id)
        #expect(session.placements.map { $0.mark } == session.marks.map { $0.id })

        // A click with a placement selected only puts it down; the next one places the current mark there.
        session.pageTapped(at: CGPoint(x: 0.2, y: 0.8))
        #expect(session.selectedID == nil && session.placements.count == 2)
        session.pageTapped(at: CGPoint(x: 0.2, y: 0.8))
        let placed = try #require(session.placements.last)
        #expect(session.placements.count == 3 && placed.mark == session.marks[1].id)
        #expect(abs(placed.bounds.midX - 0.2) < 0.001 && abs(placed.bounds.midY - 0.8) < 0.001)
        session.pageTapped(at: CGPoint(x: 0.99, y: 0.01))
        session.pageTapped(at: CGPoint(x: 0.99, y: 0.01))
        #expect(session.placements.last.map { $0.bounds.maxX <= 1 && $0.bounds.minY >= 0 } == true, "A mark stays inside the page")

        session.selectMark(session.marks[0].id)
        session.addPlacement()
        #expect(session.placements.last?.mark == session.marks[0].id)
        let output = folder.appendingPathComponent("signed.pdf")
        await session.saveCopy(to: output)
        #expect(PDFDocument(url: output)?.page(at: 0)?.annotations.filter { $0.type == "Stamp" }.count == 5)

        session.removeMark(session.marks[1].id)
        #expect(session.marks.count == 1 && session.placements.count == 2, "A mark leaves with its placements")
        session.undo()
        #expect(session.marks.count == 2 && session.placements.count == 5)
        #expect(session.selectedID == session.placements.last?.id, "The placement that came back is the selected one")
    }

    @Test func aTypedLineIsAsTallAsALineOfTextAndTheListStopsAtTwenty() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let session = try await readySession(makePDF(in: folder))
        session.addText("Ada Lovelace", style: SignatureImage.TextStyle.handwritten)
        try await waitUntil { session.marks.count == 1 }
        let line = try #require(session.placements.first)
        // A line of 24 points, whatever the length of the text.
        let tall = 24 / session.pageSizes[0].height
        #expect(abs(line.bounds.height - tall) < 0.002 && line.bounds.width < 0.9, "\(line.bounds)")
        session.addText("AL", style: SignatureImage.TextStyle.plain)
        try await waitUntil { session.marks.count == 2 }
        #expect(abs(session.placements[1].bounds.height - tall) < 0.002 && session.placements[1].bounds.width < line.bounds.width)

        session.addText("", style: SignatureImage.TextStyle.plain)
        session.addText(String(repeating: "a", count: 121), style: SignatureImage.TextStyle.plain)
        #expect(session.errorMessage?.contains("120") == true, "A line too long says so, in words about text")
        #expect(session.marks.count == 2)
        for number in 3...20 { session.addText("Mark \(number)", style: SignatureImage.TextStyle.plain) }
        try await waitUntil { session.marks.count == 20 }
        #expect(!session.canAddMark)
        session.addText("One too many", style: SignatureImage.TextStyle.plain)
        try await waitUntil { session.errorMessage != nil }
        #expect(session.marks.count == 20)
    }

    @Test func undoRestoresTheDeletedSignatureOnItsPageAndSelectsIt() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let session = try await readySession(makePDF(in: folder))
        try await addSignature(to: session)
        session.addPlacement()
        let removed = try #require(session.placements.last)
        session.removeSelected()
        session.goToPage(1)
        session.undo()

        #expect(session.pageIndex == 0)
        #expect(session.placements.count == 2)
        #expect(session.placements.last == removed)
        #expect(session.selectedID == removed.id)
    }

    @Test func movingASignatureCanBeUndoneAndInvalidBoundsLeaveItIntact() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let session = try await readySession(makePDF(in: folder))
        try await addSignature(to: session)
        let original = try #require(session.placements.first)
        let moved = CGRect(x: 0.1, y: 0.2, width: original.bounds.width, height: original.bounds.height)
        session.updatePlacement(id: original.id, bounds: moved)
        #expect(session.placements.first?.bounds == moved)
        session.updatePlacement(id: original.id, bounds: CGRect(x: -0.1, y: 0, width: 0.2, height: 0.1))
        session.updatePlacement(id: original.id, bounds: CGRect(x: 0, y: 0, width: CGFloat.nan, height: 0.1))
        session.updatePlacement(id: original.id, bounds: CGRect(x: 0.3, y: 0.2, width: -0.1, height: 0.1))
        #expect(session.placements.first?.bounds == moved)
        session.undo()
        #expect(session.placements.first == original)
    }

    @Test func savingACopyProtectsTheOriginalAndItsFilesystemAliases() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let original = try makePDF(in: folder)
        let originalData = try Data(contentsOf: original)
        let session = try await readySession(original)
        try await addSignature(to: session)
        let symbolicLink = folder.appendingPathComponent("symlink.pdf")
        let hardLink = folder.appendingPathComponent("hardlink.pdf")
        try FileManager.default.createSymbolicLink(at: symbolicLink, withDestinationURL: original)
        try FileManager.default.linkItem(at: original, to: hardLink)

        for destination in [original, symbolicLink, hardLink] {
            await session.saveCopy(to: destination)
            #expect(session.errorMessage != nil)
            #expect(session.lastSavedURL == nil)
            #expect(session.hasUnexportedChanges)
            #expect(try Data(contentsOf: destination) == originalData)
        }

        let copy = folder.appendingPathComponent("signed-copy.pdf")
        await session.saveCopy(to: copy)
        #expect(session.state == .ready)
        #expect(session.errorMessage == nil)
        #expect(session.lastSavedURL == copy)
        #expect(!session.hasUnexportedChanges)
        #expect(try Data(contentsOf: original) == originalData)
        let saved = try #require(PDFDocument(url: copy))
        #expect(saved.pageCount == 2)
        #expect(saved.page(at: 0)?.annotations.count == 1)
        #expect(saved.page(at: 1)?.annotations.isEmpty == true)
        session.addPlacement()
        #expect(session.hasUnexportedChanges)
        #expect(session.lastSavedURL == nil)
        session.undo()
        #expect(!session.hasUnexportedChanges)
    }

    @Test func failedSaveKeepsThePlacementsUnsavedAndAllowsAnotherAttempt() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let session = try await readySession(makePDF(in: folder))
        try await addSignature(to: session)
        let placements = session.placements
        await session.saveCopy(to: folder.appendingPathComponent("missing/failed.pdf"))
        #expect(session.state == .ready)
        #expect(session.errorMessage != nil)
        #expect(session.hasUnexportedChanges)
        #expect(session.placements == placements)
        #expect(session.canExport)
        await session.saveCopy(to: folder.appendingPathComponent("retry.pdf"))
        #expect(session.errorMessage == nil)
        #expect(!session.hasUnexportedChanges)
    }

    @Test func resettingDuringImportDoesNotBringTheDocumentBack() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let session = SigningSession()
        session.open(try makePDF(in: folder))
        session.reset()
        try await Task.sleep(for: .milliseconds(100))
        #expect(session.state == .empty)
        #expect(session.sourceName.isEmpty)
        #expect(session.pageSizes.isEmpty)
        #expect(session.preview == nil)
        #expect(session.errorMessage == nil)
    }

    private func readySession(_ url: URL) async throws -> SigningSession {
        let session = SigningSession()
        session.open(url)
        try await waitUntil { session.state != .opening }
        try #require(session.state == .ready)
        return session
    }

    private func addSignature(to session: SigningSession) async throws {
        let context = try #require(CGContext(data: nil, width: 120, height: 40, bitsPerComponent: 8,
                                            bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(),
                                            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
        context.setStrokeColor(CGColor(gray: 0, alpha: 1))
        context.setLineWidth(3)
        context.move(to: CGPoint(x: 10, y: 10))
        context.addLine(to: CGPoint(x: 100, y: 30))
        context.strokePath()
        let image = try #require(context.makeImage())
        let bytes = NSMutableData()
        let destination = try #require(CGImageDestinationCreateWithData(bytes, UTType.png.identifier as CFString, 1, nil))
        CGImageDestinationAddImage(destination, image, nil)
        try #require(CGImageDestinationFinalize(destination))
        session.addSignature(data: bytes as Data)
        try await waitUntil { !session.marks.isEmpty || session.errorMessage != nil }
        try #require(!session.marks.isEmpty)
        try #require(session.placements.count == 1)
    }

    private func makePDF(in folder: URL) throws -> URL {
        let url = folder.appendingPathComponent("original.pdf")
        try blankPDF(widths: [400, 400]).write(to: url)
        return url
    }
}
