import Foundation
import Observation
import ScanCore

@MainActor
@Observable
public final class ScannerSession {
    public internal(set) var pages: [UUID: ScanPage] = [:]
    public internal(set) var documents: [ScanDocument] = []
    /// Pages of imports still running, in import order. They join `documents` when their whole import is done.
    public internal(set) var pending: [UUID] = []
    /// Pages whose photo could not be read. They are never exported.
    public internal(set) var unreadable: [UUID] = []

    /// The Edit menu's name for an undoable change. The app sets it: this module holds no user-facing text.
    public var describeAction: (EditAction) -> String = { _ in "" }
    /// Called when an undo or a redo changes a page, so the app can show that page.
    public var showPage: (UUID) -> Void = { _ in }
    /// Called when an undo or a redo changes the board, so the app can show the board.
    public var showBoard: () -> Void = { }

    static let supportedExtensions: Set<String> = ["heic", "heif", "jpg", "jpeg", "png"]

    let processor: PageProcessor
    let today: @Sendable () -> Date
    let concurrency: Int
    var batches: [[UUID]] = []
    var queue: [UUID] = []
    var firstRenders = 0
    var inFlight = 0
    /// Bumped by every render of a page, so that only the newest render lands.
    var generations: [UUID: Int] = [:]
    var rendering: Set<UUID> = []
    var rerender: Set<UUID> = []
    /// A waiter with a document waits for that document's pages only.
    var idleWaiters: [(documentID: UUID?, continuation: CheckedContinuation<Void, Never>)] = []

    public init(processor: @escaping PageProcessor = ScannerSession.pipeline(),
                today: @escaping @Sendable () -> Date = { Date() },
                concurrency: Int = ProcessInfo.processInfo.activeProcessorCount) {
        self.processor = processor
        self.today = today
        self.concurrency = max(1, concurrency)
    }

    public static func pipeline() -> PageProcessor {
        let pipeline = ScanPipeline()
        return { (url: URL, edits: PageEdits, detection: Detection?) async throws(ScanError) -> ProcessedPage in
            try await pipeline.process(url, edits: edits, detection: detection)
        }
    }

    public var isEmpty: Bool { pages.isEmpty }
    public var isProcessing: Bool { inFlight > 0 || !queue.isEmpty }

    public var progress: (done: Int, total: Int) {
        (pending.filter { pages[$0]?.status.isSettled ?? true }.count, pending.count)
    }

    /// Adds photos in file-name order. A folder adds the photos it holds; a photo already here is skipped.
    public func add(_ urls: [URL]) {
        var seen = Set(pages.values.map(\.url.standardizedFileURL))
        let files = urls.flatMap(Self.expand)
            .filter { seen.insert($0.standardizedFileURL).inserted }
            .sorted { $0.lastPathComponent.localizedStandardCompare($1.lastPathComponent) == .orderedAscending }
        var batch: [UUID] = []
        for url in files {
            let page: ScanPage
            if Self.supportedExtensions.contains(url.pathExtension.lowercased()) {
                page = ScanPage(url: url)
                batch.append(page.id)
            } else {
                page = ScanPage(url: url, status: .failed(.unsupportedFormat(url), previous: nil))
                unreadable.append(page.id)
            }
            pages[page.id] = page
        }
        guard !batch.isEmpty else { return }
        batches.append(batch)
        pending += batch
        queue += batch
        pump()
    }

    public func waitUntilIdle() async {
        await wait(for: nil)
    }

    func wait(for documentID: UUID?) async {
        guard !isIdle(for: documentID) else { return }
        await withCheckedContinuation { idleWaiters.append((documentID, $0)) }
    }

    /// A deleted document has nothing left to wait for.
    func isIdle(for documentID: UUID?) -> Bool {
        guard let documentID else { return !isProcessing }
        return documents.first { $0.id == documentID }?.pageIDs.allSatisfy { pages[$0]?.status.isSettled ?? true } ?? true
    }

