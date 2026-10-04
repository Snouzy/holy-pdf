import CoreGraphics
import PDFKit

public struct DocumentPagesInfo: Sendable {
    public let pageSizes: [CGSize]
    public let isEncrypted: Bool
}

public enum PageGeometry {
    static func displayedBounds(of page: PDFPage) -> CGRect {
        page.bounds(for: .cropBox).applying(displayTransform(of: page))
    }

    static func displayedRect(_ normalized: CGRect, on page: PDFPage) -> CGRect {
        let visible = displayedBounds(of: page)
        return CGRect(x: visible.minX + normalized.minX * visible.width,
                      y: visible.minY + (1 - normalized.maxY) * visible.height,
                      width: normalized.width * visible.width, height: normalized.height * visible.height)
    }

    public static func isValid(_ bounds: CGRect) -> Bool {
        [bounds.origin.x, bounds.origin.y, bounds.size.width, bounds.size.height].allSatisfy(\.isFinite)
            && bounds.origin.x >= 0 && bounds.origin.y >= 0 && bounds.size.width > 0 && bounds.size.height > 0
            && bounds.maxX <= 1 && bounds.maxY <= 1
    }

    /// Page space to the reader's space: the crop box after /Rotate, origin bottom-left. Built from `rotation` because
    /// `transform(for:)` leaves the rotation out while PDFKit writes a document.
    static func displayTransform(of page: PDFPage) -> CGAffineTransform {
        let crop = page.bounds(for: .cropBox)
        switch (page.rotation % 360 + 360) % 360 {
        case 90: return CGAffineTransform(a: 0, b: -1, c: 1, d: 0, tx: -crop.minY, ty: crop.width + crop.minX)
        case 180: return CGAffineTransform(a: -1, b: 0, c: 0, d: -1, tx: crop.width + crop.minX, ty: crop.height + crop.minY)
        case 270: return CGAffineTransform(a: 0, b: 1, c: -1, d: 0, tx: crop.height + crop.minY, ty: -crop.minX)
        default: return CGAffineTransform(translationX: -crop.minX, y: -crop.minY)
        }
    }

    static func displayedSizes(of document: PDFDocument) throws(PDFToolError) -> [CGSize] {
        var sizes: [CGSize] = []
        for index in 0..<document.pageCount {
            guard let page = document.page(at: index) else { throw .invalidDocument }
            let size = displayedBounds(of: page).size
            guard size.width.isFinite, size.height.isFinite, size.width > 0, size.height > 0 else { throw .invalidDocument }
            sizes.append(size)
        }
        return sizes
    }
}
