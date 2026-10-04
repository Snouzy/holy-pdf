import Foundation
import ScanCore
import Testing
import TestSupport
@testable import ScanSession

@MainActor
struct ImportTests {
    let contract = [FakePages.line("CONTRACT", y: 0.1, height: 0.04), FakePages.line("Pagina 1 din 2", y: 0.95)]
    let contractEnd = [FakePages.line("Pagina 2 din 2", y: 0.95)]
    let invoice = [FakePages.line("FACTURA", y: 0.1, height: 0.04)]

    func files(_ session: ScannerSession, _ ids: [UUID]) -> [String] {
        ids.compactMap { session.pages[$0]?.url.lastPathComponent }
    }

    @Test func photosBecomeDocumentsWhenTheirImportIsDone() async throws {
        let fake = FakePages(lines: ["a.heic": contract, "b.heic": contractEnd, "c.jpg": invoice])
        let session = fake.session()
        session.add(try photos("c.jpg", "b.heic", "a.heic"))
        #expect(files(session, session.pending) == ["a.heic", "b.heic", "c.jpg"])
        #expect(session.documents.isEmpty)
        await session.waitUntilIdle()
        #expect(session.pending.isEmpty)
        #expect(session.documents.map(\.name) == ["2026-01-05_Contract", "2026-01-05_Factura"])
        #expect(files(session, session.documents[0].pageIDs) == ["a.heic", "b.heic"])
    }

    @Test func anUnsupportedFileIsUnreadableRightAway() async throws {
        let fake = FakePages()
        let session = fake.session()
        session.add(try photos("a.heic", "notes.txt"))
        #expect(files(session, session.unreadable) == ["notes.txt"])
        await session.waitUntilIdle()
        #expect(await fake.log.calls.map(\.file) == ["a.heic"])
    }

    @Test func aPhotoThatFailsJoinsTheUnreadablePages() async throws {
        let fake = FakePages(failing: ["b.heic"])
        let session = fake.session()
        session.add(try photos("a.heic", "b.heic"))
        await session.waitUntilIdle()
        #expect(files(session, session.unreadable) == ["b.heic"])
        #expect(session.documents.flatMap(\.pageIDs).count == 1)
    }

    @Test func aFolderAddsItsPhotosButNotHiddenFilesOrSubfolders() async throws {
        let folder = try TestImages.emptyFolder()
        for name in ["b.png", "a.heic", ".DS_Store"] {
            try Data().write(to: folder.appending(path: name))
        }
        try FileManager.default.createDirectory(at: folder.appending(path: "old"), withIntermediateDirectories: true)
        try Data().write(to: folder.appending(path: "old/c.heic"))
        let session = FakePages().session()
        session.add([folder])
        #expect(files(session, session.pending) == ["a.heic", "b.png"])
        #expect(session.unreadable.isEmpty)
    }

    @Test func aPhotoAddedTwiceIsSkipped() throws {
        let session = FakePages().session()
        let urls = try photos("a.heic")
        session.add(urls)
        session.add(urls)
        #expect(session.pages.count == 1)
    }

    @Test func rendersRunAtMostConcurrencyAtOnce() async throws {
        let fake = FakePages(delay: .milliseconds(20))
        let session = fake.session(concurrency: 2)
        session.add(try photos("1.heic", "2.heic", "3.heic", "4.heic", "5.heic", "6.heic"))
        await session.waitUntilIdle()
        #expect(await fake.log.calls.count == 6)
        #expect(await fake.log.mostAtOnce == 2)
    }

    @Test func aSecondImportAddsItsOwnDocumentsWithFreeNames() async throws {
        let fake = FakePages(lines: ["a.heic": invoice, "b.heic": invoice])
        let session = fake.session()
        session.add(try photos("a.heic"))
        await session.waitUntilIdle()
        session.add(try photos("b.heic"))
        await session.waitUntilIdle()
        #expect(session.documents.map(\.name) == ["2026-01-05_Factura", "2026-01-05_Factura-2"])
    }

    @Test func theRealPipelineRendersASyntheticPhoto() async throws {
        let session = ScannerSession()
        session.add([TestImages.write(SyntheticPage().render(), type: .png)])
        await session.waitUntilIdle()
        let id = try #require(session.documents.first?.pageIDs.first)
        let result = try #require(session.pages[id]?.status.result)
        #expect(result.thumbnail?.height == Thumbnail.maxPixelSize)
        #expect(result.processed.pixelSize == PixelSize(width: 1654, height: 2339))
    }
}
