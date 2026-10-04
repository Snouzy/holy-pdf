import CoreGraphics
import Foundation
import PDFKit

/// A PDF opened by a tool that saves a changed copy: its bytes, its pages as the reader sees them, and their previews.
public actor PDFOpenedDocument {
    public nonisolated let data: Data
    public nonisolated let password: String
    public nonisolated let info: DocumentPagesInfo
    private let document: PDFDocument

    /// `allowsSigned` is for a tool that writes no copy of the PDF: nothing can break the signature.
    public init(data: Data, password: String = "", allowsSigned: Bool = false) throws(PDFToolError) {
        let document = try PDFDocumentValidation.open(data, password: password)
        if !allowsSigned { try PDFDocumentValidation.rejectDigitalSignatures(data, password: password) }
        self.data = data
        self.password = password
        self.document = document
        info = DocumentPagesInfo(pageSizes: try PageGeometry.displayedSizes(of: document), isEncrypted: document.isEncrypted)
    }

    /// `overlay` draws over the page in the reader's space: it receives the page's bounds, origin bottom-left.
    /// `underlay` draws the same way on the white paper, before the page. It comes last: a trailing closure is `overlay`.
    public func preview(pageIndex: Int, maxDimension: Int = 1600, overlay: (@Sendable (CGContext, CGRect) -> Void)? = nil,
                        underlay: (@Sendable (CGContext, CGRect) -> Void)? = nil) throws(PDFToolError) -> CGImage {
        // A caller that changed its mind must not pay for a render nobody will show.
        guard !Task.isCancelled else { throw .cancelled }
        guard info.pageSizes.indices.contains(pageIndex), let page = document.page(at: pageIndex), maxDimension > 0 else { throw .renderFailed }
        return try render(page, size: info.pageSizes[pageIndex], maxDimension: maxDimension, overlay: overlay, underlay: underlay)
    }
}

/// Apple's way to draw into pages: PDFKit draws each page, then `draw`, and writes both into the page content.
enum PageOverlay {
    /// A copy of the PDF where `draw` adds to every page. It receives the page's index, and the page's bounds in the
    /// reader's space: the crop box after /Rotate, origin bottom-left. A protected source gives a copy without password.
    /// With `under`, `draw` comes first and the page is drawn over it.
    static func write(_ data: Data, password: String, under: Bool = false,
                      draw: @escaping (Int, CGContext, CGRect) -> Void) throws(PDFToolError) -> Data {
        // A fresh copy for each export: nothing piles up from one save to the next.
        let copy = try PDFDocumentValidation.open(data, password: password)
        let stamp = Stamp(draw, under: under)
        copy.delegate = stamp
        let options: [AnyHashable: Any] = copy.isEncrypted
            ? [PDFDocumentWriteOption.ownerPasswordOption: "", PDFDocumentWriteOption.userPasswordOption: ""] : [:]
        guard let output = withExtendedLifetime(stamp, { copy.dataRepresentation(options: options) }), !output.isEmpty else { throw .writeFailed }
        return output
    }

    private final class Stamp: NSObject, PDFDocumentDelegate {
        let draw: (Int, CGContext, CGRect) -> Void
        let under: Bool

        init(_ draw: @escaping (Int, CGContext, CGRect) -> Void, under: Bool) {
            self.draw = draw
            self.under = under
        }

        func classForPage() -> AnyClass { StampedPage.self }
    }

    private final class StampedPage: PDFPage {
        override func draw(with box: PDFDisplayBox, to context: CGContext) {
            guard let document, let stamp = document.delegate as? Stamp else { return super.draw(with: box, to: context) }
            if !stamp.under { super.draw(with: box, to: context) }
            // The reader's page is the crop box after /Rotate, whatever box PDFKit draws.
            let toDisplay = PageGeometry.displayTransform(of: self)
            context.saveGState()
            context.concatenate(toDisplay.inverted())
            stamp.draw(document.index(for: self), context, bounds(for: .cropBox).applying(toDisplay))
            context.restoreGState()
            if stamp.under { super.draw(with: box, to: context) }
        }
    }
}
