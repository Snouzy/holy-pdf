import CoreGraphics
import CoreText
import Foundation
import ImageIO
import PDFKit

public struct WatermarkColor: Hashable, Sendable {
    public var red: Double
    public var green: Double
    public var blue: Double

    public init(red: Double, green: Double, blue: Double) {
        self.red = red
        self.green = green
        self.blue = blue
    }

    /// The brand's stamp red, `--stamp` in the site's tokens.
    public static let stamp = WatermarkColor(red: 200 / 255, green: 50 / 255, blue: 27 / 255)
}

public struct Watermark: Equatable, Sendable {
    public enum Content: Hashable, Sendable {
        case text(String, WatermarkColor)
        case image(SignatureImage)
    }

    public static let maxTextLength = 80
    public static let widths: ClosedRange<CGFloat> = 0.05...1
    public static let angles: ClosedRange<Double> = -90...90
    public static let opacities: ClosedRange<Double> = 0.1...1

    public var content: Content
    /// Normalized to the displayed crop box, with a top-left origin, like `SignaturePlacement`.
    public var center: CGPoint
    /// The unrotated mark's width, as a share of the displayed page width.
    public var width: CGFloat
    /// Degrees, counter-clockwise as the reader sees the page.
    public var angle: Double
    public var opacity: Double
    /// Zero-based and inclusive.
    public var pages: ClosedRange<Int>

    public init(content: Content, center: CGPoint = CGPoint(x: 0.5, y: 0.5), width: CGFloat = 0.6, angle: Double = 45,
                opacity: Double = 0.3, pages: ClosedRange<Int>) {
        self.content = content
        self.center = center
        self.width = width
        self.angle = angle
        self.opacity = opacity
        self.pages = pages
    }

    public var isValid: Bool {
        if case .text(let value, _) = content,
           value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || value.count > Self.maxTextLength { return false }
        return (0...1).contains(center.x) && (0...1).contains(center.y) && Self.widths.contains(width)
            && Self.angles.contains(angle) && Self.opacities.contains(opacity) && pages.lowerBound >= 0
    }

    /// The rotated mark's bounding box on a page `pageWidth` wide, in the page's unit.
    public func boundingSize(pageWidth: CGFloat) -> CGSize {
        let width = self.width * pageWidth
        let height = width * WatermarkPainter.aspect(of: content)
        let radians = angle * .pi / 180
        let sine = abs(sin(radians)), cosine = abs(cos(radians))
        return CGSize(width: width * cosine + height * sine, height: width * sine + height * cosine)
    }

    public func widthAfterCornerDrag(_ translation: CGSize, pageWidth: CGFloat) -> CGFloat {
        let box = boundingSize(pageWidth: pageWidth)
        let diagonal = box.width * box.width + box.height * box.height
        guard diagonal > 0 else { return width }
        // The centre stays put, so the corner moves half the growth: project the pointer on the half-diagonal.
        let factor = 1 + 2 * (translation.width * box.width + translation.height * box.height) / diagonal
        return min(max(width * factor, Self.widths.lowerBound), Self.widths.upperBound)
    }

    public func fitted(in page: CGSize) -> Watermark {
        let box = boundingSize(pageWidth: page.width)
        guard box.width > 0, box.height > 0 else { return self }
        var fitted = self
        fitted.width = max(width * min(1, 0.9 * page.width / box.width, 0.9 * page.height / box.height), Self.widths.lowerBound)
        return fitted
    }

    /// The rotated mark alone on a transparent background, its long side `maxDimension` pixels: what the preview lays over the page.
    public func overlayImage(maxDimension: Int) throws(PDFToolError) -> CGImage {
        guard isValid, maxDimension > 0 else { throw .invalidPlacement }
        let unit = boundingSize(pageWidth: 1)
        let scale = CGFloat(maxDimension) / max(unit.width, unit.height)
        let width = max(1, Int(ceil(unit.width * scale)))
        let height = max(1, Int(ceil(unit.height * scale)))
        guard let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
                                      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
            throw .renderFailed
        }
        var centered = self
        centered.center = CGPoint(x: 0.5, y: 0.5)
        // A square page `scale` wide, centred on the bitmap, puts the mark in the middle at the bitmap's scale.
        let page = CGRect(x: (CGFloat(width) - scale) / 2, y: (CGFloat(height) - scale) / 2, width: scale, height: scale)
        WatermarkPainter.draw(centered, image: try WatermarkPainter.image(of: content), in: context, displayed: page)
        guard let image = context.makeImage() else { throw .renderFailed }
        return image
    }
}

