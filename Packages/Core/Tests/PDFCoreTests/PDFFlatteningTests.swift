import CoreGraphics
import Foundation
import PDFKit
import Testing
@testable import PDFCore

struct PDFFlatteningTests {
    /// The fixture, with its field filled as a user fills it: PDFKit then writes the look of the value.
    private func filled(_ value: String = "Ada Lovelace") throws -> Data {
        let document = try #require(PDFDocument(data: fixture("Form")))
        let field = try #require(document.page(at: 0)?.annotations.first { $0.type == "Widget" })
        field.widgetStringValue = value
        return try #require(document.dataRepresentation())
    }

    @Test func aFilledFieldBecomesTextOfThePage() throws {
        let source = try filled()
        #expect(PDFDocument(data: source)?.page(at: 0)?.string?.contains("Ada Lovelace") != true, "A field's value is not page text")
        let copy = try #require(PDFDocument(data: try PDFFlattening.flattened(source)))
        let page = try #require(copy.page(at: 0))
        #expect(page.string?.contains("Ada Lovelace") == true)
        #expect(page.string?.contains("Form") == true)
        #expect(!page.annotations.contains { $0.type == "Widget" || $0.type == "Square" })
        #expect(copy.pageCount == 2)
        #expect(copy.outlineRoot?.child(at: 0)?.label == "Form last")
    }

    @Test func thePageLooksTheSame() async throws {
        let source = try filled()
        let before = pixels(of: try await PDFOpenedDocument(data: source).preview(pageIndex: 0, maxDimension: 400))
        let after = pixels(of: try await PDFOpenedDocument(data: try PDFFlattening.flattened(source)).preview(pageIndex: 0, maxDimension: 400))
        try #require(before.contains { $0.red > 180 && $0.green < 90 && $0.blue < 90 }, "The red square of the source is drawn")
        let changed = zip(before, after).filter { abs($0.red - $1.red) > 40 || abs($0.green - $1.green) > 40 || abs($0.blue - $1.blue) > 40 }
        #expect(changed.count < before.count / 200, "\(changed.count) of \(before.count) pixels changed")
    }

    @Test func theLinksStillWork() throws {
        let copy = try #require(PDFDocument(data: try PDFFlattening.flattened(try filled())))
        let links = try #require(copy.page(at: 0)?.annotations.filter { $0.type == "Link" })
        #expect(links.count == 2)
        #expect(links.contains { $0.url?.absoluteString == "https://example.com/Form" })
        let inner = try #require(links.first { $0.destination?.page != nil }?.destination?.page)
        #expect(copy.index(for: inner) == 1)
    }

    @Test func countsWhatWillBeFlattened() throws {
        #expect(try PDFFlattening.survey(try filled()).marks == 2, "The field and the square; the links stay links")
        #expect(try PDFFlattening.survey(try filled()).attachments == 0)
        let plain = try #require(PDFDocument(data: fixture("Plain")))
        for annotation in plain.page(at: 0)?.annotations ?? [] where annotation.type != "Link" { plain.page(at: 0)?.removeAnnotation(annotation) }
        let bare = try #require(plain.dataRepresentation())
        #expect(try PDFFlattening.survey(bare).marks == 0)
    }

    /// A page with a hidden field that holds a value, and a note whose popup was left open.
    private func reviewed() -> Data {
        let text = "BT /F1 12 Tf 20 350 Td (VISIBLE) Tj ET"
        return serialize(objects: [
            "<</Type/Catalog/Pages 2 0 R/AcroForm<</Fields[6 0 R]/DR<</Font<</Helv 5 0 R>>>>>>>>",
            "<</Type/Pages/Count 1/Kids[3 0 R]>>",
            "<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 400]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R/Annots[6 0 R 7 0 R 8 0 R 9 0 R]>>",
            "<</Length \(text.utf8.count)>>stream\n\(text)\nendstream",
            "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
            "<</Type/Annot/Subtype/Widget/FT/Tx/T(Secret)/V(HIDDENVALUE)/F 2/Rect[20 240 220 270]/P 3 0 R/DA(/Helv 12 Tf 0 g)>>",
            "<</Type/Annot/Subtype/Text/Rect[150 300 170 320]/Contents(NOTEBODYTEXT)/Popup 8 0 R/P 3 0 R>>",
            "<</Type/Annot/Subtype/Popup/Rect[20 60 280 200]/Parent 7 0 R/Open true/P 3 0 R>>",
            "<</Type/Annot/Subtype/Link/F 2/Rect[20 20 120 50]/A<</S/URI/URI(https://example.com/hidden)>>>>",
        ])
    }

    @Test func whatTheReaderDoesNotSeeIsNotDrawn() async throws {
        let source = reviewed()
        #expect(try PDFFlattening.survey(source).marks == 1, "The note; not the hidden field, not the popup, not the hidden link")
        let output = try PDFFlattening.flattened(source)
        let copy = try #require(PDFDocument(data: output))
        let text = try #require(copy.page(at: 0)?.string)
        #expect(text.contains("VISIBLE"))
        #expect(!text.contains("HIDDENVALUE"), "A hidden field does not show in the copy")
        #expect(!text.contains("NOTEBODYTEXT"), "An open popup is not laid over the page")
        #expect(copy.page(at: 0)?.annotations.isEmpty == true, "A hidden link does not come back as a visible one")
        // The popup's box and the hidden field are in the lower half of the page, where the page itself is blank.
        let after = pixels(of: try await PDFOpenedDocument(data: output).preview(pageIndex: 0, maxDimension: 300))
        #expect(after.filter { $0.y > 0.5 }.allSatisfy { $0.red > 240 && $0.green > 240 && $0.blue > 240 })
    }

    @Test func countsTheFilesAttachedToAPage() throws {
        let document = try #require(PDFDocument(data: fixture("Report")))
        let clip = PDFAnnotation(bounds: CGRect(x: 30, y: 30, width: 20, height: 20), forType: PDFAnnotationSubtype(rawValue: "FileAttachment"), withProperties: nil)
        document.page(at: 0)?.addAnnotation(clip)
        let source = try #require(document.dataRepresentation())
        #expect(try PDFFlattening.survey(source).attachments == 1)
    }

    @Test func refusesASignedPDFAndOpensAProtectedOne() throws {
        #expect(throws: PDFToolError.alreadySigned) { try PDFFlattening.flattened(fixture("Signed", digitalSignature: true)) }
        let source = try filled()
        let locked = try #require(PDFDocument(data: source)?.dataRepresentation(options: [
            PDFDocumentWriteOption.userPasswordOption: "open", PDFDocumentWriteOption.ownerPasswordOption: "owner",
        ]))
        #expect(throws: PDFToolError.passwordRequired) { try PDFFlattening.flattened(locked) }
        #expect(try PDFFlattening.survey(locked, password: "open").marks == 2)
        let copy = try #require(PDFDocument(data: try PDFFlattening.flattened(locked, password: "open")))
        #expect(!copy.isLocked)
        #expect(copy.page(at: 0)?.string?.contains("Ada Lovelace") == true)
    }
}
