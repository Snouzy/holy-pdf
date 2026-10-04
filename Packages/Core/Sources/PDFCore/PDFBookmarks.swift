import CoreGraphics
import Foundation
import PDFKit

public struct PDFBookmark: Equatable, Sendable {
    public var title: String
    public var pageIndex: Int
    /// 0 for a bookmark of the first level, 1 for one under it, and so on.
    public var level: Int
    /// Where the bookmark lands on its page, in page space. Nil for the top of the page.
    public var point: CGPoint?

    public init(title: String, pageIndex: Int, level: Int = 0, point: CGPoint? = nil) {
        self.title = title
        self.pageIndex = pageIndex
        self.level = level
        self.point = point
    }
}

public enum PDFBookmarks {
    public struct Outline: Sendable {
        public let bookmarks: [PDFBookmark]
        public let unlisted: Int
    }

    /// The bookmarks in the order a reader lists them. One that leads to no page of the document, or has no title to
    /// show, is left out and counted: its children take its place.
    public static func outline(_ data: Data, password: String = "") throws(PDFToolError) -> Outline {
        let document = try PDFDocumentValidation.open(data, password: password)
        var found: [PDFBookmark] = []
        var unlisted = 0
        func children(of node: PDFOutline, level: Int) -> [(PDFOutline, Int)] {
            (0..<node.numberOfChildren).reversed().compactMap { index in node.child(at: index).map { ($0, level) } }
        }
        // A pile: the children go on it last first, so the outline comes off it in reading order.
        var pending = document.outlineRoot.map { children(of: $0, level: 0) } ?? []
        var visited = 0
        while let (node, level) = pending.popLast(), visited < 100_000 {
            visited += 1
            guard let destination = node.destination, let page = destination.page, document.index(for: page) < document.pageCount,
                  let title = node.label, !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                unlisted += 1
                pending += children(of: node, level: level)
                continue
            }
            pending += children(of: node, level: level + 1)
            let point = destination.point
            let unspecified = point.x == kPDFDestinationUnspecifiedValue && point.y == kPDFDestinationUnspecifiedValue
            found.append(PDFBookmark(title: title, pageIndex: document.index(for: page), level: min(level, (found.last?.level ?? -1) + 1),
                                     point: unspecified ? nil : point))
        }
        return Outline(bookmarks: found, unlisted: unlisted)
    }

    public static func list(_ data: Data, password: String = "") throws(PDFToolError) -> [PDFBookmark] {
        try outline(data, password: password).bookmarks
    }

    /// A copy whose bookmarks are exactly `bookmarks`, in that order. A level deeper than the one before it by more
    /// than one is brought back to one deeper.
    public static func written(_ data: Data, password: String = "", bookmarks: [PDFBookmark]) throws(PDFToolError) -> Data {
        let document = try PDFDocumentValidation.open(data, password: password)
        try PDFDocumentValidation.rejectDigitalSignatures(data, password: password)
        let root = PDFOutline()
        // The root, then the last bookmark written at each level: `parents[n]` takes the next bookmark of level n.
        var parents = [root]
        for bookmark in bookmarks {
            guard !bookmark.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, (0..<document.pageCount).contains(bookmark.pageIndex), let page = document.page(at: bookmark.pageIndex) else {
                throw .invalidOrder
            }
            let level = min(max(bookmark.level, 0), parents.count - 1)
            let node = PDFOutline()
            node.label = bookmark.title
            let top = CGPoint(x: 0, y: PageGeometry.displayedBounds(of: page).height).applying(PageGeometry.displayTransform(of: page).inverted())
            node.destination = PDFDestination(page: page, at: bookmark.point ?? top)
            parents[level].insertChild(node, at: parents[level].numberOfChildren)
            parents.removeSubrange((level + 1)...)
            parents.append(node)
        }
        document.outlineRoot = root
        let options: [AnyHashable: Any] = document.isEncrypted
            ? [PDFDocumentWriteOption.ownerPasswordOption: "", PDFDocumentWriteOption.userPasswordOption: ""] : [:]
        guard let output = document.dataRepresentation(options: options), !output.isEmpty else { throw .writeFailed }
        return output
    }
}
