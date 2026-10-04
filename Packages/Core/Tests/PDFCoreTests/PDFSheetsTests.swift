import CoreGraphics
import CoreText
import Foundation
import PDFKit
import Testing
@testable import PDFCore

/// Pages of 400 × 300 points, each with a word in each corner and its own colour across the middle.
private func quartered(pages: Int = 1, rotation: Int = 0) throws -> Data {
    let data = NSMutableData()
    let consumer = try #require(CGDataConsumer(data: data))
    var box = CGRect(x: 0, y: 0, width: 400, height: 300)
    let context = try #require(CGContext(consumer: consumer, mediaBox: &box, nil))
    let colors = [CGColor(red: 1, green: 0, blue: 0, alpha: 1), CGColor(red: 0, green: 0.6, blue: 0, alpha: 1), CGColor(red: 0, green: 0, blue: 1, alpha: 1)]
    for page in 1...pages {
        context.beginPDFPage(nil)
        context.setFillColor(colors[(page - 1) % colors.count])
        context.fill(CGRect(x: 150, y: 110, width: 100, height: 80))
        context.setFillColor(CGColor(gray: 0, alpha: 1))
        for (word, point) in [("TOPLEFT\(page)", CGPoint(x: 20, y: 260)), ("TOPRIGHT\(page)", CGPoint(x: 260, y: 260)),
                              ("LOWLEFT\(page)", CGPoint(x: 20, y: 30)), ("LOWRIGHT\(page)", CGPoint(x: 260, y: 30))] {
            let line = CFAttributedStringCreate(nil, word as CFString, [kCTFontAttributeName: CTFontCreateWithName("Helvetica" as CFString, 14, nil)] as CFDictionary)!
            context.textPosition = point
            CTLineDraw(CTLineCreateWithAttributedString(line), context)
        }
        context.endPDFPage()
    }
    context.closePDF()
    guard rotation != 0 else { return data as Data }
    let document = try #require(PDFDocument(data: data as Data))
    for index in 0..<pages { document.page(at: index)?.rotation = rotation }
    return try #require(document.dataRepresentation())
}

struct PDFPixelizingTests {
    @Test func eachPageBecomesAnImageOfItsSize() throws {
        let source = fixture("Glass", rotation: 90)
        var steps: [Int] = []
        let output = try PDFPixelizing.pixelized(source, quality: .normal) { done, total in
            #expect(total == 2)
            steps.append(done)
        }
        #expect(steps == [1, 2])
        let copy = try #require(PDFDocument(data: output))
        #expect(copy.pageCount == 2)
        #expect(copy.string?.contains { !$0.isWhitespace } != true, "No text is left to select")
        let before = try PDFOpenedDocument(data: source).info.pageSizes
        let after = try PDFOpenedDocument(data: output).info.pageSizes
        #expect(zip(before, after).allSatisfy { abs($0.width - $1.width) < 0.5 && abs($0.height - $1.height) < 0.5 }, "\(before) → \(after)")
        #expect(copy.page(at: 0)?.rotation == 0, "The rotated page comes out as the reader saw it")
        // 360 points of displayed width at 150 dots per inch.
        #expect(output.range(of: Data("/Width 750".utf8)) != nil)
        #expect(output.range(of: Data("/DCTDecode".utf8)) != nil)
        #expect(copy.documentAttributes?[PDFDocumentAttribute.creatorAttribute] as? String == "Holy PDF")
    }

    @Test func thePageLooksTheSameAndASignedPDFIsAccepted() async throws {
        let source = try quartered()
        let before = pixels(of: try await PDFOpenedDocument(data: source).preview(pageIndex: 0, maxDimension: 300))
        let after = pixels(of: try await PDFOpenedDocument(data: try PDFPixelizing.pixelized(source, quality: .high)).preview(pageIndex: 0, maxDimension: 300))
        let changed = zip(before, after).filter { abs($0.red - $1.red) > 60 || abs($0.blue - $1.blue) > 60 }
        #expect(changed.count < before.count / 100, "\(changed.count) pixels changed")
        #expect(PDFDocument(data: try PDFPixelizing.pixelized(fixture("Signed", digitalSignature: true), quality: .normal))?.pageCount == 2)
    }
}

