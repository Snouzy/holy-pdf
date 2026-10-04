import CoreGraphics
import Foundation
import PDFKit
import Testing
@testable import PDFCore

struct PDFPageNumberingTests {
    @Test func countsFromTheFirstNumberedPage() {
        var numbering = PageNumbering(pages: 1...3)
        #expect(numbering.text(forPage: 0) == nil)
        #expect(numbering.text(forPage: 1) == "1")
        numbering.first = 5
        numbering.format = .numberOfTotal
        #expect(numbering.text(forPage: 3) == "7 / 7")
        numbering.format = .page
        #expect(numbering.text(forPage: 2) == "Page 6")
        #expect(numbering.text(forPage: 4) == nil)
    }

    @Test func writesTheNumbersIntoThePagesOfTheRangeOnly() throws {
        let source = fixture("Report")
        var numbering = PageNumbering(pages: 1...1)
        numbering.format = .page
        numbering.first = 12
        let output = try PDFPageNumbers.numbered(source, numbering)
        let document = try #require(PDFDocument(data: output)), original = try #require(PDFDocument(data: source))
        #expect(document.page(at: 0)?.string?.contains("Page 12") == false)
        #expect(document.page(at: 1)?.string?.contains("Page 12") == true)
        #expect(document.page(at: 1)?.string?.contains("Report") == true)
        #expect(document.page(at: 0)?.annotations.count == original.page(at: 0)?.annotations.count)
        #expect(document.outlineRoot?.numberOfChildren == original.outlineRoot?.numberOfChildren)
        #expect(PDFDocument(data: source)?.page(at: 1)?.string?.contains("Page 12") == false)
    }

    @Test(arguments: [0, 90, 180, 270], [PageNumbering.Position.topRight, .bottomCenter])
    func placesTheNumberWhereTheReaderSeesIt(rotation: Int, position: PageNumbering.Position) throws {
        let source = fixture("Turned", rotation: rotation)
        var numbering = PageNumbering(pages: 0...0)
        numbering.position = position
        numbering.fontSize = 20
        let output = try PDFPageNumbers.numbered(source, numbering)
        func shown(_ data: Data) throws -> [(x: Double, y: Double, red: Double, green: Double, blue: Double)] {
            let page = try #require(PDFDocument(data: data)?.page(at: 0))
            return pixels(of: try render(page, size: PageGeometry.displayedBounds(of: page).size, maxDimension: 400))
        }
        let changed = zip(try shown(source), try shown(output)).filter { abs($0.red - $1.red) > 80 }.map(\.0)
        try #require(!changed.isEmpty)
        let x = changed.map(\.x).reduce(0, +) / Double(changed.count)
        let y = changed.map(\.y).reduce(0, +) / Double(changed.count)
        switch position {
        case .topRight: #expect(x > 0.8 && y < 0.15, "x \(x), y \(y)")
        default: #expect(abs(x - 0.5) < 0.05 && y > 0.85, "x \(x), y \(y)")
        }
    }

    @Test func refusesSettingsOutsideTheDocumentAndSignedDocuments() {
        #expect(throws: PDFToolError.invalidPlacement) { try PDFPageNumbers.numbered(fixture("Short"), PageNumbering(pages: 0...2)) }
        var tiny = PageNumbering(pages: 0...1)
        tiny.fontSize = 2
        #expect(throws: PDFToolError.invalidPlacement) { try PDFPageNumbers.numbered(fixture("Short"), tiny) }
        #expect(throws: PDFToolError.alreadySigned) {
            try PDFPageNumbers.numbered(fixture("Signed", digitalSignature: true), PageNumbering(pages: 0...1))
        }
    }

    @Test func aProtectedDocumentGivesANumberedCopyWithoutPassword() throws {
        let locked = try #require(PDFDocument(data: fixture("Secret"))?.dataRepresentation(options: [
            PDFDocumentWriteOption.userPasswordOption: "open", PDFDocumentWriteOption.ownerPasswordOption: "owner",
        ]))
        #expect(throws: PDFToolError.passwordRequired) { try PDFPageNumbers.numbered(locked, PageNumbering(pages: 0...1)) }
        let output = try PDFPageNumbers.numbered(locked, password: "open", PageNumbering(pages: 0...1))
        let copy = try #require(PDFDocument(data: output))
        #expect(!copy.isLocked)
        #expect(copy.page(at: 1)?.string?.contains("2") == true)
    }
}

struct PDFOpenedDocumentTests {
    @Test func givesThePagesAndDrawsOverAPreview() async throws {
        let document = try PDFOpenedDocument(data: fixture("Open", rotation: 90))
        #expect(document.info.pageSizes == [CGSize(width: 360, height: 270), CGSize(width: 300, height: 400)])
        #expect(!document.info.isEncrypted)
        let plain = try await document.preview(pageIndex: 0, maxDimension: 200)
        #expect(plain.width == 200 && plain.height == 150)
        let marked = try await document.preview(pageIndex: 0, maxDimension: 200) { context, page in
            context.setFillColor(CGColor(red: 0, green: 0, blue: 1, alpha: 1))
            context.fill(CGRect(x: page.maxX - 36, y: page.minY, width: 36, height: 27))
        }
        let blue = pixels(of: marked).filter { $0.blue > 200 && $0.red < 80 }
        try #require(!blue.isEmpty)
        #expect(blue.allSatisfy { $0.x > 0.89 && $0.y > 0.89 })
    }

    @Test func aToolThatWritesNoPDFOpensASignedDocument() throws {
        let signed = fixture("Signed", digitalSignature: true)
        #expect(throws: PDFToolError.alreadySigned) { try PDFOpenedDocument(data: signed) }
        #expect(try PDFOpenedDocument(data: signed, allowsSigned: true).info.pageSizes.count == 2)
    }

    @Test func aCancelledPreviewDoesNotRender() async throws {
        let document = try PDFOpenedDocument(data: fixture("Open"))
        let task = Task {
            withUnsafeCurrentTask { $0?.cancel() }
            return try await document.preview(pageIndex: 0)
        }
        await #expect(throws: PDFToolError.cancelled) { try await task.value }
    }

    @Test func asksForThePasswordAndRefusesSignedDocuments() throws {
        let locked = try #require(PDFDocument(data: fixture("Secret"))?.dataRepresentation(options: [
            PDFDocumentWriteOption.userPasswordOption: "open", PDFDocumentWriteOption.ownerPasswordOption: "owner",
        ]))
        #expect(throws: PDFToolError.passwordRequired) { try PDFOpenedDocument(data: locked) }
        #expect(throws: PDFToolError.wrongPassword) { try PDFOpenedDocument(data: locked, password: "nope") }
        #expect(try PDFOpenedDocument(data: locked, password: "open").info.isEncrypted)
        #expect(throws: PDFToolError.alreadySigned) { try PDFOpenedDocument(data: fixture("Signed", digitalSignature: true)) }
        #expect(throws: PDFToolError.invalidDocument) { try PDFOpenedDocument(data: Data("not PDF".utf8)) }
    }
}
