import Compression
import CoreGraphics
import Foundation
import zlib

/// The little of a Word document (.docx) that a recopied PDF needs, written by hand as the site writes it: XML parts
/// in a ZIP archive, and no library.
enum Docx {
    struct Run: Equatable {
        var text: String
        var font: String
        /// In points.
        var size: Double
        var bold: Bool
        var italic: Bool
    }

    enum Block {
        case text([Run])
        /// `size` is the size on the page, in points.
        case picture(jpeg: Data, size: CGSize)
    }

    /// `size` in points.
    struct Page {
        var size: CGSize
        var blocks: [Block]
    }

    /// An inch, or a quarter of the page when the page is small: the text keeps half of the page at least.
    private static func margin(of page: CGSize) -> Double { min(72, page.width / 4, page.height / 4) }
    private static let header = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
    private static let office = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    private static let namespaces = [
        "xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"",
        "xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"",
        "xmlns:wp=\"http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing\"",
        "xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\"",
        "xmlns:pic=\"http://schemas.openxmlformats.org/drawingml/2006/picture\"",
    ].joined(separator: " ")

    private static func twips(_ points: Double) -> Int { Int((points * 20).rounded()) }
    private static func emus(_ points: Double) -> Int { Int((points * 12700).rounded()) }

    /// One Word page for each page, all at the size of the first: the main part, and the pictures it names in order.
    static func parts(pages: [Page]) -> (document: String, media: [Data]) {
        var media: [Data] = []
        let first = pages.first?.size ?? CGSize(width: 595.28, height: 841.89)
        let margin = margin(of: first)
        var body = ""
        for (index, page) in pages.enumerated() {
            if index > 0 { body += "<w:p><w:r><w:br w:type=\"page\"/></w:r></w:p>" }
            for block in page.blocks {
                switch block {
                case .text(let runs): body += paragraph(runs)
                case .picture(let jpeg, let size):
                    media.append(jpeg)
                    body += picture(media.count, size: size, textWidth: first.width - 2 * margin)
                }
            }
        }
        let edge = twips(margin)
        let section = "<w:sectPr><w:pgSz w:w=\"\(twips(first.width))\" w:h=\"\(twips(first.height))\"/>"
            + "<w:pgMar w:top=\"\(edge)\" w:right=\"\(edge)\" w:bottom=\"\(edge)\" w:left=\"\(edge)\" w:header=\"720\" w:footer=\"720\" w:gutter=\"0\"/></w:sectPr>"
        return ("\(header)<w:document \(namespaces)><w:body>\(body)\(section)</w:body></w:document>", media)
    }

    static func data(pages: [Page]) throws(PDFToolError) -> Data {
        let (document, media) = parts(pages: pages)
        // The plain ZIP format counts its files on two bytes and its sizes on four.
        guard media.count < 65_000, media.reduce(document.utf8.count, { $0 + $1.count }) < 3_000_000_000 else { throw .writeFailed }
        let relations = ["<Relationship Id=\"rIdStyles\" Type=\"\(office)/styles\" Target=\"styles.xml\"/>"]
            + media.indices.map { "<Relationship Id=\"rIdImage\($0 + 1)\" Type=\"\(office)/image\" Target=\"media/image\($0 + 1).jpeg\"/>" }
        var archive = Archive()
        archive.add("[Content_Types].xml", "\(header)<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">"
            + "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/>"
            + "<Default Extension=\"jpeg\" ContentType=\"image/jpeg\"/>"
            + "<Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/>"
            + "<Override PartName=\"/word/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml\"/></Types>")
        archive.add("_rels/.rels", "\(header)<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">"
            + "<Relationship Id=\"rId1\" Type=\"\(office)/officeDocument\" Target=\"word/document.xml\"/></Relationships>")
        archive.add("word/document.xml", document)
        archive.add("word/styles.xml", "\(header)<w:styles xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:docDefaults>"
            + "<w:rPrDefault><w:rPr><w:rFonts w:ascii=\"Arial\" w:hAnsi=\"Arial\" w:cs=\"Arial\" w:eastAsia=\"Arial\"/><w:sz w:val=\"22\"/></w:rPr></w:rPrDefault>"
            + "<w:pPrDefault><w:pPr><w:spacing w:after=\"120\" w:line=\"264\" w:lineRule=\"auto\"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>")
        archive.add("word/_rels/document.xml.rels",
                    "\(header)<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">\(relations.joined())</Relationships>")
        // A JPEG is compressed already.
        for (index, jpeg) in media.enumerated() { archive.add("word/media/image\(index + 1).jpeg", jpeg, deflate: false) }
        return archive.finished()
    }

    private static func paragraph(_ runs: [Run]) -> String {
        "<w:p>" + runs.map { run in
            let name = escaped(run.font)
            // Word counts sizes in half points, from 1 to 1 638 points.
            let halfPoints = min(1638, max(2, Int((run.size * 2).rounded())))
            return "<w:r><w:rPr><w:rFonts w:ascii=\"\(name)\" w:hAnsi=\"\(name)\" w:cs=\"\(name)\"/>\(run.bold ? "<w:b/>" : "")\(run.italic ? "<w:i/>" : "")"
                + "<w:sz w:val=\"\(halfPoints)\"/></w:rPr><w:t xml:space=\"preserve\">\(escaped(run.text))</w:t></w:r>"
        }.joined() + "</w:p>"
    }

    private static func picture(_ id: Int, size: CGSize, textWidth: Double) -> String {
        let scale = min(1, textWidth / size.width)
        let (width, height) = (emus(size.width * scale), emus(size.height * scale))
        return "<w:p><w:r><w:drawing><wp:inline distT=\"0\" distB=\"0\" distL=\"0\" distR=\"0\"><wp:extent cx=\"\(width)\" cy=\"\(height)\"/><wp:docPr id=\"\(id)\" name=\"Picture \(id)\"/>"
            + "<a:graphic><a:graphicData uri=\"http://schemas.openxmlformats.org/drawingml/2006/picture\"><pic:pic>"
            + "<pic:nvPicPr><pic:cNvPr id=\"\(id)\" name=\"image\(id).jpeg\"/><pic:cNvPicPr/></pic:nvPicPr>"
            + "<pic:blipFill><a:blip r:embed=\"rIdImage\(id)\"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>"
            + "<pic:spPr><a:xfrm><a:off x=\"0\" y=\"0\"/><a:ext cx=\"\(width)\" cy=\"\(height)\"/></a:xfrm><a:prstGeom prst=\"rect\"><a:avLst/></a:prstGeom></pic:spPr>"
            + "</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>"
    }

    /// XML 1.0 has no place for most control characters, even escaped: Word refuses the file.
    private static func escaped(_ text: String) -> String {
        var result = ""
        for scalar in text.unicodeScalars {
            switch scalar {
            case "&": result += "&amp;"
            case "<": result += "&lt;"
            case ">": result += "&gt;"
            case "\"": result += "&quot;"
            case "\t", "\n", "\r": result.unicodeScalars.append(scalar)
            default:
                if scalar.value >= 0x20, scalar.value != 0xFFFE, scalar.value != 0xFFFF { result.unicodeScalars.append(scalar) }
            }
        }
        return result
    }
}

/// A ZIP archive in memory: what a .docx is.
private struct Archive {
    private var files = Data()
    private var directory = Data()
    private var count: UInt16 = 0

