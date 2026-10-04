import CoreGraphics
import Foundation
import ImageIO
import PDFKit
import Testing
import TestSupport
import UniformTypeIdentifiers
@testable import PDFCore

struct PDFWriterTests {
    let a4 = CGSize(width: 595.28, height: 841.89)
    let a5Landscape = CGSize(width: 595.28, height: 419.53)

    /// A JPEG with text-like bars, so its size is realistic.
    func jpeg(width: Int, height: Int, paper: CGFloat = 1) -> Data {
        guard let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
                                      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else {
            fatalError("Cannot create a bitmap context")
        }
        context.setFillColor(CGColor(gray: paper, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        context.setFillColor(CGColor(gray: 0, alpha: 1))
        for row in 0..<(height / 60) {
            context.fill(CGRect(x: width / 10, y: 40 + row * 60, width: width / 3 + (row * 37) % (width / 2), height: 12))
        }
        guard let image = context.makeImage() else { fatalError("Cannot read the bitmap back") }
        let data = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(data, UTType.jpeg.identifier as CFString, 1, nil) else {
            fatalError("No JPEG encoder")
        }
        CGImageDestinationAddImage(destination, image, [kCGImageDestinationLossyCompressionQuality: 0.8] as CFDictionary)
        CGImageDestinationFinalize(destination)
        return data as Data
    }

    @Test func writesOnePagePerImageAtItsSize() throws {
        let pdf = try PDFWriter.data(pages: [PDFPageInput(jpeg: jpeg(width: 1654, height: 2339), pageSize: a4),
                                             PDFPageInput(jpeg: jpeg(width: 2339, height: 1654), pageSize: a5Landscape)], title: "Test")
        let document = try #require(PDFDocument(data: pdf))
        #expect(document.pageCount == 2)
        let first = try #require(document.page(at: 0)).bounds(for: .mediaBox).size
        let second = try #require(document.page(at: 1)).bounds(for: .mediaBox).size
        #expect(abs(first.width - 595.28) < 0.01 && abs(first.height - 841.89) < 0.01)
        #expect(abs(second.width - 595.28) < 0.01 && abs(second.height - 419.53) < 0.01)
    }

    @Test func embedsTheJPEGWithoutRecompressing() throws {
        let image = jpeg(width: 1654, height: 2339)
        let pdf = try PDFWriter.data(pages: [PDFPageInput(jpeg: image, pageSize: a4)], title: "Test")
        #expect(pdf.count - image.count < 20_000)
    }

    @Test func textLayerCanBeSearched() throws {
        let line = PDFTextLine(text: "Pagina 1 din 3", box: CGRect(x: 0.6, y: 0.95, width: 0.25, height: 0.015))
        let pdf = try PDFWriter.data(pages: [PDFPageInput(jpeg: jpeg(width: 400, height: 566), pageSize: a4, textLines: [line])], title: "Test")
        let document = try #require(PDFDocument(data: pdf))
        #expect(document.string?.contains("Pagina 1 din 3") == true)
        let page = try #require(document.page(at: 0))
        let found = try #require(document.findString("Pagina 1 din 3", withOptions: []).first)
        let bounds = found.bounds(for: page)
        #expect(bounds.minY < 841.89 * 0.1)
        #expect(abs(bounds.width - 0.25 * 595.28) < 0.1 * 0.25 * 595.28)
        #expect(abs(bounds.minX - 0.6 * 595.28) < 5)
    }

    @Test func storesTheTitle() throws {
        let pdf = try PDFWriter.data(pages: [PDFPageInput(jpeg: jpeg(width: 400, height: 566), pageSize: a4)], title: "2026-07-14_Attestation")
        let document = try #require(PDFDocument(data: pdf))
        #expect(document.documentAttributes?[PDFDocumentAttribute.titleAttribute] as? String == "2026-07-14_Attestation")
    }

    @Test func namesHolyPDFAsItsCreator() throws {
        let pdf = try PDFWriter.data(pages: [PDFPageInput(jpeg: jpeg(width: 400, height: 566), pageSize: a4)], title: "x")
        let document = try #require(PDFDocument(data: pdf))
        #expect(document.documentAttributes?[PDFDocumentAttribute.creatorAttribute] as? String == "Holy PDF")
    }

    @Test func rejectsEmptyDocumentsAndBadImages() {
        #expect(throws: PDFWriteError.emptyDocument) { try PDFWriter.data(pages: [], title: "x") }
        #expect(throws: PDFWriteError.invalidImage(page: 0)) {
            try PDFWriter.data(pages: [PDFPageInput(jpeg: Data("nope".utf8), pageSize: a4)], title: "x")
        }
    }

    @Test func reportsAnUnwritableDestination() {
        let url = URL(fileURLWithPath: "/nonexistent-folder/out.pdf")
        #expect(throws: PDFWriteError.cannotWrite(url)) {
            try PDFWriter.write(pages: [PDFPageInput(jpeg: jpeg(width: 100, height: 141), pageSize: a4)], title: "x", to: url)
        }
    }

