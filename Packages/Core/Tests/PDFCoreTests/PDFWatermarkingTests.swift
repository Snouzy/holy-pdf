import CoreGraphics
import Foundation
import ImageIO
import PDFKit
import Testing
import TestSupport
import UniformTypeIdentifiers
@testable import PDFCore

struct PDFWatermarkingTests {
    private func text(_ value: String = "CONFIDENTIEL", pages: ClosedRange<Int> = 0...1) -> Watermark {
        Watermark(content: .text(value, .stamp), pages: pages)
    }

    private func blue(width: Int = 100, height: Int = 100, center: CGPoint, size: CGFloat = 0.2, angle: Double = 0,
                      opacity: Double = 1, pages: ClosedRange<Int>) throws -> Watermark {
        Watermark(content: .image(try SignatureImage.load(data: png(width: width, height: height) { context in
            context.setFillColor(CGColor(red: 0, green: 0, blue: 1, alpha: 1))
            context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        })), center: center, width: size, angle: angle, opacity: opacity, pages: pages)
    }

    @Test func severalMarksGoOnTheirPagesTogether() async throws {
        let signer = try PDFWatermarkDocument(data: fixture("Several"))
        var left = text(pages: 0...1), right = text(pages: 1...1)
        left.center = CGPoint(x: 0.25, y: 0.5)
        left.width = 0.4
        left.angle = 0
        left.opacity = 1
        right.center = CGPoint(x: 0.75, y: 0.5)
        right.width = 0.4
        right.angle = 0
        right.opacity = 1
        right.content = .text("DRAFT", WatermarkColor(red: 0, green: 0, blue: 1))
        let output = try await signer.watermarkedData([left, right])
        let copy = try PDFWatermarkDocument(data: output)
        let first = Bitmap(try await copy.preview(pageIndex: 0, maxDimension: 300))
        let second = Bitmap(try await copy.preview(pageIndex: 1, maxDimension: 300))
        func reddish(_ bitmap: Bitmap, x: Double) -> Bool {
            (0..<bitmap.height).contains { y in let c = bitmap.rgb(x: Int(x * Double(bitmap.width)), y: y); return c.red > 150 && c.blue < 100 }
        }
        func bluish(_ bitmap: Bitmap, x: Double) -> Bool {
            (0..<bitmap.height).contains { y in let c = bitmap.rgb(x: Int(x * Double(bitmap.width)), y: y); return c.blue > 150 && c.red < 100 }
        }
        #expect(reddish(first, x: 0.25) && !bluish(first, x: 0.75), "Page 1 has the left mark only")
        #expect(reddish(second, x: 0.25) && bluish(second, x: 0.75), "Page 2 has both")
        var wrong = right
        wrong.content = .text("", .stamp)
        await #expect(throws: PDFToolError.invalidPlacement) { try await signer.watermarkedData([left, wrong]) }
        await #expect(throws: PDFToolError.invalidPlacement) { try await signer.watermarkedData([]) }
    }

    @Test func writesTheTextIntoThePagesOfTheRangeOnly() async throws {
        let source = fixture("Contract")
        let output = try await PDFWatermarkDocument(data: source).watermarkedData(text(pages: 1...1))
        let document = try #require(PDFDocument(data: output))
        let original = try #require(PDFDocument(data: source))
        #expect(document.page(at: 0)?.string?.contains("CONFIDENTIEL") == false)
        #expect(document.page(at: 1)?.string?.contains("CONFIDENTIEL") == true)
        #expect(document.page(at: 1)?.annotations.count == original.page(at: 1)?.annotations.count)
    }

    @Test(arguments: [0, 90, 180, 270])
    func placesTheMarkWhereTheReaderSeesIt(rotation: Int) async throws {
        let mark = try blue(center: CGPoint(x: 0.25, y: 0.3), pages: 0...0)
        let output = try await PDFWatermarkDocument(data: fixture("Rotated", rotation: rotation)).watermarkedData(mark)
        let page = try #require(PDFDocument(data: output)?.page(at: 0))
        let image = try render(page, size: PageGeometry.displayedBounds(of: page).size, maxDimension: 400)
        let points = pixels(of: image).filter { $0.blue > 200 && $0.red < 80 && $0.green < 80 }
        try #require(!points.isEmpty)
        let x = points.map(\.x).reduce(0, +) / Double(points.count)
        let y = points.map(\.y).reduce(0, +) / Double(points.count)
        #expect(abs(x - 0.25) < 0.03)
        #expect(abs(y - 0.3) < 0.03)
    }