struct PDFPageHalvesTests {
    private func words(_ document: PDFDocument) -> [String] {
        (0..<document.pageCount).map { (document.page(at: $0)?.string ?? "").split(whereSeparator: \.isNewline).joined(separator: " ") }
    }

    @Test func leftThenRight() throws {
        let copy = try #require(PDFDocument(data: try PDFPageHalves.halved(try quartered(pages: 2), cut: .leftRight)))
        #expect(copy.pageCount == 4)
        let sizes = (0..<4).compactMap { copy.page(at: $0)?.bounds(for: .cropBox).size }
        #expect(sizes.allSatisfy { $0 == CGSize(width: 200, height: 300) })
        let text = words(copy)
        #expect(text[0].contains("TOPLEFT1") && text[0].contains("LOWLEFT1") && !text[0].contains("RIGHT"))
        #expect(text[1].contains("TOPRIGHT1") && text[1].contains("LOWRIGHT1") && !text[1].contains("LEFT"))
        #expect(text[2].contains("TOPLEFT2") && text[3].contains("LOWRIGHT2"))
    }

    @Test func topThenBottom() throws {
        let copy = try #require(PDFDocument(data: try PDFPageHalves.halved(try quartered(), cut: .topBottom)))
        #expect(copy.pageCount == 2)
        #expect(copy.page(at: 0)?.bounds(for: .cropBox).size == CGSize(width: 400, height: 150))
        let text = words(copy)
        #expect(text[0].contains("TOPLEFT1") && text[0].contains("TOPRIGHT1") && !text[0].contains("LOW"))
        #expect(text[1].contains("LOWLEFT1") && text[1].contains("LOWRIGHT1") && !text[1].contains("TOP"))
    }

    @Test(arguments: [90, 180, 270])
    func theCutFollowsThePageAsTheReaderSeesIt(rotation: Int) async throws {
        let source = try quartered(rotation: rotation)
        let whole = try PDFOpenedDocument(data: source)
        let halves = try PDFOpenedDocument(data: try PDFPageHalves.halved(source, cut: .leftRight))
        #expect(halves.info.pageSizes.count == 2)
        let shown = whole.info.pageSizes[0]
        #expect(halves.info.pageSizes.allSatisfy { abs($0.width - shown.width / 2) < 0.5 && abs($0.height - shown.height) < 0.5 })
        // At one pixel for one point, each half shows the same pixels as its side of the whole page.
        let full = try await whole.preview(pageIndex: 0, maxDimension: Int(max(shown.width, shown.height)))
        let all = pixels(of: full)
        for number in 0..<2 {
            let part = try await halves.preview(pageIndex: number, maxDimension: Int(max(shown.width / 2, shown.height)))
            try #require(part.width == full.width / 2 && part.height == full.height)
            let expected = (0..<full.height).flatMap { row in (0..<part.width).map { all[row * full.width + $0 + number * part.width] } }
            try #require(expected.contains { $0.red < 100 && $0.green < 100 }, "The half shows a word")
            let differing = zip(pixels(of: part), expected).filter { abs($0.red - $1.red) > 60 || abs($0.green - $1.green) > 60 }
            #expect(differing.count < expected.count / 200, "half \(number + 1): \(differing.count) pixels differ")
        }
    }

    @Test func aLinkStaysOnTheHalfThatShowsItAndTheBookmarksStay() throws {
        // The fixture's page is cropped to 270 × 360 from (10, 20); its two links are on the left, near x = 20…120.
        let copy = try #require(PDFDocument(data: try PDFPageHalves.halved(fixture("Half"), cut: .leftRight)))
        #expect(copy.pageCount == 4)
        #expect(copy.page(at: 0)?.annotations.filter { $0.type == "Link" }.count == 2)
        #expect(copy.page(at: 1)?.annotations.filter { $0.type == "Link" }.isEmpty == true)
        #expect(copy.outlineRoot?.child(at: 0)?.label == "Half last")
    }

