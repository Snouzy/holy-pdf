#if DEBUG
import CoreGraphics
import Foundation
import ImageIO
import ScanCore
import ScanSession
import UniformTypeIdentifiers

/// A board made of drawn photos and a processor without Vision, for previews and screen snapshots.
enum DemoSession {
    static let today = Date(timeIntervalSince1970: 1_767_614_400)

    static let texts: [String: [String]] = [
        "IMG_0001": ["CONTRACT", "Pagina 1 din 3"],
        "IMG_0002": ["Pagina 2 din 3"],
        "IMG_0003": ["Pagina 3 din 3"],
        "IMG_0004": ["FACTURA", "05.01.2026"],
        "IMG_0005": ["DECLARATIE"],
    ]
    static let toCheck: Set<String> = ["IMG_0002"]

    @MainActor
    static func make() -> ScannerSession {
        let session = ScannerSession(processor: processor, today: { today }, concurrency: 4)
        session.describeAction = ScannerText.title(of:)
        session.add(photos())
        return session
    }

    static func photos() -> [URL] {
        let folder = FileManager.default.temporaryDirectory.appending(path: "demo-photos")
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return texts.keys.sorted().map { name in
            let url = folder.appending(path: "\(name).png")
            if !FileManager.default.fileExists(atPath: url.path), let image = draw(width: 1200, height: 1600, photo: true) {
                write(image, to: url)
            }
            return url
        }
    }

    static let processor: PageProcessor = { (url: URL, edits: PageEdits, detection: Detection?) async throws(ScanError) -> ProcessedPage in
        let name = url.deletingPathExtension().lastPathComponent
        let found = detection ?? Detection(
            quad: Quad(topLeft: .init(x: 0.15, y: 0.09), topRight: .init(x: 0.84, y: 0.11),
                       bottomRight: .init(x: 0.87, y: 0.84), bottomLeft: .init(x: 0.12, y: 0.83)),
            visionConfidence: 0.9, inlierRatios: [1, 1, 1, 1], reviewReasons: toCheck.contains(name) ? [.weakEdge] : [])
        guard let page = draw(width: 827, height: 1170, photo: false) else { throw .renderFailed }
        let lines = (texts[name] ?? []).enumerated().map { index, text in
            TextLine(text: text, box: index == 0 && !text.hasPrefix("Pagina")
                         ? NormalizedRect(x: 0.1, y: 0.1, width: 0.5, height: 0.04)
                         : NormalizedRect(x: 0.4, y: 0.95, width: 0.2, height: 0.02),
                     confidence: 1)
        }
        return ProcessedPage(detection: found, quad: edits.quad ?? found.quad, quarterTurns: edits.quarterTurns ?? 0,
                             settings: EnhanceSettings(mode: edits.mode ?? .document, keepWatermark: edits.keepWatermark ?? false),
                             format: edits.format, pixelSize: PixelSize(page), jpeg: try JPEGEncoder.encode(page),
                             lines: lines, captureDate: nil)
    }

    /// A page with grey bars for text; as a photo, the page sits tilted on a darker table.
    static func draw(width: Int, height: Int, photo: Bool) -> CGImage? {
        guard let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
                                      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
            return nil
        }
        let w = Double(width), h = Double(height)
        context.translateBy(x: 0, y: h)
        context.scaleBy(x: 1, y: -1)
        context.setFillColor(gray: photo ? 0.45 : 1, alpha: 1)
        context.fill(CGRect(x: 0, y: 0, width: w, height: h))
        var page = [CGPoint(x: 0, y: 0), CGPoint(x: w, y: 0), CGPoint(x: w, y: h), CGPoint(x: 0, y: h)]
        if photo {
            page = [CGPoint(x: 0.15 * w, y: 0.09 * h), CGPoint(x: 0.84 * w, y: 0.11 * h),
                    CGPoint(x: 0.87 * w, y: 0.84 * h), CGPoint(x: 0.12 * w, y: 0.83 * h)]
            context.setFillColor(gray: 0.95, alpha: 1)
            context.addLines(between: page)
            context.fillPath()
        }
        context.setFillColor(gray: 0.55, alpha: 1)
        let left = photo ? 0.22 : 0.1, right = photo ? 0.75 : 0.88
        for row in 0..<18 {
            let y = (photo ? 0.18 : 0.12) + Double(row) * (photo ? 0.035 : 0.042)
            let length = row % 4 == 3 ? 0.6 : 1
            context.fill(CGRect(x: left * w, y: y * h, width: (right - left) * length * w, height: 0.008 * h))
        }
        return context.makeImage()
    }

    static func write(_ image: CGImage, to url: URL) {
        guard let destination = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else { return }
        CGImageDestinationAddImage(destination, image, nil)
        CGImageDestinationFinalize(destination)
    }
}
#endif
