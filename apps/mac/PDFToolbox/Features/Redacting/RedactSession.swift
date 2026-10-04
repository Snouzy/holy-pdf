import CoreGraphics
import Foundation
import Observation
import PDFCore

@MainActor
@Observable
final class RedactSession {
    let file = PDFCopySession(describe: RedactText.message)
    /// By page index. An area is normalized to the page as the reader sees it, origin top-left.
    private(set) var areas: [Int: [CGRect]] = [:]
    /// The areas before each change, oldest first.
    private var history: [[Int: [CGRect]]] = []

    init() {
        file.onClosed = { [weak self] in
            self?.areas = [:]
            self?.history = []
        }
    }

    var areasOnPage: [CGRect] { areas[file.pageIndex] ?? [] }
    var areaCount: Int { areas.values.reduce(0) { $0 + $1.count } }
    var pageCount: Int { areas.count }
    var canSave: Bool { !areas.isEmpty }

    func add(_ area: CGRect) {
        let inside = area.standardized.intersection(CGRect(x: 0, y: 0, width: 1, height: 1))
        guard file.state == .ready, !inside.isEmpty else { return }
        remember()
        areas[file.pageIndex, default: []].append(inside)
        file.edited()
    }

    func remove(at index: Int) {
        guard file.state == .ready, areasOnPage.indices.contains(index) else { return }
        remember()
        areas[file.pageIndex]?.remove(at: index)
        if areasOnPage.isEmpty { areas[file.pageIndex] = nil }
        file.edited(unsaved: canSave)
    }

    private func remember() {
        history.append(areas)
        if history.count > 100 { history.removeFirst() }
    }

    var canUndo: Bool { file.state == .ready && !history.isEmpty }

    /// Takes back the last change, on whatever page it was made.
    func undo() {
        guard canUndo, let before = history.popLast() else { return }
        areas = before
        file.edited(unsaved: canSave)
    }

    func removeAllOnPage() {
        guard file.state == .ready, !areasOnPage.isEmpty else { return }
        remember()
        areas[file.pageIndex] = nil
        file.edited(unsaved: canSave)
    }

    private var maker: PDFCopySession.Maker? {
        guard canSave else { return nil }
        return { [areas] data, password in try PDFRedaction.redacted(data, password: password, areas: areas) }
    }

    func export() {
        if let maker { file.export(suffix: String(localized: "redacted"), make: maker) }
    }

    func saveCopy(to url: URL) async {
        if let maker { await file.saveCopy(to: url, make: maker) }
    }
}

enum RedactText {
    static func message(_ error: Error) -> String {
        switch error as? PDFToolError {
        case .alreadySigned: String(localized: "This PDF has a digital signature. A redacted copy would lose it.")
        case .renderFailed: String(localized: "A page could not be turned into an image. Your original PDF has not changed.")
        default: SigningText.message(error)
        }
    }
}