    @Test(arguments: [PDFPageHalves.Cut.leftRight, .topBottom])
    func theScreenShowsWhereTheCutFalls(cut: PDFPageHalves.Cut) async throws {
        let document = try PDFOpenedDocument(data: fixture("Half"))
        let plain = pixels(of: try await document.preview(pageIndex: 0, maxDimension: 360))
        let marked = pixels(of: try await document.preview(pageIndex: 0, maxDimension: 360) { context, page in
            PDFPageHalves.mark(cut, in: context, displayed: page)
        })
        let changed = zip(plain, marked).filter { abs($0.red - $1.red) > 40 || abs($0.green - $1.green) > 40 }.map(\.1)
        try #require(!changed.isEmpty)
        #expect(changed.allSatisfy { abs((cut == .leftRight ? $0.x : $0.y) - 0.5) < 0.02 })
        let along = changed.map { cut == .leftRight ? $0.y : $0.x }
        #expect((along.min() ?? 1) < 0.05 && (along.max() ?? 0) > 0.95, "The line crosses the whole page")
    }

    @Test func aCommentKeepsItsBubbleEvenWhenTheBubbleSitsOnTheOtherHalf() throws {
        let content = "BT /F1 12 Tf 20 200 Td (Note) Tj ET"
        let source = serialize(objects: [
            "<</Type/Catalog/Pages 2 0 R>>",
            "<</Type/Pages/Count 1/Kids[3 0 R]>>",
            "<</Type/Page/Parent 2 0 R/MediaBox[0 0 400 300]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R/Annots[6 0 R 7 0 R]>>",
            "<</Length \(content.utf8.count)>>stream\n\(content)\nendstream",
            "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
            "<</Type/Annot/Subtype/Highlight/Rect[20 195 60 215]/QuadPoints[20 215 60 215 20 195 60 195]/C[1 1 0]/Contents(Check this)/Popup 7 0 R/P 3 0 R>>",
            "<</Type/Annot/Subtype/Popup/Rect[300 200 390 260]/Parent 6 0 R/P 3 0 R>>",
        ])
        try #require(PDFDocument(data: source)?.page(at: 0)?.annotations.first { $0.type == "Highlight" }?.popup != nil)

        let copy = try #require(PDFDocument(data: try PDFPageHalves.halved(source, cut: .leftRight)))
        let kept = try #require(copy.page(at: 0)?.annotations.first { $0.type == "Highlight" })
        #expect(kept.contents == "Check this")
        // PDFKit does not link a comment to its popup again when it reads its own file: the popup itself is the proof.
        #expect(copy.page(at: 0)?.annotations.contains { $0.type == "Popup" } == true)
        #expect(copy.page(at: 1)?.annotations.isEmpty == true, "The other half gets neither the comment nor a popup without a comment")
    }

    @Test func refusesASignedPDFAndOpensAProtectedOne() throws {
        #expect(throws: PDFToolError.alreadySigned) { try PDFPageHalves.halved(fixture("Signed", digitalSignature: true), cut: .leftRight) }
        let quarters = try quartered()
        let locked = try #require(PDFDocument(data: quarters)?.dataRepresentation(options: [
            PDFDocumentWriteOption.userPasswordOption: "open", PDFDocumentWriteOption.ownerPasswordOption: "owner",
        ]))
        #expect(throws: PDFToolError.passwordRequired) { try PDFPageHalves.halved(locked, cut: .leftRight) }
        let copy = try #require(PDFDocument(data: try PDFPageHalves.halved(locked, password: "open", cut: .leftRight)))
        #expect(!copy.isLocked && copy.pageCount == 2)
    }
}

struct PDFSheetsTests {
    @Test(arguments: [(2, 5, 3, true), (4, 5, 2, false), (6, 7, 2, true), (9, 9, 1, false), (16, 17, 2, false)])
    func arrangesThePagesOnA4Sheets(perSheet: Int, pages: Int, sheets: Int, landscape: Bool) throws {
        let copy = try #require(PDFDocument(data: try PDFSheets.arranged(try quartered(pages: pages), perSheet: perSheet)))
        #expect(copy.pageCount == sheets)
        let size = try #require(copy.page(at: 0)?.bounds(for: .mediaBox).size)
        let expected = landscape ? CGSize(width: 841.89, height: 595.28) : CGSize(width: 595.28, height: 841.89)
        #expect(abs(size.width - expected.width) < 0.01 && abs(size.height - expected.height) < 0.01)
    }

