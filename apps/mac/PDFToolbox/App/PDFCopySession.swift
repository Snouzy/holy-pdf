import CoreGraphics
import Foundation
import Observation
import PDFCore

/// Where a long work is: the page it handles, of how many.
struct WorkStep: Equatable, Sendable {
    let done: Int
    let total: Int
}

/// One PDF opened by a tool that saves a changed copy: the opening, the password, the page previews and the save.
/// The tool keeps its own settings and gives `make`, the function that builds the copy.
@MainActor
@Observable
final class PDFCopySession {
    enum State { case empty, opening, locked, ready, working, choosingDestination, exporting }
    typealias Overlay = @Sendable (CGContext, CGRect) -> Void
    typealias Maker = @Sendable (_ data: Data, _ password: String) async throws -> Data
    typealias Report = @Sendable (WorkStep) -> Void
    /// A maker that takes minutes: it says where it is.
    typealias ReportingMaker = @Sendable (_ data: Data, _ password: String, _ report: @escaping Report) async throws -> Data

    private(set) var state: State = .empty
    private(set) var sourceName = ""
    private(set) var isEncrypted = false
    private(set) var pageSizes: [CGSize] = []
    private(set) var notices: [String] = []
    private(set) var pageIndex = 0
    private(set) var preview: CGImage?
    private(set) var lastSavedURL: URL?
    private(set) var hasUnsavedEdits = false
    private(set) var step: WorkStep?
    private(set) var findings: (any Sendable)?
    var errorMessage: String?
    /// What the tool draws over the preview of a page, in the reader's space. The tool calls `refreshPreview` after a change.
    @ObservationIgnored var overlay: (@MainActor (Int) -> Overlay?)?
    /// What the tool draws under the page, on the white paper.
    @ObservationIgnored var underlay: (@MainActor (Int) -> Overlay?)?
    /// The tool's own look at a document that opens: it throws to refuse the document, or returns notes for the screen.
    @ObservationIgnored var inspect: (@Sendable (_ data: Data, _ password: String) async throws -> [String])?
    /// What the tool reads in a document that opens. The result waits in `findings`; a throw refuses the document.
    @ObservationIgnored var survey: (@Sendable (_ data: Data, _ password: String) async throws -> any Sendable)?
    @ObservationIgnored var onSaved: (@MainActor () -> Void)?
    /// After a document opened, with its `findings` in place.
    @ObservationIgnored var onOpened: (@MainActor () -> Void)?
    @ObservationIgnored var onClosed: (@MainActor () -> Void)?

    private let describe: (Error) -> String
    private let allowsSigned: Bool
    private var document: PDFOpenedDocument?
    private var shown: PDFOpenedDocument?
    private var source: FileIdentity?
    private var pendingData: Data?
    private var generation = 0
    private var workGeneration = 0
    @ObservationIgnored private var runningWork: (id: Int, stop: () -> Void, wait: () async -> Void)?
    @ObservationIgnored private var openingTask: Task<Void, Never>?
    @ObservationIgnored private var previewTask: Task<Void, Never>?

    init(describe: @escaping (Error) -> String, allowsSigned: Bool = false) {
        self.describe = describe
        self.allowsSigned = allowsSigned
    }

    var isBusy: Bool { state == .opening || state == .working || state == .choosingDestination || state == .exporting }

    func open(_ url: URL) {
        guard state != .working, state != .exporting, state != .choosingDestination else { return }
        reset()
        sourceName = url.lastPathComponent
        state = .opening
        let token = generation
        openingTask = Task {
            let access = url.startAccessingSecurityScopedResource()
            defer { if access { url.stopAccessingSecurityScopedResource() } }
            guard token == generation, !Task.isCancelled else { return }
            source = FileIdentity(url)
            do {
                let data = try await readFile(url, limit: 256 * 1024 * 1024)
                guard token == generation, !Task.isCancelled else { return }
                pendingData = data
                await load(data, password: "", token: token)
            } catch {
                guard token == generation else { return }
                state = .empty
                errorMessage = String(localized: "The PDF could not be opened. Choose a readable file under 256 MB.")
            }
        }
    }

    func unlock(_ password: String) {
        guard state == .locked, let pendingData else { return }
        state = .opening
        errorMessage = nil
        let token = generation
        openingTask = Task { await load(pendingData, password: password, token: token) }
    }

