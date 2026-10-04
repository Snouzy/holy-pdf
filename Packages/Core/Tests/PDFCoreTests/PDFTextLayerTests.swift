import CoreGraphics
import CoreText
import Foundation
import PDFKit
import Testing
@testable import PDFCore

struct PDFTextLayerTests {
    private func scannedPDF(pages: Int = 2, rotation: Int = 0) throws -> Data {
        let data = NSMutableData()
        let consumer = try #require(CGDataConsumer(data: data))
        var box = CGRect(x: 0, y: 0, width: 300, height: 400)
        let context = try #require(CGContext(consumer: consumer, mediaBox: &box, nil))
        let bitmap = try #require(CGContext(data: nil, width: 150, height: 200, bitsPerComponent: 8, bytesPerRow: 0,
                                            space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue))
        bitmap.setFillColor(gray: 0.9, alpha: 1)
        bitmap.fill(CGRect(x: 0, y: 0, width: 150, height: 200))
        let image = try #require(bitmap.makeImage())
        for _ in 0..<pages {
            context.beginPDFPage(nil)
            context.draw(image, in: box)
            context.endPDFPage()
        }
        context.closePDF()
        guard rotation != 0 else { return data as Data }
        let document = try #require(PDFDocument(data: data as Data))
        for index in 0..<pages { document.page(at: index)?.rotation = rotation }
        return try #require(document.dataRepresentation())
    }

    private let line = PDFTextLine(text: "Invoice 2026", box: CGRect(x: 0.1, y: 0.2, width: 0.5, height: 0.05))

    @Test func aScannedPageGetsTheTextItsImageShows() throws {
        let source = try scannedPDF()
        #expect(PDFDocument(data: source)?.string?.isEmpty != false)
        var images: [CGSize] = []
        var steps: [Int] = []
        let result = try #require(try PDFTextLayer.adding(source, read: { image in
            images.append(CGSize(width: image.width, height: image.height))
            return [line]
        }, progress: { done, total in
            #expect(total == 2)
            steps.append(done)
        }))
        #expect(result.pages == 2)
        #expect(result.lines == [0: [line], 1: [line]])
        #expect(images == [CGSize(width: 1800, height: 2400), CGSize(width: 1800, height: 2400)], "Vision reads small print at 2 400 pixels")
        #expect(steps == [1, 2], "The page being read, said before its reading")
        let copy = try #require(PDFDocument(data: result.data))
        #expect(copy.pageCount == 2)
        #expect(copy.page(at: 0)?.string?.contains("Invoice 2026") == true)
        #expect(copy.page(at: 1)?.string?.contains("Invoice 2026") == true)
    }

    @Test func theTextIsInvisible() async throws {
        let source = try scannedPDF(pages: 1)
        let result = try #require(try PDFTextLayer.adding(source, read: { _ in [line] }))
        let before = try await PDFOpenedDocument(data: source).preview(pageIndex: 0, maxDimension: 300)
        let after = try await PDFOpenedDocument(data: result.data).preview(pageIndex: 0, maxDimension: 300)
        let darker = zip(pixels(of: before), pixels(of: after)).filter { $0.red - $1.red > 12 }
        #expect(darker.isEmpty, "\(darker.count) pixels changed")
    }

    @Test(arguments: [0, 90, 180, 270])
    func theTextSitsWhereTheReaderSeesIt(rotation: Int) throws {
        let source = try scannedPDF(pages: 1, rotation: rotation)
        let result = try #require(try PDFTextLayer.adding(source, read: { _ in [line] }))
        let copy = try #require(PDFDocument(data: result.data))
        let page = try #require(copy.page(at: 0))
        let found = try #require(copy.findString("Invoice", withOptions: []).first)
        let shown = found.bounds(for: page).applying(PageGeometry.displayTransform(of: page))
        let visible = PageGeometry.displayedBounds(of: page)
        // The line starts at 10 % of the width, and its top is at 20 % of the height from the top.
        #expect(abs(shown.minX - visible.width * 0.1) < 4, "\(shown) in \(visible)")
        #expect(abs((visible.height - shown.maxY) - visible.height * 0.2) < 8, "\(shown) in \(visible)")
        #expect(shown.width < visible.width * 0.5)
    }

    @Test func theScreenCanShowWhatWasRead() async throws {
        let document = try PDFOpenedDocument(data: try scannedPDF(pages: 1))
        let shown = try await document.preview(pageIndex: 0, maxDimension: 300) { [line] context, page in
            PDFTextLayer.highlight([line], in: context, displayed: page)
        }
        let yellow = pixels(of: shown).filter { $0.blue < $0.red - 40 }
        try #require(!yellow.isEmpty)
        #expect(yellow.allSatisfy { $0.x > 0.09 && $0.x < 0.61 && $0.y > 0.19 && $0.y < 0.26 })
    }

    /// Two typed pages: more text on each than a stamp carries.
    private func typedPDF() throws -> Data {
        let data = NSMutableData()
        let consumer = try #require(CGDataConsumer(data: data))
        var box = CGRect(x: 0, y: 0, width: 300, height: 400)
        let context = try #require(CGContext(consumer: consumer, mediaBox: &box, nil))
        for _ in 0..<2 {
            context.beginPDFPage(nil)
            for (row, text) in ["Dear neighbour, the stairs will be", "painted on Monday morning.", "Please keep the door closed."].enumerated() {
                let line = CFAttributedStringCreate(nil, text as CFString, [kCTFontAttributeName: CTFontCreateWithName("Helvetica" as CFString, 12, nil)] as CFDictionary)!
                context.textPosition = CGPoint(x: 20, y: 350 - row * 20)
                CTLineDraw(CTLineCreateWithAttributedString(line), context)
            }
            context.endPDFPage()
        }
        context.closePDF()
        return data as Data
    }

    @Test func pagesThatHaveTextAreLeftAlone() throws {
        let typed = try typedPDF()
        var calls = 0
        #expect(try PDFTextLayer.adding(typed, read: { _ in
            calls += 1
            return [line]
        }) == nil)
        #expect(calls == 0)

        let mixed = try #require(PDFDocument(data: typed))
        let scan = try #require(PDFDocument(data: try scannedPDF(pages: 1))?.page(at: 0))
        mixed.insert(scan, at: 1)
        let source = try #require(mixed.dataRepresentation())
        let result = try #require(try PDFTextLayer.adding(source, read: { _ in [line] }))
        #expect(result.pages == 1)
        #expect(Array(result.lines.keys) == [1])
        let copy = try #require(PDFDocument(data: result.data))
        #expect(copy.page(at: 0)?.string?.contains("Invoice") == false)
        #expect(copy.page(at: 1)?.string?.contains("Invoice 2026") == true)
        #expect(copy.page(at: 2)?.string?.contains("Invoice") == false)
    }

    @Test func aStampOnAScanDoesNotHideItFromTheReader() throws {
        // A scan that carries a few typed characters: a page number added by this app, a fax header, a scanner's stamp.
        let numbered = try PDFPageNumbers.numbered(try scannedPDF(pages: 1), PageNumbering(pages: 0...0))
        #expect(PDFDocument(data: numbered)?.page(at: 0)?.string?.contains("1") == true)
        let result = try #require(try PDFTextLayer.adding(numbered, read: { _ in [line, PDFTextLine(text: "1", box: CGRect(x: 0.48, y: 0.93, width: 0.03, height: 0.03))] }))
        #expect(result.lines == [0: [line]], "What the page already says is not written a second time")
        let copy = try #require(PDFDocument(data: result.data))
        #expect(copy.page(at: 0)?.string?.contains("Invoice 2026") == true)
        #expect(copy.findString("1", withOptions: []).count == PDFDocument(data: numbered)?.findString("1", withOptions: []).count)
    }

    @Test func aCancelledReadingStopsAtTheNextPage() async throws {
        let source = try scannedPDF(pages: 3)
        let task = Task.detached { () -> Int in
            var calls = 0
            do {
                _ = try PDFTextLayer.adding(source, read: { _ in
                    calls += 1
                    withUnsafeCurrentTask { $0?.cancel() }
                    return []
                })
                return -1
            } catch PDFToolError.cancelled {
                return calls
            }
        }
        #expect(try await task.value == 1)
    }

    @Test func aScanWithoutWordsGivesNothing() throws {
        #expect(try PDFTextLayer.adding(try scannedPDF(), read: { _ in [] }) == nil)
        #expect(try PDFTextLayer.adding(try scannedPDF(), read: { _ in [PDFTextLine(text: "  ", box: CGRect(x: 0, y: 0, width: 1, height: 1))] }) == nil)
    }

    @Test func aReaderThatFailsStopsTheWork() throws {
        struct Unavailable: Error {}
        let source = try scannedPDF()
        #expect(throws: PDFToolError.renderFailed) { try PDFTextLayer.adding(source, read: { _ in throw Unavailable() }) }
    }

    @Test func refusesASignedPDFAndOpensAProtectedOne() throws {
        #expect(throws: PDFToolError.alreadySigned) { try PDFTextLayer.adding(fixture("Signed", digitalSignature: true), read: { _ in [line] }) }
        let scan = try scannedPDF(pages: 1)
        let locked = try #require(PDFDocument(data: scan)?.dataRepresentation(options: [
            PDFDocumentWriteOption.userPasswordOption: "open", PDFDocumentWriteOption.ownerPasswordOption: "owner",
        ]))
        #expect(throws: PDFToolError.passwordRequired) { try PDFTextLayer.adding(locked, read: { _ in [line] }) }
        let result = try #require(try PDFTextLayer.adding(locked, password: "open", read: { _ in [line] }))
        let copy = try #require(PDFDocument(data: result.data))
        #expect(!copy.isLocked)
        #expect(copy.page(at: 0)?.string?.contains("Invoice 2026") == true)
    }
}
