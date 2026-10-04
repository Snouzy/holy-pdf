import CoreGraphics
import CoreText
import Foundation

public struct PageNumbering: Equatable, Sendable {
    public enum Format: CaseIterable, Sendable { case number, numberOfTotal, page }
    public enum Position: CaseIterable, Sendable { case topLeft, topCenter, topRight, bottomLeft, bottomCenter, bottomRight }

    public static let fontSizes: ClosedRange<CGFloat> = 6...36
    /// From the edge of the displayed page to the number, in points.
    static let margin: CGFloat = 24

    public var format = Format.number
    public var position = Position.bottomCenter
    /// The number written on the first page of `pages`.
    public var first = 1
    public var fontSize: CGFloat = 11
    /// Zero-based and inclusive.
    public var pages: ClosedRange<Int>

    public init(pages: ClosedRange<Int>) {
        self.pages = pages
    }

    public var isValid: Bool {
        pages.lowerBound >= 0 && (0...99_999).contains(first) && Self.fontSizes.contains(fontSize)
    }

    public func text(forPage index: Int) -> String? {
        guard pages.contains(index) else { return nil }
        let number = first + index - pages.lowerBound
        switch format {
        case .number: return String(number)
        case .numberOfTotal: return "\(number) / \(first + pages.count - 1)"
        case .page: return "Page \(number)"
        }
    }

    /// Draws the number of the page `index` in a context whose space is the displayed page, origin bottom-left;
    /// `displayed` is that page's bounds.
    public func draw(page index: Int, in context: CGContext, displayed: CGRect) {
        guard let text = text(forPage: index) else { return }
        let font = CTFontCreateUIFontForLanguage(.system, fontSize, nil) ?? CTFontCreateWithName("Helvetica" as CFString, fontSize, nil)
        let line = CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: [
            NSAttributedString.Key(kCTFontAttributeName as String): font,
            NSAttributedString.Key(kCTForegroundColorAttributeName as String): CGColor(gray: 0, alpha: 1),
        ]) as CFAttributedString)
        var ascent: CGFloat = 0, descent: CGFloat = 0
        let width = CGFloat(CTLineGetTypographicBounds(line, &ascent, &descent, nil))
        let x: CGFloat = switch position {
        case .topLeft, .bottomLeft: displayed.minX + Self.margin
        case .topCenter, .bottomCenter: displayed.midX - width / 2
        case .topRight, .bottomRight: displayed.maxX - Self.margin - width
        }
        let y: CGFloat = switch position {
        case .topLeft, .topCenter, .topRight: displayed.maxY - Self.margin - ascent
        case .bottomLeft, .bottomCenter, .bottomRight: displayed.minY + Self.margin + descent
        }
        context.saveGState()
        context.textMatrix = .identity
        context.textPosition = CGPoint(x: x, y: y)
        CTLineDraw(line, context)
        context.restoreGState()
    }
}

public enum PDFPageNumbers {
    /// A copy of the PDF with its numbers written into the content of the pages.
    public static func numbered(_ data: Data, password: String = "", _ numbering: PageNumbering) throws(PDFToolError) -> Data {
        let document = try PDFDocumentValidation.open(data, password: password)
        try PDFDocumentValidation.rejectDigitalSignatures(data, password: password)
        guard numbering.isValid, numbering.pages.upperBound < document.pageCount else { throw .invalidPlacement }
        return try PageOverlay.write(data, password: password) { index, context, displayed in
            numbering.draw(page: index, in: context, displayed: displayed)
        }
    }
}
