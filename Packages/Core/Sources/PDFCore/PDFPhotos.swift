import CoreGraphics
import CryptoKit
import Foundation
import ImageIO
import PDFKit
import UniformTypeIdentifiers

/// The photos of a PDF, as they are in it: the site's rule for « Extract images ». Pictures under 64 pixels a side
/// are rules and bullets; a picture drawn on several pages comes once; the layers a scanner stacks on one frame are
/// one picture.
public enum PDFPhotos {
    static let smallest = 64
    /// No photo of a document is wider, and the memory of a Mac has an end.
    private static let widest = 30_000
    private static let mostPixels = 50_000_000
    /// What is drawn in memory at once.
    private static let mostPixelsAtOnce = 16_000_000
    private static let unit = CGRect(x: 0, y: 0, width: 1, height: 1)

    /// The pictures laid on one frame of a page, with the size in pixels of the finest: one file.
    private struct Candidate {
        let matrix: CGAffineTransform
        var streams: Set<CGPDFStreamRef>
        var pixels: CGSize
        var placed: CGRect { unit.applying(matrix) }

        mutating func join(_ stream: CGPDFStreamRef, _ size: CGSize) {
            streams.insert(stream)
            if size.width * size.height > pixels.width * pixels.height { pixels = size }
        }
    }

    /// How many photos `export` gives, without decoding one. A picture that cannot be drawn is counted all the same.
    public static func count(_ data: Data, password: String = "") throws(PDFToolError) -> Int {
        let document = try PDFDocumentValidation.open(data, password: password)
        var seen = Set<Set<CGPDFStreamRef>>()
        for index in 0..<document.pageCount {
            guard let page = document.page(at: index)?.pageRef else { continue }
            for candidate in candidates(on: page) { seen.insert(candidate.streams) }
        }
        return seen.count
    }

    /// Each photo as a JPEG, in the order of the pages. A JPEG of the PDF comes out as it went in; anything else is
    /// cut out of the page, drawn as the page draws it, at its own size.
    public static func export(_ data: Data, password: String = "", progress: (_ done: Int, _ total: Int) -> Void = { _, _ in },
                              write: (_ jpeg: Data) throws -> Void) throws(PDFToolError) {
        let document = try PDFDocumentValidation.open(data, password: password)
        let sizes = try PageGeometry.displayedSizes(of: document)
        // The same frame of pictures comes once; the same photo stored twice in the document comes once as well.
        var seen = Set<Set<CGPDFStreamRef>>()
        var digests = Set<Data>()
        for (index, size) in sizes.enumerated() {
            guard !Task.isCancelled else { throw .cancelled }
            guard let page = document.page(at: index), let ref = page.pageRef else { throw .invalidDocument }
            progress(index + 1, sizes.count)
            let display = PageGeometry.displayTransform(of: page)
            for candidate in candidates(on: ref) where !seen.contains(candidate.streams) {
                guard !Task.isCancelled else { throw .cancelled }
                // A picture the page does not show may show on another page.
                let shown = candidate.placed.applying(display).standardized
                guard shown.width >= 1, shown.height >= 1, shown.intersects(CGRect(origin: .zero, size: size)) else { continue }
                let file = try autoreleasepool { () throws(PDFToolError) -> Data? in
                    // Layers on one frame are drawn together; a picture alone may keep its own bytes.
                    if candidate.streams.count == 1, let alone = candidate.streams.first, let own = own(alone, pixels: candidate.pixels) { return own }
                    return try cut(candidate, in: shown, display: display, from: page)
                }
                guard let file else { continue }
                seen.insert(candidate.streams)
                guard digests.insert(Data(SHA256.hash(data: file))).inserted else { continue }
                do { try write(file) } catch { throw .writeFailed }
            }
        }
    }

    private static func candidates(on page: CGPDFPage) -> [Candidate] {
        let pictures = PageScan(page).pictures.compactMap { picture in
            picture.stream.flatMap { stream in measure(stream).map { (picture.matrix, stream, $0.pixels, $0.mask) } }
        }
        var found: [Candidate] = []
        func index(of matrix: CGAffineTransform) -> Int? {
            let placed = unit.applying(matrix)
            return found.firstIndex { abs($0.placed.minX - placed.minX) < 1 && abs($0.placed.minY - placed.minY) < 1
                && abs($0.placed.width - placed.width) < 1 && abs($0.placed.height - placed.height) < 1 }
        }
        for (matrix, stream, pixels, mask) in pictures where !mask {
            if let at = index(of: matrix) { found[at].join(stream, pixels) } else { found.append(Candidate(matrix: matrix, streams: [stream], pixels: pixels)) }
        }
        // A mask is the sharp text of a scan: it joins the picture under it, and is no picture alone.
        for (matrix, stream, pixels, mask) in pictures where mask {
            if let at = index(of: matrix) { found[at].join(stream, pixels) }
        }
        return found
    }

    /// The size of a picture worth a file, in its own pixels, and whether it is a mask.
    private static func measure(_ stream: CGPDFStreamRef) -> (pixels: CGSize, mask: Bool)? {
        guard let facts = CGPDFStreamGetDictionary(stream) else { return nil }
        var width = 0, height = 0
        var mask: CGPDFBoolean = 0
        CGPDFDictionaryGetInteger(facts, "Width", &width)
        CGPDFDictionaryGetInteger(facts, "Height", &height)
        CGPDFDictionaryGetBoolean(facts, "ImageMask", &mask)
        guard (smallest...widest).contains(width), (smallest...widest).contains(height), width * height <= mostPixels else { return nil }
        return (CGSize(width: width, height: height), mask != 0)
    }

