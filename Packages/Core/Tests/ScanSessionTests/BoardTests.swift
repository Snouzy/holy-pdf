import Foundation
import ScanCore
import Testing
import TestSupport
@testable import ScanSession

@MainActor
struct BoardTests {
    /// Documents [a] "Factura" and [b, c] "Contract"; c needs review.
    func board() async throws -> (ScannerSession, [String: UUID]) {
        let fake = FakePages(lines: [
            "a.heic": [FakePages.line("FACTURA", y: 0.1, height: 0.04)],
            "b.heic": [FakePages.line("CONTRACT", y: 0.1, height: 0.04), FakePages.line("Pagina 1 din 2", y: 0.95)],
            "c.heic": [FakePages.line("Pagina 2 din 2", y: 0.95)],
        ], needsReview: ["c.heic"])
        let session = fake.session()
        session.add(try photos("a.heic", "b.heic", "c.heic"))
        await session.waitUntilIdle()
        let ids = Dictionary(uniqueKeysWithValues: session.pages.values.map { ($0.url.lastPathComponent, $0.id) })
        return (session, ids)
    }

    func rows(_ session: ScannerSession) -> [[String]] {
        session.documents.map { $0.pageIDs.compactMap { session.pages[$0]?.url.lastPathComponent } }
    }

    @Test func renamingKeepsAFileSafeName() async throws {
        let (session, _) = try await board()
        let invoice = session.documents[0].id
        session.rename(invoice, to: " Facture/EDF ")
        #expect(session.documents[0].name == "Facture-EDF")
        session.rename(invoice, to: "  ")
        #expect(session.documents[0].name == "Facture-EDF")
    }

    @Test func renamingBackRestoresTheName() async throws {
        let (session, _) = try await board()
        let invoice = session.documents[0]
        session.documents[0].exported = true
        session.rename(invoice.id, to: "Facture EDF")
        session.rename(invoice.id, to: invoice.name)
        #expect(session.documents[0].name == invoice.name)
        #expect(!session.documents[0].exported)
    }

    @Test func renamingToTheSameNameKeepsTheExportFlag() async throws {
        let (session, _) = try await board()
        session.documents[0].exported = true
        session.rename(session.documents[0].id, to: session.documents[0].name)
        #expect(session.documents[0].exported)
    }

