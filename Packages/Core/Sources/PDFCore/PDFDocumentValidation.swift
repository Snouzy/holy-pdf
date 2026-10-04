import CoreGraphics
import Foundation
import PDFKit

public enum PDFToolError: Error, Equatable, Sendable {
    case invalidDocument, passwordRequired, wrongPassword, invalidPassword, alreadySigned
    case invalidImage, imageTooLarge, invalidPlacement
    case fileTooLarge, collectionTooLarge, tooManyDocuments, invalidOrder
    case unsupportedDocument, renderFailed, writeFailed, cancelled
}

enum PDFDocumentValidation {
    static func open(_ data: Data, password: String) throws(PDFToolError) -> PDFDocument {
        guard let document = PDFDocument(data: data) else { throw .invalidDocument }
        if document.isLocked && !document.unlock(withPassword: password) {
            throw password.isEmpty ? .passwordRequired : .wrongPassword
        }
        guard document.pageCount > 0 else { throw .invalidDocument }
        return document
    }

    static func rejectDigitalSignatures(_ data: Data, password: String) throws(PDFToolError) {
        guard let provider = CGDataProvider(data: data as CFData), let pdf = CGPDFDocument(provider) else { throw .invalidDocument }
        if !pdf.isUnlocked && !pdf.unlockWithPassword(password) { throw .invalidDocument }
        guard let catalog = pdf.catalog, pdf.numberOfPages > 0 else { throw .invalidDocument }
        var visited = 0
        func inspect(_ field: CGPDFDictionaryRef, inherited: String? = nil, depth: Int = 0) throws(PDFToolError) {
            guard depth < 64, visited < 100_000 else { throw .invalidDocument }
            visited += 1
            let type = field.name("FT") ?? inherited
            if field.name("Type") == "Sig" || (type == "Sig" && field.dictionary("V") != nil) { throw .alreadySigned }
            if let value = field.dictionary("V"), value.name("Type") == "Sig" { throw .alreadySigned }
            for child in field.dictionaries("Kids") { try inspect(child, inherited: type, depth: depth + 1) }
        }
        // Usage rights (/UR, /UR3) only unlock Adobe Reader features, on tax forms for instance: nobody signed them.
        if catalog.dictionary("Perms")?.dictionary("DocMDP") != nil { throw .alreadySigned }
        if let form = catalog.dictionary("AcroForm") {
            for field in form.dictionaries("Fields") { try inspect(field) }
        }
        for index in 1...pdf.numberOfPages {
            guard let page = pdf.page(at: index), let owner = page.dictionary else { throw .invalidDocument }
            for annotation in owner.dictionaries("Annots") { try inspect(annotation) }
        }
    }
}

/// `overlay` draws over the page in the reader's space: it receives the page's bounds, origin bottom-left.
/// `underlay` draws the same way on the white paper, before the page.
func render(_ page: PDFPage, size: CGSize, maxDimension: Int, limit: Int = 1600, overlay: ((CGContext, CGRect) -> Void)? = nil,
            underlay: ((CGContext, CGRect) -> Void)? = nil) throws(PDFToolError) -> CGImage {
    let scale = CGFloat(min(maxDimension, limit)) / max(size.width, size.height)
    let width = max(1, Int(floor(size.width * scale)))
    let height = max(1, Int(floor(size.height * scale)))
    guard let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
                                  space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
        throw .renderFailed
    }
    context.setFillColor(CGColor(gray: 1, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    context.scaleBy(x: CGFloat(width) / size.width, y: CGFloat(height) / size.height)
    underlay?(context, CGRect(origin: .zero, size: size))
    context.saveGState()
    // PDFKit autoreleases what keeps the bitmap alive: without a pool, a loop over pages holds every render.
    autoreleasepool { page.draw(with: .cropBox, to: context) }
    context.restoreGState()
    overlay?(context, CGRect(origin: .zero, size: size))
    guard let image = context.makeImage() else { throw .renderFailed }
    return image
}

// CGPDFDictionaryRef is OpaquePointer: never call these on a CGPDFArrayRef.
extension CGPDFDictionaryRef {
    func has(_ key: String) -> Bool {
        var object: CGPDFObjectRef?
        return CGPDFDictionaryGetObject(self, key, &object)
    }

    func dictionary(_ key: String) -> CGPDFDictionaryRef? {
        var result: CGPDFDictionaryRef?
        CGPDFDictionaryGetDictionary(self, key, &result)
        return result
    }

    func array(_ key: String) -> CGPDFArrayRef? {
        var result: CGPDFArrayRef?
        CGPDFDictionaryGetArray(self, key, &result)
        return result
    }

    func name(_ key: String) -> String? {
        var result: UnsafePointer<CChar>?
        guard CGPDFDictionaryGetName(self, key, &result), let result else { return nil }
        return String(cString: result)
    }

    /// The dictionaries of the array at `key`, read one at a time so that a caller's limit stops a huge array early.
    func dictionaries(_ key: String) -> some Sequence<CGPDFDictionaryRef> {
        let items = array(key)
        return (0..<(items.map(CGPDFArrayGetCount) ?? 0)).lazy.compactMap { index in
            var result: CGPDFDictionaryRef?
            guard let items, CGPDFArrayGetDictionary(items, index, &result) else { return nil }
            return result
        }
    }
}