    static func expand(_ url: URL) -> [URL] {
        // Photos picked or dropped by the user stay readable for the whole session.
        _ = url.startAccessingSecurityScopedResource()
        guard (try? url.resourceValues(forKeys: [.isDirectoryKey]))?.isDirectory == true else {
            return url.lastPathComponent.hasPrefix(".") ? [] : [url]
        }
        let children = (try? FileManager.default.contentsOfDirectory(at: url, includingPropertiesForKeys: [.isDirectoryKey],
                                                                     options: [.skipsHiddenFiles])) ?? []
        return children.filter { (try? $0.resourceValues(forKeys: [.isDirectoryKey]))?.isDirectory != true }
    }

    func pump() {
        while firstRenders < concurrency, !queue.isEmpty {
            guard let render = startRender(queue.removeFirst()) else { continue }
            firstRenders += 1
            Task {
                await render.value
                firstRenders -= 1
                pump()
            }
        }
    }

    /// Renders a page with its current edits. A newer render of the same page wins, and a deleted page drops its result.
    /// At most one render per page runs: 8 quick rotations rendered in parallel reached 1.2 GB.
    @discardableResult
    func startRender(_ id: UUID) -> Task<Void, Never>? {
        guard var page = pages[id] else { return nil }
        let generation = (generations[id] ?? 0) + 1
        generations[id] = generation
        if rendering.contains(id) {
            rerender.insert(id)
            return nil
        }
        rendering.insert(id)
        let previous = page.status.result
        page.status = .processing(previous: previous)
        pages[id] = page
        let edits = Self.resolvedEdits(page.edits, previous: previous?.processed)
        let url = page.url
        let detection = previous?.processed.detection
        let processor = self.processor
        inFlight += 1
        return Task {
            land(await Self.render(processor, url, edits, detection), on: id, generation: generation, previous: previous)
        }
    }

    @concurrent
    nonisolated static func render(_ processor: PageProcessor, _ url: URL, _ edits: PageEdits,
                                   _ detection: Detection?) async -> Result<PageResult, ScanError> {
        do throws(ScanError) {
            return .success(PageResult(try await processor(url, edits, detection)))
        } catch {
            return .failure(error)
        }
    }

    func land(_ outcome: Result<PageResult, ScanError>, on id: UUID, generation: Int, previous: PageResult?) {
        inFlight -= 1
        defer { resumeIdleWaiters() }
        rendering.remove(id)
        if rerender.remove(id) != nil {
            startRender(id)
            return
        }
        guard generations[id] == generation, var page = pages[id] else { return }
        switch outcome {
        case .success(let result): page.status = .ready(result)
        case .failure(let error): page.status = .failed(error, previous: previous)
        }
        pages[id] = page
        settleBatches()
    }

    /// Fields the user left automatic follow the previous render, so a re-render keeps its turn and its watermark choice.
    static func resolvedEdits(_ edits: PageEdits, previous: ProcessedPage?) -> PageEdits {
        guard let previous else { return edits }
        var resolved = edits
        resolved.quarterTurns = edits.quarterTurns ?? previous.quarterTurns
        let mode = edits.mode ?? previous.settings.mode
        resolved.mode = mode
        if edits.keepWatermark == nil, previous.settings.mode == mode {
            resolved.keepWatermark = previous.settings.keepWatermark
        }
        return resolved
    }

    /// Suggests the documents of finished imports, oldest first, so documents keep the import order.
    func settleBatches() {
        while let batch = batches.first, batch.allSatisfy({ pages[$0]?.status.isSettled ?? true }) {
            batches.removeFirst()
            let alive = batch.filter { pages[$0] != nil }
            let readable = alive.filter { pages[$0]?.status.result != nil }
            unreadable += alive.filter { pages[$0]?.status.result == nil }
            let texts = readable.compactMap { id in
                pages[id]?.status.result.map { PageText(id: id, lines: $0.processed.lines, captureDate: $0.processed.captureDate) }
            }
            let suggestions = DocumentSuggester.suggest(texts, today: today())
            let names = NameFormatting.uniqued(suggestions.map(\.name), avoiding: Set(documents.map(\.name)))
            documents += zip(suggestions, names).map { ScanDocument(name: $1, pageIDs: $0.pageIDs, evidence: $0.evidence) }
            pending.removeAll { batch.contains($0) }
        }
    }

    func resumeIdleWaiters() {
        let done = idleWaiters.filter { isIdle(for: $0.documentID) }
        idleWaiters.removeAll { isIdle(for: $0.documentID) }
        done.forEach { $0.continuation.resume() }
    }
}
