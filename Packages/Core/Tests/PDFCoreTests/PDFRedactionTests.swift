import CoreGraphics
import Foundation
import PDFKit
import Testing
@testable import PDFCore

struct PDFRedactionTests {
    /// Page 1 holds a secret in its text, in a field, in a note and in a link. Page 2 is public and links back to page 1.
    /// Two secrets reach page 2: the note's popup sits there, and a second field has a widget on each page.
    private func confidential() -> Data {
        let secret = "BT /F1 12 Tf 20 300 Td (SECRETCONTENT 4242) Tj ET"
        let open = "BT /F1 12 Tf 20 300 Td (PUBLICPAGE) Tj ET"
        return serialize(objects: [
            "<</Type/Catalog/Pages 2 0 R/AcroForm<</Fields[7 0 R 14 0 R]/DR<</Font<</Helv 5 0 R>>>>>>/Outlines 10 0 R>>",
            "<</Type/Pages/Count 2/Kids[3 0 R 9 0 R]>>",
            "<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 400]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R/Annots[6 0 R 7 0 R 8 0 R 15 0 R]>>",
            "<</Length \(secret.utf8.count)>>stream\n\(secret)\nendstream",
            "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
            "<</Type/Annot/Subtype/Link/Rect[20 100 120 130]/A<</S/URI/URI(https://example.com/SECRETLINK)>>>>",
            "<</Type/Annot/Subtype/Widget/FT/Tx/T(Name)/V(SECRETFIELD)/Rect[20 240 120 270]/P 3 0 R/DA(/Helv 12 Tf 0 g)>>",
            "<</Type/Annot/Subtype/Text/Rect[150 250 170 270]/Contents(SECRETNOTE)/Popup 16 0 R/P 3 0 R>>",
            "<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 400]/Resources<</Font<</F1 5 0 R>>>>/Contents 12 0 R/Annots[13 0 R 16 0 R 17 0 R]>>",
            "<</Type/Outlines/First 11 0 R/Last 11 0 R/Count 1>>",
            "<</Title(To the first page)/Parent 10 0 R/Dest[3 0 R /Fit]>>",
            "<</Length \(open.utf8.count)>>stream\n\(open)\nendstream",
            "<</Type/Annot/Subtype/Link/Rect[20 100 120 130]/Dest[3 0 R /Fit]>>",
            "<</FT/Tx/T(Shared)/V(SECRETSHARED)/DV(SECRETSHARED)/Kids[15 0 R 17 0 R]/DA(/Helv 12 Tf 0 g)>>",
            "<</Type/Annot/Subtype/Widget/Parent 14 0 R/Rect[20 200 120 230]/P 3 0 R>>",
            "<</Type/Annot/Subtype/Popup/Rect[150 100 250 200]/Parent 8 0 R/P 9 0 R>>",
            "<</Type/Annot/Subtype/Widget/Parent 14 0 R/Rect[20 200 120 230]/P 9 0 R/F 2>>",
        ])
    }

    /// The bytes of the file and of every stream PDFKit deflated: a secret may hide in either.
    private func everything(in pdf: Data) -> [Data] {
        var parts = [pdf]
        var search = pdf.startIndex..<pdf.endIndex
        while let start = pdf.range(of: Data("stream\n".utf8), in: search),
              let end = pdf.range(of: Data("endstream".utf8), in: start.upperBound..<pdf.endIndex) {
            // A Flate stream starts with a two-byte zlib header that NSData's raw inflate does not read.
            let body = pdf[start.upperBound..<end.lowerBound].dropFirst(2)
            if let inflated = try? (Data(body) as NSData).decompressed(using: .zlib) { parts.append(inflated as Data) }
            search = end.upperBound..<pdf.endIndex
        }
        return parts
    }

    /// A PDF string may be written as bytes, as UTF-16 or in hexadecimal.
    private func holds(_ marker: String, _ parts: [Data]) -> Bool {
        let hex = marker.utf8.map { String(format: "%02X", $0) }.joined()
        let forms = [Data(marker.utf8), marker.data(using: .utf16BigEndian)!, Data(hex.utf8), Data(hex.lowercased().utf8)]
        return parts.contains { part in forms.contains { part.range(of: $0) != nil } }
    }

    private let band = CGRect(x: 0, y: 0.2, width: 0.8, height: 0.1)
    /// Over the widget of the field that both pages share.
    private let fieldBand = CGRect(x: 0, y: 0.4, width: 0.5, height: 0.12)

