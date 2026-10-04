import AppKit
import Foundation
import Testing
@testable import PDFCore

/// What Word, Pages and TextEdit read in a document: macOS reads it the same way.
func wordText(_ docx: Data) throws -> NSAttributedString {
    try NSAttributedString(data: docx, options: [.documentType: NSAttributedString.DocumentType.officeOpenXML], documentAttributes: nil)
}

/// One file of the archive, read by the system's `unzip`, which also checks its checksum.
func unzipped(_ name: String, from docx: Data) throws -> Data {
    let file = FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID().uuidString).docx")
    try docx.write(to: file)
    defer { try? FileManager.default.removeItem(at: file) }
    let unzip = Process()
    unzip.executableURL = URL(fileURLWithPath: "/usr/bin/unzip")
    unzip.arguments = ["-p", file.path, name]
    let output = Pipe()
    unzip.standardOutput = output
    unzip.standardError = Pipe()
    try unzip.run()
    let data = output.fileHandleForReading.readDataToEndOfFile()
    unzip.waitUntilExit()
    try #require(unzip.terminationStatus == 0, "unzip refused \(name)")
    return data
}

struct DocxTests {
    private func run(_ text: String, font: String = "Arial", size: Double = 12, bold: Bool = false, italic: Bool = false) -> Docx.Run {
        Docx.Run(text: text, font: font, size: size, bold: bold, italic: italic)
    }

    private func jpeg(width: Int, height: Int) throws -> Data {
        let context = try #require(CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
                                             space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue))
        context.setFillColor(CGColor(red: 1, green: 0, blue: 0, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        let image = try #require(context.makeImage())
        return try #require(jpegData(image, quality: 0.8))
    }

    @Test func aDocumentThatMacOSReadsWithItsParagraphsAndStyles() throws {
        let a4 = CGSize(width: 595.28, height: 841.89)
        let docx = try Docx.data(pages: [
            Docx.Page(size: a4, blocks: [
                .text([run("Annual report", size: 24, bold: true)]),
                .text([run("Plain, then "), run("slanted", italic: true), run(" & <kept> \"as is\".", font: "Times New Roman")]),
            ]),
            Docx.Page(size: a4, blocks: [.text([run("Second page, été — 日本")])]),
        ])
        #expect(docx.prefix(2) == Data("PK".utf8))
        let read = try wordText(docx)
        let text = read.string as NSString
        #expect(read.string.contains("Annual report\nPlain, then slanted & <kept> \"as is\".\n"))
        #expect(read.string.contains("Second page, été — 日本"))
        #expect(read.string.contains("\u{0C}"), "A page break between the two pages")
        func font(at word: String) throws -> NSFont {
            try #require(read.attribute(.font, at: text.range(of: word).location, effectiveRange: nil) as? NSFont)
        }
        let title = try font(at: "Annual")
        #expect(title.pointSize == 24 && title.fontDescriptor.symbolicTraits.contains(.bold) && title.familyName == "Arial")
        let plain = try font(at: "Plain")
        #expect(plain.pointSize == 12 && !plain.fontDescriptor.symbolicTraits.contains(.bold) && !plain.fontDescriptor.symbolicTraits.contains(.italic))
        #expect(try font(at: "slanted").fontDescriptor.symbolicTraits.contains(.italic))
        #expect(try font(at: "kept").familyName == "Times New Roman")
    }

    @Test func aPictureKeepsItsSizeUnlessItIsWiderThanTheText() throws {
        let page = CGSize(width: 400, height: 600)
        let parts = Docx.parts(pages: [Docx.Page(size: page, blocks: [
            .picture(jpeg: try jpeg(width: 40, height: 20), size: CGSize(width: 100, height: 50)),
            .picture(jpeg: try jpeg(width: 80, height: 20), size: CGSize(width: 512, height: 128)),
        ])])
        #expect(parts.media.count == 2)
        // 12 700 units for a point. The text is 400 − 2 × 72 = 256 points wide: the second picture is halved.
        #expect(parts.document.contains("<wp:extent cx=\"1270000\" cy=\"635000\"/>"))
        #expect(parts.document.contains("<wp:extent cx=\"3251200\" cy=\"812800\"/>"))
        #expect(parts.document.contains("<w:pgSz w:w=\"8000\" w:h=\"12000\"/>"), "The page of the PDF, in twentieths of a point")
        // macOS does not read the pictures of a Word document: the archive is opened by `unzip`, as Word opens it.
        let picture = try jpeg(width: 40, height: 20)
        let docx = try Docx.data(pages: [Docx.Page(size: page, blocks: [.text([run("Above")]), .picture(jpeg: picture, size: CGSize(width: 100, height: 50))])])
        #expect(try unzipped("word/media/image1.jpeg", from: docx) == picture)
        let document = try XMLDocument(data: try unzipped("word/document.xml", from: docx))
        #expect(try document.nodes(forXPath: "//*[local-name()='blip']").count == 1)
        #expect(String(decoding: try unzipped("word/_rels/document.xml.rels", from: docx), as: UTF8.self).contains("Target=\"media/image1.jpeg\""))
    }

    @Test func aPageNarrowerThanTheMarginsStillGivesSizesThatWordAccepts() throws {
        let parts = Docx.parts(pages: [Docx.Page(size: CGSize(width: 120, height: 200), blocks: [.picture(jpeg: try jpeg(width: 40, height: 20), size: CGSize(width: 100, height: 50))])])
        #expect(!parts.document.contains("=\"-"), "No negative size: \(parts.document)")
        #expect(parts.document.contains("<w:pgMar w:top=\"600\" w:right=\"600\" w:bottom=\"600\" w:left=\"600\""), "A quarter of the page at most for each margin")
        #expect(parts.document.contains("<wp:extent cx=\"762000\" cy=\"381000\"/>"), "The picture fits the 60 points left for the text")
    }

    @Test func charactersThatXMLRefusesAreLeftOut() throws {
        let read = try wordText(Docx.data(pages: [Docx.Page(size: CGSize(width: 400, height: 600), blocks: [.text([run("Bell\u{07}, form\u{0C} and null\u{00} go; tab\tstays.")])])]))
        #expect(read.string.contains("Bell, form and null go; tab\tstays."))
    }

    @Test func aLongDocumentIsDeflatedAndStillReads() throws {
        let line = String(repeating: "The quick brown fox jumps over the lazy dog. ", count: 40)
        let pages = (0..<30).map { _ in Docx.Page(size: CGSize(width: 595, height: 842), blocks: (0..<10).map { _ in Docx.Block.text([run(line)]) }) }
        let docx = try Docx.data(pages: pages)
        #expect(docx.count < Docx.parts(pages: pages).document.utf8.count / 10, "Text is deflated in the archive")
        #expect(try wordText(docx).string.contains("lazy dog."))
    }
}
