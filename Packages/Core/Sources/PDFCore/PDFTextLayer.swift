import CoreGraphics
import Foundation
import PDFKit

public enum PDFTextLayer {
    public struct Result: Equatable, Sendable {
        public let data: Data
        /// What was read, by page index: the pages that gained text.
        public let lines: [Int: [PDFTextLine]]
        public var pages: Int { lines.count }
    }

    /// Marks the lines read on a preview of the page, in the reader's space.
    public static func highlight(_ lines: [PDFTextLine], in context: CGContext, displayed: CGRect) {
        context.setFillColor(CGColor(red: 1, green: 0.84, blue: 0.2, alpha: 0.4))
        context.fill(lines.map { PDFWriter.pdfRect($0.box, in: displayed) })
    }

    /// Under this many characters, the text of a page is a stamp on a scan: a page number, a fax header.
    static let stampLength = 50

    /// A copy where each page without text carries the text that `read` finds in its image, invisible over the page:
    /// the page can then be searched and copied. Nil when no page gains text. A page that has text is left alone.
    public static func adding(_ data: Data, password: String = "", read: (CGImage) throws -> [PDFTextLine],
                              progress: (_ done: Int, _ total: Int) -> Void = { _, _ in }) throws(PDFToolError) -> Result? {
        let document = try PDFDocumentValidation.open(data, password: password)
        try PDFDocumentValidation.rejectDigitalSignatures(data, password: password)
        let sizes = try PageGeometry.displayedSizes(of: document)
        var lines: [Int: [PDFTextLine]] = [:]
        for (index, size) in sizes.enumerated() {
            guard !Task.isCancelled else { throw .cancelled }
            guard let page = document.page(at: index) else { throw .invalidDocument }
            progress(index + 1, sizes.count)
            let known = letters(page.string ?? "")
            guard known.count < stampLength else { continue }
            // A field value or a stamp laid over the scan is not the text of the page.
            page.displaysAnnotations = false
            // Vision reads small print at 2 400 pixels; the previews stop at 1 600.
            let image = try render(page, size: size, maxDimension: 2400, limit: 2400)
            let found: [PDFTextLine]
            do {
                found = try read(image).filter { line in
                    let text = letters(line.text)
                    return !text.isEmpty && !known.contains(text)
                }
            } catch { throw .renderFailed }
            if !found.isEmpty { lines[index] = found }
        }
        guard !lines.isEmpty else { return nil }
        let output = try PageOverlay.write(data, password: password) { [lines] index, context, displayed in
            PDFWriter.drawInvisibleText(lines[index] ?? [], in: context, frame: displayed)
        }
        return Result(data: output, lines: lines)
    }

    private static func letters(_ text: String) -> String {
        String(text.lowercased().filter { !$0.isWhitespace })
    }
}
