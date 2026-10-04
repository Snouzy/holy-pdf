import CoreGraphics
import CoreText
import Foundation
import PDFKit
import Testing
@testable import PDFCore

struct PDFOverlayTests {
    /// Pages with a word each, and a filled block. The paper is left bare: what lies under shows through.
    private func sheets(_ words: [String], size: CGSize = CGSize(width: 300, height: 400), block: CGRect, color: CGColor, rotation: Int = 0) throws -> Data {
        let data = NSMutableData()
        let consumer = try #require(CGDataConsumer(data: data))
        var box = CGRect(origin: .zero, size: size)
        let context = try #require(CGContext(consumer: consumer, mediaBox: &box, nil))
        for word in words {
            context.beginPDFPage(nil)
            context.setFillColor(color)
            context.fill(block)
            context.setFillColor(CGColor(gray: 0, alpha: 1))
            let line = CFAttributedStringCreate(nil, word as CFString, [kCTFontAttributeName: CTFontCreateWithName("Helvetica" as CFString, 14, nil)] as CFDictionary)!
            context.textPosition = CGPoint(x: 20, y: 20)
            CTLineDraw(CTLineCreateWithAttributedString(line), context)
            context.endPDFPage()
        }
        context.closePDF()
        guard rotation != 0 else { return data as Data }
        let document = try #require(PDFDocument(data: data as Data))
        for index in 0..<words.count { document.page(at: index)?.rotation = rotation }
        return try #require(document.dataRepresentation())
    }

    private let black = CGColor(gray: 0, alpha: 1), red = CGColor(red: 1, green: 0, blue: 0, alpha: 1)

    private func base(pages: Int = 3, rotation: Int = 0) throws -> Data {
        try sheets((1...pages).map { "BASE\($0)" }, block: CGRect(x: 100, y: 150, width: 100, height: 100), color: black, rotation: rotation)
    }

    /// The colour at a point of the page, given from the top left as shares of the page.
    private func color(_ data: Data, page: Int = 0, x: Double, y: Double) async throws -> (red: Double, green: Double) {
        let shown = pixels(of: try await PDFOpenedDocument(data: data).preview(pageIndex: page, maxDimension: 400))
        let pixel = try #require(shown.min { hypot($0.x - x, $0.y - y) < hypot($1.x - x, $1.y - y) })
        return (pixel.red, pixel.green)
    }

    @Test func eachPageOfTheLayerGoesOnItsPageAndTheLastOneRepeats() throws {
        let layer = try sheets(["LAYER1", "LAYER2"], block: CGRect(x: 0, y: 380, width: 300, height: 20), color: red)
        let output = try PDFOverlay.overlaid(try base(), layer: layer, position: .over)
        let copy = try #require(PDFDocument(data: output))
        #expect(copy.pageCount == 3)
        let text = (0..<3).map { copy.page(at: $0)?.string ?? "" }
        #expect(text[0].contains("BASE1") && text[0].contains("LAYER1"), "Both texts stay text")
        #expect(text[1].contains("BASE2") && text[1].contains("LAYER2"))
        #expect(text[2].contains("BASE3") && text[2].contains("LAYER2") && !text[2].contains("LAYER1"))
    }

    @Test func overCoversThePageAndUnderShowsThroughIt() async throws {
        // The layer's red block crosses the base's black block and goes beyond it on the right.
        let layer = try sheets(["L"], block: CGRect(x: 150, y: 180, width: 120, height: 40), color: red)
        let over = try PDFOverlay.overlaid(try base(pages: 1), layer: layer, position: .over)
        let under = try PDFOverlay.overlaid(try base(pages: 1), layer: layer, position: .under)
        // Inside both blocks, then inside the red block only.
        #expect(try await color(over, x: 0.58, y: 0.5).red > 200)
        #expect(try await color(under, x: 0.58, y: 0.5).red < 60)
        for copy in [over, under] {
            let alone = try await color(copy, x: 0.8, y: 0.5)
            #expect(alone.red > 200 && alone.green < 60)
        }
    }

    @Test func theLayerIsFittedAndCenteredAsTheReaderSeesBothPages() async throws {
        // A layer twice as wide as the page it goes on, red all over: a red band across the middle of the page.
        let wide = try sheets(["L"], size: CGSize(width: 600, height: 400), block: CGRect(x: 0, y: 0, width: 600, height: 400), color: red)
        let upright = try PDFOverlay.overlaid(try base(pages: 1), layer: wide, position: .under)
        let band = try await color(upright, x: 0.5, y: 0.3)
        #expect(band.red > 200 && band.green < 60)
        #expect(try await color(upright, x: 0.5, y: 0.1).green > 200, "Above the band, the paper")
        // The base turned on its side is 400 × 300 for the reader: the layer now covers its width, and 267 points of its height.
        let turned = try PDFOverlay.overlaid(try base(pages: 1, rotation: 90), layer: wide, position: .under)
        #expect(try await color(turned, x: 0.05, y: 0.5).green < 60)
        #expect(try await color(turned, x: 0.95, y: 0.5).green < 60)
        #expect(try await color(turned, x: 0.5, y: 0.02).green > 200)
        #expect(try await color(turned, x: 0.5, y: 0.1).green < 60)
        #expect(PDFDocument(data: turned)?.page(at: 0)?.rotation == 90)
    }

