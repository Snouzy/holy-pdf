import Foundation
import PDFKit
import Testing
@testable import PDFToolbox

@MainActor
struct MergeSessionTests {
    @Test func importsInChosenOrderAndRestoresMovesAndDeletions() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let urls = try ["third", "first", "second"].enumerated().map {
            try makePDF(in: folder, name: $0.element, pages: $0.offset + 1)
        }
        let session = try await readySession(urls)
        let original = session.items.map(\.id)
        #expect(session.items.map(\.name) == ["third.pdf", "first.pdf", "second.pdf"])
        #expect(session.totalPages == 6)
        #expect(session.canExport)
        session.moveDown(original[0])
        #expect(session.items.map(\.id) == [original[1], original[0], original[2]])
        session.undo()
        #expect(session.items.map(\.id) == original)
        session.move(id: original[0], to: .after(original[2]))
        #expect(session.items.map(\.id) == [original[1], original[2], original[0]])
        session.undo()
        session.move(id: original[0], to: .end)
        #expect(session.items.map(\.id) == [original[1], original[2], original[0]])
        session.undo()
        session.moveUp(original[2])
        #expect(session.items.map(\.id) == [original[0], original[2], original[1]])
        session.undo()
        session.move(id: original[2], before: original[0])
        #expect(session.items.map(\.id) == [original[2], original[0], original[1]])
        session.undo()
        session.remove(original[1])
        #expect(session.items.map(\.id) == [original[0], original[2]])
        #expect(session.totalPages == 4)
        session.undo()
        #expect(session.items.map(\.id) == original)
        #expect(session.totalPages == 6)
        let output = folder.appendingPathComponent("ordered.pdf")
        await session.saveCopy(to: output)
        try #require(session.errorMessage == nil)
        let merged = try #require(PDFDocument(url: output))
        let widths = (0..<merged.pageCount).compactMap { merged.page(at: $0)?.bounds(for: .mediaBox).width }
        #expect(widths == [401, 402, 402, 403, 403, 403])
    }

    @Test func protectsEverySourceItsAliasesAndASourceKeptForUndo() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let urls = try (1...3).map { try makePDF(in: folder, name: "source-\($0)", pages: $0) }
        let originals = try urls.map { try Data(contentsOf: $0) }
        let session = try await readySession(urls)
        let symlink = folder.appendingPathComponent("alias.pdf")
        let hardlink = folder.appendingPathComponent("hardlink.pdf")
        try FileManager.default.createSymbolicLink(at: symlink, withDestinationURL: urls[0])
        try FileManager.default.linkItem(at: urls[1], to: hardlink)
        session.remove(session.items[2].id)
        for url in urls + [symlink, hardlink] {
            await session.saveCopy(to: url)
            #expect(session.errorMessage != nil)
            #expect(session.lastSavedURL == nil)
            #expect(session.hasUnexportedChanges)
        }
        for (url, original) in zip(urls, originals) { #expect(try Data(contentsOf: url) == original) }
        let output = folder.appendingPathComponent("merged.pdf")
        await session.saveCopy(to: output)
        #expect(session.errorMessage == nil)
        #expect(session.lastSavedURL == output)
        #expect(!session.hasUnexportedChanges)
        #expect(PDFDocument(url: output)?.pageCount == 3)
        session.moveDown(session.items[0].id)
        #expect(session.hasUnexportedChanges)
        session.undo()
        #expect(!session.hasUnexportedChanges)
    }

    @Test func unreadableFilesBlockExportUntilRemovedAndUndoRestoresTheBlocker() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let valid = try (1...2).map { try makePDF(in: folder, name: "valid-\($0)") }
        let invalid = folder.appendingPathComponent("invalid.pdf")
        try Data("This is not a PDF".utf8).write(to: invalid)
        let session = MergeSession()
        session.add([valid[0], invalid, valid[1]])
        try await waitUntil { !session.isBusy }
        #expect(session.items.map(\.name) == ["valid-1.pdf", "invalid.pdf", "valid-2.pdf"])
        let failed = try #require(session.items.first { $0.name == "invalid.pdf" })
        guard case .failed = failed.status else { Issue.record("Unreadable source must fail"); return }
        #expect(!session.canExport)
        let output = folder.appendingPathComponent("blocked.pdf")
        await session.saveCopy(to: output)
        #expect(!FileManager.default.fileExists(atPath: output.path))
        session.remove(failed.id)
        #expect(session.canExport)
        session.undo()
        #expect(!session.canExport)
    }

    @Test func lockedPDFCanBeRetriedAndItsMergedCopyIsUnlocked() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let plain = try makePDF(in: folder, name: "plain")
        let locked = folder.appendingPathComponent("locked.pdf")
        let document = try #require(PDFDocument(url: plain))
        try #require(document.write(to: locked, withOptions: [.userPasswordOption: "secret", .ownerPasswordOption: "owner"]))
        let session = MergeSession()
        session.add([locked, plain])
        try await waitUntil { !session.isBusy }
        let id = try #require(session.items.first?.id)
        guard case .locked = session.items[0].status else { Issue.record("Password-protected PDF must stay locked"); return }
        #expect(!session.canExport)
        session.unlock(id: id, password: "wrong")
        try await waitUntil { !session.isBusy }
        guard case .locked = session.items[0].status else { Issue.record("Wrong password must keep the source locked"); return }
        #expect(session.errorMessage != nil)
        session.unlock(id: id, password: "secret")
        try await waitUntil { !session.isBusy }
        #expect(session.errorMessage == nil)
        #expect(session.canExport)
        #expect(session.hasEncryptedSources)
        let output = folder.appendingPathComponent("unlocked.pdf")
        await session.saveCopy(to: output)
        try #require(session.errorMessage == nil)
        let saved = try #require(PDFDocument(url: output))
        #expect(!saved.isLocked)
        #expect(saved.pageCount == 2)
        #expect(PDFDocument(url: locked)?.isLocked == true)
    }

    @Test func failedWriteLeavesTheMergeReadyForAnotherAttempt() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let urls = try (1...2).map { try makePDF(in: folder, name: "source-\($0)") }
        let session = try await readySession(urls)
        let order = session.items.map(\.id)
        await session.saveCopy(to: folder.appendingPathComponent("missing/output.pdf"))
        #expect(!session.isBusy)
        #expect(session.canExport)
        #expect(session.errorMessage != nil)
        #expect(session.hasUnexportedChanges)
        #expect(session.items.map(\.id) == order)
        await session.saveCopy(to: folder.appendingPathComponent("retry.pdf"))
        #expect(session.errorMessage == nil)
        #expect(!session.hasUnexportedChanges)
    }

    @Test func resetDuringImportOrPreviewKeepsTheNewSessionEmpty() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let urls = try (1...2).map { try makePDF(in: folder, name: "source-\($0)") }
        let session = MergeSession()
        session.add(urls)
        session.reset()
        try await Task.sleep(for: .milliseconds(100))
        #expect(session.items.isEmpty)
        #expect(!session.isBusy)
        #expect(!session.canUndo)
        session.add(urls)
        try await waitUntil { !session.isBusy }
        let id = try #require(session.items.first?.id)
        let previewTask = Task { await session.loadPreview(id: id) }
        await Task.yield()
        session.reset()
        await previewTask.value
        #expect(session.items.isEmpty)
        #expect(!session.isBusy)
        #expect(!session.hasUnexportedChanges)
        #expect(session.errorMessage == nil)
    }

    @Test func thumbnailCacheEvictsOldPreviewsAndCanRenderThemAgain() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let url = try makePDF(in: folder, name: "small")
        let session = try await readySession(Array(repeating: url, count: 33))
        let ids = session.items.map(\.id)
        for id in ids { await session.loadPreview(id: id) }
        #expect(session.items.filter { $0.preview != nil }.count == 32)
        #expect(session.items.first?.preview == nil)
        await session.loadPreview(id: ids[0])
        #expect(session.items.first?.preview != nil)
        #expect(session.items[1].preview == nil)
        #expect(session.items.filter { $0.preview != nil }.count == 32)
        #expect(session.canExport)
    }

    @Test func fullPreviewUsesLoadedDataWithoutChangingThumbnailsOrExportState() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let url = try makePDF(in: folder, name: "preview", pages: 2)
        let session = try await readySession([url])
        let id = try #require(session.items.first?.id)
        await session.loadPreview(id: id)
        try FileManager.default.removeItem(at: url)
        let image = try await session.pagePreview(id: id, pageIndex: 1)
        #expect(max(image.width, image.height) == 1600)
        let thumbnail = try #require(session.items.first?.preview)
        #expect(max(thumbnail.width, thumbnail.height) == 240)
        #expect(!session.isBusy)
        #expect(session.hasUnexportedChanges)
        session.reset()
        await #expect(throws: (any Error).self) { try await session.pagePreview(id: id, pageIndex: 0) }
    }

    @Test func theMergedPreviewShowsEveryPageInTheListOrder() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        // Each file's pages have their own width: 402 points for the first, 403 for the second.
        let urls = try [2, 3].map { try makePDF(in: folder, name: "pages-\($0)", pages: $0) }
        let session = try await readySession(urls)
        let (two, three) = (session.items[0].id, session.items[1].id)
        let twoWide = try await session.pagePreview(id: two, pageIndex: 0).width
        let threeWide = try await session.pagePreview(id: three, pageIndex: 0).width
        try #require(twoWide != threeWide)
        let second = try await session.mergedPagePreview(at: 1).width, third = try await session.mergedPagePreview(at: 2).width
        #expect(second == twoWide && third == threeWide, "Page 3 is the first page of the second PDF")
        session.moveUp(three)
        let moved = try await session.mergedPagePreview(at: 2).width
        #expect(moved == threeWide, "Moved first, the three-page PDF still holds page 3")
        let last = try await session.mergedPagePreview(at: 3).width
        #expect(last == twoWide, "Page 4 is now the first page of the two-page PDF")
        await #expect(throws: (any Error).self) { try await session.mergedPagePreview(at: 5) }
        await #expect(throws: (any Error).self) { try await session.mergedPagePreview(at: -1) }
    }

    private func readySession(_ urls: [URL]) async throws -> MergeSession {
        let session = MergeSession()
        session.add(urls)
        try await waitUntil { !session.isBusy }
        try #require(session.items.count == urls.count)
        try #require(session.items.allSatisfy { $0.information != nil })
        return session
    }

    private func makePDF(in folder: URL, name: String, pages: Int = 1) throws -> URL {
        let url = folder.appendingPathComponent(name + ".pdf")
        try blankPDF(widths: Array(repeating: 400 + pages, count: pages)).write(to: url)
        return url
    }
}
