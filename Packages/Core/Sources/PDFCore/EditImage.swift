import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

/// A picture ready for the page.
public struct EditImage: Equatable, Sendable {
    public static let maxSide = 2400
    /// A phone's photo, 24 million pixels or more, fits; ImageIO shrinks it while it reads it.
    public static let maxBytes = 50 * 1024 * 1024
    public static let maxPixels = 50_000_000.0

    /// JPEG when nothing shows through, PNG otherwise.
    public let data: Data
    public let width: Int
    public let height: Int
    public let isOpaque: Bool

    /// Any picture ImageIO reads, its first frame, upright as the camera was held, 2,400 px at most on its long side.
    public static func load(data: Data) throws(PDFToolError) -> EditImage {
        guard data.count <= maxBytes else { throw .imageTooLarge }
        guard let source = CGImageSourceCreateWithData(data as CFData, [kCGImageSourceShouldCache: false] as CFDictionary),
              CGImageSourceGetCount(source) > 0,
              let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              let width = (properties[kCGImagePropertyPixelWidth] as? NSNumber)?.doubleValue,
              let height = (properties[kCGImagePropertyPixelHeight] as? NSNumber)?.doubleValue,
              width.isFinite, height.isFinite, width > 0, height > 0 else { throw .invalidImage }
        guard width * height <= maxPixels else { throw .imageTooLarge }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: min(maxSide, Int(max(width, height))),
            kCGImageSourceShouldCacheImmediately: true,
        ]
        guard let upright = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { throw .invalidImage }
        let bitmap = try redrawn(upright, part: CGRect(x: 0, y: 0, width: upright.width, height: upright.height))
        return EditImage(data: try encoded(bitmap.image, opaque: bitmap.isOpaque), width: bitmap.image.width,
                         height: bitmap.image.height, isOpaque: bitmap.isOpaque)
    }

    public func decoded() throws(PDFToolError) -> CGImage {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { throw .invalidImage }
        return image
    }

    /// `crop` in this picture's pixels, origin top-left.
    public func pixels(of crop: CGRect) -> CGRect {
        CGRect(x: crop.minX * CGFloat(width), y: crop.minY * CGFloat(height), width: crop.width * CGFloat(width), height: crop.height * CGFloat(height))
            .integral.intersection(CGRect(x: 0, y: 0, width: width, height: height))
    }

    /// What the page receives. Uncut, the JPEG goes in as it is; cut, the kept part is drawn again, so the cut pixels
    /// are not in the file.
    func cropped(_ crop: CGRect) throws(PDFToolError) -> CGImage {
        if crop == EditPicture.whole, isOpaque { return try Self.jpeg(data) }
        let part = try Self.redrawn(try decoded(), part: pixels(of: crop)).image
        return isOpaque ? try Self.jpeg(try Self.encoded(part, opaque: true)) : part
    }

    /// Quartz writes a picture made from JPEG data as that JPEG, without decoding it again.
    private static func jpeg(_ data: Data) throws(PDFToolError) -> CGImage {
        guard let provider = CGDataProvider(data: data as CFData),
              let image = CGImage(jpegDataProviderSource: provider, decode: nil, shouldInterpolate: true, intent: .defaultIntent) else {
            throw .invalidImage
        }
        return image
    }

    /// `part` of `image`, in pixels from the top-left corner, alone in a new bitmap.
    private static func redrawn(_ image: CGImage, part: CGRect) throws(PDFToolError) -> (image: CGImage, isOpaque: Bool) {
        let width = Int(part.width), height = Int(part.height)
        guard width > 0, height > 0, let space = CGColorSpace(name: CGColorSpace.sRGB),
              let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4, space: space,
                                      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { throw .invalidImage }
        // Core Graphics counts from the bottom.
        context.draw(image, in: CGRect(x: -part.minX, y: part.maxY - CGFloat(image.height), width: CGFloat(image.width), height: CGFloat(image.height)))
        guard let drawn = context.makeImage(), let bytes = context.data?.assumingMemoryBound(to: UInt8.self) else { throw .invalidImage }
        let opaque = stride(from: 3, to: width * height * 4, by: 4).allSatisfy { bytes[$0] == 255 }
        return (drawn, opaque)
    }

    private static func encoded(_ image: CGImage, opaque: Bool) throws(PDFToolError) -> Data {
        let output = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(output, (opaque ? UTType.jpeg : UTType.png).identifier as CFString, 1, nil) else {
            throw .invalidImage
        }
        CGImageDestinationAddImage(destination, image, opaque ? [kCGImageDestinationLossyCompressionQuality: 0.9] as CFDictionary : nil)
        guard CGImageDestinationFinalize(destination) else { throw .invalidImage }
        return output as Data
    }
}
