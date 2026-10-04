import CoreGraphics
import Foundation
import Observation
import PDFCore

@MainActor
@Observable
final class OrganizingSession {
    enum State { case empty, opening, locked, ready, choosingDestination, exporting }
    enum ExportError: Error { case originalDestination }

    private(set) var state: State = .empty
    private(set) var pages: [OrganizedPage] = []
    private(set) var pageSizes: [CGSize] = []
    private(set) var documentName: String?
    private(set) var isEncrypted = false
    private(set) var generation = 0
    private(set) var lastSavedURL: URL?
    var errorMessage: String?

    private let describe: (Error) -> String
    private var document: PDFOrganizingDocument?
    private var source: FileIdentity?
    private var pendingData: Data?
    private var notices: Set<PDFMergeNotice> = []
    private var revision = 0
    private var nextRevision = 0
    private var savedRevision = 0
    private var history: [(edit: Edit, revision: Int)] = []
    @ObservationIgnored private var openingTask: Task<Void, Never>?
    @ObservationIgnored private var thumbnails: [Int: CGImage] = [:]
    @ObservationIgnored private var thumbnailOrder: [Int] = []

    private enum Edit {
        case move(Int, Int)
        case rotation(Int, Int)
        case insert(OrganizedPage, Int)
    }

    /// `describe` words the errors: Split and Extract load their pages through this session, with their own messages.
    init(describe: @escaping (Error) -> String = OrganizingText.message) {
        self.describe = describe
    }

    var isBusy: Bool { state == .opening || state == .choosingDestination || state == .exporting }
    var needsPassword: Bool { state == .locked }
    var canExport: Bool { state == .ready && !pages.isEmpty }
    var canUndo: Bool { state == .ready && !history.isEmpty }
    var hasUnexportedChanges: Bool { !pages.isEmpty && revision != savedRevision }
    var cachedThumbnailCount: Int { thumbnails.count }

    var conservationNotices: [String] { OrganizingText.conservation(notices) }

    func open(_ url: URL) {
        guard state != .exporting, state != .choosingDestination, url.isFileURL else { return }
        reset()
        documentName = url.lastPathComponent
        state = .opening
        let token = generation
        openingTask = Task {
            let access = url.startAccessingSecurityScopedResource()
            defer { if access { url.stopAccessingSecurityScopedResource() } }
            guard token == generation, !Task.isCancelled else { return }
            source = FileIdentity(url)
            do {
                let data = try await readFile(url, limit: PDFOrganizingDocument.maxDocumentBytes)
                guard token == generation, !Task.isCancelled else { return }
                pendingData = data
                await load(data, password: "", token: token)
            } catch {
                guard token == generation, !Task.isCancelled else { return }
                state = .empty
                errorMessage = describe(error)
            }
        }
    }

    func unlock(password: String) {
        guard needsPassword, let pendingData else { return }
        state = .opening
        errorMessage = nil
        let token = generation
        openingTask = Task { await load(pendingData, password: password, token: token) }
    }

    private func load(_ data: Data, password: String, token: Int) async {
        do {
            let loaded = try await Task.detached(priority: .userInitiated) {
                try PDFOrganizingDocument(data: data, password: password)
            }.value
            let information = await loaded.information()
            guard token == generation, !Task.isCancelled else { return }
            document = loaded
            pageSizes = information.pageSizes
            pages = pageSizes.indices.map { OrganizedPage(id: $0) }
            isEncrypted = information.isEncrypted
            notices = information.notices
            pendingData = nil
            state = .ready
        } catch {
            guard token == generation, !Task.isCancelled else { return }
            switch error as? PDFToolError {
            case .passwordRequired: state = .locked
            case .wrongPassword:
                state = .locked
                errorMessage = describe(error)
            default:
                pendingData = nil
                state = .empty
                errorMessage = describe(error)
            }
        }
    }

    func thumbnail(pageID: Int) async -> CGImage? {
        guard pages.contains(where: { $0.id == pageID }), let document, !Task.isCancelled else { return nil }
        if let image = thumbnails[pageID] {
            thumbnailOrder.removeAll { $0 == pageID }
            thumbnailOrder.append(pageID)
            return image
        }
        let token = generation
        let image = try? await document.preview(pageIndex: pageID, maxDimension: 240)
        guard token == generation else { return nil }
        guard let image, pages.contains(where: { $0.id == pageID }), !Task.isCancelled else { return nil }
        thumbnails[pageID] = image
        thumbnailOrder.removeAll { $0 == pageID }
        thumbnailOrder.append(pageID)
        while thumbnailOrder.count > 32 {
            thumbnails[thumbnailOrder.removeFirst()] = nil
        }
        return image
    }

    func pagePreview(pageID: Int) async throws -> CGImage {
        guard pages.contains(where: { $0.id == pageID }), let document else { throw PDFToolError.invalidOrder }
        let token = generation
        let image = try await document.preview(pageIndex: pageID, maxDimension: 1600)
        guard token == generation, !Task.isCancelled,
              pages.contains(where: { $0.id == pageID }) else { throw PDFToolError.cancelled }
        return image
    }