    mutating func add(_ name: String, _ text: String) { add(name, Data(text.utf8), deflate: true) }

    mutating func add(_ name: String, _ content: Data, deflate: Bool) {
        let packed = deflate ? Self.deflated(content) : nil
        let checksum = content.withUnsafeBytes { UInt32(crc32(0, $0.bindMemory(to: Bytef.self).baseAddress, uInt($0.count))) }
        // Version 2.0, no flag, stored (0) or deflated (8), no time, 1 January 1980, then the checksum and the two sizes.
        var facts = Data()
        for value in [20, 0, packed == nil ? 0 : 8, 0, 0x21] as [UInt16] { facts.append(value) }
        for value in [checksum, UInt32((packed ?? content).count), UInt32(content.count)] { facts.append(value) }
        facts.append(UInt16(name.utf8.count))
        let offset = UInt32(files.count)
        files.append(UInt32(0x0403_4B50))
        files.append(facts)
        files.append(UInt16(0))
        files.append(Data(name.utf8))
        files.append(packed ?? content)
        directory.append(UInt32(0x0201_4B50))
        directory.append(UInt16(20))
        directory.append(facts)
        // No extra field, no comment, disk 0, no attribute.
        for value in [0, 0, 0, 0] as [UInt16] { directory.append(value) }
        directory.append(UInt32(0))
        directory.append(offset)
        directory.append(Data(name.utf8))
        count += 1
    }

    /// The directory goes after the files, in place: an archive of pictures is not held twice.
    mutating func finished() -> Data {
        let start = UInt32(files.count)
        files.append(directory)
        files.append(UInt32(0x0605_4B50))
        for value in [0, 0, count, count] as [UInt16] { files.append(value) }
        files.append(UInt32(directory.count))
        files.append(start)
        files.append(UInt16(0))
        return files
    }

    /// The raw deflate stream a ZIP archive holds. Nil when it would not be shorter.
    private static func deflated(_ content: Data) -> Data? {
        guard !content.isEmpty else { return nil }
        var output = Data(count: content.count)
        let written = output.withUnsafeMutableBytes { target in
            content.withUnsafeBytes { source in
                compression_encode_buffer(target.bindMemory(to: UInt8.self).baseAddress!, target.count,
                                          source.bindMemory(to: UInt8.self).baseAddress!, source.count, nil, COMPRESSION_ZLIB)
            }
        }
        return written > 0 ? output.prefix(written) : nil
    }
}

private extension Data {
    /// ZIP writes its numbers low byte first.
    mutating func append<Number: FixedWidthInteger>(_ number: Number) {
        Swift.withUnsafeBytes(of: number.littleEndian) { append(contentsOf: $0) }
    }
}
