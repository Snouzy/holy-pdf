import CoreGraphics
import Foundation

public enum PDFEditing {
    /// A copy with `items` drawn into the content of their pages, in the order given. `images` holds the pictures they
    /// name. Every copy starts from `data`: nothing piles up from one save to the next.
    public static func editedData(_ data: Data, password: String, items: [EditItem], images: [UUID: EditImage]) throws(PDFToolError) -> Data {
        let pageCount = try PDFDocumentValidation.open(data, password: password).pageCount
        try PDFDocumentValidation.rejectDigitalSignatures(data, password: password)
        guard !items.isEmpty, items.allSatisfy({ item in
            item.isValid && item.pageIndex < pageCount && picture(of: item).map { images[$0.image] != nil } ?? true
        }) else { throw .invalidPlacement }
        // One picture with one crop is one image object: the file holds it once however often it is placed.
        var prepared: [String: CGImage] = [:]
        for case .picture(let picture) in items.map(\.content) where prepared[key(picture)] == nil {
            if let image = images[picture.image] { prepared[key(picture)] = try image.cropped(picture.crop) }
        }
        let pictures = prepared
        let pages = Dictionary(grouping: items, by: \.pageIndex)
        return try PageOverlay.write(data, password: password) { index, context, page in
            for item in pages[index] ?? [] {
                EditPainter.draw(item, picture: picture(of: item).flatMap { pictures[key($0)] }, in: context, page: page)
            }
        }
    }

    private static func picture(of item: EditItem) -> EditPicture? {
        if case .picture(let picture) = item.content { picture } else { nil }
    }

    private static func key(_ picture: EditPicture) -> String { "\(picture.image)\(picture.crop)" }
}
