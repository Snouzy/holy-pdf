import Foundation
import PDFKit
#if canImport(Quartz)
import Quartz
#endif

public enum CompressionLevel: CaseIterable, Sendable {
    case extreme, recommended, low
}

public enum PDFCompression {
    /// The lightest copy PDFKit writes at this level, or nil when no copy is at least 1 % lighter than the original.
    /// Only the images change: PDFKit has no setting that fits every PDF, so several writes compete.
    public static func compressed(_ data: Data, password: String = "", level: CompressionLevel) throws(PDFToolError) -> Data? {
        let pageCount = try PDFDocumentValidation.open(data, password: password).pageCount
        try PDFDocumentValidation.rejectDigitalSignatures(data, password: password)
        var best: Data?
        var wrote = false
        for var options in candidates(level) {
            guard !Task.isCancelled else { throw .cancelled }
            let document = try PDFDocumentValidation.open(data, password: password)
            if document.isEncrypted {
                options[.userPasswordOption] = ""
                options[.ownerPasswordOption] = ""
            }
            guard let output = document.dataRepresentation(options: options), let copy = PDFDocument(data: output),
                  copy.pageCount == pageCount, !copy.isLocked else { continue }
            wrote = true
            if output.count < best?.count ?? data.count - data.count / 100 { best = output }
        }
        // No copy at all is a failure, not a PDF that was already light.
        guard wrote else { throw .writeFailed }
        return best
    }

    /// True when a page draws a large one-bit image: a black-and-white scan. Every write of `compressed` turns it
    /// into a JPEG, which blurs it, and PDFKit has no setting to leave one image alone.
    public static func hasBilevelScan(_ data: Data, password: String = "") -> Bool {
        guard let provider = CGDataProvider(data: data as CFData), let pdf = CGPDFDocument(provider),
              pdf.isUnlocked || pdf.unlockWithPassword(password), pdf.numberOfPages > 0 else { return false }
        var visited = 0
        func scan(_ resources: CGPDFDictionaryRef?, depth: Int) -> Bool {
            guard depth < 8, let objects = resources?.dictionary("XObject") else { return false }
            var found = false
            CGPDFDictionaryApplyBlock(objects, { _, object, _ in
                var stream: CGPDFStreamRef?
                guard visited < 10_000, CGPDFObjectGetValue(object, .stream, &stream), let stream,
                      let facts = CGPDFStreamGetDictionary(stream) else { return true }
                visited += 1
                if facts.name("Subtype") == "Form" {
                    found = scan(facts.dictionary("Resources"), depth: depth + 1)
                } else if facts.name("Subtype") == "Image" {
                    var width = 0, height = 0, bits = 8
                    var mask: CGPDFBoolean = 0
                    CGPDFDictionaryGetInteger(facts, "Width", &width)
                    CGPDFDictionaryGetInteger(facts, "Height", &height)
                    CGPDFDictionaryGetInteger(facts, "BitsPerComponent", &bits)
                    CGPDFDictionaryGetBoolean(facts, "ImageMask", &mask)
                    // Under 500 × 500 pixels, a one-bit image is a mask or an icon.
                    found = (bits == 1 || mask != 0) && width * height >= 250_000
                }
                return !found
            }, nil)
            return found
        }
        return (1...pdf.numberOfPages).contains { number in
            // A page inherits the resources of its parents.
            var node = pdf.page(at: number)?.dictionary
            while let owner = node {
                if scan(owner.dictionary("Resources"), depth: 0) { return true }
                node = owner.dictionary("Parent")
            }
            return false
        }
    }

    private static func candidates(_ level: CompressionLevel) -> [[PDFDocumentWriteOption: Any]] {
        var writes: [[PDFDocumentWriteOption: Any]] = [[.saveImagesAsJPEGOption: true, .optimizeImagesForScreenOption: level != .low]]
        #if canImport(Quartz)
        // The filter of Preview's « Reduce File Size », with our settings. Without the cap on the longest side,
        // a scan that declares no resolution comes out sixteen times heavier.
        let (resolution, quality, longestSide) = switch level {
        case .low: (200, 0.8, 3200)
        case .recommended: (150, 0.6, 2400)
        case .extreme: (96, 0.5, 1600)
        }
        let scale: [String: Any] = ["ImageResolution": resolution, "ImageScaleInterpolate": true, "ImageSizeMax": longestSide, "ImageSizeMin": 0]
        let images: [String: Any] = ["Compression Quality": quality, "ImageCompression": "ImageJPEGCompress", "ImageScaleSettings": scale]
        let properties: [String: Any] = ["FilterType": 1, "Name": "Holy PDF", "Domains": ["Applications": true],
                                         "FilterData": ["ColorSettings": ["ImageSettings": images]]]
        if let filter = QuartzFilter(properties: properties) { writes.append([PDFDocumentWriteOption(rawValue: "QuartzFilter"): filter]) }
        #endif
        return writes
    }
}
