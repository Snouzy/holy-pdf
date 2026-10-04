import PDFCore
import SwiftUI
import Testing
@testable import PDFToolbox

@Suite(.serialized)
@MainActor
struct BookmarksSnapshots {
    private static let folder = ScreenSnapshots.folder.appendingPathComponent("bookmarks")

    @Test func startReadyAndSaved() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        try await snapshot("start-light", BookmarksView().environment(BookmarksSession()), in: Self.folder)
        let source = folder.appendingPathComponent("Roman.pdf")
        try PDFBookmarks.written(try demoPDF(title: "Roman", pages: 6, color: 0), bookmarks: [
            PDFBookmark(title: "Préface", pageIndex: 0), PDFBookmark(title: "Première partie", pageIndex: 1),
            PDFBookmark(title: "L'été", pageIndex: 1, level: 1), PDFBookmark(title: "L'automne", pageIndex: 3, level: 1),
            PDFBookmark(title: "Épilogue", pageIndex: 5),
        ]).write(to: source)
        let session = BookmarksSession()
        session.file.open(source)
        try await waitUntil { session.file.state == .ready && session.file.preview != nil }
        for dark in [false, true] {
            try await snapshot("ready-\(dark ? "dark" : "light")", BookmarksView().environment(session), in: Self.folder, dark: dark)
        }
        try await snapshot("ready-english", BookmarksView().environment(session), in: Self.folder, language: "en")
        session.file.goToPage(2)
        try await waitUntil { session.file.preview != nil }
        session.add(title: "Un orage")
        await session.saveCopy(to: folder.appendingPathComponent("Roman-signets.pdf"))
        try await snapshot("saved-light", BookmarksView().environment(session), in: Self.folder)

        let plain = folder.appendingPathComponent("Lettre.pdf")
        try demoPDF(title: "Lettre", pages: 2, color: 0).write(to: plain)
        let empty = BookmarksSession()
        empty.file.open(plain)
        try await waitUntil { empty.file.state == .ready && empty.file.preview != nil }
        try await snapshot("none-light", BookmarksView().environment(empty), in: Self.folder)
    }
}