    @Test func thePagesFollowTheReadingOrderAndStayText() async throws {
        let output = try PDFSheets.arranged(try quartered(pages: 3), perSheet: 4)
        let copy = try #require(PDFDocument(data: output))
        let text = try #require(copy.page(at: 0)?.string)
        #expect(text.contains("TOPLEFT1") && text.contains("LOWRIGHT3"), "The text of the pages is still text")
        // Four cells on a portrait A4: page 1 red top left, page 2 green top right, page 3 blue bottom left, nothing bottom right.
        let shown = pixels(of: try await PDFOpenedDocument(data: output).preview(pageIndex: 0, maxDimension: 400))
        func tint(_ x: ClosedRange<Double>, _ y: ClosedRange<Double>) -> (red: Bool, green: Bool, blue: Bool) {
            let cell = shown.filter { x.contains($0.x) && y.contains($0.y) }
            return (cell.contains { $0.red > 200 && $0.green < 80 && $0.blue < 80 }, cell.contains { $0.green > 120 && $0.red < 80 && $0.blue < 80 },
                    cell.contains { $0.blue > 200 && $0.red < 80 && $0.green < 80 })
        }
        #expect(tint(0...0.5, 0...0.5) == (true, false, false))
        #expect(tint(0.5...1, 0...0.5) == (false, true, false))
        #expect(tint(0...0.5, 0.5...1) == (false, false, true))
        #expect(tint(0.5...1, 0.5...1) == (false, false, false))
    }

    @Test func aRotatedPageIsDrawnAsTheReaderSeesIt() async throws {
        // Turned by 90 degrees, the page is 300 × 400: on a landscape sheet of two, it stands upright in the left cell.
        let output = try PDFSheets.arranged(try quartered(rotation: 90), perSheet: 2)
        let shown = pixels(of: try await PDFOpenedDocument(data: output).preview(pageIndex: 0, maxDimension: 400))
        let red = shown.filter { $0.red > 200 && $0.green < 80 && $0.blue < 80 }
        try #require(!red.isEmpty)
        #expect(red.allSatisfy { $0.x < 0.5 })
        let width = (red.map(\.x).max() ?? 0) - (red.map(\.x).min() ?? 0), height = (red.map(\.y).max() ?? 0) - (red.map(\.y).min() ?? 0)
        // The 100 × 80 block turns into 80 × 100; the sheet is 842 × 595, so its share of the height is larger still.
        #expect(height * 595 > width * 842, "\(width) × \(height)")
    }

    @Test func saysWhichPageItDrawsAndStopsWhenCancelled() async throws {
        let source = try quartered(pages: 5)
        var steps: [Int] = []
        _ = try PDFSheets.arranged(source, perSheet: 4) { done, total in
            #expect(total == 5)
            steps.append(done)
        }
        #expect(steps == [1, 2, 3, 4, 5])
        #expect(PDFSheets.grid(6)?.columns == 3 && PDFSheets.grid(6)?.rows == 2 && PDFSheets.grid(5) == nil)
        let task = Task.detached { () -> Int in
            var drawn = 0
            do {
                _ = try PDFSheets.arranged(source, perSheet: 4) { _, _ in
                    drawn += 1
                    withUnsafeCurrentTask { $0?.cancel() }
                }
                return -1
            } catch PDFToolError.cancelled {
                return drawn
            }
        }
        #expect(try await task.value == 1)
    }

    @Test func refusesANumberOfPagesTheSheetDoesNotOfferAndAcceptsASignedPDF() throws {
        #expect(PDFSheets.choices == [2, 4, 6, 9, 16])
        #expect(throws: PDFToolError.invalidOrder) { try PDFSheets.arranged(try quartered(), perSheet: 3) }
        #expect(PDFDocument(data: try PDFSheets.arranged(fixture("Signed", digitalSignature: true), perSheet: 2))?.pageCount == 1)
        let locked = try #require(PDFDocument(data: try quartered())?.dataRepresentation(options: [
            PDFDocumentWriteOption.userPasswordOption: "open", PDFDocumentWriteOption.ownerPasswordOption: "owner",
        ]))
        #expect(throws: PDFToolError.passwordRequired) { try PDFSheets.arranged(locked, perSheet: 2) }
        #expect(PDFDocument(data: try PDFSheets.arranged(locked, password: "open", perSheet: 2))?.pageCount == 1)
    }
}
