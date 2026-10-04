import CoreGraphics
import Foundation
import Observation
import PDFCore

@MainActor
@Observable
final class WatermarkSession {
    enum State { case empty, opening, locked, ready, exporting }
    enum Kind: Hashable { case text, image }

    /// Everything the user sets on one watermark.
    struct Settings: Equatable, Identifiable {
        var id = UUID()
        var kind = Kind.text
        var text = String(localized: "CONFIDENTIAL")
        var color = WatermarkColor.stamp
        var image: SignatureImage?
        var center = CGPoint(x: 0.5, y: 0.5)
        var width: CGFloat = 0.6
        var angle: Double = 45
        var opacity: Double = 0.3
        var allPages = true
        var firstPage = 0
        var lastPage = 0
    }

    /// The watermarks of the document, never empty: the screen always has one to edit. One undo step brings back one of these.
    struct Layout: Equatable {
        var marks = [Settings()]
    }

    /// What a watermark looks like, whatever its place and size: one drawing serves every mark that looks the same.
    private struct Look: Hashable {
        let kind: Kind
        let text: String
        let color: [Double]
        let image: Data?
        let angle: Double
        let opacity: Double

        init(_ settings: Settings) {
            kind = settings.kind
            text = settings.text
            color = [settings.color.red, settings.color.green, settings.color.blue]
            image = settings.image?.dataPNG
            angle = settings.angle
            opacity = settings.opacity
        }
    }

    private(set) var state: State = .empty
    private(set) var sourceName = ""
    private(set) var sourceWasEncrypted = false
    private(set) var pageSizes: [CGSize] = []
    private(set) var pageIndex = 0
    private(set) var preview: CGImage?
    private var overlays: [Look: CGImage] = [:]
    /// The last drawing of each watermark: what the preview shows while a slider moves faster than the drawing.
    private var recent: [UUID: CGImage] = [:]
    private(set) var layout = Layout()
    /// Nil falls back to the first watermark.
    private(set) var selectedID: UUID?
    var errorMessage: String?
    private(set) var lastSavedURL: URL?

    private var document: PDFWatermarkDocument?
    private var source: FileIdentity?
    private var pendingData: Data?
    private var generation = 0
    private var revision = 0
    private var nextRevision = 0
    private var savedRevision = 0
    private var history: [(layout: Layout, revision: Int)] = []
    private var editStart: Layout?
    @ObservationIgnored private var openingTask: Task<Void, Never>?
    @ObservationIgnored private var previewTask: Task<Void, Never>?
    @ObservationIgnored private var overlayTask: Task<Void, Never>?
    @ObservationIgnored private var imageTask: Task<Void, Never>?

    /// The selected watermark: what the panel edits.
    var settings: Settings { layout.marks.first { $0.id == selectedID } ?? layout.marks[0] }

    /// The selected watermark as the engine draws it. Nil while its settings cannot be drawn.
    var mark: Watermark? { watermark(of: settings) }

    /// Every watermark that can be drawn, in the order they were placed.
    var marks: [Watermark] { layout.marks.compactMap(watermark(of:)) }

    func watermark(of settings: Settings) -> Watermark? {
        let content: Watermark.Content
        switch settings.kind {
        case .text: content = .text(settings.text, settings.color)
        case .image:
            guard let image = settings.image else { return nil }
            content = .image(image)
        }
        let pages = settings.allPages ? 0...max(0, pageSizes.count - 1) : settings.firstPage...settings.lastPage
        let mark = Watermark(content: content, center: settings.center, width: settings.width, angle: settings.angle,
                             opacity: settings.opacity, pages: pages)
        return mark.isValid ? mark : nil
    }

    /// The drawing of a watermark for the preview: its own, or its last one while the new one is being drawn.
    func overlay(for settings: Settings) -> CGImage? { overlays[Look(settings)] ?? recent[settings.id] }

    var canUndo: Bool { state == .ready && (!history.isEmpty || editStart != nil) }
    /// Every watermark can be drawn: an empty one is the selected one, and the panel says what it lacks.
    var canExport: Bool { state == .ready && marks.count == layout.marks.count }
    var canRemove: Bool { state == .ready && layout.marks.count > 1 }
    var canAdd: Bool { state == .ready && layout.marks.count < 50 }
    var hasUnexportedChanges: Bool { document != nil && (revision != savedRevision || (editStart != nil && editStart != layout)) }

