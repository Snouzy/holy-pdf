import CoreGraphics
import Foundation
import ImageIO
import PDFKit
import UniformTypeIdentifiers

func jpegData(_ image: CGImage, quality: Double) -> Data? {
    let data = NSMutableData()
    guard let destination = CGImageDestinationCreateWithData(data, UTType.jpeg.identifier as CFString, 1, nil) else { return nil }
    CGImageDestinationAddImage(destination, image, [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary)
    return CGImageDestinationFinalize(destination) ? data as Data : nil
}

public enum PDFImagePages {
    /// One picture of an image file. A scanned TIFF holds several: one for each of its pages.
    public struct Picture: Sendable {
        public var data: Data
        public var frame: Int

        public init(data: Data, frame: Int = 0) {
            self.data = data
            self.frame = frame
        }
    }

    static let a4 = CGSize(width: 595.28, height: 841.89)

    /// How many pages the file gives: every page of a TIFF, the first picture of any other image, 0 for a file
    /// that is not an image.
    public static func pictures(in data: Data) -> Int {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return 0 }
        let count = CGImageSourceGetCount(source)
        return CGImageSourceGetType(source) as String? == UTType.tiff.identifier ? count : min(count, 1)
    }

    /// One A4 page for each picture, turned to the picture's shape, the picture fitted and centered: the site's rule.
    public static func document(of pictures: [Picture], title: String = "") throws(PDFToolError) -> Data {
        guard !pictures.isEmpty else { throw .invalidOrder }
        var pages: [PDFPageInput] = []
        for picture in pictures {
            guard !Task.isCancelled else { throw .cancelled }
            let (jpeg, pixels) = try upright(picture)
            pages.append(PDFPageInput(jpeg: jpeg, pageSize: pixels.width > pixels.height ? CGSize(width: a4.height, height: a4.width) : a4))
        }
        do {
            return try PDFWriter.data(pages: pages, title: title)
        } catch {
            if case .invalidImage = error { throw .invalidImage }
            throw .writeFailed
        }
    }

    /// The picture as a JPEG that needs no rotation, with its size in pixels, and without what the camera wrote
    /// beside it: place, date, author. A JPEG that is already upright keeps its compressed pixels; any other picture
    /// is decoded, turned as its EXIF orientation says, and laid on white.
    private static func upright(_ picture: Picture) throws(PDFToolError) -> (Data, CGSize) {
        guard let source = CGImageSourceCreateWithData(picture.data as CFData, nil), picture.frame >= 0, picture.frame < CGImageSourceGetCount(source),
              let properties = CGImageSourceCopyPropertiesAtIndex(source, picture.frame, nil) as? [CFString: Any],
              let width = properties[kCGImagePropertyPixelWidth] as? Int, let height = properties[kCGImagePropertyPixelHeight] as? Int,
              width > 0, height > 0 else { throw .invalidImage }
        if properties[kCGImagePropertyOrientation] as? Int ?? 1 == 1, CGImageSourceGetType(source) as String? == UTType.jpeg.identifier,
           let bare = withoutMetadata(source) {
            return (bare, CGSize(width: width, height: height))
        }
        let options: [CFString: Any] = [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceCreateThumbnailWithTransform: true,
                                        kCGImageSourceThumbnailMaxPixelSize: max(width, height)]
        guard let image = CGImageSourceCreateThumbnailAtIndex(source, picture.frame, options as CFDictionary),
              let context = CGContext(data: nil, width: image.width, height: image.height, bitsPerComponent: 8, bytesPerRow: 0,
                                      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { throw .invalidImage }
        let frame = CGRect(x: 0, y: 0, width: image.width, height: image.height)
        context.setFillColor(CGColor(gray: 1, alpha: 1))
        context.fill(frame)
        context.draw(image, in: frame)
        guard let flat = context.makeImage(), let jpeg = jpegData(flat, quality: 0.9) else { throw .invalidImage }
        return (jpeg, frame.size)
    }

    /// ImageIO copies the compressed pixels and the colour profile, and leaves the EXIF, GPS and XMP blocks out.
    private static func withoutMetadata(_ source: CGImageSource) -> Data? {
        let data = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(data, UTType.jpeg.identifier as CFString, 1, nil) else { return nil }
        let options: [CFString: Any] = [kCGImageDestinationMetadata: CGImageMetadataCreateMutable(), kCGImageDestinationMergeMetadata: false,
                                        kCGImageMetadataShouldExcludeGPS: true, kCGImageMetadataShouldExcludeXMP: true]
        return CGImageDestinationCopyImageSource(destination, source, options as CFDictionary, nil) ? data as Data : nil
    }
}

public enum PDFPageImages {
    /// The site's two qualities: 150 dots per inch, or 300 with a lighter compression.
    public enum Quality: CaseIterable, Sendable { case normal, high }

    /// Gives each page to `write` as a JPEG, in order, as the reader sees the page.
    public static func export(_ data: Data, password: String = "", quality: Quality,
                              write: (_ pageIndex: Int, _ jpeg: Data) throws -> Void) throws(PDFToolError) {
        let document = try PDFDocumentValidation.open(data, password: password)
        let sizes = try PageGeometry.displayedSizes(of: document)
        let (resolution, compression): (CGFloat, Double) = quality == .high ? (300, 0.92) : (150, 0.85)
        for (index, size) in sizes.enumerated() {
            guard !Task.isCancelled else { throw .cancelled }
            guard let page = document.page(at: index) else { throw .invalidDocument }
            let side = Int((max(size.width, size.height) * resolution / 72).rounded())
            let image = try render(page, size: size, maxDimension: side, limit: PDFRedaction.longestSide)
            guard let jpeg = jpegData(image, quality: compression) else { throw .renderFailed }
            do { try write(index, jpeg) } catch { throw .writeFailed }
        }
    }
}