    @Test func nothingOfARedactedPageStaysInTheFile() throws {
        let source = confidential()
        let before = everything(in: source)
        for marker in ["SECRETCONTENT", "SECRETFIELD", "SECRETNOTE", "SECRETLINK", "SECRETSHARED", "PUBLICPAGE"] {
            try #require(holds(marker, before), "\(marker) is in the source")
        }
        let output = try PDFRedaction.redacted(source, areas: [0: [band, fieldBand]])
        let after = everything(in: output)
        try #require(after.count > 2, "The streams of the copy were read")
        for marker in ["SECRETCONTENT", "SECRETFIELD", "SECRETNOTE", "SECRETLINK", "SECRETSHARED"] {
            #expect(!holds(marker, after), "\(marker) is still in the copy")
        }
        let copy = try #require(PDFDocument(data: output))
        #expect(copy.pageCount == 2)
        #expect(copy.page(at: 0)?.string?.contains { !$0.isWhitespace } != true)
        #expect(copy.page(at: 0)?.annotations.isEmpty == true)
        #expect(copy.page(at: 1)?.string?.contains("PUBLICPAGE") == true)
        #expect(copy.page(at: 1)?.annotations.contains { $0.type == "Widget" } == false, "The field that an area covers leaves the other pages too")
        #expect(copy.page(at: 1)?.annotations.contains { $0.type == "Link" } == true)
    }

    @Test func aFieldThatNoAreaCoversStaysOnTheOtherPages() throws {
        let copy = try #require(PDFDocument(data: try PDFRedaction.redacted(confidential(), areas: [0: [band]])))
        let shared = try #require(copy.page(at: 1)?.annotations.first { $0.type == "Widget" })
        #expect(shared.fieldName == "Shared")
        #expect(shared.widgetStringValue == "SECRETSHARED", "The image of page 1 shows this value: it was not covered")
    }

    @Test func bookmarksAndLinksFollowThePageToItsImage() throws {
        let copy = try #require(PDFDocument(data: try PDFRedaction.redacted(confidential(), areas: [0: [band]])))
        let first = try #require(copy.page(at: 0))
        #expect(copy.outlineRoot?.child(at: 0)?.label == "To the first page")
        #expect(copy.outlineRoot?.child(at: 0)?.destination?.page === first)
        #expect(copy.page(at: 1)?.annotations.first { $0.type == "Link" }?.destination?.page === first)
    }

    @Test func aBookmarkKeepsItsPlaceOnAPageThatWasRotated() throws {
        // Page 1 is rotated by 90 degrees; the bookmark points at (40, 300) of the page's own space, with a zoom.
        let source = serialize(objects: [
            "<</Type/Catalog/Pages 2 0 R/Outlines 5 0 R>>",
            "<</Type/Pages/Count 1/Kids[3 0 R]>>",
            "<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 400]/Rotate 90/Contents 4 0 R>>",
            "<</Length 0>>stream\n\nendstream",
            "<</Type/Outlines/First 6 0 R/Last 6 0 R/Count 1>>",
            "<</Title(Clause)/Parent 5 0 R/Dest[3 0 R /XYZ 40 300 2]>>",
        ])
        let copy = try #require(PDFDocument(data: try PDFRedaction.redacted(source, areas: [0: [band]])))
        let destination = try #require(copy.outlineRoot?.child(at: 0)?.destination)
        // Rotated by 90 degrees, (40, 300) of a 300 × 400 page is shown at (300, 260) of a 400 × 300 page.
        #expect(abs(destination.point.x - 300) < 1 && abs(destination.point.y - 260) < 1, "\(destination.point)")
        #expect(destination.zoom == 2)
    }

    @Test func theAreaIsBlackAndTheRestOfThePageIsKept() async throws {
        let source = confidential()
        let output = try PDFRedaction.redacted(source, areas: [0: [band]])
        let shown = pixels(of: try await PDFOpenedDocument(data: output).preview(pageIndex: 0, maxDimension: 400))
        let inside = shown.filter { $0.x < 0.78 && $0.y > 0.21 && $0.y < 0.29 }
        try #require(!inside.isEmpty)
        #expect(inside.allSatisfy { $0.red < 40 && $0.green < 40 && $0.blue < 40 })
        let below = shown.filter { $0.y > 0.5 && $0.y < 0.55 && $0.x > 0.6 }
        #expect(below.allSatisfy { $0.red > 230 }, "The page under the band stays white")
        let original = pixels(of: try await PDFOpenedDocument(data: source).preview(pageIndex: 0, maxDimension: 400))
        #expect(original.contains { $0.y > 0.21 && $0.y < 0.29 && $0.red < 100 }, "The band covers the secret line of the source")
    }

