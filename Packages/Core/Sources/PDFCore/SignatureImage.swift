import CoreGraphics
import CoreText
import Foundation
import ImageIO
import UniformTypeIdentifiers

public struct SignatureImage: Hashable, Sendable {
    public let dataPNG: Data
    public let width: Int
    public let height: Int

    public enum TextStyle: CaseIterable, Sendable { case handwritten, plain }

    /// A line of typed text as a mark: a name, initials, a date. Ink on a transparent ground, 120 characters at most.
    public static func text(_ string: String, style: TextStyle) throws(PDFToolError) -> SignatureImage {
        let line = string.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !line.isEmpty, line.count <= 120 else { throw .invalidImage }
        // Bradley Hand comes with macOS; Core Text gives a stand-in if a Mac lacks it.
        let font = CTFontCreateWithName((style == .handwritten ? "BradleyHandITCTT-Bold" : "Helvetica") as CFString, 120, nil)
        let ink = CGColor(red: 0.08, green: 0.1, blue: 0.18, alpha: 1)
        let attributes = [kCTFontAttributeName: font, kCTForegroundColorAttributeName: ink] as CFDictionary
        let typeset = CTLineCreateWithAttributedString(CFAttributedStringCreate(nil, line as CFString, attributes))
        var ascent: CGFloat = 0, descent: CGFloat = 0
        let width = CTLineGetTypographicBounds(typeset, &ascent, &descent, nil)
        // A stand-in font, or a mark above a capital, can reach beyond the typographic box: the glyphs decide too.
        let box = CGRect(x: 0, y: -descent, width: width, height: ascent + descent).union(CTLineGetBoundsWithOptions(typeset, .useGlyphPathBounds))
        let margin: CGFloat = 24
        guard width > 0, box.width.isFinite, box.height.isFinite, let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
              let context = CGContext(data: nil, width: Int((box.width + 2 * margin).rounded(.up)), height: Int((box.height + 2 * margin).rounded(.up)),
                                      bitsPerComponent: 8, bytesPerRow: 0, space: colorSpace, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { throw .invalidImage }
        context.textPosition = CGPoint(x: margin - box.minX, y: margin - box.minY)
        CTLineDraw(typeset, context)
        guard let image = context.makeImage(), let png = pngData(image) else { throw .invalidImage }
        return try load(data: png)
    }

    private static func pngData(_ image: CGImage) -> Data? {
        let output = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(output, UTType.png.identifier as CFString, 1, nil) else { return nil }
        CGImageDestinationAddImage(destination, image, nil)
        return CGImageDestinationFinalize(destination) ? output as Data : nil
    }

    public static func load(data: Data) throws(PDFToolError) -> SignatureImage {
        guard data.count <= 10 * 1024 * 1024 else { throw .imageTooLarge }
        guard let source = CGImageSourceCreateWithData(data as CFData, [kCGImageSourceShouldCache: false] as CFDictionary),
              let type = CGImageSourceGetType(source) as String?,
              [UTType.png.identifier, UTType.jpeg.identifier].contains(type),
              CGImageSourceGetCount(source) == 1,
              let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              let width = (properties[kCGImagePropertyPixelWidth] as? NSNumber)?.doubleValue,
              let height = (properties[kCGImagePropertyPixelHeight] as? NSNumber)?.doubleValue,
              width.isFinite, height.isFinite, width > 0, height > 0 else { throw .invalidImage }
        guard width * height <= 16_000_000 else { throw .imageTooLarge }
        let longest = min(1600, Int(floor(max(width, height) * min(1, sqrt(1_000_000 / (width * height))))))
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: max(1, longest),
            kCGImageSourceShouldCacheImmediately: true,
        ]
        guard let thumbnail = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary),
              thumbnail.width <= 1600, thumbnail.height <= 1600,
              thumbnail.width * thumbnail.height <= 1_000_000,
              let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
              let context = CGContext(data: nil, width: thumbnail.width, height: thumbnail.height,
                                      bitsPerComponent: 8, bytesPerRow: 0, space: colorSpace,
                                      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { throw .invalidImage }
        context.draw(thumbnail, in: CGRect(x: 0, y: 0, width: thumbnail.width, height: thumbnail.height))
        guard let image = context.makeImage() else { throw .invalidImage }
        let output = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(output, UTType.png.identifier as CFString, 1, nil) else {
            throw .invalidImage
        }
        CGImageDestinationAddImage(destination, image, nil)
        guard CGImageDestinationFinalize(destination) else { throw .invalidImage }
        return SignatureImage(dataPNG: output as Data, width: image.width, height: image.height)
    }
}