    func open(_ url: URL) {
        guard state != .exporting else { return }
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
            let loaded = try await Task.detached(priority: .userInitiated) {
                try PDFWatermarkDocument(data: data, password: password)
            }.value
            let info = await loaded.information()
            guard token == generation, !Task.isCancelled else { return }
            document = loaded
            pendingData = nil
            sourceWasEncrypted = info.isEncrypted
            pageSizes = info.pageSizes
            layout.marks[0].lastPage = info.pageSizes.count - 1
            state = .ready
            refreshPreview()
            refreshOverlay()
        } catch let error as PDFToolError {
            guard token == generation else { return }
            switch error {
            case .passwordRequired, .wrongPassword: state = .locked
            default:
                state = .empty
                pendingData = nil
            }
            errorMessage = error == .passwordRequired ? nil : WatermarkText.message(error)
        } catch {
            guard token == generation else { return }
            state = .empty
            pendingData = nil
            errorMessage = String(localized: "This PDF could not be read.")
        }
    }

    func goToPage(_ index: Int) {
        guard state == .ready, pageSizes.indices.contains(index), index != pageIndex else { return }
        pageIndex = index
        // The panel edits what the user sees: a watermark of this page, when the selected one is elsewhere.
        if mark?.pages.contains(index) != true, let shown = layout.marks.first(where: { watermark(of: $0)?.pages.contains(index) == true }) {
            select(shown.id)
        }
        refreshPreview()
    }

    /// Changes the selected watermark. `final: false` changes it without an undo step, for a slider or a field still
    /// moving; the next final call records the pending edit as one step, and a final change as a step of its own.
    func update(final: Bool = true, _ change: (inout Settings) -> Void) {
        update(settings.id, final: final, change)
    }

    private func update(_ id: UUID, final: Bool = true, _ change: (inout Settings) -> Void) {
        arrange(final: final) { layout in
            guard let index = layout.marks.firstIndex(where: { $0.id == id }) else { return }
            change(&layout.marks[index])
        }
    }

    private func arrange(final: Bool = true, _ change: (inout Layout) -> Void) {
        guard state == .ready else { return }
        var next = layout
        change(&next)
        next.marks = next.marks.map(clamped)
        let changed = next != layout
        if final {
            if let start = editStart, start != layout { remember(start) }
            editStart = nil
            if changed { remember(layout) }
        } else if editStart == nil, changed {
            editStart = layout
        }
        layout = next
        if changed { refreshOverlay() }
    }

    /// The edit still moving on the watermark left behind ends there; an empty one, which cannot be drawn nor
    /// clicked, goes with the selection.
    func select(_ id: UUID) {
        guard id != settings.id, layout.marks.contains(where: { $0.id == id }) else { return }
        update { _ in }
        let left = settings
        selectedID = id
        if watermark(of: left) == nil, layout.marks.count > 1 { arrange { $0.marks.removeAll { $0.id == left.id } } }
    }

    /// Another watermark like the selected one, in the middle of the page on screen and on that page, selected: the
    /// user then drags it to its place.
    func addPlacement() {
        guard canAdd else { return }
        var copy = settings
        copy.id = UUID()
        copy.center = CGPoint(x: 0.5, y: 0.5)
        copy.firstPage = min(copy.firstPage, pageIndex)
        copy.lastPage = max(copy.lastPage, pageIndex)
        arrange { $0.marks.append(copy) }
        selectedID = copy.id
    }

    /// The selected watermark goes; the one placed before it is selected. The last watermark stays.
    func removePlacement() {
        guard canRemove, let index = layout.marks.firstIndex(where: { $0.id == settings.id }) else { return }
        arrange { $0.marks.remove(at: index) }
        selectedID = layout.marks[max(0, index - 1)].id
    }

    func useText() {
        guard settings.kind != .text else { return }
        update {
            $0.kind = .text
            $0.angle = 45
        }
    }

    func useImage() {
        guard settings.kind != .image, settings.image != nil else { return }
        update {
            $0.kind = .image
            $0.angle = 0
        }
    }

    /// The image goes on the watermark selected when the user chose it, whatever is selected when it is decoded.
    func importImage(_ url: URL) {
        imageTask?.cancel()
        let token = generation
        let id = settings.id
        imageTask = Task {
            let access = url.startAccessingSecurityScopedResource()
            defer { if access { url.stopAccessingSecurityScopedResource() } }
            do {
                let data = try await readFile(url, limit: 10 * 1024 * 1024, tooLarge: .imageTooLarge)
                let asset = try await Task.detached(priority: .userInitiated) { try SignatureImage.load(data: data) }.value
                guard !Task.isCancelled, token == generation, pageSizes.indices.contains(pageIndex) else { return }
                guard let target = layout.marks.first(where: { $0.id == id }) else { return }
                let placed = Watermark(content: .image(asset), center: target.center, width: target.width, angle: 0,
                                       opacity: target.opacity, pages: 0...0).fitted(in: pageSizes[pageIndex])
                errorMessage = nil
                update(id) {
                    $0.kind = .image
                    $0.image = asset
                    $0.angle = 0
                    $0.width = placed.width
                }
            } catch {
                guard !Task.isCancelled, token == generation else { return }
                errorMessage = WatermarkText.message(error)
            }
        }
    }

    func undo() {
        guard state == .ready else { return }
        update { _ in }
        guard let record = history.popLast() else { return }
        layout = record.layout
        revision = record.revision
        lastSavedURL = nil
        refreshOverlay()
    }

    func export() {
        guard canExport else { return }
        let token = generation
        let name = URL(fileURLWithPath: sourceName).deletingPathExtension().lastPathComponent + "-" + String(localized: "watermarked") + ".pdf"
        Task {
            guard let url = await choosePDFDestination(name: name), token == generation else { return }
            await saveCopy(to: url)
        }
    }

    func saveCopy(to url: URL) async {
        update { _ in }
        guard canExport, let document else { return }
        let marks = self.marks
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        guard FileIdentity(url) != source else {
            errorMessage = String(localized: "Choose a different name or folder to keep your original PDF.")
            return
        }
        state = .exporting
        errorMessage = nil
        let exportingRevision = revision
        defer { state = .ready }
        do {
            let bytes = try await document.watermarkedData(marks)
            try await Task.detached(priority: .userInitiated) { try bytes.write(to: url, options: .atomic) }.value
            savedRevision = exportingRevision
            lastSavedURL = url
        } catch {
            errorMessage = WatermarkText.message(error)
        }
    }

    func reset() {
        guard state != .exporting else { return }
        generation += 1
        openingTask?.cancel()
        previewTask?.cancel()
        overlayTask?.cancel()
        imageTask?.cancel()
        document = nil
        source = nil
        pendingData = nil
        sourceName = ""
        sourceWasEncrypted = false
        state = .empty
        pageSizes = []
        pageIndex = 0
        preview = nil
        overlays = [:]
        recent = [:]
        layout = Layout()
        selectedID = nil
        history = []
        editStart = nil
        revision = 0
        nextRevision = 0
        savedRevision = 0
        errorMessage = nil
        lastSavedURL = nil
    }

    private func clamped(_ settings: Settings) -> Settings {
        var result = settings
        let last = max(0, pageSizes.count - 1)
        result.text = String(result.text.prefix(Watermark.maxTextLength))
        result.center = CGPoint(x: min(max(result.center.x, 0), 1), y: min(max(result.center.y, 0), 1))
        result.width = min(max(result.width, Watermark.widths.lowerBound), Watermark.widths.upperBound)
        result.angle = min(max(result.angle, Watermark.angles.lowerBound), Watermark.angles.upperBound)
        result.opacity = min(max(result.opacity, Watermark.opacities.lowerBound), Watermark.opacities.upperBound)
        result.firstPage = min(max(result.firstPage, 0), last)
        result.lastPage = min(max(result.lastPage, result.firstPage), last)
        return result
    }

    private func remember(_ previous: Layout) {
        history.append((previous, revision))
        if history.count > 100 { history.removeFirst() }
        nextRevision += 1
        revision = nextRevision
        lastSavedURL = nil
    }

    private func refreshPreview() {
        previewTask?.cancel()
        preview = nil
        guard let document else { return }
        let index = pageIndex
        let token = generation
        previewTask = Task {
            do {
                // Collapse rapid page navigation before queuing another PDF render.
                try await Task.sleep(for: .milliseconds(35))
                let image = try await document.preview(pageIndex: index)
                guard !Task.isCancelled, token == generation, index == pageIndex else { return }
                preview = image
            } catch is CancellationError {
            } catch {
                guard !Task.isCancelled, token == generation, index == pageIndex else { return }
                errorMessage = String(localized: "This page could not be displayed. Try another page.")
            }
        }
    }

    /// Draws the looks the preview lacks, one task for all. The looks no watermark has any more go once the new
    /// drawings are in: a slider that moves must not leave the page bare.
    private func refreshOverlay() {
        overlayTask?.cancel()
        let marks = layout.marks
        let wanted = Dictionary(marks.compactMap { settings in watermark(of: settings).map { (Look(settings), $0) } }, uniquingKeysWith: { first, _ in first })
        recent = recent.filter { id, _ in marks.contains { $0.id == id } }
        let missing = wanted.filter { overlays[$0.key] == nil }
        guard !missing.isEmpty else {
            overlays = overlays.filter { wanted[$0.key] != nil }
            return
        }
        let token = generation
        overlayTask = Task {
            let drawn = await Task.detached(priority: .userInitiated) {
                missing.compactMapValues { try? $0.overlayImage(maxDimension: 800) }
            }.value
            guard !Task.isCancelled, token == generation else { return }
            overlays.merge(drawn) { _, new in new }
            overlays = overlays.filter { wanted[$0.key] != nil }
            for settings in marks { if let image = overlays[Look(settings)] { recent[settings.id] = image } }
        }
    }
}

enum WatermarkText {
    static func message(_ error: Error) -> String {
        switch error as? PDFToolError {
        case .alreadySigned: return String(localized: "This PDF has a digital signature. A watermark would invalidate it.")
        case .invalidImage: return String(localized: "Choose a readable PNG or JPEG image.")
        case .invalidPlacement: return String(localized: "Check the watermark settings before saving.")
        default: return SigningText.message(error)
        }
    }
}
