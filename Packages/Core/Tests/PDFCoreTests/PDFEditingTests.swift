import CoreGraphics
import Foundation
import PDFKit
import Testing
import TestSupport
@testable import PDFCore

struct PDFEditingTests {
    private static let box = CGRect(x: 0.2, y: 0.25, width: 0.1, height: 0.1)
    private typealias Pixel = (x: Double, y: Double, red: Double, green: Double, blue: Double)

    private func edited(_ source: Data, _ items: [EditItem], images: [UUID: EditImage] = [:], password: String = "") throws -> Data {
        try PDFEditing.editedData(source, password: password, items: items, images: images)
    }

    /// The page as the reader sees it, 400 pixels on its long side.
    private func shown(_ data: Data, page index: Int = 0) throws -> CGImage {
        let page = try #require(PDFDocument(data: data)?.page(at: index))
        return try render(page, size: PageGeometry.displayedBounds(of: page).size, maxDimension: 400)
    }

    private func blueBox(_ frame: CGRect = box, page: Int = 0) -> EditItem {
        EditItem(pageIndex: page, frame: frame, content: .rectangle(EditShapeStyle(color: .blue, filled: true)))
    }

    private func isBlue(_ pixel: Pixel) -> Bool { pixel.blue > 150 && pixel.red < 90 && pixel.green < 120 }
    private func isRed(_ pixel: Pixel) -> Bool { pixel.red > 180 && pixel.green < 90 && pixel.blue < 90 }
    private func mean(_ values: [Double]) -> Double { values.reduce(0, +) / Double(max(1, values.count)) }

    // MARK: Shapes

    @Test(arguments: [0, 90, 180, 270])
    func placesAnAdditionWhereTheReaderSeesIt(rotation: Int) throws {
        let points = pixels(of: try shown(try edited(fixture("Rotated", rotation: rotation), [blueBox()]))).filter(isBlue)
        try #require(!points.isEmpty)
        #expect(abs(mean(points.map(\.x)) - 0.25) < 0.02)
        #expect(abs(mean(points.map(\.y)) - 0.3) < 0.02)
    }

    @Test func drawsShapesLinesInkAndTheHighlighter() throws {
        // The first page shows 270 × 360 points: 300 × 400 pixels here.
        let thick = EditStroke(color: .red, thickness: .thick)
        let items: [EditItem] = [
            EditItem(pageIndex: 0, frame: CGRect(x: 0.1, y: 0.05, width: 0.3, height: 0.15), content: .rectangle(EditShapeStyle(color: .red, thickness: .thick))),
            EditItem(pageIndex: 0, frame: CGRect(x: 0.55, y: 0.05, width: 0.3, height: 0.15), content: .ellipse(EditShapeStyle(color: .green, filled: true))),
            .stroke(pageIndex: 0, through: [CGPoint(x: 0.1, y: 0.3), CGPoint(x: 0.9, y: 0.3)], content: .line(thick, arrow: false)),
            .stroke(pageIndex: 0, through: [CGPoint(x: 0.1, y: 0.4), CGPoint(x: 0.9, y: 0.4)], content: .line(thick, arrow: true)),
            .stroke(pageIndex: 0, through: [CGPoint(x: 0.1, y: 0.8), CGPoint(x: 0.3, y: 0.7), CGPoint(x: 0.5, y: 0.8)],
                    content: .ink(EditStroke(color: .blue, thickness: .thick))),
            EditItem(pageIndex: 0, frame: CGRect(x: 0.02, y: 0.46, width: 0.4, height: 0.06), content: .highlight(.yellow)),
        ]
        let bitmap = Bitmap(try shown(try edited(fixture("Shapes"), items)))
        func at(_ x: Double, _ y: Double) -> (red: Double, green: Double, blue: Double) {
            bitmap.rgb(x: Int(x * Double(bitmap.width)), y: Int(y * Double(bitmap.height)))
        }
        let outline = at(0.1 + 2.5 / 270, 0.125), inside = at(0.25, 0.125), ellipse = at(0.7, 0.125)
        #expect(outline.red > 180 && outline.green < 80, "The outline is inside the box")
        #expect(min(inside.red, inside.green, inside.blue) > 240, "An outline is not filled")
        #expect(ellipse.green > 120 && ellipse.red < 80)
        #expect(at(0.5, 0.3).red > 180)
        // Ten points before the end and 4.5 points off the axis: inside the arrow's head, outside a plain line.
        let head = at(0.9 - 10 / 270, 0.4 - 4.5 / 360), beside = at(0.9 - 10 / 270, 0.3 - 4.5 / 360)
        #expect(head.red > 180 && head.green < 100)
        #expect(min(beside.red, beside.green, beside.blue) > 200)
        #expect(at(0.2, 0.75).blue > 150)
        let marked = at(0.35, 0.49)
        #expect(marked.red > 200 && marked.green > 150 && marked.blue < 100)
        let columns = Int(0.04 * Double(bitmap.width))..<Int(0.17 * Double(bitmap.width))
        let rows = Int(0.475 * Double(bitmap.height))..<Int(0.5 * Double(bitmap.height))
        let darkest = columns.flatMap { x in rows.map { bitmap.gray(x: x, y: $0, radius: 0) } }.min() ?? 255
        #expect(darkest < 80, "The highlighter multiplies: the text under it stays dark")
    }

