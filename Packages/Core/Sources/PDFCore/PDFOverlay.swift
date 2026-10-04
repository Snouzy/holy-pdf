import CoreGraphics
import Foundation
import PDFKit

public enum PDFOverlay {
    public enum Position: CaseIterable, Sendable { case over, under }

    /// A copy where each page carries the page of `layer` that has its number, fitted and centered, as the reader
    /// sees both. The last page of the layer goes on all the pages after it. Both texts stay text. The layer is only
    /// read: it may be signed, and it must open without a password.
    public static func overlaid(_ data: Data, password: String = "", layer: Data, position: Position) throws(PDFToolError) -> Data {
        _ = try PDFDocumentValidation.open(data, password: password)
        try PDFDocumentValidation.rejectDigitalSignatures(data, password: password)
        let pages = try PDFDocumentValidation.open(layer, password: "")
        return try PageOverlay.write(data, password: password, under: position == .under) { index, context, displayed in
            draw(pages, onto: index, in: context, displayed: displayed)
        }
    }

    /// The layer for the preview of a page: the caller draws it before the page, or after it.
    public static func show(_ layer: Data, onto pageIndex: Int, in context: CGContext, displayed page: CGRect) {
        if let pages = PDFDocument(data: layer) { draw(pages, onto: pageIndex, in: context, displayed: page) }
    }

    private static func draw(_ layer: PDFDocument, onto index: Int, in context: CGContext, displayed: CGRect) {
        guard let page = layer.page(at: min(index, layer.pageCount - 1)) else { return }
        let size = PageGeometry.displayedBounds(of: page).size
        guard size.width > 0, size.height > 0 else { return }
        let scale = min(displayed.width / size.width, displayed.height / size.height)
        context.saveGState()
        context.translateBy(x: displayed.midX - size.width * scale / 2, y: displayed.midY - size.height * scale / 2)
        context.scaleBy(x: scale, y: scale)
        // Core Graphics draws the page as it is stored. `PDFPage.draw` would leave its rotation out while PDFKit writes
        // a document, and would draw its annotations on screen only.
        context.concatenate(PageGeometry.displayTransform(of: page))
        context.clip(to: page.bounds(for: .cropBox))
        if let stored = page.pageRef { context.drawPDFPage(stored) }
        context.restoreGState()
    }
}