    @Test func writeNeverReplacesAFile() throws {
        let folder = try TestImages.emptyFolder()
        let url = folder.appending(path: "scan.pdf")
        try Data("first".utf8).write(to: url)
        try Data("second".utf8).write(to: folder.appending(path: "scan-2.pdf"))
        let written = try PDFWriter.write(pages: [PDFPageInput(jpeg: jpeg(width: 100, height: 141), pageSize: a4)], title: "x", to: url)
        #expect(written.lastPathComponent == "scan-3.pdf")
        #expect(try Data(contentsOf: url) == Data("first".utf8))
        #expect(try Data(contentsOf: folder.appending(path: "scan-2.pdf")) == Data("second".utf8))
    }

    @Test func anISOPageKeepsItsRatioOnLetter() throws {
        let letter = CGSize(width: 612, height: 792)
        let fitted = PDFWriter.aspectFit(CGSize(width: 1654, height: 2339), on: letter)
        #expect(abs(fitted.height / fitted.width - 2339.0 / 1654) < 0.001)
        #expect(abs(fitted.midX - 306) < 0.01 && abs(fitted.midY - 396) < 0.01)

        let line = PDFTextLine(text: "Factura", box: CGRect(x: 0, y: 0.5, width: 0.5, height: 0.02))
        let pdf = try PDFWriter.data(pages: [PDFPageInput(jpeg: jpeg(width: 1654, height: 2339, paper: 0), pageSize: letter, textLines: [line])],
                                     title: "Test")
        let page = try #require(CGDataProvider(data: pdf as CFData).flatMap(CGPDFDocument.init)?.page(at: 1))
        let context = try #require(CGContext(data: nil, width: 612, height: 792, bitsPerComponent: 8, bytesPerRow: 0,
                                             space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue))
        context.setFillColor(CGColor(gray: 1, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: 612, height: 792))
        context.drawPDFPage(page)
        let rendered = Bitmap(try #require(context.makeImage()))
        #expect(rendered.gray(x: 10, y: 396) > 250)
        #expect(rendered.gray(x: 602, y: 396) > 250)
        #expect(rendered.gray(x: 306, y: 396) < 10)
        #expect(rendered.gray(x: 306, y: 3) < 10)

        let document = try #require(PDFDocument(data: pdf))
        let found = try #require(document.findString("Factura", withOptions: []).first)
        #expect(abs(found.bounds(for: try #require(document.page(at: 0))).minX - fitted.minX) < 3)
    }

    @Test func pdfRectHasABottomLeftOrigin() {
        #expect(PDFWriter.pdfRect(CGRect(x: 0.5, y: 0, width: 0.5, height: 0.25), in: CGRect(x: 10, y: 20, width: 100, height: 200))
                == CGRect(x: 60, y: 170, width: 50, height: 50))
    }
}
