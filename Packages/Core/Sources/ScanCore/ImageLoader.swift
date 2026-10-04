import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

public struct LoadedImage: Sendable {
    public let image: CGImage
    public let captureDate: Date?
}

public enum ImageLoader {
    /// Enough for a 200 dpi A4 page after perspective correction, and it bounds memory:
    /// a 48 Mpx photo decoded at full size weighs about 190 MB.
    public static let maxLongSide = 4096
    static let supportedTypes: [UTType] = [.heic, .jpeg, .png]

    public static func load(_ url: URL, maxLongSide: Int = maxLongSide) throws(ScanError) -> LoadedImage {
        guard FileManager.default.isReadableFile(atPath: url.path),
              let source = CGImageSourceCreateWithURL(url as CFURL, nil) else {
            throw .unreadableFile(url)
        }
        guard let identifier = CGImageSourceGetType(source) as String?,
              let type = UTType(identifier),
              supportedTypes.contains(where: { type.conforms(to: $0) }) else {
            throw .unsupportedFormat(url)
        }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maxLongSide,
            kCGImageSourceShouldCacheImmediately: true,
        ]
        guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else {
            throw .unreadableFile(url)
        }
        return LoadedImage(image: image, captureDate: captureDate(of: source))
    }

    static func captureDate(of source: CGImageSource) -> Date? {
        guard let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              let exif = properties[kCGImagePropertyExifDictionary] as? [CFString: Any],
              let text = exif[kCGImagePropertyExifDateTimeOriginal] as? String else {
            return nil
        }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy:MM:dd HH:mm:ss"
        return formatter.date(from: text)
    }
}