    /// The picture's own JPEG, when the page shows it as it is: a bare `DCTDecode` stream in the colours a JPEG
    /// viewer assumes, with no mask and no decode array, that reads whole at the size it declares. Nothing else is
    /// copied out of the document: a stream can inflate to gigabytes, and only the page knows how to draw it. Nil
    /// sends the picture to `cut`.
    private static func own(_ stream: CGPDFStreamRef, pixels: CGSize) -> Data? {
        guard let facts = CGPDFStreamGetDictionary(stream), facts.name("Filter") == "DCTDecode", let gray = isGray(facts),
              !facts.has("SMask"), !facts.has("Mask"), !facts.has("Decode"), !facts.has("DecodeParms") else { return nil }
        var format = CGPDFDataFormat.raw
        guard let bytes = CGPDFStreamCopyData(stream, &format), format == .jpegEncoded, let source = CGImageSourceCreateWithData(bytes, nil),
              let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              properties[kCGImagePropertyColorModel] as? String == (gray ? "Gray" : "RGB"),
              let image = CGImageSourceCreateImageAtIndex(source, 0, [kCGImageSourceShouldCacheImmediately: true] as CFDictionary),
              image.width == Int(pixels.width), image.height == Int(pixels.height), CGImageSourceGetStatusAtIndex(source, 0) == .statusComplete
        else { return nil }
        return bytes as Data
    }

    /// False for the colours a JPEG viewer assumes in red, green and blue, true for those it assumes in gray: the
    /// device's, or a profile that leaves the primaries, mid-gray and white where sRGB has them. Nil for a colour
    /// space only the page knows how to draw.
    private static func isGray(_ facts: CGPDFDictionaryRef) -> Bool? {
        switch facts.name("ColorSpace") {
        case "DeviceRGB": return false
        case "DeviceGray": return true
        case .some: return nil
        case nil: break
        }
        var kind: UnsafePointer<CChar>?
        var profile: CGPDFStreamRef?
        var length = 0
        var format = CGPDFDataFormat.raw
        // A profile stream can inflate like any other; a known profile is a few kilobytes.
        guard let space = facts.array("ColorSpace"), CGPDFArrayGetCount(space) == 2, CGPDFArrayGetName(space, 0, &kind), let kind,
              String(cString: kind) == "ICCBased", CGPDFArrayGetStream(space, 1, &profile), let profile, let facts = CGPDFStreamGetDictionary(profile),
              CGPDFDictionaryGetInteger(facts, "Length", &length), length <= 65_536, let icc = CGPDFStreamCopyData(profile, &format),
              let space = CGColorSpace(iccData: icc), [1, 3].contains(space.numberOfComponents), let srgb = CGColorSpace(name: CGColorSpace.sRGB) else { return nil }
        // From sRGB into the profile: the other way round, a wider gamut clips its primaries onto sRGB's.
        let gray = space.numberOfComponents == 1
        let samples: [[CGFloat]] = gray ? [[0, 0, 0], [0.5, 0.5, 0.5], [1, 1, 1]] : [[1, 0, 0], [0, 1, 0], [0, 0, 1], [0.5, 0.5, 0.5], [1, 1, 1]]
        for sample in samples {
            guard let seen = CGColor(colorSpace: srgb, components: sample + [1])?.converted(to: space, intent: .relativeColorimetric, options: nil)?.components,
                  zip(gray ? [sample[0]] : sample, seen).allSatisfy({ abs($0 - $1) <= 2 / 255 }) else { return nil }
        }
        return gray
    }

    /// The picture as the page draws it, drawn alone at its own resolution: only `shown`, its box in the reader's
    /// space, is rasterized, and only inside the picture's outline, so that a neighbour stays out of the corners of
    /// a turned picture.
    private static func cut(_ candidate: Candidate, in shown: CGRect, display: CGAffineTransform, from page: PDFPage) throws(PDFToolError) -> Data? {
        let laid = candidate.matrix.concatenating(display)
        // Pixels per point along the picture's own sides: a turned picture keeps its sharpness.
        var scale = max(candidate.pixels.width / hypot(laid.a, laid.b), candidate.pixels.height / hypot(laid.c, laid.d))
        scale = min(scale, CGFloat(PDFRedaction.longestSide) / max(shown.width, shown.height), sqrt(CGFloat(mostPixelsAtOnce) / (shown.width * shown.height)))
        guard scale.isFinite, scale > 0 else { return nil }
        let width = max(1, Int(shown.width * scale)), height = max(1, Int(shown.height * scale))
        guard let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
                                      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { throw .renderFailed }
        context.setFillColor(CGColor(gray: 1, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        context.scaleBy(x: CGFloat(width) / shown.width, y: CGFloat(height) / shown.height)
        context.translateBy(x: -shown.minX, y: -shown.minY)
        var outline = laid
        context.addPath(CGPath(rect: unit, transform: &outline))
        context.clip()
        autoreleasepool { page.draw(with: .cropBox, to: context) }
        guard let image = context.makeImage() else { throw .renderFailed }
        // A picture the page cannot decode leaves its box white: no photo.
        guard let bytes = image.dataProvider?.data as Data?, bytes.contains(where: { $0 != 255 }) else { return nil }
        return jpegData(image, quality: 0.9)
    }
}