    func move(id: Int, before target: Int?) {
        guard state == .ready, target != id, let source = pages.firstIndex(where: { $0.id == id }),
              target == nil || pages.contains(where: { $0.id == target }) else { return }
        let destination = target.flatMap { target in pages.firstIndex { $0.id == target } } ?? pages.count
        let adjusted = destination > source ? destination - 1 : destination
        guard adjusted != source else { return }
        remember(.move(id, source))
        let page = pages.remove(at: source)
        pages.insert(page, at: adjusted)
    }

    func moveLeft(id: Int) {
        guard let index = pages.firstIndex(where: { $0.id == id }), index > 0 else { return }
        move(id: id, before: pages[index - 1].id)
    }

    func moveRight(id: Int) {
        guard let index = pages.firstIndex(where: { $0.id == id }), index + 1 < pages.count else { return }
        move(id: id, before: index + 2 < pages.count ? pages[index + 2].id : nil)
    }

    func rotate(id: Int) {
        guard state == .ready, let index = pages.firstIndex(where: { $0.id == id }) else { return }
        remember(.rotation(id, pages[index].rotation))
        pages[index].rotation = (pages[index].rotation + 90) % 360
    }

    func remove(id: Int) {
        guard state == .ready, pages.count > 1, let index = pages.firstIndex(where: { $0.id == id }) else { return }
        remember(.insert(pages[index], index))
        pages.remove(at: index)
        thumbnails[id] = nil
        thumbnailOrder.removeAll { $0 == id }
    }

    private func remember(_ edit: Edit) {
        history.append((edit, revision))
        if history.count > 100 { history.removeFirst() }
        nextRevision += 1
        revision = nextRevision
        lastSavedURL = nil
    }

    func undo() {
        guard canUndo, let record = history.popLast() else { return }
        switch record.edit {
        case .move(let id, let destination):
            if let index = pages.firstIndex(where: { $0.id == id }) {
                let page = pages.remove(at: index)
                pages.insert(page, at: min(destination, pages.count))
            }
        case .rotation(let id, let rotation):
            if let index = pages.firstIndex(where: { $0.id == id }) { pages[index].rotation = rotation }
        case .insert(let page, let index):
            pages.insert(page, at: min(index, pages.count))
        }
        revision = record.revision
        lastSavedURL = nil
        errorMessage = nil
    }

    func export() {
        guard canExport, let documentName else { return }
        let name = URL(fileURLWithPath: documentName).deletingPathExtension().lastPathComponent + "-" + String(localized: "organized") + ".pdf"
        state = .choosingDestination
        let token = generation
        Task {
            let url = await choosePDFDestination(name: name)
            guard token == generation else { return }
            state = .ready
            guard let url else { return }
            do { try await export(to: url) } catch { errorMessage = describe(error) }
        }
    }

    func export(to url: URL) async throws {
        guard canExport, let document else { throw PDFToolError.invalidOrder }
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        guard !isOriginal(url) else { throw ExportError.originalDestination }
        state = .exporting
        errorMessage = nil
        let exportingPages = pages
        let exportingRevision = revision
        defer { state = .ready }
        let bytes = try await document.organizedData(pages: exportingPages)
        try await Task.detached(priority: .userInitiated) { try bytes.write(to: url, options: .atomic) }.value
        savedRevision = exportingRevision
        lastSavedURL = url
    }

    func isOriginal(_ url: URL) -> Bool { FileIdentity(url) == source }

    func copy(of pages: [OrganizedPage]) async throws -> Data {
        guard state == .ready, let document else { throw PDFToolError.invalidOrder }
        return try await document.organizedData(pages: pages)
    }

    func reset() {
        guard state != .exporting, state != .choosingDestination else { return }
        generation += 1
        openingTask?.cancel()
        openingTask = nil
        thumbnails = [:]
        thumbnailOrder = []
        document = nil
        source = nil
        pendingData = nil
        documentName = nil
        pageSizes = []
        pages = []
        isEncrypted = false
        notices = []
        state = .empty
        history = []
        revision = 0
        nextRevision = 0
        savedRevision = 0
        lastSavedURL = nil
        errorMessage = nil
    }
}

enum OrganizingText {
    static func conservation(_ notices: Set<PDFMergeNotice>) -> [String] {
        var messages: [String] = []
        if notices.contains(.accessibilityTags) {
            messages.append(String(localized: "Accessibility tags from the original PDF will not be kept in the saved copy."))
        }
        if notices.contains(.archivalProfile) {
            messages.append(String(localized: "Archival and print profiles will not be kept. The saved copy is not guaranteed to comply with PDF/A or retain the same print colors."))
        }
        return messages
    }

    static func message(_ error: Error) -> String {
        if error is OrganizingSession.ExportError {
            return String(localized: "Choose a different name or folder to keep your original PDF.")
        }
        guard let error = error as? PDFToolError else {
            return String(localized: "The operation could not be completed. Your original PDF has not changed.")
        }
        switch error {
        case .alreadySigned: return String(localized: "This PDF has a digital signature that organizing would invalidate.")
        case .unsupportedDocument: return String(localized: "This PDF contains features that cannot be preserved when organizing, such as attachments, layers or dynamic forms.")
        case .invalidOrder: return String(localized: "Keep at least one page before saving the PDF.")
        case .cancelled: return String(localized: "The operation was cancelled. Your original PDF has not changed.")
        default: return MergeText.message(error)
        }
    }
}