    @Test(arguments: [0, 90, 180, 270])
    func theDisplayTransformIsPDFKitsOutsideAWrite(rotation: Int) throws {
        let page = try #require(PDFDocument(data: fixture("Turned", rotation: rotation))?.page(at: 0))
        let ours = PageGeometry.displayTransform(of: page), theirs = page.transform(for: .cropBox)
        #expect([ours.a, ours.b, ours.c, ours.d, ours.tx, ours.ty] == [theirs.a, theirs.b, theirs.c, theirs.d, theirs.tx, theirs.ty])
    }

    @Test func opacityLetsThePageShowThrough() async throws {
        let mark = try blue(center: CGPoint(x: 0.5, y: 0.5), size: 0.3, opacity: 0.3, pages: 1...1)
        let output = try await PDFWatermarkDocument(data: fixture("Faint")).watermarkedData(mark)
        let page = try #require(PDFDocument(data: output)?.page(at: 1))
        let image = try render(page, size: PageGeometry.displayedBounds(of: page).size, maxDimension: 400)
        let center = try #require(pixels(of: image).min { hypot($0.x - 0.5, $0.y - 0.5) < hypot($1.x - 0.5, $1.y - 0.5) })
        #expect(abs(center.red - 178) < 20)
        #expect(abs(center.green - 178) < 20)
        #expect(center.blue > 240)
    }

    @Test func theAngleTurnsTheMark() async throws {
        let mark = try blue(width: 200, height: 50, center: CGPoint(x: 0.5, y: 0.5), size: 0.4, angle: 90, pages: 1...1)
        let output = try await PDFWatermarkDocument(data: fixture("Turned")).watermarkedData(mark)
        let page = try #require(PDFDocument(data: output)?.page(at: 1))
        let image = try render(page, size: PageGeometry.displayedBounds(of: page).size, maxDimension: 400)
        let points = pixels(of: image).filter { $0.blue > 200 && $0.red < 80 && $0.green < 80 }
        let wide = (points.map(\.x).max() ?? 0) - (points.map(\.x).min() ?? 0)
        let tall = (points.map(\.y).max() ?? 0) - (points.map(\.y).min() ?? 0)
        #expect(tall > wide * 2)
    }

    @Test func keepsTextLinksFormsAndBookmarks() async throws {
        let output = try await PDFWatermarkDocument(data: fixture("Contract")).watermarkedData(text())
        let document = try #require(PDFDocument(data: output))
        let page = try #require(document.page(at: 0))
        #expect(page.string?.contains("Contract") == true)
        #expect(page.annotations.filter { $0.type == "Link" }.count == 2)
        #expect(page.annotations.first { $0.type == "Widget" }?.widgetStringValue == "Contract")
        #expect(document.outlineRoot?.numberOfChildren == 1)
    }

    @Test func twoExportsGiveOneMarkEach() async throws {
        let document = try PDFWatermarkDocument(data: fixture("Twice"))
        _ = try await document.watermarkedData(text())
        let second = try #require(PDFDocument(data: try await document.watermarkedData(text())))
        #expect(second.page(at: 1)?.string?.components(separatedBy: "CONFIDENTIEL").count == 2)
    }

    @Test func storesARepeatedImageOnce() async throws {
        let source = try pages(20)
        var generator = SystemRandomNumberGenerator()
        let noise = try png(width: 300, height: 300) { context in
            for x in stride(from: 0, to: 300, by: 2) {
                for y in stride(from: 0, to: 300, by: 2) {
                    context.setFillColor(CGColor(red: .random(in: 0...1, using: &generator), green: .random(in: 0...1, using: &generator),
                                                 blue: .random(in: 0...1, using: &generator), alpha: 1))
                    context.fill(CGRect(x: x, y: y, width: 2, height: 2))
                }
            }
        }
        let asset = try SignatureImage.load(data: noise)
        let mark = Watermark(content: .image(asset), center: CGPoint(x: 0.8, y: 0.1), width: 0.2, angle: 0, opacity: 0.5, pages: 0...19)
        let document = try PDFWatermarkDocument(data: source)
        let start = ContinuousClock.now
        let output = try await document.watermarkedData(mark)
        #expect(ContinuousClock.now - start < .seconds(3))
        #expect(output.count - source.count < 2 * asset.dataPNG.count)
    }

