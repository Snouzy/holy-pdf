import Foundation
import ScanCore
import ScanSession
import TestSupport

/// Holds renders until the test opens it, so a test can act while a render is in flight without a delay.
actor Gate {
    private var isOpen = false
    private var waiting: [CheckedContinuation<Void, Never>] = []

    func pass() async {
        guard !isOpen else { return }
        await withCheckedContinuation { waiting.append($0) }
    }

    func open() {
        isOpen = true
        waiting.forEach { $0.resume() }
        waiting = []
    }
}

actor ProcessorLog {
    struct Call: Sendable {
        var file: String
        var edits: PageEdits
        var detection: Detection?
    }

    private(set) var calls: [Call] = []
    private(set) var mostAtOnce = 0
    private var running = 0

    func start(_ call: Call) {
        calls.append(call)
        running += 1
        mostAtOnce = max(mostAtOnce, running)
    }

    func end() {
        running -= 1
    }
}

/// Answers like `ScanPipeline`, without Vision: each file gets the lines given for its name.
struct FakePages: Sendable {
    var lines: [String: [TextLine]] = [:]
    var failing: Set<String> = []
    var needsReview: Set<String> = []
    /// Fails only when the page is rendered again, like a photo moved away after its import.
    var failingReRenders: Set<String> = []
    var quarterTurns: [String: Int] = [:]
    var delay: Duration = .zero
    var slowColorRenders = false
    /// Every render of these files waits for `gate`.
    var gated: Set<String> = []
    let log = ProcessorLog()
    let gate = Gate()

    static let jpeg = (try? JPEGEncoder.encode(TestImages.marked(width: 40, height: 57))) ?? Data()
    static let today = Date(timeIntervalSince1970: 1_767_614_400)

    static func line(_ text: String, y: Double, height: Double = 0.02) -> TextLine {
        TextLine(text: text, box: NormalizedRect(x: 0.1, y: y, width: 0.6, height: height), confidence: 1)
    }

    var processor: PageProcessor {
        { [self] (url: URL, edits: PageEdits, detection: Detection?) async throws(ScanError) -> ProcessedPage in
            let file = url.lastPathComponent
            await log.start(.init(file: file, edits: edits, detection: detection))
            let wait = slowColorRenders && edits.mode == .color ? .milliseconds(80) : delay
            if wait > .zero { try? await Task.sleep(for: wait) }
            if gated.contains(file) { await gate.pass() }
            await log.end()
            if failing.contains(file) || (detection != nil && failingReRenders.contains(file)) { throw .unreadableFile(url) }
            let found = detection ?? Detection(quad: .fullImage, visionConfidence: 0.9, inlierRatios: [1, 1, 1, 1],
                                               reviewReasons: needsReview.contains(file) ? [.weakEdge] : [])
            return ProcessedPage(detection: found, quad: edits.quad ?? found.quad, quarterTurns: edits.quarterTurns ?? quarterTurns[file] ?? 0,
                                 settings: EnhanceSettings(mode: edits.mode ?? .document, keepWatermark: edits.keepWatermark ?? false),
                                 format: edits.format, pixelSize: PixelSize(width: 1654, height: 2339), jpeg: Self.jpeg,
                                 lines: lines[file] ?? [], captureDate: nil)
        }
    }

    @MainActor
    func session(concurrency: Int = 4) -> ScannerSession {
        ScannerSession(processor: processor, today: { Self.today }, concurrency: concurrency)
    }
}

@MainActor
func undoManager() -> UndoManager {
    let undo = UndoManager()
    undo.groupsByEvent = false
    return undo
}

@MainActor
func grouped(_ undo: UndoManager, _ body: () -> Void) {
    undo.beginUndoGrouping()
    body()
    undo.endUndoGrouping()
}

/// Empty files: the fake processor never reads them.
func photos(_ names: String...) throws -> [URL] {
    let folder = try TestImages.emptyFolder()
    return try names.map { name in
        let url = folder.appending(path: name)
        try Data().write(to: url)
        return url
    }
}