    // The layer's page has a red corner, top left as it is stored. Turned, the reader sees that corner elsewhere, and a
    // page that lies on its side is fitted in a band across the middle of the page that receives it.
    @Test(arguments: [(0, 0.17, 0.125), (90, 0.875, 0.31), (180, 0.83, 0.875), (270, 0.125, 0.69)])
    func aLayerThatIsTurnedIsLaidAsTheReaderSeesIt(rotation: Int, x: Double, y: Double) async throws {
        let layer = try sheets(["TURNED"], block: CGRect(x: 0, y: 300, width: 100, height: 100), color: red, rotation: rotation)
        for position in PDFOverlay.Position.allCases {
            let copy = try PDFOverlay.overlaid(try base(pages: 1), layer: layer, position: position)
            let corner = try await color(copy, x: x, y: y)
            #expect(corner.red > 200 && corner.green < 60, "\(position), turned by \(rotation)")
            #expect(PDFDocument(data: copy)?.page(at: 0)?.string?.contains("TURNED") == true)
            if rotation != 0 {
                let unturned = try await color(copy, x: 0.17, y: 0.125)
                #expect(unturned.green > 200, "\(position), turned by \(rotation): nothing where an unturned page has its corner")
            }
        }
    }

    @Test func theScreenShowsTheLayerOnThePage() async throws {
        let layer = try sheets(["L"], block: CGRect(x: 150, y: 180, width: 120, height: 40), color: red)
        let document = try PDFOpenedDocument(data: try base(pages: 1))
        for position in PDFOverlay.Position.allCases {
            let draw: @Sendable (CGContext, CGRect) -> Void = { context, page in PDFOverlay.show(layer, onto: 0, in: context, displayed: page) }
            let shown = pixels(of: try await document.preview(pageIndex: 0, maxDimension: 400, overlay: position == .over ? draw : nil,
                                                              underlay: position == .under ? draw : nil))
            let crossing = try #require(shown.min { hypot($0.x - 0.58, $0.y - 0.5) < hypot($1.x - 0.58, $1.y - 0.5) })
            let alone = try #require(shown.min { hypot($0.x - 0.8, $0.y - 0.5) < hypot($1.x - 0.8, $1.y - 0.5) })
            #expect(position == .over ? crossing.red > 200 : crossing.red < 60)
            #expect(alone.red > 200 && alone.green < 60)
        }
    }

    @Test func keepsTheBookmarksAndLinksAndRefusesASignedBaseOnly() throws {
        let layer = try sheets(["LAYER"], block: .zero, color: red)
        let copy = try #require(PDFDocument(data: try PDFOverlay.overlaid(fixture("Doc"), layer: layer, position: .over)))
        #expect(copy.outlineRoot?.child(at: 0)?.label == "Doc last")
        #expect(copy.page(at: 0)?.annotations.filter { $0.type == "Link" }.count == 2)
        #expect(copy.page(at: 0)?.string?.contains("LAYER") == true)
        #expect(throws: PDFToolError.alreadySigned) { try PDFOverlay.overlaid(fixture("Signed", digitalSignature: true), layer: layer, position: .over) }
        let signedLayer = try PDFOverlay.overlaid(try base(pages: 1), layer: fixture("Signed", digitalSignature: true), position: .over)
        #expect(PDFDocument(data: signedLayer)?.page(at: 0)?.string?.contains("Signed") == true, "A layer is only read: its signature has nothing to fear")
        let locked = try #require(PDFDocument(data: try base(pages: 1))?.dataRepresentation(options: [
            PDFDocumentWriteOption.userPasswordOption: "open", PDFDocumentWriteOption.ownerPasswordOption: "owner",
        ]))
        #expect(throws: PDFToolError.passwordRequired) { try PDFOverlay.overlaid(locked, layer: layer, position: .over) }
        #expect(PDFDocument(data: try PDFOverlay.overlaid(locked, password: "open", layer: layer, position: .over))?.isLocked == false)
        #expect(throws: PDFToolError.passwordRequired) { try PDFOverlay.overlaid(try base(pages: 1), layer: locked, position: .over) }
    }
}
