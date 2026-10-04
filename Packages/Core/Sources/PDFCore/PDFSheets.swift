import CoreGraphics
import Foundation
import PDFKit

/// Draws a new document through a file, then maps it: a copy of hundreds of megabytes does not also wait in memory.
private func newDocument(_ draw: (CGContext) throws(PDFToolError) -> Void) throws(PDFToolError) -> Data {
    let scratch = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    // The mapped pages outlive the name of the file.
    defer { try? FileManager.default.removeItem(at: scratch) }
    guard let context = CGContext(scratch as CFURL, mediaBox: nil, [kCGPDFContextCreator: PDFWriter.creator] as CFDictionary) else { throw .writeFailed }
    do {
        defer { context.closePDF() }
        try draw(context)
    }
    guard let output = try? Data(contentsOf: scratch, options: .alwaysMapped), !output.isEmpty else { throw .writeFailed }
    return output
}

public enum PDFPixelizing {
    /// Every page as a picture of what the reader sees, on a new page of the same size: no text is left to select.
    /// The new document has no signature field, so a signed PDF is accepted.
    public static func pixelized(_ data: Data, password: String = "", quality: PDFPageImages.Quality,
                                 progress: (_ done: Int, _ total: Int) -> Void = { _, _ in }) throws(PDFToolError) -> Data {
        let sizes = try PageGeometry.displayedSizes(of: PDFDocumentValidation.open(data, password: password))
        return try newDocument { context throws(PDFToolError) in
            try PDFPageImages.export(data, password: password, quality: quality) { index, jpeg in
                progress(index + 1, sizes.count)
                guard let image = PDFWriter.jpegImage(jpeg) else { throw PDFToolError.renderFailed }
                var box = CGRect(origin: .zero, size: sizes[index])
                context.beginPage(mediaBox: &box)
                context.draw(image, in: box)
                context.endPage()
            }
        }
    }
}

public enum PDFPageHalves {
    public enum Cut: CaseIterable, Sendable { case leftRight, topBottom }

    /// A dashed line over the preview of a page, where the cut falls.
    public static func mark(_ cut: Cut, in context: CGContext, displayed page: CGRect) {
        let width = max(page.width, page.height) / 250
        context.setStrokeColor(CGColor(red: 0.85, green: 0.15, blue: 0.1, alpha: 1))
        context.setLineWidth(width)
        context.setLineDash(phase: 0, lengths: [width * 5, width * 3])
        context.strokeLineSegments(between: cut == .leftRight ? [CGPoint(x: page.midX, y: page.minY), CGPoint(x: page.midX, y: page.maxY)]
            : [CGPoint(x: page.minX, y: page.midY), CGPoint(x: page.maxX, y: page.midY)])
    }

    /// Each page becomes two pages that follow each other: the two halves of what the reader sees. The pages keep
    /// their text; a link or a field stays on the half that shows it.
    public static func halved(_ data: Data, password: String = "", cut: Cut) throws(PDFToolError) -> Data {
        let document = try PDFDocumentValidation.open(data, password: password)
        try PDFDocumentValidation.rejectDigitalSignatures(data, password: password)
        for index in stride(from: document.pageCount - 1, through: 0, by: -1) {
            guard !Task.isCancelled else { throw .cancelled }
            guard let page = document.page(at: index), let second = page.copy() as? PDFPage else { throw .invalidDocument }
            let toReader = PageGeometry.displayTransform(of: page)
            let shown = PageGeometry.displayedBounds(of: page)
            let (first, last) = cut == .leftRight ? shown.divided(atDistance: shown.width / 2, from: .minXEdge)
                : shown.divided(atDistance: shown.height / 2, from: .maxYEdge)
            for (half, frame) in [(page, first), (second, last)] {
                let bounds = frame.applying(toReader.inverted())
                half.setBounds(bounds, for: .cropBox)
                half.setBounds(bounds, for: .mediaBox)
                // A popup follows its comment: PDFKit does not write one whose comment is gone.
                for annotation in half.annotations where annotation.type != "Popup" && !annotation.bounds.intersects(bounds) {
                    half.removeAnnotation(annotation)
                }
            }
            document.insert(second, at: index + 1)
        }
        let options: [AnyHashable: Any] = document.isEncrypted
            ? [PDFDocumentWriteOption.ownerPasswordOption: "", PDFDocumentWriteOption.userPasswordOption: ""] : [:]
        guard let output = document.dataRepresentation(options: options), !output.isEmpty else { throw .writeFailed }
        return output
    }
}

public enum PDFSheets {
    public static let choices = [2, 4, 6, 9, 16]

    /// With 2 or 6 pages the sheet lies on its side, so that a portrait page keeps a portrait cell.
    public static func grid(_ perSheet: Int) -> (columns: Int, rows: Int)? {
        [2: (2, 1), 4: (2, 2), 6: (3, 2), 9: (3, 3), 16: (4, 4)][perSheet]
    }

    /// The pages in reading order on A4 sheets, each fitted and centered in its cell. The pages are drawn, not
    /// photographed: their text stays text. The new document has no signature field, so a signed PDF is accepted.
    public static func arranged(_ data: Data, password: String = "", perSheet: Int,
                                progress: (_ done: Int, _ total: Int) -> Void = { _, _ in }) throws(PDFToolError) -> Data {
        guard let (columns, rows) = grid(perSheet) else { throw .invalidOrder }
        let document = try PDFDocumentValidation.open(data, password: password)
        let sizes = try PageGeometry.displayedSizes(of: document)
        let a4 = PDFImagePages.a4
        var sheet = CGRect(origin: .zero, size: columns > rows ? CGSize(width: a4.height, height: a4.width) : a4)
        let cell = CGSize(width: sheet.width / CGFloat(columns), height: sheet.height / CGFloat(rows))
        return try newDocument { context throws(PDFToolError) in
            for (index, size) in sizes.enumerated() {
                guard !Task.isCancelled else { throw .cancelled }
                guard let page = document.page(at: index) else { throw .invalidDocument }
                progress(index + 1, sizes.count)
                let place = index % perSheet
                if place == 0 { context.beginPage(mediaBox: &sheet) }
                let scale = min(cell.width / size.width, cell.height / size.height)
                context.saveGState()
                context.translateBy(x: CGFloat(place % columns) * cell.width + (cell.width - size.width * scale) / 2,
                                    y: sheet.height - CGFloat(place / columns + 1) * cell.height + (cell.height - size.height * scale) / 2)
                context.scaleBy(x: scale, y: scale)
                context.clip(to: CGRect(origin: .zero, size: size))
                autoreleasepool { page.draw(with: .cropBox, to: context) }
                context.restoreGState()
                if place == perSheet - 1 || index == sizes.count - 1 { context.endPage() }
            }
        }
    }
}