    @Test func theOrderGivenIsTheOrderDrawn() throws {
        let red = EditItem(pageIndex: 0, frame: CGRect(x: 0.2, y: 0.2, width: 0.3, height: 0.3), content: .rectangle(EditShapeStyle(color: .red, filled: true)))
        let blue = blueBox(CGRect(x: 0.3, y: 0.3, width: 0.3, height: 0.3))
        let source = fixture("Order")
        let over = Bitmap(try shown(try edited(source, [red, blue]))), under = Bitmap(try shown(try edited(source, [blue, red])))
        let x = Int(0.4 * Double(over.width)), y = Int(0.4 * Double(over.height))
        #expect(over.rgb(x: x, y: y).blue > 150 && under.rgb(x: x, y: y).red > 150)
    }

    @Test func keepsTextLinksFormsAndBookmarks() throws {
        let document = try #require(PDFDocument(data: try edited(fixture("Contract"), [blueBox(), blueBox(page: 1)])))
        let page = try #require(document.page(at: 0))
        #expect(page.string?.contains("Contract") == true)
        #expect(page.annotations.filter { $0.type == "Link" }.count == 2)
        #expect(page.annotations.first { $0.type == "Widget" }?.widgetStringValue == "Contract")
        #expect(document.outlineRoot?.numberOfChildren == 1)
    }

