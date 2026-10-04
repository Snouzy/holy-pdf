import Foundation
import Observation
import PDFCore

/// Marks on the pages of one PDF. Extract: the pages to keep. Split: the pages after which the PDF is cut.
@MainActor
@Observable
final class PagePickingSession {
    enum Mode { case split, extract }

    let mode: Mode
    let deck = OrganizingSession(describe: PickingText.message)
    private(set) var picked: Set<Int> = []
    private(set) var savedURLs: [URL] = []
    private(set) var isSaving = false
    private(set) var isChoosing = false
    private var savedPicks: Set<Int>?
    private var history: [Set<Int>] = []

    init(mode: Mode) {
        self.mode = mode
    }

    var pageCount: Int { deck.pageSizes.count }
    var isBusy: Bool { deck.isBusy || isSaving || isChoosing }
    var canExport: Bool { !isBusy && pageCount > 0 && !picked.isEmpty }
    var canUndo: Bool { !isBusy && !history.isEmpty }
    var hasUnexportedChanges: Bool { !picked.isEmpty && picked != savedPicks }

    var parts: [ClosedRange<Int>] {
        guard mode == .split, pageCount > 0 else { return [] }
        var start = 0
        var result: [ClosedRange<Int>] = []
        for cut in picked.sorted() {
            result.append(start...cut)
            start = cut + 1
        }
        return result + [start...(pageCount - 1)]
    }

    func part(of page: Int) -> Int { picked.count { $0 < page } }

    func open(_ url: URL) {
        guard !isSaving, !isChoosing else { return }
        forget()
        deck.open(url)
    }

    func reset() {
        guard !isSaving, !isChoosing else { return }
        forget()
        deck.reset()
    }

    private func forget() {
        picked = []
        history = []
        savedURLs = []
        savedPicks = nil
    }

    func toggle(_ page: Int) {
        // A cut after the last page would make an empty file.
        guard page >= 0, page < (mode == .split ? pageCount - 1 : pageCount) else { return }
        mark(picked.symmetricDifference([page]))
    }

    func pickAll() {
        guard mode == .extract else { return }
        mark(Set(0..<pageCount))
    }

    func pickNone() { mark([]) }

    func cutEvery(_ count: Int) {
        guard mode == .split, count > 0 else { return }
        mark(Set(stride(from: count - 1, to: pageCount - 1, by: count)))
    }

    private func mark(_ pages: Set<Int>) {
        guard deck.state == .ready, !isSaving, !isChoosing, pages != picked else { return }
        history.append(picked)
        if history.count > 100 { history.removeFirst() }
        picked = pages
        savedURLs = []
    }

    func undo() {
        guard canUndo, let previous = history.popLast() else { return }
        picked = previous
        savedURLs = []
    }

    func export() {
        guard let stem else { return }
        export { [mode] in
            switch mode {
            case .extract: await choosePDFDestination(name: stem + "-" + String(localized: "extracted") + ".pdf")
            case .split: await chooseFolder(prompt: String(localized: "Split here"))
            }
        }
    }

    /// `destination` is the save or folder panel. While it is open the session is busy, so the marks it saves are the ones on screen.
    func export(choosing destination: @escaping @MainActor () async -> URL?) {
        guard canExport else { return }
        isChoosing = true
        Task {
            let url = await destination()
            isChoosing = false
            guard let url else { return }
            do {
                switch mode {
                case .extract: try await extract(to: url)
                case .split: try await split(into: url)
                }
            } catch {
                deck.errorMessage = mode == .split && !savedURLs.isEmpty
                    ? String(localized: "The split stopped after file \(savedURLs.count) of \(parts.count). The files already written stay in the folder.")
                    : PickingText.message(error)
            }
        }
    }

    func extract(to url: URL) async throws {
        guard mode == .extract, canExport else { throw PDFToolError.invalidOrder }
        guard !deck.isOriginal(url) else { throw OrganizingSession.ExportError.originalDestination }
        try await save(in: url) { [pages = picked.sorted()] in
            try await self.write(pages, to: url, replacing: true)
        }
    }

    func split(into folder: URL) async throws {
        guard mode == .split, canExport, let stem else { throw PDFToolError.invalidOrder }
        try await save(in: folder) { [parts] in
            for (index, part) in parts.enumerated() {
                // Never replaces a file, so never the original either.
                let url = unusedURL(named: "\(stem)-\(index + 1).pdf", in: folder)
                try await self.write(Array(part), to: url, replacing: false)
            }
        }
    }

    private var stem: String? {
        deck.documentName.map { URL(fileURLWithPath: $0).deletingPathExtension().lastPathComponent }
    }

    private func save(in location: URL, _ work: () async throws -> Void) async throws {
        let access = location.startAccessingSecurityScopedResource()
        defer { if access { location.stopAccessingSecurityScopedResource() } }
        isSaving = true
        deck.errorMessage = nil
        savedURLs = []
        let marks = picked
        defer { isSaving = false }
        try await work()
        savedPicks = marks
    }

    private func write(_ pages: [Int], to url: URL, replacing: Bool) async throws {
        let bytes = try await deck.copy(of: pages.map { OrganizedPage(id: $0) })
        try await Task.detached(priority: .userInitiated) {
            if replacing { try bytes.write(to: url, options: .atomic) } else { try writeNewFile(bytes, at: url) }
        }.value
        savedURLs.append(url)
    }
}

enum PickingText {
    static func message(_ error: Error) -> String {
        switch error as? PDFToolError {
        case .alreadySigned: String(localized: "This PDF has a digital signature. Its pages cannot be split or extracted without losing it.")
        case .unsupportedDocument: String(localized: "This PDF contains features that cannot be preserved, such as attachments, layers or dynamic forms.")
        case .invalidOrder: String(localized: "Mark at least one page or one cut before saving.")
        default: OrganizingText.message(error)
        }
    }
}