    private func load(_ data: Data, password: String, token: Int) async {
        do {
            let (loaded, notes, found) = try await Task.detached(priority: .userInitiated) { [inspect, survey, allowsSigned] in
                (try PDFOpenedDocument(data: data, password: password, allowsSigned: allowsSigned),
                 try await inspect?(data, password) ?? [], try await survey?(data, password))
            }.value
            guard token == generation, !Task.isCancelled else { return }
            document = loaded
            notices = notes
            findings = found
            pendingData = nil
            isEncrypted = loaded.info.isEncrypted
            pageSizes = loaded.info.pageSizes
            state = .ready
            refreshPreview()
            onOpened?()
        } catch {
            guard token == generation else { return }
            switch error as? PDFToolError {
            case .passwordRequired: state = .locked
            case .wrongPassword:
                state = .locked
                errorMessage = describe(error)
            default:
                state = .empty
                pendingData = nil
                errorMessage = describe(error)
            }
        }
    }

    /// Reads the open document in the background, with no change of state: a count for the screen. Nil when the
    /// document closed before the reading ended.
    func read<Value: Sendable>(_ work: @escaping @Sendable (_ data: Data, _ password: String) -> Value) async -> Value? {
        guard let document else { return nil }
        let token = generation
        let value = await Task.detached(priority: .utility) { [data = document.data, password = document.password] in work(data, password) }.value
        return token == generation ? value : nil
    }

    /// The preview shows this copy in place of the document: what a tool is about to save. Nil shows the document again.
    func showCopy(_ copy: PDFOpenedDocument?) {
        shown = copy
        refreshPreview()
    }

    func goToPage(_ index: Int) {
        guard state == .ready, pageSizes.indices.contains(index), index != pageIndex else { return }
        pageIndex = index
        preview = nil
        errorMessage = nil
        refreshPreview()
    }

    func refreshPreview() {
        previewTask?.cancel()
        guard let document = shown ?? document else { return }
        let index = pageIndex
        let token = generation
        let overlay = overlay?(index)
        let underlay = underlay?(index)
        previewTask = Task {
            do {
                // Collapse rapid changes before queuing another PDF render.
                try await Task.sleep(for: .milliseconds(35))
                let image = try await document.preview(pageIndex: index, overlay: overlay, underlay: underlay)
                guard !Task.isCancelled, token == generation, index == pageIndex else { return }
                preview = image
            } catch is CancellationError {
            } catch {
                guard !Task.isCancelled, token == generation, index == pageIndex else { return }
                errorMessage = String(localized: "This page could not be displayed. Try another page.")
            }
        }
    }

    /// Runs the tool's work on the open document, away from the main actor. The session is busy meanwhile.
    /// Nil when the work failed, and the message says why, or when `cancelWork` stopped it.
    func prepare<Value: Sendable>(_ work: @escaping @Sendable (_ data: Data, _ password: String) async throws -> Value) async -> Value? {
        guard state == .ready, let document else { return nil }
        state = .working
        errorMessage = nil
        lastSavedURL = nil
        workGeneration += 1
        let token = workGeneration
        // Minutes of work must not slow down when the window is hidden.
        let activity = ProcessInfo.processInfo.beginActivity(options: .userInitiated, reason: "PDF work")
        defer { ProcessInfo.processInfo.endActivity(activity) }
        // A cancelled write still runs. Two at once would fight for the memory and the threads the previews need.
        await runningWork?.wait()
        guard token == workGeneration else { return nil }
        let task = Task.detached(priority: .userInitiated) { [data = document.data, password = document.password] in
            try await work(data, password)
        }
        runningWork = (token, { task.cancel() }, { _ = await task.result })
        let result = await task.result
        if runningWork?.id == token { runningWork = nil }
        guard token == workGeneration else { return nil }
        state = .ready
        switch result {
        case .success(let value): return value
        case .failure(let error):
            errorMessage = describe(error)
            return nil
        }
    }

