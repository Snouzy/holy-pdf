import CoreGraphics
import Foundation
import ImageIO
import PDFKit

public struct SignaturePlacement: Identifiable, Equatable, Sendable {
    public let id: UUID
    public var pageIndex: Int
    /// Normalized to the displayed crop box, with a top-left origin.
    public var bounds: CGRect
    /// The mark this placement shows: one of the keys given to `signedData`.
    public var mark: UUID

    public init(id: UUID = UUID(), pageIndex: Int, bounds: CGRect, mark: UUID) {
        self.id = id
        self.pageIndex = pageIndex
        self.bounds = bounds
        self.mark = mark
    }
}

public actor PDFSigningDocument {
    private let original: Data
    private let password: String
    private let document: PDFDocument
    private let info: DocumentPagesInfo

    public init(data: Data, password: String = "") throws(PDFToolError) {
        let document = try PDFDocumentValidation.open(data, password: password)
        try PDFDocumentValidation.rejectDigitalSignatures(data, password: password)
        self.original = data
        self.password = password
        self.document = document
        self.info = DocumentPagesInfo(pageSizes: try PageGeometry.displayedSizes(of: document), isEncrypted: document.isEncrypted)
    }

    public func information() -> DocumentPagesInfo { info }

    public func preview(pageIndex: Int, maxDimension: Int = 1600) throws(PDFToolError) -> CGImage {
        guard !Task.isCancelled else { throw .renderFailed }
        guard info.pageSizes.indices.contains(pageIndex), let page = document.page(at: pageIndex) else { throw .invalidPlacement }
        guard maxDimension > 0 else { throw .renderFailed }
        return try render(page, size: info.pageSizes[pageIndex], maxDimension: maxDimension)
    }

    /// Several marks, signatures and typed lines, each placed as often as the user wants.
    public func signedData(marks: [UUID: SignatureImage], placements: [SignaturePlacement]) throws(PDFToolError) -> Data {
        guard !placements.isEmpty, placements.allSatisfy({
            info.pageSizes.indices.contains($0.pageIndex) && PageGeometry.isValid($0.bounds) && marks[$0.mark] != nil
        }) else { throw .invalidPlacement }
        var images: [UUID: CGImage] = [:]
        for (id, mark) in marks where placements.contains(where: { $0.mark == id }) {
            guard let source = CGImageSourceCreateWithData(mark.dataPNG as CFData, nil),
                  let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { throw .invalidImage }
            images[id] = image
        }
        // A fresh document retains its catalog and makes repeated exports independent of previous placements.
        let copy = try PDFDocumentValidation.open(original, password: password)
        for placement in placements {
            guard let page = copy.page(at: placement.pageIndex), let image = images[placement.mark] else { throw .invalidPlacement }
            page.addAnnotation(SignatureAnnotation(page: page, image: image, bounds: placement.bounds))
        }
        let options: [AnyHashable: Any] = info.isEncrypted
            ? [PDFDocumentWriteOption.ownerPasswordOption: "", PDFDocumentWriteOption.userPasswordOption: ""] : [:]
        guard let data = copy.dataRepresentation(options: options), !data.isEmpty else { throw .writeFailed }
        return data
    }
}

private final class SignatureAnnotation: PDFAnnotation {
    private let image: CGImage
    private let displayedRect: CGRect
    private let displayToPage: CGAffineTransform

    init(page: PDFPage, image: CGImage, bounds: CGRect) {
        self.image = image
        self.displayedRect = PageGeometry.displayedRect(bounds, on: page)
        self.displayToPage = page.transform(for: .cropBox).inverted()
        super.init(bounds: displayedRect.applying(displayToPage), forType: .stamp, withProperties: nil)
        userName = nil
        shouldPrint = true
    }

    required init?(coder: NSCoder) { return nil }

    override func draw(with box: PDFDisplayBox, in context: CGContext) {
        context.saveGState()
        context.concatenate(displayToPage)
        context.draw(image, in: displayedRect)
        context.restoreGState()
    }
}
