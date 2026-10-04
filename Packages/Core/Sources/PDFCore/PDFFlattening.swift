import Foundation
import PDFKit

public enum PDFFlattening {
    public struct Survey: Sendable {
        /// The fields and annotations that `flattened` moves into the pages. Links stay links.
        public let marks: Int
        /// The files attached to a page by an annotation: the flattened copy does not hold them.
        public let attachments: Int
    }

    public static func survey(_ data: Data, password: String = "") throws(PDFToolError) -> Survey {
        let document = try PDFDocumentValidation.open(data, password: password)
        let shown = (0..<document.pageCount).flatMap { document.page(at: $0)?.annotations ?? [] }.filter { !isUnseen($0) }
        return Survey(marks: shown.count { $0.type != "Link" }, attachments: shown.count { $0.type == "FileAttachment" })
    }

    /// PDFKit burns what a reader does not see: an annotation with the Hidden flag, which its own drawing skips,
    /// and the popup of a note, as an opaque box over the page when the note was saved open.
    private static func isUnseen(_ annotation: PDFAnnotation) -> Bool {
        annotation.type == "Popup" || ((annotation.value(forAnnotationKey: .flags) as? NSNumber)?.intValue ?? 0) & 2 != 0
    }

    /// A copy where the filled fields and the annotations are part of the pages: they look the same and can no
    /// longer be changed. The text stays text, the links stay links.
    public static func flattened(_ data: Data, password: String = "") throws(PDFToolError) -> Data {
        let source = try PDFDocumentValidation.open(data, password: password)
        try PDFDocumentValidation.rejectDigitalSignatures(data, password: password)
        for index in 0..<source.pageCount {
            guard let page = source.page(at: index) else { throw .invalidDocument }
            for annotation in page.annotations where isUnseen(annotation) { page.removeAnnotation(annotation) }
        }
        let open: [PDFDocumentWriteOption: Any] = source.isEncrypted ? [.ownerPasswordOption: "", .userPasswordOption: ""] : [:]
        guard let burned = source.dataRepresentation(options: open.merging([.burnInAnnotationsOption: true]) { $1 }),
              let copy = PDFDocument(data: burned), copy.pageCount == source.pageCount else { throw .writeFailed }
        // PDFKit burns every annotation, and a link has nothing to draw: it would just stop working. The links are
        // laid again on the flattened pages.
        var links = 0
        for index in 0..<source.pageCount {
            guard let page = source.page(at: index), let target = copy.page(at: index) else { throw .invalidDocument }
            for link in page.annotations where link.type == "Link" {
                let again = PDFAnnotation(bounds: link.bounds, forType: .link, withProperties: nil)
                if let url = link.url {
                    again.url = url
                } else if let destination = link.destination, let old = destination.page, let new = copy.page(at: source.index(for: old)) {
                    let moved = PDFDestination(page: new, at: destination.point)
                    moved.zoom = destination.zoom
                    again.destination = moved
                } else { continue }
                // The frame of the old link is already drawn in the page.
                again.border = nil
                target.addAnnotation(again)
                links += 1
            }
        }
        guard links > 0 else { return burned }
        guard let output = copy.dataRepresentation(options: open), !output.isEmpty else { throw .writeFailed }
        return output
    }
}
