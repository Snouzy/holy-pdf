import Foundation
import PDFCore
import PDFKit
import Testing
@testable import PDFToolbox

@MainActor
struct BookmarksSessionTests {
    private func opened(_ bookmarks: [PDFBookmark], pages: Int = 4) async throws -> (session: BookmarksSession, source: URL, folder: URL) {
        let folder = try temporaryFolder()
        let source = folder.appendingPathComponent("Book.pdf")
        try PDFBookmarks.written(try demoPDF(title: "Book", pages: pages, color: 0), bookmarks: bookmarks).write(to: source)
        let session = BookmarksSession()
        session.file.open(source)
        try await waitUntil { session.file.state == .ready }
        return (session, source, folder)
    }

    private func shown(_ session: BookmarksSession) -> [String] {
        session.rows.map { "\(String(repeating: ">", count: $0.bookmark.level))\($0.bookmark.title) p\($0.bookmark.pageIndex + 1)" }
    }

    @Test func listsTheBookmarksOfTheDocumentThenSavesTheChanges() async throws {
        let (session, source, folder) = try await opened([PDFBookmark(title: "Preface", pageIndex: 0), PDFBookmark(title: "End", pageIndex: 3)])
        defer { try? FileManager.default.removeItem(at: folder) }
        let original = try Data(contentsOf: source)
        #expect(shown(session) == ["Preface p1", "End p4"])
        #expect(!session.canSave && !session.file.hasUnsavedEdits, "Nothing changed yet: nothing to save")

        session.file.goToPage(1)
        session.add(title: "  Chapter 1 ")
        session.add(title: "")
        #expect(shown(session) == ["Preface p1", "Chapter 1 p2", "Page 2 p2", "End p4"])
        #expect(session.canSave && session.file.hasUnsavedEdits)
        session.rename(session.rows[2].id, to: "Summer")
        session.shift(session.rows[2].id, by: 1)
        session.remove(session.rows[0].id)
        #expect(shown(session) == ["Chapter 1 p2", ">Summer p2", "End p4"])

        let output = folder.appendingPathComponent("Book-bookmarks.pdf")
        await session.saveCopy(to: output)
        #expect(session.file.errorMessage == nil)
        #expect(session.file.lastSavedURL == output && !session.file.hasUnsavedEdits)
        let saved = try PDFBookmarks.list(try Data(contentsOf: output))
        #expect(saved.map(\.title) == ["Chapter 1", "Summer", "End"])
        #expect(saved.map(\.level) == [0, 1, 0])
        #expect(saved.map(\.pageIndex) == [1, 1, 3])
        #expect(try Data(contentsOf: source) == original)
    }

    @Test func aNewBookmarkStaysInTheFamilyItLandsInAndALevelNeverSkipsOne() async throws {
        let (session, _, folder) = try await opened([
            PDFBookmark(title: "Part", pageIndex: 0), PDFBookmark(title: "One", pageIndex: 0, level: 1), PDFBookmark(title: "Three", pageIndex: 2, level: 1),
        ])
        defer { try? FileManager.default.removeItem(at: folder) }
        session.file.goToPage(1)
        session.add(title: "Two")
        #expect(shown(session) == ["Part p1", ">One p1", ">Two p2", ">Three p3"])
        session.shift(session.rows[2].id, by: 5)
        #expect(shown(session)[2] == ">>Two p2")
        session.shift(session.rows[0].id, by: 1)
        #expect(shown(session)[0] == "Part p1", "The first bookmark has nothing above it to go under")
        session.remove(session.rows[1].id)
        #expect(shown(session) == ["Part p1", ">Two p2", ">Three p3"], "Without its parent, a bookmark moves up")
    }

    @Test func saysHowManyBookmarksLeadToNoPage() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let document = try #require(PDFDocument(data: try PDFBookmarks.written(try demoPDF(title: "Book", pages: 2, color: 0),
                                                                              bookmarks: [PDFBookmark(title: "Preface", pageIndex: 0)])))
        let site = PDFOutline()
        site.label = "Our site"
        site.action = PDFActionURL(url: try #require(URL(string: "https://example.com")))
        document.outlineRoot?.insertChild(site, at: 1)
        let source = folder.appendingPathComponent("Book.pdf")
        try #require(document.dataRepresentation()).write(to: source)
        let session = BookmarksSession()
        #expect(session.unlisted == 0)
        session.file.open(source)
        try await waitUntil { session.file.state == .ready }
        #expect(shown(session) == ["Preface p1"])
        #expect(session.unlisted == 1)
    }

    @Test func aBlankTitleCannotBeSavedAndAnotherDocumentStartsAfresh() async throws {
        let (session, source, folder) = try await opened([PDFBookmark(title: "Preface", pageIndex: 0)])
        defer { try? FileManager.default.removeItem(at: folder) }
        session.rename(session.rows[0].id, to: " ")
        #expect(!session.canSave)
        session.rename(session.rows[0].id, to: "Foreword")
        #expect(session.canSave)
        session.remove(session.rows[0].id)
        #expect(session.rows.isEmpty && session.canSave, "A copy without any bookmark is a change worth saving")
        session.file.reset()
        session.file.open(source)
        try await waitUntil { session.file.state == .ready }
        #expect(shown(session) == ["Preface p1"])
        #expect(!session.canSave)
    }
}
