import CoreGraphics
import CoreText
import Foundation
import PDFKit
import Testing
@testable import PDFCore

struct PDFCompressionTests {
    /// Two pages with a selectable title and a photo of `side` pixels: noise over a gradient, heavy until it is resampled.
    private func photoPDF(side: Int = 1400) throws -> Data {
        var bytes = [UInt8](repeating: 255, count: side * side * 4)
        var noise: UInt32 = 2_463_534_242
        bytes.withUnsafeMutableBufferPointer { pixels in
            for at in stride(from: 0, to: pixels.count, by: 4) {
                noise ^= noise << 13
                noise ^= noise >> 17
                noise ^= noise << 5
                pixels[at] = UInt8(truncatingIfNeeded: at / 4 % side * 255 / side)
                pixels[at + 1] = UInt8(truncatingIfNeeded: noise >> 8)
                pixels[at + 2] = UInt8(truncatingIfNeeded: noise)
            }
        }
        let provider = try #require(CGDataProvider(data: Data(bytes) as CFData))
        let photo = try #require(CGImage(width: side, height: side, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: side * 4,
                                         space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipLast.rawValue),
                                         provider: provider, decode: nil, shouldInterpolate: true, intent: .defaultIntent))
        let data = NSMutableData()
        var box = CGRect(x: 0, y: 0, width: 400, height: 500)
        let consumer = try #require(CGDataConsumer(data: data))
        let context = try #require(CGContext(consumer: consumer, mediaBox: &box, nil))
        for page in 1...2 {
            context.beginPDFPage(nil)
            let title = CFAttributedStringCreate(nil, "Holiday \(page)" as CFString, [kCTFontAttributeName: CTFontCreateWithName("Helvetica" as CFString, 18, nil)] as CFDictionary)!
            context.textPosition = CGPoint(x: 30, y: 450)
            CTLineDraw(CTLineCreateWithAttributedString(title), context)
            if page == 1 { context.draw(photo, in: CGRect(x: 30, y: 60, width: 340, height: 340)) }
            context.endPDFPage()
        }
        context.closePDF()
        return data as Data
    }

    @Test func aPhotoPDFGetsLighterAtEveryLevelAndKeepsItsText() throws {
        let source = try photoPDF()
        var sizes: [Int] = []
        for level in [CompressionLevel.low, .recommended, .extreme] {
            let output = try #require(try PDFCompression.compressed(source, level: level), "\(level)")
            #expect(output.count < source.count / 2, "\(level): \(output.count) of \(source.count)")
            let copy = try #require(PDFDocument(data: output))
            #expect(copy.pageCount == 2)
            #expect(copy.page(at: 0)?.string?.contains("Holiday 1") == true)
            #expect(copy.page(at: 1)?.string?.contains("Holiday 2") == true)
            sizes.append(output.count)
        }
        #expect(sizes[0] > sizes[1] && sizes[1] > sizes[2], "\(sizes)")
    }

    @Test func aPDFWithoutPhotosIsAlreadyLight() throws {
        #expect(try PDFCompression.compressed(fixture("Text only"), level: .extreme) == nil)
    }

    @Test func linksFieldsAndBookmarksStay() throws {
        let photo = try photoPDF()
        let document = try #require(PDFDocument(data: photo))
        let page = try #require(document.page(at: 0))
        let link = PDFAnnotation(bounds: CGRect(x: 30, y: 420, width: 100, height: 20), forType: .link, withProperties: nil)
        link.url = URL(string: "https://example.com/album")
        page.addAnnotation(link)
        let field = PDFAnnotation(bounds: CGRect(x: 150, y: 420, width: 120, height: 20), forType: .widget, withProperties: nil)
        field.widgetFieldType = .text
        field.fieldName = "Place"
        field.widgetStringValue = "Lisbon"
        page.addAnnotation(field)
        let root = PDFOutline()
        let bookmark = PDFOutline()
        bookmark.label = "Second page"
        let second = try #require(document.page(at: 1))
        bookmark.destination = PDFDestination(page: second, at: .zero)
        root.insertChild(bookmark, at: 0)
        document.outlineRoot = root
        let source = try #require(document.dataRepresentation())

        let output = try #require(try PDFCompression.compressed(source, level: .recommended))
        let copy = try #require(PDFDocument(data: output))
        let annotations = try #require(copy.page(at: 0)?.annotations)
        #expect(annotations.first { $0.type == "Link" }?.url?.absoluteString == "https://example.com/album")
        #expect(annotations.first { $0.type == "Widget" }?.widgetStringValue == "Lisbon")
        #expect(copy.outlineRoot?.child(at: 0)?.label == "Second page")
    }

    @Test func aProtectedPDFGivesACopyThatOpensWithoutPassword() throws {
        let photo = try photoPDF()
        let locked = try #require(PDFDocument(data: photo)?.dataRepresentation(options: [
            PDFDocumentWriteOption.userPasswordOption: "open", PDFDocumentWriteOption.ownerPasswordOption: "owner",
        ]))
        #expect(throws: PDFToolError.passwordRequired) { try PDFCompression.compressed(locked, level: .recommended) }
        let output = try #require(try PDFCompression.compressed(locked, password: "open", level: .recommended))
        let copy = try #require(PDFDocument(data: output))
        #expect(!copy.isLocked)
        #expect(copy.page(at: 0)?.string?.contains("Holiday 1") == true)
    }

    @Test func findsTheBlackAndWhiteScansThatJPEGWouldBlur() throws {
        #expect(!PDFCompression.hasBilevelScan(try photoPDF()))
        #expect(!PDFCompression.hasBilevelScan(fixture("Text only")))
        #expect(!PDFCompression.hasBilevelScan(bilevel(side: 64)), "A small one-bit image is a mask or an icon, not a scan")
        #expect(PDFCompression.hasBilevelScan(bilevel(side: 1000)))
        #expect(PDFCompression.hasBilevelScan(bilevel(side: 1000, inForm: true)), "Scanners often wrap the image in a form")
        #expect(!PDFCompression.hasBilevelScan(Data("not a PDF".utf8)))
    }

    /// One page that draws a one-bit image of `side` pixels, directly or through a form XObject.
    private func bilevel(side: Int, inForm: Bool = false) -> Data {
        let image = "<</Type/XObject/Subtype/Image/Width \(side)/Height \(side)/ColorSpace/DeviceGray/BitsPerComponent 1/Length 0>>stream\n\nendstream"
        let draw = "q 300 0 0 300 0 0 cm /X Do Q"
        let form = "<</Type/XObject/Subtype/Form/BBox[0 0 300 300]/Resources<</XObject<</X 4 0 R>>>>/Length \(draw.utf8.count)>>stream\n\(draw)\nendstream"
        return serialize(objects: [
            "<</Type/Catalog/Pages 2 0 R>>",
            "<</Type/Pages/Count 1/Kids[3 0 R]/Resources<</XObject<</X \(inForm ? 6 : 4) 0 R>>>>>>",
            "<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 300]/Contents 5 0 R>>",
            image,
            "<</Length \(draw.utf8.count)>>stream\n\(draw)\nendstream",
            form,
        ])
    }

    @Test func aSignedPDFIsRefused() {
        #expect(throws: PDFToolError.alreadySigned) { try PDFCompression.compressed(fixture("Signed", digitalSignature: true), level: .low) }
    }
}
