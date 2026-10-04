import Foundation
import Observation
import PDFCore

@MainActor
@Observable
final class BookmarksSession {
    struct Row: Identifiable, Equatable {
        let id: Int
        var bookmark: PDFBookmark
    }

    let file = PDFCopySession(describe: BookmarksText.message)
    /// Nil until the first change: the screen then lists the bookmarks the document came with.
    private var edited: [Row]?
    private var lastID = 0

    init() {
        file.survey = { data, password in try PDFBookmarks.outline(data, password: password) }
        file.onClosed = { [weak self] in self?.edited = nil }
    }

    private var outline: PDFBookmarks.Outline? { file.findings as? PDFBookmarks.Outline }

    var rows: [Row] {
        edited ?? (outline?.bookmarks ?? []).enumerated().map { Row(id: $0.offset, bookmark: $0.element) }
    }

    /// The bookmarks of the document that the list cannot show: they open an address, or lead nowhere.
    var unlisted: Int { outline?.unlisted ?? 0 }

    var canSave: Bool {
        edited != nil && rows.allSatisfy { !$0.bookmark.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    }

    /// A bookmark for the page on screen, placed after the bookmarks of that page and of the pages before it.
    func add(title: String) {
        let page = file.pageIndex
        let name = title.trimmingCharacters(in: .whitespacesAndNewlines)
        change { rows in
            let at = rows.lastIndex { $0.bookmark.pageIndex <= page }.map { $0 + 1 } ?? 0
            // Between a bookmark and its children, the new one is a child too: it does not take the children for itself.
            let level = max(at > 0 ? rows[at - 1].bookmark.level : 0, at < rows.count ? rows[at].bookmark.level : 0)
            lastID = max(lastID, rows.map(\.id).max() ?? -1) + 1
            rows.insert(Row(id: lastID, bookmark: PDFBookmark(title: name.isEmpty ? String(localized: "Page \(page + 1)") : name,
                                                               pageIndex: page, level: level)), at: at)
        }
    }

    func rename(_ id: Int, to title: String) {
        change { rows in
            if let index = rows.firstIndex(where: { $0.id == id }) { rows[index].bookmark.title = title }
        }
    }

    func remove(_ id: Int) {
        change { rows in rows.removeAll { $0.id == id } }
    }

    /// One level deeper (1) or one level up (-1).
    func shift(_ id: Int, by levels: Int) {
        change { rows in
            if let index = rows.firstIndex(where: { $0.id == id }) { rows[index].bookmark.level += levels }
        }
    }

    private func change(_ edit: (inout [Row]) -> Void) {
        guard file.state == .ready else { return }
        var next = rows
        edit(&next)
        // The list shows what the copy will hold: a level is at most one deeper than the one before it.
        for index in next.indices {
            next[index].bookmark.level = min(max(next[index].bookmark.level, 0), index == 0 ? 0 : next[index - 1].bookmark.level + 1)
        }
        guard next != rows else { return }
        edited = next
        file.edited()
    }

    private var make: PDFCopySession.ReportingMaker {
        { [bookmarks = rows.map(\.bookmark)] data, password, _ in try PDFBookmarks.written(data, password: password, bookmarks: bookmarks) }
    }

    func export() { file.export(suffix: String(localized: "bookmarks"), reporting: make) }

    func saveCopy(to url: URL) async { await file.saveCopy(to: url, reporting: make) }
}

enum BookmarksText {
    static func message(_ error: Error) -> String {
        (error as? PDFToolError) == .alreadySigned
            ? String(localized: "This PDF has a digital signature. A copy with other bookmarks would lose it.") : SigningText.message(error)
    }
}