    /// `prepare` for a work that says where it is: `step` follows it while the work runs.
    func prepare<Value: Sendable>(
        reporting work: @escaping @Sendable (_ data: Data, _ password: String, _ report: @escaping Report) async throws -> Value
    ) async -> Value? {
        let (steps, report) = AsyncStream<WorkStep>.makeStream(bufferingPolicy: .bufferingNewest(1))
        // A cancelled work still reports its last page: only the latest work speaks.
        let token = workGeneration + 1
        let showing = Task { for await step in steps where token == workGeneration { self.step = step } }
        let value = await prepare { data, password in
            defer { report.finish() }
            return try await work(data, password) { report.yield($0) }
        }
        report.finish()
        await showing.value
        if token == workGeneration { step = nil }
        return value
    }

    /// PDFKit cannot stop in the middle of a write: the session is free at once, and the result of the work is dropped when it ends.
    func cancelWork() {
        guard state == .working else { return }
        workGeneration += 1
        runningWork?.stop()
        step = nil
        state = .ready
    }

    /// `unsaved` is false when the edit left nothing to lose: the last mark was removed.
    func edited(unsaved: Bool = true) {
        hasUnsavedEdits = unsaved
        lastSavedURL = nil
    }

    func export(suffix: String, make: @escaping Maker) {
        export(choosing: destination(suffix), make: make)
    }

    func export(suffix: String, reporting make: @escaping ReportingMaker) {
        export(choosing: destination(suffix)) { [self] in await saveCopy(to: $0, reporting: make) }
    }

    func export(choosing destination: @escaping @MainActor () async -> URL?, make: @escaping Maker) {
        export(choosing: destination) { [self] in await saveCopy(to: $0, make: make) }
    }

    private func destination(_ suffix: String) -> @MainActor () async -> URL? {
        let name = URL(fileURLWithPath: sourceName).deletingPathExtension().lastPathComponent + "-" + suffix + ".pdf"
        return { await choosePDFDestination(name: name) }
    }

    /// `destination` is the save panel. The session is busy while it is open, so the copy holds what was on screen.
    private func export(choosing destination: @escaping @MainActor () async -> URL?, save: @escaping @MainActor (URL) async -> Void) {
        // Busy before the task starts: a second call in the same turn of the run loop must find the session taken.
        guard state == .ready else { return }
        state = .choosingDestination
        Task {
            let url = await destination()
            state = .ready
            if let url { await save(url) }
        }
    }

    /// Waits for a panel with the session busy: nothing replaces the document under it. Nil without a document.
    func choosing<Choice>(_ panel: @MainActor () async -> Choice?) async -> Choice? {
        guard state == .ready else { return nil }
        state = .choosingDestination
        defer { state = .ready }
        return await panel()
    }

    /// For a copy that takes minutes: the screen shows its steps and the user can cancel it, as in `prepare`.
    func saveCopy(to url: URL, reporting make: @escaping ReportingMaker) async {
        guard state == .ready else { return }
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        guard isFree(url) else { return }
        let written: Void? = await prepare(reporting: { data, password, report in
            let copy = try await make(data, password, report)
            // A work that cannot stop ends after its cancel: its copy must not reach the disk then.
            try Task.checkCancellation()
            try copy.write(to: url, options: .atomic)
        })
        guard written != nil else { return }
        hasUnsavedEdits = false
        lastSavedURL = url
        onSaved?()
    }

    private func isFree(_ url: URL) -> Bool {
        guard FileIdentity(url) == source else { return true }
        errorMessage = String(localized: "Choose a different name or folder to keep your original PDF.")
        return false
    }

    func saveCopy(to url: URL, make: @escaping Maker) async {
        guard state == .ready, let document else { return }
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        guard isFree(url) else { return }
        state = .exporting
        errorMessage = nil
        lastSavedURL = nil
        do {
            try await Task.detached(priority: .userInitiated) { [data = document.data, password = document.password] in
                try await make(data, password).write(to: url, options: .atomic)
            }.value
            hasUnsavedEdits = false
            lastSavedURL = url
        } catch {
            errorMessage = describe(error)
        }
        state = .ready
        if lastSavedURL != nil { onSaved?() }
    }

    func reset() {
        guard state != .working, state != .exporting, state != .choosingDestination else { return }
        generation += 1
        openingTask?.cancel()
        previewTask?.cancel()
        document = nil
        shown = nil
        source = nil
        pendingData = nil
        sourceName = ""
        isEncrypted = false
        pageSizes = []
        notices = []
        findings = nil
        pageIndex = 0
        preview = nil
        lastSavedURL = nil
        hasUnsavedEdits = false
        errorMessage = nil
        state = .empty
        onClosed?()
    }
}
