import CoreGraphics
import CoreText
import Foundation
import ImageIO
import UniformTypeIdentifiers

public struct PDFTextLine: Hashable, Sendable {
    public var text: String
    /// Normalized to the page image, top-left origin.
    public var box: CGRect

    public init(text: String, box: CGRect) {
        self.text = text
        self.box = box
    }
}

public struct PDFPageInput: Sendable {
    public var jpeg: Data
    /// In points.
    public var pageSize: CGSize
    public var textLines: [PDFTextLine]

    public init(jpeg: Data, pageSize: CGSize, textLines: [PDFTextLine] = []) {
        self.jpeg = jpeg
        self.pageSize = pageSize
        self.textLines = textLines
    }
}

public enum PDFWriteError: Error, Equatable, Sendable {
    case emptyDocument
    case invalidImage(page: Int)
    case renderFailed
    case cannotWrite(URL)
}

public enum PDFWriter {
    public static let creator = "Holy PDF"

    /// Never replaces a file: when `url` exists, writes "<name>-2.pdf", "<name>-3.pdf"… and returns the URL it wrote.
    public static func write(pages: [PDFPageInput], title: String, to url: URL) throws(PDFWriteError) -> URL {
        let pdf = try Self.data(pages: pages, title: title)
        let name = url.deletingPathExtension().lastPathComponent
        var target = url
        var number = 1
        // The file system applies its own case rules. `.withoutOverwriting` cannot be combined with `.atomic`.
        while FileManager.default.fileExists(atPath: target.path) {
            number += 1
            target = url.deletingLastPathComponent().appending(path: "\(name)-\(number)").appendingPathExtension(url.pathExtension)
        }
        do {
            try pdf.write(to: target, options: .atomic)
        } catch {
            throw .cannotWrite(target)
        }
        return target
    }

    /// One page per image. An image made from JPEG data is embedded as is, not recompressed.
    public static func data(pages: [PDFPageInput], title: String) throws(PDFWriteError) -> Data {
        guard let first = pages.first else { throw .emptyDocument }
        let output = NSMutableData()
        var mediaBox = CGRect(origin: .zero, size: first.pageSize)
        let info: [CFString: Any] = [kCGPDFContextTitle: title, kCGPDFContextCreator: creator]
        guard let consumer = CGDataConsumer(data: output),
              let context = CGContext(consumer: consumer, mediaBox: &mediaBox, info as CFDictionary) else {
            throw .renderFailed
        }
        for (index, page) in pages.enumerated() {
            guard let image = jpegImage(page.jpeg) else { throw .invalidImage(page: index) }
            let box = CGRect(origin: .zero, size: page.pageSize)
            let boxData = withUnsafeBytes(of: box) { Data($0) } as CFData
            let frame = aspectFit(CGSize(width: image.width, height: image.height), on: page.pageSize)
            context.beginPDFPage([kCGPDFContextMediaBox: boxData] as CFDictionary)
            context.draw(image, in: frame)
            drawInvisibleText(page.textLines, in: context, frame: frame)
            context.endPDFPage()
        }
        context.closePDF()
        return output as Data
    }

    static func jpegImage(_ data: Data) -> CGImage? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              CGImageSourceGetType(source) as String? == UTType.jpeg.identifier,
              CGImageSourceGetCount(source) > 0,
              let provider = CGDataProvider(data: data as CFData) else {
            return nil
        }
        return CGImage(jpegDataProviderSource: provider, decode: nil, shouldInterpolate: true, intent: .defaultIntent)
    }

    /// The OCR text sits under the image, invisible, so the page can be searched and copied.
    static func drawInvisibleText(_ lines: [PDFTextLine], in context: CGContext, frame: CGRect) {
        context.saveGState()
        context.setTextDrawingMode(.invisible)
        for line in lines where !line.text.isEmpty {
            let rect = pdfRect(line.box, in: frame)
            let fontSize = max(rect.height * 0.85, 1)
            let plain = CTLineCreateWithAttributedString(attributed(line.text, font: CTFontCreateWithName("Helvetica" as CFString, fontSize, nil)))
            let naturalWidth = CTLineGetTypographicBounds(plain, nil, nil, nil)
            guard naturalWidth > 0 else { continue }
            // Scale inside the font: Quartz turns a text-matrix stretch into character spacing, which shrinks the selection.
            var matrix = CGAffineTransform(scaleX: rect.width / naturalWidth, y: 1)
            let scaled = CTFontCreateWithName("Helvetica" as CFString, fontSize, &matrix)
            let ctLine = CTLineCreateWithAttributedString(attributed(line.text, font: scaled))
            context.textMatrix = .identity
            context.textPosition = CGPoint(x: rect.minX, y: rect.minY + rect.height * 0.2)
            CTLineDraw(ctLine, context)
        }
        context.restoreGState()
    }

    static func attributed(_ text: String, font: CTFont) -> NSAttributedString {
        NSAttributedString(string: text, attributes: [NSAttributedString.Key(kCTFontAttributeName as String): font])
    }

    static func aspectFit(_ image: CGSize, on page: CGSize) -> CGRect {
        let scale = min(page.width / image.width, page.height / image.height)
        let size = CGSize(width: image.width * scale, height: image.height * scale)
        return CGRect(x: (page.width - size.width) / 2, y: (page.height - size.height) / 2, width: size.width, height: size.height)
    }

    /// Normalized top-left box of the image → PDF points with a bottom-left origin. The only conversion of the module.
    static func pdfRect(_ box: CGRect, in frame: CGRect) -> CGRect {
        CGRect(x: frame.minX + box.minX * frame.width, y: frame.minY + (1 - box.maxY) * frame.height,
               width: box.width * frame.width, height: box.height * frame.height)
    }
}
