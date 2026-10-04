import Foundation
import PDFKit
import Testing
@testable import PDFToolbox

@MainActor
struct OrganizingSessionTests {
    @Test func editsUndoAndExportPreserveSourcePages() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let source = try makePDF(in: folder, pages: 3)
        let original = try Data(contentsOf: source)
        let session = try await readySession(source)
        #expect(!session.hasUnexportedChanges)
        session.move(id: 0, before: nil)
        #expect(session.pages.map(\.id) == [1, 2, 0])
        session.rotate(id: 2)
        session.remove(id: 1)
        #expect(session.pages.map(\.id) == [2, 0])
        let output = folder.appendingPathComponent("organized.pdf")
        try await session.export(to: output)
        let saved = try #require(PDFDocument(url: output))
        #expect(saved.pageCount == 2)
        #expect(saved.page(at: 0)?.bounds(for: .mediaBox).width == 402)
        #expect(saved.page(at: 0)?.rotation == 90)
        #expect(saved.page(at: 1)?.bounds(for: .mediaBox).width == 400)
        #expect(!session.hasUnexportedChanges)
        #expect(session.lastSavedURL == output)
        #expect(try Data(contentsOf: source) == original)
        session.rotate(id: 0)
        #expect(session.hasUnexportedChanges)
        session.undo()
        #expect(!session.hasUnexportedChanges)
        session.undo()
        #expect(session.pages.map(\.id) == [1, 2, 0])
        session.undo()
        #expect(session.pages.allSatisfy { $0.rotation == 0 })
        session.undo()
        #expect(session.pages.map(\.id) == [0, 1, 2])
    }

    @Test func movesRejectInvalidTargetsAndLastPageCannotBeRemoved() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let session = try await readySession(makePDF(in: folder, pages: 3))
        session.move(id: 0, before: 0)
        session.move(id: 0, before: 999)
        session.moveLeft(id: 0)
        session.moveRight(id: 2)
        #expect(!session.canUndo)
        session.moveRight(id: 0)
        #expect(session.pages.map(\.id) == [1, 0, 2])
        session.moveLeft(id: 2)
        #expect(session.pages.map(\.id) == [1, 2, 0])
        session.undo()
        session.undo()
        #expect(session.pages.map(\.id) == [0, 1, 2])
        session.remove(id: 0)
        session.remove(id: 1)
        session.remove(id: 2)
        #expect(session.pages.map(\.id) == [2])
        #expect(session.canExport)
        session.undo()
        #expect(session.pages.map(\.id) == [1, 2])
    }

    @Test func protectsOriginalSymlinksAndHardlinksAndCanRetryAfterWriteFailure() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let source = try makePDF(in: folder)
        let original = try Data(contentsOf: source)
        let symlink = folder.appendingPathComponent("symlink.pdf")
        let hardlink = folder.appendingPathComponent("hardlink.pdf")
        try FileManager.default.createSymbolicLink(at: symlink, withDestinationURL: source)
        try FileManager.default.linkItem(at: source, to: hardlink)
        let session = try await readySession(source)
        session.rotate(id: 0)
        for destination in [source, symlink, hardlink] {
            await #expect(throws: OrganizingSession.ExportError.self) { try await session.export(to: destination) }
        }
        #expect(try Data(contentsOf: source) == original)
        await #expect(throws: (any Error).self) { try await session.export(to: folder.appendingPathComponent("missing/copy.pdf")) }
        #expect(!session.isBusy)
        #expect(session.canExport)
        #expect(session.hasUnexportedChanges)
        try await session.export(to: folder.appendingPathComponent("copy.pdf"))
        #expect(!session.hasUnexportedChanges)
    }

    @Test func passwordCanBeRetriedAndExportedCopyIsUnlocked() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let source = try makePDF(in: folder)
        let locked = folder.appendingPathComponent("locked.pdf")
        let document = try #require(PDFDocument(url: source))
        try #require(document.write(to: locked, withOptions: [.userPasswordOption: "secret", .ownerPasswordOption: "owner"]))
        let session = OrganizingSession()
        session.open(locked)
        try await waitUntil { !session.isBusy }
        #expect(session.needsPassword)
        #expect(!session.canExport)
        session.unlock(password: "wrong")
        try await waitUntil { !session.isBusy }
        #expect(session.needsPassword)
        #expect(session.errorMessage != nil)
        session.unlock(password: "secret")
        try await waitUntil { !session.isBusy }
        #expect(session.canExport)
        #expect(session.isEncrypted)
        #expect(session.errorMessage == nil)
        let output = folder.appendingPathComponent("unlocked.pdf")
        try await session.export(to: output)
        let saved = try #require(PDFDocument(url: output))
        #expect(!saved.isLocked)
        #expect(PDFDocument(url: locked)?.isLocked == true)
    }

    @Test func resetAndNewImportDiscardStaleTasks() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let source = try makePDF(in: folder, pages: 3)
        let session = OrganizingSession()
        session.open(source)
        session.reset()
        try await Task.sleep(for: .milliseconds(50))
        #expect(session.pages.isEmpty)
        #expect(session.documentName == nil)
        #expect(!session.isBusy)
        session.open(source)
        try await waitUntil { !session.isBusy }
        let thumbnailTask = Task { await session.thumbnail(pageID: 0) }
        await Task.yield()
        session.reset()
        _ = await thumbnailTask.value
        #expect(session.cachedThumbnailCount == 0)
        #expect(session.pages.isEmpty)
        #expect(!session.canUndo)
        #expect(!session.hasUnexportedChanges)
        session.open(source)
        session.open(try makePDF(in: folder, name: "replacement", pages: 1))
        try await waitUntil { !session.isBusy }
        #expect(session.documentName == "replacement.pdf")
        #expect(session.pages.count == 1)
    }

    @Test func thumbnailsAreBoundedAndRotationDoesNotRenderAgain() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let source = try makePDF(in: folder, pages: 34)
        let session = try await readySession(source)
        for id in 0..<34 {
            let image = try #require(await session.thumbnail(pageID: id))
            #expect(max(image.width, image.height) == 240)
        }
        #expect(session.cachedThumbnailCount == 32)
        let before = try #require(await session.thumbnail(pageID: 33))
        session.rotate(id: 33)
        let after = try #require(await session.thumbnail(pageID: 33))
        #expect(before === after)
        _ = try #require(await session.thumbnail(pageID: 0))
        #expect(session.cachedThumbnailCount == 32)
        try FileManager.default.removeItem(at: source)
        let preview = try await session.pagePreview(pageID: 33)
        #expect(max(preview.width, preview.height) == 1600)
        #expect(session.cachedThumbnailCount == 32)
    }

    @Test func historyKeepsOnlyOneHundredEdits() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let session = try await readySession(makePDF(in: folder))
        for _ in 0..<101 { session.rotate(id: 0) }
        for _ in 0..<100 { session.undo() }
        #expect(!session.canUndo)
        #expect(session.pages[0].rotation == 90)
        #expect(session.hasUnexportedChanges)
    }

    @Test func cancelledThumbnailRequestDoesNotPopulateCache() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let session = try await readySession(makePDF(in: folder))
        let request = Task { await session.thumbnail(pageID: 0) }
        request.cancel()
        #expect(await request.value == nil)
        #expect(session.cachedThumbnailCount == 0)
    }

    private func readySession(_ url: URL) async throws -> OrganizingSession {
        let session = OrganizingSession()
        session.open(url)
        try await waitUntil { !session.isBusy }
        try #require(session.canExport)
        return session
    }

    private func makePDF(in folder: URL, name: String = "source", pages: Int = 1) throws -> URL {
        let url = folder.appendingPathComponent(name + ".pdf")
        try blankPDF(widths: (0..<pages).map { 400 + $0 }).write(to: url)
        return url
    }
}