    @Test func refusesSignedAndImpossibleAdditionsAndOpensAProtectedCopy() throws {
        #expect(throws: PDFToolError.alreadySigned) { try edited(fixture("Signed", digitalSignature: true), [blueBox()]) }
        #expect(throws: PDFToolError.invalidPlacement) { try edited(fixture("Empty"), []) }
        #expect(throws: PDFToolError.invalidPlacement) { try edited(fixture("Far"), [blueBox(page: 2)]) }
        #expect(throws: PDFToolError.invalidPlacement) {
            try edited(fixture("Lost"), [EditItem(pageIndex: 0, frame: Self.box, content: .picture(EditPicture(image: UUID())))])
        }
        let locked = try protected(fixture("Locked"))
        #expect(throws: PDFToolError.passwordRequired) { try edited(locked, [blueBox()]) }
        let copy = try #require(PDFDocument(data: try edited(locked, [blueBox()], password: "1234")))
        #expect(!copy.isLocked)
    }

    // MARK: Pictures

    @Test(arguments: [0, 90, 180, 270])
    func placesAPictureWhereTheReaderSeesIt(rotation: Int) throws {
        let context = try #require(CGContext(data: nil, width: 100, height: 100, bitsPerComponent: 8, bytesPerRow: 0,
                                             space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue))
        context.setFillColor(CGColor(red: 0, green: 0, blue: 1, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: 100, height: 100))
        let asset = try EditImage.load(data: try encoded(try #require(context.makeImage()), as: .jpeg))
        let id = UUID()
        let item = EditItem(pageIndex: 0, frame: Self.box, content: .picture(EditPicture(image: id)))
        let points = pixels(of: try shown(try edited(fixture("Pictured", rotation: rotation), [item], images: [id: asset]))).filter(isBlue)
        try #require(!points.isEmpty)
        #expect(abs(mean(points.map(\.x)) - 0.25) < 0.02)
        #expect(abs(mean(points.map(\.y)) - 0.3) < 0.02)
    }

    @Test func turnsMirrorsAndCropsAPicture() throws {
        let asset = try EditImage.load(data: try encoded(try halves(width: 200, height: 100), as: .jpeg))
        let id = UUID()
        func drawn(_ picture: EditPicture, in frame: CGRect) throws -> (red: [Pixel], blue: [Pixel]) {
            let item = EditItem(pageIndex: 1, frame: frame, content: .picture(picture))
            let all = pixels(of: try shown(try edited(fixture("Halves"), [item], images: [id: asset]), page: 1))
            return (all.filter(isRed), all.filter(isBlue))
        }
        let upright = try drawn(EditPicture(image: id), in: CGRect(x: 0.1, y: 0.1, width: 0.4, height: 0.15))
        #expect(mean(upright.red.map(\.x)) < mean(upright.blue.map(\.x)))
        let turned = try drawn(EditPicture(image: id, quarterTurns: 1), in: CGRect(x: 0.1, y: 0.4, width: 0.2, height: 0.3))
        #expect(mean(turned.red.map(\.y)) < mean(turned.blue.map(\.y)), "Turned right, the left half is on top")
        let mirrored = try drawn(EditPicture(image: id, flippedHorizontally: true), in: CGRect(x: 0.1, y: 0.1, width: 0.4, height: 0.15))
        #expect(mean(mirrored.blue.map(\.x)) < mean(mirrored.red.map(\.x)))
        let right = try drawn(EditPicture(image: id, crop: CGRect(x: 0.5, y: 0, width: 0.5, height: 1)), in: CGRect(x: 0.6, y: 0.1, width: 0.2, height: 0.15))
        #expect(right.red.isEmpty && !right.blue.isEmpty)
    }

    @Test func aRepeatedPictureIsStoredOnceAsItsJPEG() throws {
        let asset = try EditImage.load(data: try encoded(try noise(width: 600, height: 400), as: .jpeg))
        let id = UUID()
        let twice = (0..<2).map { EditItem(pageIndex: $0, frame: Self.box, content: .picture(EditPicture(image: id))) }
        let source = fixture("Logo")
        let output = try edited(source, twice, images: [id: asset])
        #expect(occurrences(of: "/DCTDecode", in: output) == 1)
        #expect(output.range(of: asset.data) != nil, "The JPEG goes in as it is")
        let cut = twice + [EditItem(pageIndex: 0, frame: Self.box, content: .picture(EditPicture(image: id, crop: CGRect(x: 0, y: 0, width: 0.5, height: 1))))]
        #expect(occurrences(of: "/DCTDecode", in: try edited(source, cut, images: [id: asset])) == 2)
    }

    @Test func theCutPixelsLeaveTheFile() throws {
        let asset = try EditImage.load(data: try encoded(try halves(width: 400, height: 200), as: .jpeg))
        let id = UUID()
        let item = EditItem(pageIndex: 1, frame: Self.box, content: .picture(EditPicture(image: id, crop: CGRect(x: 0.5, y: 0, width: 0.5, height: 1))))
        let output = try edited(fixture("Cut"), [item], images: [id: asset])
        let stored = jpegs(in: output)
        try #require(stored.count == 1)
        let bitmap = Bitmap(stored[0])
        #expect(bitmap.width == 200)
        #expect((0..<bitmap.height).allSatisfy { y in (8..<bitmap.width).allSatisfy { bitmap.rgb(x: $0, y: y).red < 120 } })
        #expect(output.range(of: asset.data) == nil, "The whole picture is not in the copy")
    }

    // MARK: Text

    @Test(arguments: [0, 90, 180, 270])
    func writesTextThatReadersFindAtItsPlace(rotation: Int) throws {
        let text = EditItem(pageIndex: 0, frame: CGRect(x: 0.3, y: 0.4, width: 0.2, height: 0.05), content: .text("Bonjour", EditTextStyle(size: 20)))
        let document = try #require(PDFDocument(data: try edited(fixture("Turned", rotation: rotation), [text])))
        let page = try #require(document.page(at: 0))
        let found = try #require(document.findString("Bonjour", withOptions: []).first)
        let visible = PageGeometry.displayedBounds(of: page)
        let box = found.bounds(for: page).applying(PageGeometry.displayTransform(of: page))
        #expect(abs((box.minX - visible.minX) / visible.width - 0.3) < 0.02)
        #expect(abs((visible.maxY - box.maxY) / visible.height - 0.4) < 0.03)
    }

    @Test func writesEveryAlphabetAndTheEmoji() throws {
        let words = ["Brașov", "Ωμέγα", "Жук", "😀"]
        let text = EditItem(pageIndex: 1, frame: CGRect(x: 0.1, y: 0.2, width: 0.8, height: 0.1), content: .text(words.joined(separator: " "), EditTextStyle()))
        let document = try #require(PDFDocument(data: try edited(fixture("Alphabets"), [text])))
        for word in words { #expect(document.findString(word, withOptions: []).count == 1, "\(word)") }
    }

    @Test func linesStackInTheChosenStyle() throws {
        let style = EditTextStyle(font: .times, bold: true, size: 24, color: .red)
        let text = EditItem(pageIndex: 1, frame: CGRect(x: 0.1, y: 0.1, width: 0.5, height: 0.2), content: .text("Un\nDeux", style))
        let output = try edited(fixture("Lines"), [text])
        let document = try #require(PDFDocument(data: output))
        let page = try #require(document.page(at: 1))
        let first = try #require(document.findString("Un", withOptions: []).first?.bounds(for: page))
        let second = try #require(document.findString("Deux", withOptions: []).first?.bounds(for: page))
        #expect(abs(first.minY - second.minY - EditPainter.lineHeight(style)) < 2)
        #expect(pixels(of: try shown(output, page: 1)).contains(where: isRed))
    }

    @Test func twoExportsGiveOneTextEach() throws {
        let text = EditItem(pageIndex: 1, frame: Self.box, content: .text("APPROUVÉ", EditTextStyle()))
        let source = fixture("Twice")
        _ = try edited(source, [text])
        let second = try #require(PDFDocument(data: try edited(source, [text])))
        #expect(second.page(at: 1)?.string?.components(separatedBy: "APPROUVÉ").count == 2)
    }

    @Test func theTextSizeFollowsTheWidestLineAndTheLineCount() {
        let style = EditTextStyle(size: 20)
        let one = EditPainter.textSize("Oui", style: style), wide = EditPainter.textSize("Oui, bien sûr", style: style)
        let two = EditPainter.textSize("Oui, bien sûr\nOui", style: style)
        #expect(wide.width > one.width && two.width == wide.width)
        #expect(abs(one.height - EditPainter.lineHeight(style)) < 0.001 && abs(two.height - 2 * EditPainter.lineHeight(style)) < 0.001)
        #expect(EditPainter.textSize("", style: style).width == 0)
    }

    private func protected(_ data: Data) throws -> Data {
        let document = try #require(PDFDocument(data: data))
        return try #require(document.dataRepresentation(options: [PDFDocumentWriteOption.userPasswordOption: "1234",
                                                                  PDFDocumentWriteOption.ownerPasswordOption: "owner"]))
    }
}
