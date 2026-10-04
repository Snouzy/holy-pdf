import Foundation
import ScanCore
import Testing
import TestSupport
@testable import ScanSession

@MainActor
struct EditTests {
    let quad = Quad(topLeft: .init(x: 0.1, y: 0.1), topRight: .init(x: 0.9, y: 0.12),
                    bottomRight: .init(x: 0.92, y: 0.9), bottomLeft: .init(x: 0.08, y: 0.88))

    func onePage(_ fake: FakePages = FakePages()) async throws -> (ScannerSession, UUID) {
        let session = fake.session()
        session.add(try photos("a.heic"))
        await session.waitUntilIdle()
        return (session, try #require(session.pages.keys.first))
    }

    @Test func movedCornersRenderAgainWithTheFirstDetection() async throws {
        let fake = FakePages()
        let (session, page) = try await onePage(fake)
        let first = try #require(session.pages[page]?.status.result?.processed.detection)
        session.setQuad(quad, for: page, undoManager: nil)
        await session.waitUntilIdle()
        let call = try #require(await fake.log.calls.last)
        #expect(call.edits.quad == quad)
        #expect(call.detection == first)
        #expect(session.pages[page]?.status.result?.processed.quad == quad)
    }

    @Test func anUnusableQuadChangesNothing() async throws {
        let fake = FakePages()
        let (session, page) = try await onePage(fake)
        let crossed = Quad(topLeft: quad.topRight, topRight: quad.topLeft, bottomRight: quad.bottomRight, bottomLeft: quad.bottomLeft)
        session.setQuad(crossed, for: page, undoManager: nil)
        await session.waitUntilIdle()
        #expect(await fake.log.calls.count == 1)
        #expect(session.pages[page]?.edits.quad == nil)
    }

    @Test func automaticDetectionComesBack() async throws {
        let (session, page) = try await onePage()
        session.setQuad(quad, for: page, undoManager: nil)
        session.setQuad(nil, for: page, undoManager: nil)
        await session.waitUntilIdle()
        #expect(session.pages[page]?.status.result?.processed.quad == .fullImage)
    }

    @Test func erasedAreasTurnWithThePage() async throws {
        let (session, page) = try await onePage()
        let mark = EraseMark.stroke(points: [.init(x: 0.2, y: 0.1)], radius: 0.05)
        session.addErase(mark, to: page, undoManager: nil)
        session.rotate(page, undoManager: nil)
        session.rotate(page, undoManager: nil)
        let portrait = PixelSize(width: 1654, height: 2339), landscape = PixelSize(width: 2339, height: 1654)
        #expect(session.pages[page]?.edits.quarterTurns == 2)
        #expect(session.pages[page]?.edits.erase == [mark.rotated(quarterTurns: 1, pageSize: portrait).rotated(quarterTurns: 1, pageSize: landscape)])
    }

    @Test func aReRenderKeepsTheTurnFoundAtImport() async throws {
        let fake = FakePages(quarterTurns: ["a.heic": 1])
        let (session, page) = try await onePage(fake)
        session.setMode(.color, for: page, undoManager: nil)
        await session.waitUntilIdle()
        let call = try #require(await fake.log.calls.last)
        #expect(call.edits.quarterTurns == 1)
        #expect(call.edits.mode == .color)
        #expect(call.edits.keepWatermark == false)
    }

    @Test func undoAndRedoRestoreTheRenderedPage() async throws {
        let (session, page) = try await onePage()
        session.describeAction = { "action \($0)" }
        let undo = undoManager()
        grouped(undo) { session.setMode(.color, for: page, undoManager: undo) }
        #expect(undo.undoActionName == "action rendering")
        await session.waitUntilIdle()
        undo.undo()
        await session.waitUntilIdle()
        #expect(session.pages[page]?.status.result?.processed.settings.mode == .document)
        undo.redo()
        await session.waitUntilIdle()
        #expect(session.pages[page]?.status.result?.processed.settings.mode == .color)
    }

    @Test func undoingARotationGoesBackToTheImportTurn() async throws {
        let (session, page) = try await onePage(FakePages(quarterTurns: ["a.heic": 1]))
        let undo = undoManager()
        grouped(undo) { session.rotate(page, undoManager: undo) }
        await session.waitUntilIdle()
        #expect(session.pages[page]?.status.result?.processed.quarterTurns == 2)
        undo.undo()
        await session.waitUntilIdle()
        #expect(session.pages[page]?.status.result?.processed.quarterTurns == 1)
    }

    @Test func anEditThatChangesNothingIsNotRecorded() async throws {
        let fake = FakePages()
        let (session, page) = try await onePage(fake)
        let undo = undoManager()
        grouped(undo) { session.setMode(.document, for: page, undoManager: undo) }
        await session.waitUntilIdle()
        #expect(await fake.log.calls.count == 1)
    }

    @Test func onlyTheNewestRenderLands() async throws {
        let (session, page) = try await onePage(FakePages(slowColorRenders: true))
        session.setMode(.color, for: page, undoManager: nil)
        session.setMode(.document, for: page, undoManager: nil)
        await session.waitUntilIdle()
        #expect(session.pages[page]?.status.result?.processed.settings.mode == .document)
    }

    @Test func quickEditsWaitForTheRunningRender() async throws {
        let fake = FakePages(delay: .milliseconds(50))
        let (session, page) = try await onePage(fake)
        session.rotate(page, undoManager: nil)
        session.rotate(page, undoManager: nil)
        session.rotate(page, undoManager: nil)
        await session.waitUntilIdle()
        #expect(await fake.log.calls.count <= 3)
        #expect(session.pages[page]?.status.result?.processed.quarterTurns == 3)
    }

    @Test func undoShowsThePageItChanges() async throws {
        let session = FakePages().session()
        session.add(try photos("a.heic", "b.heic"))
        await session.waitUntilIdle()
        let ids = Dictionary(uniqueKeysWithValues: session.pages.values.map { ($0.url.lastPathComponent, $0.id) })
        let a = try #require(ids["a.heic"]), b = try #require(ids["b.heic"])
        var shown: [UUID] = []
        session.showPage = { shown.append($0) }
        let undo = undoManager()
        grouped(undo) { session.setMode(.color, for: a, undoManager: undo) }
        grouped(undo) { session.setMode(.color, for: b, undoManager: undo) }
        await session.waitUntilIdle()
        undo.undo()
        undo.undo()
        await session.waitUntilIdle()
        #expect(shown == [b, a])
    }

    @Test func aFailedReRenderKeepsTheLastGoodRender() async throws {
        let (session, page) = try await onePage(FakePages(failingReRenders: ["a.heic"]))
        session.setMode(.color, for: page, undoManager: nil)
        await session.waitUntilIdle()
        guard case .failed(_, let previous)? = session.pages[page]?.status else {
            Issue.record("the re-render should have failed")
            return
        }
        #expect(previous?.processed.settings.mode == .document)
    }

    @Test func anEditMakesItsDocumentUnexported() async throws {
        let (session, page) = try await onePage()
        session.documents[0].exported = true
        session.setFormat(.a5, for: page, undoManager: nil)
        #expect(!session.documents[0].exported)
    }

    @Test func anUnusableQuadIsRefused() async throws {
        let (session, page) = try await onePage()
        let crossed = Quad(topLeft: quad.topRight, topRight: quad.topLeft, bottomRight: quad.bottomRight, bottomLeft: quad.bottomLeft)
        #expect(!session.setQuad(crossed, for: page, undoManager: nil))
        #expect(session.setQuad(quad, for: page, undoManager: nil))
    }
}