public actor PDFWatermarkDocument {
    private let original: Data
    private let password: String
    private let document: PDFDocument
    private let info: DocumentPagesInfo

    public init(data: Data, password: String = "") throws(PDFToolError) {
        let document = try PDFDocumentValidation.open(data, password: password)
        try PDFDocumentValidation.rejectDigitalSignatures(data, password: password)
        self.original = data
        self.password = password
        self.document = document
        self.info = DocumentPagesInfo(pageSizes: try PageGeometry.displayedSizes(of: document), isEncrypted: document.isEncrypted)
    }

    public func information() -> DocumentPagesInfo { info }

    public func preview(pageIndex: Int, maxDimension: Int = 1600) throws(PDFToolError) -> CGImage {
        guard info.pageSizes.indices.contains(pageIndex), let page = document.page(at: pageIndex), maxDimension > 0 else { throw .renderFailed }
        return try render(page, size: info.pageSizes[pageIndex], maxDimension: maxDimension)
    }

    public func watermarkedData(_ mark: Watermark) throws(PDFToolError) -> Data {
        try watermarkedData([mark])
    }

    /// Several marks on one copy, each on its own pages, in the order given.
    public func watermarkedData(_ marks: [Watermark]) throws(PDFToolError) -> Data {
        guard !marks.isEmpty, marks.allSatisfy({ $0.isValid && $0.pages.upperBound < info.pageSizes.count }) else { throw .invalidPlacement }
        // Fifty copies of one picture are one picture in memory.
        var images: [Watermark.Content: CGImage?] = [:]
        for mark in marks where images[mark.content] == nil { images[mark.content] = try WatermarkPainter.image(of: mark.content) }
        return try PageOverlay.write(original, password: password) { index, context, displayed in
            for mark in marks where mark.pages.contains(index) {
                WatermarkPainter.draw(mark, image: images[mark.content] ?? nil, in: context, displayed: displayed)
            }
        }
    }
}

enum WatermarkPainter {
    static func image(of content: Watermark.Content) throws(PDFToolError) -> CGImage? {
        guard case .image(let asset) = content else { return nil }
        guard let source = CGImageSourceCreateWithData(asset.dataPNG as CFData, nil),
              let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { throw .invalidImage }
        return image
    }

    /// Height over width of the unrotated mark.
    static func aspect(of content: Watermark.Content) -> CGFloat {
        switch content {
        case .image(let asset): return CGFloat(asset.height) / CGFloat(asset.width)
        case .text(let text, let color):
            let metrics = metrics(line(text, color: color))
            return metrics.width > 0 ? (metrics.ascent + metrics.descent) / metrics.width : 1
        }
    }

    /// Draws in a context whose space is the displayed page with its origin bottom-left; `displayed` is that page's bounds.
    static func draw(_ mark: Watermark, image: CGImage?, in context: CGContext, displayed: CGRect) {
        let width = mark.width * displayed.width
        context.saveGState()
        defer { context.restoreGState() }
        context.translateBy(x: displayed.minX + mark.center.x * displayed.width, y: displayed.maxY - mark.center.y * displayed.height)
        context.rotate(by: mark.angle * .pi / 180)
        context.setAlpha(mark.opacity)
        switch mark.content {
        case .image:
            guard let image else { return }
            let height = width * aspect(of: mark.content)
            context.interpolationQuality = .high
            context.draw(image, in: CGRect(x: -width / 2, y: -height / 2, width: width, height: height))
        case .text(let text, let color):
            let line = line(text, color: color)
            let metrics = metrics(line)
            guard metrics.width > 0 else { return }
            context.scaleBy(x: width / metrics.width, y: width / metrics.width)
            context.textMatrix = .identity
            context.textPosition = CGPoint(x: -metrics.width / 2, y: (metrics.descent - metrics.ascent) / 2)
            CTLineDraw(line, context)
        }
    }

    private static func line(_ text: String, color: WatermarkColor) -> CTLine {
        let font = CTFontCreateUIFontForLanguage(.emphasizedSystem, 100, nil) ?? CTFontCreateWithName("Helvetica-Bold" as CFString, 100, nil)
        let attributes: [NSAttributedString.Key: Any] = [
            NSAttributedString.Key(kCTFontAttributeName as String): font,
            NSAttributedString.Key(kCTForegroundColorAttributeName as String): CGColor(srgbRed: color.red, green: color.green, blue: color.blue, alpha: 1),
        ]
        return CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: attributes) as CFAttributedString)
    }

    private static func metrics(_ line: CTLine) -> (width: CGFloat, ascent: CGFloat, descent: CGFloat) {
        var ascent: CGFloat = 0, descent: CGFloat = 0, leading: CGFloat = 0
        let width = CGFloat(CTLineGetTypographicBounds(line, &ascent, &descent, &leading))
        return (width, ascent, descent)
    }
}
