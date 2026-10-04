import CoreGraphics
import CoreImage
import Foundation

/// What the user changed on a page. `nil` means automatic.
public struct PageEdits: Hashable, Sendable, Codable {
    public var quad: Quad?
    public var quarterTurns: Int?
    public var mode: RenderMode?
    public var keepWatermark: Bool?
    public var erase: [EraseMark]
    public var format: PageFormat

    public init(quad: Quad? = nil, quarterTurns: Int? = nil, mode: RenderMode? = nil, keepWatermark: Bool? = nil,
                erase: [EraseMark] = [], format: PageFormat = .auto) {
        self.quad = quad
        self.quarterTurns = quarterTurns
        self.mode = mode
        self.keepWatermark = keepWatermark
        self.erase = erase
        self.format = format
    }

    enum CodingKeys: String, CodingKey {
        case quad, quarterTurns, mode, keepWatermark, erase, format
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        quad = try container.decodeIfPresent(Quad.self, forKey: .quad)
        quarterTurns = try container.decodeIfPresent(Int.self, forKey: .quarterTurns)
        mode = try container.decodeIfPresent(RenderMode.self, forKey: .mode)
        keepWatermark = try container.decodeIfPresent(Bool.self, forKey: .keepWatermark)
        erase = try container.decodeIfPresent([EraseMark].self, forKey: .erase) ?? []
        format = try container.decodeIfPresent(PageFormat.self, forKey: .format) ?? .auto
    }
}

public struct ProcessedPage: Sendable {
    public var detection: Detection
    public var quad: Quad
    public var quarterTurns: Int
    public var settings: EnhanceSettings
    public var format: PageFormat
    public var pixelSize: PixelSize
    public var jpeg: Data
    public var lines: [TextLine]
    /// Text recognition failed: the page has no text layer.
    public var textUnread: Bool
    public var captureDate: Date?

    public init(detection: Detection, quad: Quad, quarterTurns: Int, settings: EnhanceSettings, format: PageFormat,
                pixelSize: PixelSize, jpeg: Data, lines: [TextLine], textUnread: Bool = false, captureDate: Date?) {
        self.detection = detection
        self.quad = quad
        self.quarterTurns = quarterTurns
        self.settings = settings
        self.format = format
        self.pixelSize = pixelSize
        self.jpeg = jpeg
        self.lines = lines
        self.textUnread = textUnread
        self.captureDate = captureDate
    }
}

public struct ScanPipeline: Sendable {
    let context: CIContext
    let readText: @Sendable (CGImage) throws(ScanError) -> [TextLine]

    public init(context: CIContext = Enhancer.makeContext()) {
        self.init(context: context, readText: { image throws(ScanError) in try TextReader.read(image) })
    }

    init(context: CIContext, readText: @escaping @Sendable (CGImage) throws(ScanError) -> [TextLine]) {
        self.context = context
        self.readText = readText
    }

    /// Load → detect → rectify → turn upright → enhance → erase → JPEG and OCR.
    /// A known `detection` skips Vision: a page re-rendered after an edit keeps its first detection.
    public func process(_ url: URL, edits: PageEdits = PageEdits(), detection: Detection? = nil) async throws(ScanError) -> ProcessedPage {
        try await offPool { () throws(ScanError) in try runStages(url, edits: edits, knownDetection: detection) }
    }

    private func runStages(_ url: URL, edits: PageEdits, knownDetection: Detection?) throws(ScanError) -> ProcessedPage {
        let loaded = try ImageLoader.load(url)
        let detection = knownDetection ?? PageDetector.detect(in: loaded.image)
        let quad = edits.quad ?? detection.quad
        let flat = try Rectifier.rectify(loaded.image, quad: quad)
        let turns = edits.quarterTurns ?? OrientationDetector.quarterTurns(for: flat, context: context)
        let upright = Orientation.rotate(flat, quarterTurns: turns)
        let mode = edits.mode ?? .document
        let keepWatermark = edits.keepWatermark ?? (mode == .document && WatermarkDetector.detect(upright, context: context))
        let settings = EnhanceSettings(mode: mode, keepWatermark: keepWatermark)
        let finished = EraseMask.apply(edits.erase, to: Enhancer.enhance(upright, settings: settings, context: context))
        guard let sRGB = CGColorSpace(name: CGColorSpace.sRGB),
              let image = context.createCGImage(finished, from: finished.extent, format: .RGBA8, colorSpace: sRGB) else {
            throw .renderFailed
        }
        let jpeg = try JPEGEncoder.encode(image)
        let lines = try? readText(image)
        return ProcessedPage(detection: detection, quad: quad, quarterTurns: ((turns % 4) + 4) % 4, settings: settings,
                             format: edits.format, pixelSize: PixelSize(image), jpeg: jpeg, lines: lines ?? [],
                             textUnread: lines == nil, captureDate: loaded.captureDate)
    }
}

/// Vision needs a free pool thread to finish a request, so a blocking call on the
/// Swift concurrency pool deadlocks once every core waits on one. Run it on GCD.
func offPool<Value: Sendable, Failure: Error>(_ body: @escaping @Sendable () throws(Failure) -> Value) async throws(Failure) -> Value {
    try await withCheckedContinuation { continuation in
        DispatchQueue.global(qos: .userInitiated).async {
            continuation.resume(returning: Result(catching: body))
        }
    }.get()
}
