import CoreGraphics
import Foundation
import ImageIO
import PDFCore
import PDFKit
import Testing
import UniformTypeIdentifiers
@testable import PDFToolbox

@MainActor
struct WatermarkSessionTests {
    private func opened(pages: Int = 2) async throws -> (session: WatermarkSession, source: URL, folder: URL) {
        let folder = try temporaryFolder()
        let source = folder.appendingPathComponent("Report.pdf")
        try demoPDF(title: "Report", pages: pages, color: 0).write(to: source)
        let session = WatermarkSession()
        session.open(source)
        try await waitUntil { session.state == .ready && session.overlay(for: session.settings) != nil }
        return (session, source, folder)
    }

    @Test func severalWatermarksLiveOnThePageEachWithItsOwnSettings() async throws {
        let (session, _, folder) = try await opened(pages: 2)
        defer { try? FileManager.default.removeItem(at: folder) }
        #expect(session.marks.count == 1 && !session.canRemove, "The one watermark of the start cannot go: the screen needs one to edit")
        let first = session.settings.id
        session.addPlacement()
        #expect(session.marks.count == 2 && session.settings.id != first, "The copy is the selected one")
        session.update { $0.text = "BROUILLON"; $0.center = CGPoint(x: 0.2, y: 0.2) }
        session.select(first)
        #expect(session.settings.text != "BROUILLON", "Each watermark keeps its own text")
        #expect(session.marks.map(\.content).count == 2 && session.canRemove)
        session.addPlacement()
        let third = session.settings.id
        session.select(first)
        session.removePlacement()
        #expect(session.marks.count == 2 && session.settings.id != first && session.settings.id != third, "The one placed before the removed one is selected")
        session.select(third)
        session.removePlacement()
        session.undo()
        #expect(session.marks.count == 2, "The removed watermark is back")
        let output = folder.appendingPathComponent("two.pdf")
        await session.saveCopy(to: output)
        let text = try #require(PDFDocument(url: output)?.page(at: 0)?.string)
        #expect(text.contains("BROUILLON") && (text.contains("CONFIDENTIEL") || text.contains("CONFIDENTIAL")), "Both watermarks are in the copy")
        session.undo()
        #expect(session.layout.marks.count == 3, "The step before brought the third watermark back")
    }

    @Test func aCopyGoesOnThePageOnScreenAndTheSelectionFollowsThePages() async throws {
        let (session, _, folder) = try await opened(pages: 5)
        defer { try? FileManager.default.removeItem(at: folder) }
        session.update { $0.allPages = false; $0.firstPage = 0; $0.lastPage = 0 }
        let first = session.settings.id
        session.goToPage(4)
        session.addPlacement()
        let copy = session.settings.id
        #expect(copy != first && session.mark?.pages == 0...4, "The copy reaches the page the user looks at")
        session.update { $0.firstPage = 4 }
        session.select(first)
        session.goToPage(2)
        #expect(session.settings.id == first, "No watermark on this page: the selection stays")
        session.goToPage(4)
        #expect(session.settings.id == copy, "On a page, a watermark of that page is selected")
        session.goToPage(0)
        #expect(session.settings.id == first)
    }

