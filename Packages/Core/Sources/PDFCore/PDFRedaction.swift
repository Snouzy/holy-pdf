import CoreGraphics
import Foundation
import PDFKit

public enum PDFRedaction {
    /// Dots per inch of a page that becomes an image.
    static let resolution: CGFloat = 200
    /// A page larger than a poster is rendered at fewer dots per inch, not at gigabytes of pixels.
    static let longestSide = 6000

    /// A copy where each page of `areas` is replaced by its image, with the areas painted black: what they covered is
    /// no longer in the file, and neither are the text and the annotations of that page. The other pages keep their
    /// content. An area is normalized to the page as the reader sees it, origin top-left.
    public static func redacted(_ data: Data, password: String = "", areas: [Int: [CGRect]]) throws(PDFToolError) -> Data {
        let document = try PDFDocumentValidation.open(data, password: password)
        try PDFDocumentValidation.rejectDigitalSignatures(data, password: password)
        let marked = areas.filter { !$0.value.isEmpty }
        guard !marked.isEmpty, marked.keys.allSatisfy({ (0..<document.pageCount).contains($0) }),
              marked.values.joined().allSatisfy(PageGeometry.isValid) else { throw .invalidPlacement }
        // A page of another document lives as long as that document.
        var images: [PDFDocument] = []
        for (index, rects) in marked {
            guard !Task.isCancelled else { throw .cancelled }
            guard let page = document.page(at: index) else { throw .invalidDocument }
            let size = PageGeometry.displayedBounds(of: page).size
            let side = Int((max(size.width, size.height) * resolution / 72).rounded())
            let image = try render(page, size: size, maxDimension: side, limit: longestSide) { context, bounds in
                // Whole pixels, without smoothing: no pixel of the edge blends the black with what it covers.
                context.setShouldAntialias(false)
                context.setFillColor(CGColor(gray: 0, alpha: 1))
                context.fill(rects.map { context.convertToUserSpace(context.convertToDeviceSpace(PDFWriter.pdfRect($0, in: bounds)).integral) })
            }
            // As a JPEG, the page waits for the write in kilobytes, not in megabytes of pixels.
            let holder = try imageDocument(image, size: size)
            guard let replacement = holder.page(at: 0) else { throw .renderFailed }
            images.append(holder)
            document.insert(replacement, at: index)
            retarget(document, from: page, to: replacement)
            forget(page, covered: rects.map { PDFWriter.pdfRect($0, in: CGRect(origin: .zero, size: size)) }, in: document)
            document.removePage(at: index + 1)
        }
        let options: [AnyHashable: Any] = document.isEncrypted
            ? [PDFDocumentWriteOption.ownerPasswordOption: "", PDFDocumentWriteOption.userPasswordOption: ""] : [:]
        guard let output = withExtendedLifetime(images, { document.dataRepresentation(options: options) }), !output.isEmpty else { throw .writeFailed }
        return output
    }

    private static func imageDocument(_ image: CGImage, size: CGSize) throws(PDFToolError) -> PDFDocument {
        guard let jpeg = jpegData(image, quality: 0.8), let page = try? PDFWriter.data(pages: [PDFPageInput(jpeg: jpeg, pageSize: size)], title: ""),
              let holder = PDFDocument(data: page) else { throw .renderFailed }
        return holder
    }

    /// Bookmarks and links to the page follow it to its image.
    private static func retarget(_ document: PDFDocument, from old: PDFPage, to new: PDFPage) {
        func moved(_ destination: PDFDestination?) -> PDFDestination? {
            guard let destination, destination.page === old else { return nil }
            var point = destination.point
            // The image has the reader's space: a point of the old page turns with it.
            if point.x != kPDFDestinationUnspecifiedValue, point.y != kPDFDestinationUnspecifiedValue {
                point = point.applying(PageGeometry.displayTransform(of: old))
            }
            let target = PDFDestination(page: new, at: point)
            target.zoom = destination.zoom
            return target
        }
        var pending = document.outlineRoot.map { [$0] } ?? []
        var visited = 0
        while let node = pending.popLast(), visited < 100_000 {
            visited += 1
            if let destination = moved(node.destination) { node.destination = destination }
            pending += (0..<node.numberOfChildren).compactMap(node.child(at:))
        }
        for index in 0..<document.pageCount {
            for annotation in document.page(at: index)?.annotations ?? [] {
                if let destination = moved(annotation.destination) { annotation.destination = destination }
            }
        }
    }

    /// The annotations of the page go with it. Two kinds reach the pages that stay: the popup of a note, whose text
    /// PDFKit writes into it, and the other widgets of a form field that an area covers, which carry the same value.
    /// PDFKit cannot empty a field for good (the default value and the appearance keep the text): the widgets go.
    private static func forget(_ page: PDFPage, covered: [CGRect], in document: PDFDocument) {
        let toDisplay = PageGeometry.displayTransform(of: page)
        let fields = Set(page.annotations.compactMap { widget -> String? in
            guard widget.type == "Widget", covered.contains(where: widget.bounds.applying(toDisplay).intersects) else { return nil }
            return widget.fieldName
        })
        for index in 0..<document.pageCount {
            guard let kept = document.page(at: index), kept !== page else { continue }
            for annotation in kept.annotations {
                let orphanPopup = annotation.type == "Popup" && !kept.annotations.contains { $0.popup === annotation }
                let sameField = annotation.type == "Widget" && annotation.fieldName.map(fields.contains) == true
                if orphanPopup || sameField { kept.removeAnnotation(annotation) }
            }
        }
    }
}
