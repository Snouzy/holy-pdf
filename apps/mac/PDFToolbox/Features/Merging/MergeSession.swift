import CoreGraphics
import Foundation
import Observation
import PDFCore

struct MergeItem: Identifiable {
    enum Status {
        case loading
        case locked
        case ready(MergeDocumentInfo)
        case failed(String)
    }

    let id: UUID
    let url: URL
    let name: String
    var byteCount = 0
    var status: Status = .loading
    var preview: CGImage?
    var source: FileIdentity?

    var information: MergeDocumentInfo? {
        if case .ready(let info) = status { return info }
        return nil
    }
}

@MainActor
@Observable
final class MergeSession {
    enum State { case idle, importing(Int, Int), choosingDestination, exporting }

    private(set) var items: [MergeItem] = []
    private(set) var state: State = .idle
    var errorMessage: String?
    private(set) var lastSavedURL: URL?

    private var collection = PDFMergeCollection()
    private(set) var generation = 0
    private var revision = 0
    private var nextRevision = 0
    private var savedRevision = 0
    private var history: [(edit: Edit, revision: Int)] = []
    @ObservationIgnored private var importTask: Task<Void, Never>?
    @ObservationIgnored private var loadedIDs: Set<UUID> = []
    @ObservationIgnored private var previewOrder: [UUID] = []
    @ObservationIgnored private var previewsInFlight: Set<UUID> = []

    private enum Edit {
        case remove([UUID])
        case insert(MergeItem, Int)
        case order([UUID])
    }

    var isBusy: Bool {
        if case .idle = state { return false }
        return true
    }

    var canUndo: Bool { !isBusy && !history.isEmpty }
    var canExport: Bool { !isBusy && items.count >= 2 && items.allSatisfy { $0.information != nil } }
    var hasUnexportedChanges: Bool { !items.isEmpty && revision != savedRevision }
    var totalPages: Int { items.reduce(0) { $0 + ($1.information?.pageCount ?? 0) } }
    var hasEncryptedSources: Bool { items.contains { $0.information?.isEncrypted == true } }

    var conservationNotices: [String] {
        let notices = Set(items.flatMap { $0.information?.notices ?? [] })
        var messages: [String] = []
        if notices.contains(.accessibilityTags) {
            messages.append(String(localized: "Accessibility tags from the source PDFs will not be kept in the merged copy."))
        }
        if notices.contains(.archivalProfile) {
            messages.append(String(localized: "Archival and print profiles will not be kept. The merged copy is not guaranteed to comply with PDF/A or retain the same print colors."))
        }
        return messages
    }

    var progressText: String? {
        switch state {
        case .idle, .choosingDestination: nil
        case .importing(let completed, let total): String(localized: "Opening PDF \(completed + 1) of \(total)…")
        case .exporting: String(localized: "Merging PDFs…")
        }
    }

    func add(_ urls: [URL]) {
        guard !isBusy else { return }
        let files = urls.filter(\.isFileURL)
        guard !files.isEmpty else { return }
        guard items.count + files.count <= 100 else {
            errorMessage = MergeText.message(PDFToolError.tooManyDocuments)
            return
        }
        let added = files.map { MergeItem(id: UUID(), url: $0, name: $0.lastPathComponent) }
        remember(.remove(added.map(\.id)))
        items.append(contentsOf: added)
        errorMessage = nil
        state = .importing(0, added.count)
        let token = generation
        importTask = Task {
            for (index, item) in added.enumerated() {
                guard token == generation, !Task.isCancelled else { return }
                state = .importing(index, added.count)
                await load(id: item.id, password: "", token: token)
            }
            guard token == generation else { return }
            state = .idle
        }
    }

    func unlock(id: UUID, password: String) {
        guard !isBusy, let index = items.firstIndex(where: { $0.id == id }),
              case .locked = items[index].status else { return }
        items[index].status = .loading
        state = .importing(0, 1)
        errorMessage = nil
        let token = generation
        importTask = Task {
            await load(id: id, password: password, token: token)
            guard token == generation else { return }
            state = .idle
        }
    }