    @Test func aRedactedPageIsAnImageAtTwoHundredDotsPerInch() throws {
        let output = try PDFRedaction.redacted(confidential(), areas: [0: [band]])
        // 300 × 400 points are 4.17 × 5.56 inches.
        #expect(output.range(of: Data("/Width 833".utf8)) != nil)
        #expect(output.range(of: Data("/Height 1111".utf8)) != nil)
        #expect(output.range(of: Data("/DCTDecode".utf8)) != nil)
        #expect(output.range(of: Data("/SMask".utf8)) == nil, "An opaque page needs no transparency mask")
    }

    @Test(arguments: [0, 90, 180, 270])
    func aPageKeepsTheLookAndTheSizeTheReaderSees(rotation: Int) async throws {
        let source = fixture("Rotated", rotation: rotation)
        let before = try PDFOpenedDocument(data: source)
        let corner = CGRect(x: 0, y: 0, width: 0.5, height: 0.25)
        let after = try PDFOpenedDocument(data: try PDFRedaction.redacted(source, areas: [0: [corner]]))
        #expect(after.info.pageSizes[0].width.rounded() == before.info.pageSizes[0].width.rounded())
        #expect(after.info.pageSizes[0].height.rounded() == before.info.pageSizes[0].height.rounded())
        #expect(after.info.pageSizes[1] == before.info.pageSizes[1])
        let shown = pixels(of: try await after.preview(pageIndex: 0, maxDimension: 400))
        #expect(shown.filter { $0.x > 0.05 && $0.x < 0.45 && $0.y > 0.03 && $0.y < 0.22 }.allSatisfy { $0.red < 40 },
                "The black area is in the top left corner the reader sees")
        let elsewhere = shown.filter { $0.x > 0.55 || $0.y > 0.3 }
        #expect(elsewhere.filter { $0.red < 40 && $0.green < 40 && $0.blue < 40 }.count < elsewhere.count / 20, "Only glyphs are dark outside the corner")
    }

    @Test func theOtherPagesDoNotChange() throws {
        let source = fixture("Kept")
        let copy = try #require(PDFDocument(data: try PDFRedaction.redacted(source, areas: [1: [band]])))
        let first = try #require(copy.page(at: 0))
        #expect(first.string?.contains("Kept") == true)
        #expect(first.annotations.filter { $0.type == "Link" }.count == 2)
        #expect(first.annotations.first { $0.type == "Widget" }?.widgetStringValue == "Kept")
        #expect(first.bounds(for: .cropBox) == CGRect(x: 10, y: 20, width: 270, height: 360))
        #expect(copy.page(at: 1)?.string?.contains("Kept") != true)
    }

    @Test func refusesWhatItCannotRedact() throws {
        let source = confidential()
        #expect(throws: PDFToolError.invalidPlacement) { try PDFRedaction.redacted(source, areas: [:]) }
        #expect(throws: PDFToolError.invalidPlacement) { try PDFRedaction.redacted(source, areas: [0: []]) }
        #expect(throws: PDFToolError.invalidPlacement) { try PDFRedaction.redacted(source, areas: [2: [band]]) }
        #expect(throws: PDFToolError.invalidPlacement) { try PDFRedaction.redacted(source, areas: [0: [CGRect(x: 0.5, y: 0.5, width: 0.8, height: 0.1)]]) }
        #expect(throws: PDFToolError.alreadySigned) { try PDFRedaction.redacted(fixture("Signed", digitalSignature: true), areas: [0: [band]]) }
        let locked = try #require(PDFDocument(data: source)?.dataRepresentation(options: [
            PDFDocumentWriteOption.userPasswordOption: "open", PDFDocumentWriteOption.ownerPasswordOption: "owner",
        ]))
        #expect(throws: PDFToolError.passwordRequired) { try PDFRedaction.redacted(locked, areas: [0: [band]]) }
        let copy = try #require(PDFDocument(data: try PDFRedaction.redacted(locked, password: "open", areas: [0: [band]])))
        #expect(!copy.isLocked)
        #expect(copy.page(at: 1)?.string?.contains("PUBLICPAGE") == true)
    }
}