    @Test func aPageMovesToAnotherDocument() async throws {
        let (session, ids) = try await board()
        session.move(try #require(ids["c.heic"]), to: session.documents[0].id, at: 0, undoManager: nil)
        #expect(rows(session) == [["c.heic", "a.heic"], ["b.heic"]])
    }

    @Test func aPageMovesForwardInItsDocument() async throws {
        let (session, ids) = try await board()
        session.move(try #require(ids["b.heic"]), to: session.documents[1].id, at: 2, undoManager: nil)
        #expect(rows(session) == [["a.heic"], ["c.heic", "b.heic"]])
    }

    @Test func movingTheLastPageRemovesTheEmptyDocument() async throws {
        let (session, ids) = try await board()
        session.move(try #require(ids["a.heic"]), to: session.documents[1].id, at: 2, undoManager: nil)
        #expect(rows(session) == [["b.heic", "c.heic", "a.heic"]])
    }

    @Test func aPageDroppedOnTheEmptySlotStartsADocument() async throws {
        let (session, ids) = try await board()
        session.moveToNewDocument(try #require(ids["c.heic"]), after: session.documents[1].id, undoManager: nil)
        #expect(rows(session) == [["a.heic"], ["b.heic"], ["c.heic"]])
        #expect(session.documents[2].name == "2026-01-05_Document-1")
    }

    @Test func deletingAPageRemovesIt() async throws {
        let (session, ids) = try await board()
        let page = try #require(ids["c.heic"])
        session.delete(page, undoManager: nil)
        #expect(rows(session) == [["a.heic"], ["b.heic"]])
        #expect(session.pages[page] == nil)
    }

    @Test func aDeletedQueuedPageIsNeverRendered() async throws {
        let fake = FakePages(delay: .milliseconds(50))
        let session = fake.session(concurrency: 1)
        session.add(try photos("a.heic", "b.heic"))
        let queued = try #require(session.pending.last)
        session.delete(queued, undoManager: nil)
        await session.waitUntilIdle()
        #expect(await fake.log.calls.map(\.file) == ["a.heic"])
        #expect(session.pending.isEmpty)
        #expect(session.documents.count == 1)
    }

    @Test func duplicateNamesIgnoreCase() async throws {
        let (session, _) = try await board()
        session.rename(session.documents[1].id, to: "2026-01-05_FACTURA")
        #expect(session.duplicateNames == ["2026-01-05_factura"])
    }

    @Test func aCheckedPageLeavesTheReviewList() async throws {
        let (session, ids) = try await board()
        let flagged = try #require(ids["c.heic"])
        #expect(session.pagesToReview == [flagged])
        session.markChecked(flagged)
        #expect(session.pagesToReview.isEmpty)
    }

    @Test func thePageAfterFollowsTheBoard() async throws {
        let (session, ids) = try await board()
        let a = try #require(ids["a.heic"]), b = try #require(ids["b.heic"]), c = try #require(ids["c.heic"])
        #expect(session.page(after: a) == b)
        #expect(session.page(after: c) == nil)
        #expect(session.page(after: a, reviewOnly: true) == c)
    }

    @Test func documentsStayUnexportedUntilWritten() async throws {
        let (session, _) = try await board()
        #expect(session.hasUnexportedDocuments)
    }

    @Test func deletingADocumentRemovesItsPagesEvenMidRender() async throws {
        let (session, _) = try await board()
        let contract = session.documents[1]
        session.setMode(.color, for: contract.pageIDs[0], undoManager: nil)
        session.deleteDocument(contract.id, undoManager: nil)
        await session.waitUntilIdle()
        #expect(session.documents.count == 1)
        #expect(contract.pageIDs.allSatisfy { session.pages[$0] == nil })
    }

    @Test func undoingAPageDeletionPutsThePageBackAndRedoDeletesItAgain() async throws {
        let (session, ids) = try await board()
        let b = try #require(ids["b.heic"])
        session.describeAction = { "action \($0)" }
        let undo = undoManager()
        grouped(undo) { session.delete(b, undoManager: undo) }
        #expect(undo.undoActionName == "action deletePage")
        undo.undo()
        #expect(rows(session) == [["a.heic"], ["b.heic", "c.heic"]])
        #expect(session.pages[b]?.status.result != nil)
        undo.redo()
        #expect(rows(session) == [["a.heic"], ["c.heic"]])
        #expect(session.pages[b] == nil)
    }

    @Test func undoingTheDeletionOfALastPageBringsItsDocumentBack() async throws {
        let (session, ids) = try await board()
        let a = try #require(ids["a.heic"])
        let invoice = session.documents[0]
        let undo = undoManager()
        grouped(undo) { session.delete(a, undoManager: undo) }
        undo.undo()
        #expect(rows(session) == [["a.heic"], ["b.heic", "c.heic"]])
        #expect(session.documents[0].id == invoice.id)
        #expect(session.documents[0].name == invoice.name)
    }

    @Test func undoingADocumentDeletionBringsItsPagesBackInOrder() async throws {
        let (session, _) = try await board()
        let order = session.documents.map(\.id)
        let undo = undoManager()
        grouped(undo) { session.deleteDocument(order[1], undoManager: undo) }
        #expect(rows(session) == [["a.heic"]])
        undo.undo()
        #expect(rows(session) == [["a.heic"], ["b.heic", "c.heic"]])
        #expect(session.documents.map(\.id) == order)
    }

    @Test func undoingADeletionKeepsAnImportThatSettledSince() async throws {
        let (session, ids) = try await board()
        let c = try #require(ids["c.heic"])
        let undo = undoManager()
        grouped(undo) { session.delete(c, undoManager: undo) }
        session.add(try photos("d.heic"))
        await session.waitUntilIdle()
        undo.undo()
        #expect(rows(session) == [["a.heic"], ["b.heic", "c.heic"], ["d.heic"]])
    }

    @Test func aPageDeletedMidRenderEndsRenderedAfterItsUndo() async throws {
        let fake = FakePages(gated: ["a.heic"])
        let session = fake.session()
        session.add(try photos("a.heic"))
        let page = try #require(session.pending.first)
        let undo = undoManager()
        grouped(undo) { session.delete(page, undoManager: undo) }
        undo.undo()
        await fake.gate.open()
        await session.waitUntilIdle()
        #expect(session.pages[page]?.status.result != nil)
        #expect(session.document(containing: page) != nil)
    }

    @Test func aPageWhoseRenderLandedWhileDeletedRendersAgainAfterItsUndo() async throws {
        let fake = FakePages(gated: ["a.heic"])
        let session = fake.session()
        session.add(try photos("a.heic"))
        let page = try #require(session.pending.first)
        let undo = undoManager()
        grouped(undo) { session.delete(page, undoManager: undo) }
        await fake.gate.open()
        await session.waitUntilIdle()
        undo.undo()
        await session.waitUntilIdle()
        #expect(session.pages[page]?.status.result != nil)
        #expect(session.document(containing: page) != nil)
    }

    @Test func undoingAMovePutsThePageBackInItsDocument() async throws {
        let (session, ids) = try await board()
        let b = try #require(ids["b.heic"])
        let undo = undoManager()
        grouped(undo) { session.move(b, to: session.documents[0].id, at: 1, undoManager: undo) }
        #expect(rows(session) == [["a.heic", "b.heic"], ["c.heic"]])
        undo.undo()
        #expect(rows(session) == [["a.heic"], ["b.heic", "c.heic"]])
        undo.redo()
        #expect(rows(session) == [["a.heic", "b.heic"], ["c.heic"]])
    }

    @Test func undoingTheMoveOfALastPageBringsItsDocumentBack() async throws {
        let (session, ids) = try await board()
        let a = try #require(ids["a.heic"])
        let invoice = session.documents[0]
        let undo = undoManager()
        grouped(undo) { session.move(a, to: session.documents[1].id, at: 1, undoManager: undo) }
        #expect(rows(session) == [["b.heic", "a.heic", "c.heic"]])
        undo.undo()
        #expect(rows(session) == [["a.heic"], ["b.heic", "c.heic"]])
        #expect(session.documents[0].id == invoice.id)
        #expect(session.documents[0].name == invoice.name)
    }

    @Test func aMoveToTheSamePlaceChangesNothing() async throws {
        let (session, ids) = try await board()
        let b = try #require(ids["b.heic"])
        session.documents[1].exported = true
        session.describeAction = { "action \($0)" }
        let undo = undoManager()
        grouped(undo) { session.move(b, to: session.documents[1].id, at: 1, undoManager: undo) }
        #expect(rows(session) == [["a.heic"], ["b.heic", "c.heic"]])
        #expect(session.documents[1].exported)
        #expect(undo.undoActionName == "")
    }

    @Test func undoingANewDocumentRemovesItAndRedoBringsTheSameOneBack() async throws {
        let (session, ids) = try await board()
        let c = try #require(ids["c.heic"])
        let undo = undoManager()
        grouped(undo) { session.moveToNewDocument(c, after: session.documents[1].id, undoManager: undo) }
        let created = try #require(session.documents.last)
        undo.undo()
        #expect(rows(session) == [["a.heic"], ["b.heic", "c.heic"]])
        undo.redo()
        #expect(rows(session) == [["a.heic"], ["b.heic"], ["c.heic"]])
        #expect(session.documents.last?.id == created.id)
        #expect(session.documents.last?.name == created.name)
    }

    @Test func oneUndoCoversAWholeRenaming() async throws {
        let (session, _) = try await board()
        let invoice = session.documents[0]
        session.describeAction = { "action \($0)" }
        let undo = undoManager()
        grouped(undo) {
            for text in ["F", "Fa", "Facture"] { session.rename(invoice.id, to: text) }
            session.finishRenaming(invoice.id, from: invoice.name, undoManager: undo)
        }
        #expect(undo.undoActionName == "action rename")
        undo.undo()
        #expect(session.documents[0].name == invoice.name)
        #expect(!undo.canUndo)
        undo.redo()
        #expect(session.documents[0].name == "Facture")
    }

    @Test func aDocumentThatAnUndoTouchesIsNotExportedAnyMore() async throws {
        let (session, ids) = try await board()
        let a = try #require(ids["a.heic"])
        let undo = undoManager()
        grouped(undo) { session.move(a, to: session.documents[1].id, at: 0, undoManager: undo) }
        session.documents[0].exported = true
        undo.undo()
        #expect(session.documents.count == 2)
        #expect(session.documents.allSatisfy { !$0.exported })
    }

    @Test func aBoardUndoShowsTheBoardAndNotAPage() async throws {
        let (session, ids) = try await board()
        let c = try #require(ids["c.heic"])
        var shown: [String] = []
        session.showPage = { _ in shown.append("page") }
        session.showBoard = { shown.append("board") }
        let undo = undoManager()
        grouped(undo) { session.delete(c, undoManager: undo) }
        undo.undo()
        undo.redo()
        #expect(shown == ["board", "board"])
    }

    @Test func undoGoesBackThroughADeletionThenThePreviousEdit() async throws {
        let (session, ids) = try await board()
        let a = try #require(ids["a.heic"]), b = try #require(ids["b.heic"])
        let undo = undoManager()
        grouped(undo) { session.setMode(.color, for: a, undoManager: undo) }
        await session.waitUntilIdle()
        grouped(undo) { session.delete(b, undoManager: undo) }
        undo.undo()
        await session.waitUntilIdle()
        #expect(rows(session) == [["a.heic"], ["b.heic", "c.heic"]])
        #expect(session.pages[a]?.status.result?.processed.settings.mode == .color)
        undo.undo()
        await session.waitUntilIdle()
        #expect(session.pages[a]?.status.result?.processed.settings.mode == .document)
    }
}