    private func load(id: UUID, password: String, token: Int) async {
        guard let item = items.first(where: { $0.id == id }) else { return }
        let source = collection
        let access = item.url.startAccessingSecurityScopedResource()
        defer { if access { item.url.stopAccessingSecurityScopedResource() } }
        let identity = FileIdentity(item.url)
        do {
            let data = try await readFile(item.url, limit: PDFMergeCollection.maxDocumentBytes)
            guard token == generation, !Task.isCancelled, let index = items.firstIndex(where: { $0.id == id }) else { return }
            items[index].byteCount = data.count
            items[index].source = identity
            let info = try await source.add(data: data, password: password)
            guard token == generation, !Task.isCancelled, let updated = items.firstIndex(where: { $0.id == id }) else {
                await source.remove(id: info.id)
                return
            }
            loadedIDs.insert(info.id)
            items[updated].status = .ready(info)
        } catch {
            guard token == generation, !Task.isCancelled, let index = items.firstIndex(where: { $0.id == id }) else { return }
            switch error as? PDFToolError {
            case .passwordRequired: items[index].status = .locked
            case .wrongPassword:
                items[index].status = .locked
                errorMessage = String(localized: "This password did not unlock the PDF. Try again.")
            default: items[index].status = .failed(MergeText.message(error))
            }
        }
    }

    func loadPreview(id: UUID) async {
        guard let index = items.firstIndex(where: { $0.id == id }), items[index].preview == nil,
              let info = items[index].information, !previewsInFlight.contains(id) else { return }
        let token = generation
        let source = collection
        previewsInFlight.insert(id)
        defer { if token == generation { previewsInFlight.remove(id) } }
        do {
            let image = try await source.preview(id: info.id, maxDimension: 240)
            guard token == generation, !Task.isCancelled,
                  let updated = items.firstIndex(where: { $0.id == id }) else { return }
            items[updated].preview = image
            previewOrder.removeAll { $0 == id }
            previewOrder.append(id)
            while previewOrder.count > 32 {
                let evicted = previewOrder.removeFirst()
                if let index = items.firstIndex(where: { $0.id == evicted }) { items[index].preview = nil }
            }
        } catch {
            // A failed thumbnail does not prevent exporting the original PDF pages.
        }
    }

    func pagePreview(id: UUID, pageIndex: Int) async throws -> CGImage {
        guard let info = items.first(where: { $0.id == id })?.information else { throw PDFToolError.invalidOrder }
        let token = generation
        let image = try await collection.preview(id: info.id, pageIndex: pageIndex, maxDimension: 1600)
        guard token == generation, !Task.isCancelled,
              items.contains(where: { $0.id == id }) else { throw PDFToolError.cancelled }
        return image
    }

    /// Page `index` of the merged PDF, through the list in its order: nothing is merged to show it.
    func mergedPagePreview(at index: Int) async throws -> CGImage {
        var rest = index
        for item in items where rest >= 0 {
            guard let count = item.information?.pageCount else { break }
            if rest < count { return try await pagePreview(id: item.id, pageIndex: rest) }
            rest -= count
        }
        throw PDFToolError.invalidOrder
    }

    func moveUp(_ id: UUID) {
        guard let index = items.firstIndex(where: { $0.id == id }), index > 0 else { return }
        move(id: id, before: items[index - 1].id)
    }

    func moveDown(_ id: UUID) {
        guard !isBusy, let index = items.firstIndex(where: { $0.id == id }), index + 1 < items.count else { return }
        remember(.order(items.map(\.id)))
        items.swapAt(index, index + 1)
    }

    func move(id: UUID, before target: UUID) {
        move(id: id, to: .before(target))
    }

    func move(id: UUID, to position: MergeDropPosition) {
        guard !isBusy, let source = items.firstIndex(where: { $0.id == id }) else { return }
        var moved = items
        let item = moved.remove(at: source)
        let destination: Int
        switch position {
        case .before(let target), .after(let target):
            guard target != id, let index = moved.firstIndex(where: { $0.id == target }) else { return }
            destination = position == .after(target) ? index + 1 : index
        case .end: destination = moved.count
        }
        moved.insert(item, at: destination)
        guard moved.map(\.id) != items.map(\.id) else { return }
        remember(.order(items.map(\.id)))
        items = moved
    }

    func remove(_ id: UUID) {
        guard !isBusy, let index = items.firstIndex(where: { $0.id == id }) else { return }
        var removed = items[index]
        removed.preview = nil
        remember(.insert(removed, index))
        items.remove(at: index)
        previewOrder.removeAll { $0 == id }
    }