    @Test func anEmptyWatermarkCannotBeSavedAndGoesWhenAnotherIsSelected() async throws {
        let (session, _, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        let first = session.settings.id
        session.addPlacement()
        session.update { $0.text = "   " }
        #expect(!session.canExport, "The selected watermark has nothing to draw")
        #expect(session.layout.marks.count == 2)
        session.select(first)
        #expect(session.layout.marks.count == 1 && session.canExport, "The empty one is gone with the selection")
        session.update { $0.text = "" }
        session.select(first)
        #expect(session.layout.marks.count == 1 && !session.canExport, "The last watermark stays, empty or not")
    }

    @Test func selectingAnotherWatermarkClosesTheEditStillMoving() async throws {
        let (session, _, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        let first = session.settings.id
        session.addPlacement()
        let second = session.settings.id
        session.select(first)
        session.update(final: false) { $0.opacity = 0.9 }
        session.select(second)
        session.update(final: false) { $0.opacity = 0.8 }
        session.update { _ in }
        session.undo()
        #expect(session.layout.marks.map(\.opacity) == [0.9, 0.3], "The second edit goes alone")
        session.undo()
        #expect(session.layout.marks.map(\.opacity) == [0.3, 0.3])
    }

    @Test func savesAWatermarkedCopyAndLeavesTheOriginal() async throws {
        let (session, source, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        let original = try Data(contentsOf: source)
        session.update { $0.text = "BROUILLON" }
        #expect(session.hasUnexportedChanges)
        let output = folder.appendingPathComponent("Report-filigrane.pdf")
        await session.saveCopy(to: output)
        #expect(session.errorMessage == nil)
        #expect(session.lastSavedURL == output)
        #expect(!session.hasUnexportedChanges)
        let saved = try #require(PDFDocument(url: output))
        #expect((0..<saved.pageCount).allSatisfy { saved.page(at: $0)?.string?.contains("BROUILLON") == true })
        #expect(try Data(contentsOf: source) == original)
    }

    @Test func refusesTheOriginalAsDestination() async throws {
        let (session, source, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        let original = try Data(contentsOf: source)
        await session.saveCopy(to: source)
        #expect(session.errorMessage != nil)
        #expect(try Data(contentsOf: source) == original)
    }

    @Test func keepsEverySettingInRange() async throws {
        let (session, _, folder) = try await opened(pages: 3)
        defer { try? FileManager.default.removeItem(at: folder) }
        session.update {
            $0.center = CGPoint(x: 2, y: -1)
            $0.width = 5
            $0.angle = 200
            $0.opacity = 0
            $0.allPages = false
            $0.firstPage = 7
            $0.lastPage = 0
        }
        #expect(session.settings.center == CGPoint(x: 1, y: 0))
        #expect(session.settings.width == 1)
        #expect(session.settings.angle == 90)
        #expect(session.settings.opacity == 0.1)
        #expect(session.mark?.pages == 2...2)
    }

    @Test func aSliderGestureIsOneUndoStep() async throws {
        let (session, _, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        session.update(final: false) { $0.opacity = 0.5 }
        session.update(final: false) { $0.opacity = 0.7 }
        session.update { _ in }
        #expect(session.settings.opacity == 0.7)
        session.undo()
        #expect(session.settings.opacity == 0.3)
        #expect(!session.canUndo)
    }

    @Test func aPendingEditIsItsOwnUndoStepAndAnUnsavedChange() async throws {
        let (session, _, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        session.update(final: false) { $0.color = WatermarkColor(red: 0, green: 0, blue: 1) }
        #expect(session.hasUnexportedChanges)
        session.update { $0.center = CGPoint(x: 0.2, y: 0.2) }
        session.undo()
        #expect(session.settings.center == CGPoint(x: 0.5, y: 0.5))
        #expect(session.settings.color == WatermarkColor(red: 0, green: 0, blue: 1))
        session.undo()
        #expect(session.settings.color == .stamp)
    }

    @Test func aTallLogoFitsThePageAndClearsAnOldError() async throws {
        let (session, _, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        let wrong = folder.appendingPathComponent("notes.png")
        try Data("not an image".utf8).write(to: wrong)
        session.importImage(wrong)
        try await waitUntil { session.errorMessage != nil }
        let logo = folder.appendingPathComponent("tall.png")
        try png(width: 60, height: 240).write(to: logo)
        session.importImage(logo)
        try await waitUntil { session.settings.kind == .image }
        #expect(session.errorMessage == nil)
        let page = try #require(session.pageSizes.first)
        let box = try #require(session.mark).boundingSize(pageWidth: page.width)
        #expect(box.height <= 0.9 * page.height + 0.001)
    }

    @Test func limitsTheTextAndCannotSaveItEmpty() async throws {
        let (session, _, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        session.update { $0.text = String(repeating: "A", count: 100) }
        #expect(session.settings.text.count == Watermark.maxTextLength)
        session.update { $0.text = "   " }
        #expect(session.mark == nil)
        #expect(!session.canExport)
    }

    @Test func anImageStartsStraightAndUndoBringsTheTextBack() async throws {
        let (session, _, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        let logo = folder.appendingPathComponent("logo.png")
        try png(width: 120, height: 60).write(to: logo)
        session.importImage(logo)
        try await waitUntil { session.settings.kind == .image }
        #expect(session.settings.angle == 0)
        session.undo()
        #expect(session.settings.kind == .text)
        #expect(session.settings.angle == 45)
    }

    private func png(width: Int, height: Int) throws -> Data {
        let context = try #require(CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
                                             space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
        context.setFillColor(CGColor(red: 0.1, green: 0.3, blue: 0.8, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        let image = try #require(context.makeImage())
        let data = NSMutableData()
        let destination = try #require(CGImageDestinationCreateWithData(data, UTType.png.identifier as CFString, 1, nil))
        CGImageDestinationAddImage(destination, image, nil)
        try #require(CGImageDestinationFinalize(destination))
        return data as Data
    }
}