    @Test func refusesSignedLockedAndInvalidMarks() async throws {
        #expect(throws: PDFToolError.alreadySigned) { try PDFWatermarkDocument(data: fixture("Signed", digitalSignature: true)) }
        let locked = try protected(fixture("Locked"))
        #expect(throws: PDFToolError.passwordRequired) { try PDFWatermarkDocument(data: locked) }
        #expect(throws: PDFToolError.wrongPassword) { try PDFWatermarkDocument(data: locked, password: "nope") }
        let opened = try PDFWatermarkDocument(data: locked, password: "1234")
        let unlocked = try #require(PDFDocument(data: try await opened.watermarkedData(text())))
        #expect(!unlocked.isLocked)
        await #expect(throws: PDFToolError.invalidPlacement) { try await opened.watermarkedData(text(pages: 0...5)) }
        await #expect(throws: PDFToolError.invalidPlacement) { try await opened.watermarkedData(text("   ")) }
        var faint = text()
        faint.opacity = 0
        await #expect(throws: PDFToolError.invalidPlacement) { try await opened.watermarkedData(faint) }
    }

    @Test func theCornerFollowsAPointerDraggedAlongItsDiagonal() throws {
        var mark = text()
        mark.angle = 30
        let box = mark.boundingSize(pageWidth: 400)
        let width = mark.widthAfterCornerDrag(CGSize(width: 0.4 * box.width / 2, height: 0.4 * box.height / 2), pageWidth: 400)
        #expect(abs(width - mark.width * 1.4) < 1e-6)
        var bar = try blue(width: 200, height: 50, center: CGPoint(x: 0.5, y: 0.5), size: 0.5, angle: 90, pages: 0...0)
        bar.width = bar.widthAfterCornerDrag(CGSize(width: 3.125, height: 12.5), pageWidth: 100)
        #expect(abs(bar.width - 0.75) < 1e-6)
    }

    @Test func aFittedMarkStaysInsideThePage() throws {
        let tall = try blue(width: 100, height: 400, center: CGPoint(x: 0.5, y: 0.5), size: 0.6, pages: 0...0)
        let page = CGSize(width: 842, height: 595)
        let box = tall.fitted(in: page).boundingSize(pageWidth: page.width)
        #expect(box.height <= 0.9 * page.height + 0.001)
        #expect(box.width <= 0.9 * page.width + 0.001)
        let small = try blue(center: CGPoint(x: 0.5, y: 0.5), size: 0.1, pages: 0...0)
        #expect(small.fitted(in: page).width == 0.1)
    }

    @Test func theBoundingSizeFollowsTheAngle() throws {
        var mark = try blue(width: 200, height: 50, center: CGPoint(x: 0.5, y: 0.5), size: 0.5, pages: 0...0)
        #expect(abs(mark.boundingSize(pageWidth: 100).width - 50) < 0.01)
        #expect(abs(mark.boundingSize(pageWidth: 100).height - 12.5) < 0.01)
        mark.angle = 90
        #expect(abs(mark.boundingSize(pageWidth: 100).width - 12.5) < 0.01)
        #expect(abs(mark.boundingSize(pageWidth: 100).height - 50) < 0.01)
        let overlay = try text().overlayImage(maxDimension: 400)
        let box = text().boundingSize(pageWidth: 1)
        #expect(max(overlay.width, overlay.height) <= 401)
        #expect(abs(Double(overlay.width) / Double(overlay.height) - box.width / box.height) < 0.02)
    }

    private func png(width: Int, height: Int, draw: (CGContext) -> Void) throws -> Data {
        let context = try #require(CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
                                             space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
        draw(context)
        let image = try #require(context.makeImage())
        let data = NSMutableData()
        let destination = try #require(CGImageDestinationCreateWithData(data, UTType.png.identifier as CFString, 1, nil))
        CGImageDestinationAddImage(destination, image, nil)
        try #require(CGImageDestinationFinalize(destination))
        return data as Data
    }

    private func pages(_ count: Int) throws -> Data {
        let data = NSMutableData()
        let consumer = try #require(CGDataConsumer(data: data))
        var box = CGRect(x: 0, y: 0, width: 612, height: 792)
        let context = try #require(CGContext(consumer: consumer, mediaBox: &box, nil))
        for _ in 0..<count {
            context.beginPDFPage(nil)
            context.fill(CGRect(x: 50, y: 700, width: 300, height: 10))
            context.endPDFPage()
        }
        context.closePDF()
        return data as Data
    }

    private func protected(_ data: Data) throws -> Data {
        let document = try #require(PDFDocument(data: data))
        return try #require(document.dataRepresentation(options: [PDFDocumentWriteOption.userPasswordOption: "1234",
                                                                  PDFDocumentWriteOption.ownerPasswordOption: "owner"]))
    }
}