    private func remember(_ edit: Edit) {
        history.append((edit, revision))
        if history.count > 100 { history.removeFirst() }
        nextRevision += 1
        revision = nextRevision
        lastSavedURL = nil
        releaseUnusedDocuments()
    }

    private func releaseUnusedDocuments() {
        var retained = Set(items.compactMap { $0.information?.id })
        for record in history {
            if case .insert(let item, _) = record.edit, let info = item.information { retained.insert(info.id) }
        }
        let unused = loadedIDs.subtracting(retained)
        loadedIDs.subtract(unused)
        let source = collection
        Task { for id in unused { await source.remove(id: id) } }
    }

    func undo() {
        guard !isBusy, let record = history.popLast() else { return }
        switch record.edit {
        case .remove(let ids):
            items.removeAll { ids.contains($0.id) }
            previewOrder.removeAll { ids.contains($0) }
        case .insert(let item, let index):
            items.insert(item, at: min(index, items.count))
        case .order(let ids):
            let indexed = Dictionary(uniqueKeysWithValues: items.map { ($0.id, $0) })
            items = ids.compactMap { indexed[$0] } + items.filter { !ids.contains($0.id) }
        }
        revision = record.revision
        lastSavedURL = nil
        errorMessage = nil
        releaseUnusedDocuments()
    }

    func export() {
        guard canExport else { return }
        let token = generation
        let name = String(localized: "Merged documents") + ".pdf"
        state = .choosingDestination
        Task {
            let url = await choosePDFDestination(name: name)
            guard token == generation else { return }
            state = .idle
            guard let url else { return }
            await saveCopy(to: url)
        }
    }

    func saveCopy(to url: URL) async {
        guard canExport else { return }
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        let destination = FileIdentity(url)
        var sources = items
        for record in history {
            if case .insert(let item, _) = record.edit { sources.append(item) }
        }
        guard !sources.contains(where: { $0.source == destination }) else {
            errorMessage = String(localized: "Choose a different name or folder to keep your original PDFs.")
            return
        }
        state = .exporting
        errorMessage = nil
        let order = items.compactMap { $0.information?.id }
        let exportingRevision = revision
        let source = collection
        defer { state = .idle }
        do {
            let data = try await source.mergedData(order: order)
            try await Task.detached(priority: .userInitiated) { try data.write(to: url, options: .atomic) }.value
            savedRevision = exportingRevision
            lastSavedURL = url
        } catch {
            errorMessage = MergeText.message(error)
        }
    }

    func reset() {
        if case .exporting = state { return }
        generation += 1
        importTask?.cancel()
        collection = PDFMergeCollection()
        items = []
        state = .idle
        history = []
        loadedIDs = []
        previewOrder = []
        previewsInFlight = []
        revision = 0
        nextRevision = 0
        savedRevision = 0
        errorMessage = nil
        lastSavedURL = nil
    }
}

enum MergeText {
    static func message(_ error: Error) -> String {
        switch error as? PDFToolError {
        case .invalidDocument: return String(localized: "This PDF could not be read.")
        case .passwordRequired: return String(localized: "Enter the PDF password to open it.")
        case .wrongPassword: return String(localized: "This password did not unlock the PDF. Try again.")
        case .alreadySigned: return String(localized: "This PDF has a digital signature that merging would invalidate.")
        case .fileTooLarge: return String(localized: "Choose a PDF under 256 MB.")
        case .collectionTooLarge: return String(localized: "This session has reached 512 MB, including files kept for Undo. Start a new merge with smaller files.")
        case .tooManyDocuments: return String(localized: "You can merge up to 100 PDFs in one session.")
        case .invalidOrder: return String(localized: "Add at least two readable PDFs before merging.")
        case .unsupportedDocument: return String(localized: "This PDF contains features that cannot be preserved when merging, such as attachments, layers or dynamic forms.")
        case .renderFailed: return String(localized: "The preview could not be displayed.")
        case .writeFailed: return String(localized: "The PDF could not be saved. Choose another location.")
        case .cancelled: return String(localized: "The merge was cancelled. Your original PDFs have not changed.")
        default: return String(localized: "The operation could not be completed. Your original PDFs have not changed.")
        }
    }
}
