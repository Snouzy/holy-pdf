import AppKit
import CoreGraphics
import CoreText
import Foundation
import PDFKit
import Testing
@testable import PDFCore

struct PDFWordTests {
    struct Piece {
        var text: String
        var font = "Helvetica"
        var size: CGFloat = 12
        var x: CGFloat = 72
        var y: CGFloat
    }

    /// Letter pages with typed text, and whatever `draw` adds to a page.
    private func typed(_ pages: [[Piece]], rotation: Int = 0, draw: (CGContext, Int) -> Void = { _, _ in }) throws -> Data {
        let data = NSMutableData()
        let consumer = try #require(CGDataConsumer(data: data))
        var box = CGRect(x: 0, y: 0, width: 612, height: 792)
        let context = try #require(CGContext(consumer: consumer, mediaBox: &box, nil))
        for (index, pieces) in pages.enumerated() {
            context.beginPDFPage(nil)
            draw(context, index)
            for piece in pieces {
                let line = CFAttributedStringCreate(nil, piece.text as CFString, [kCTFontAttributeName: CTFontCreateWithName(piece.font as CFString, piece.size, nil)] as CFDictionary)!
                context.textPosition = CGPoint(x: piece.x, y: piece.y)
                CTLineDraw(CTLineCreateWithAttributedString(line), context)
            }
            context.endPDFPage()
        }
        context.closePDF()
        guard rotation != 0 else { return data as Data }
        let document = try #require(PDFDocument(data: data as Data))
        for index in 0..<pages.count { document.page(at: index)?.rotation = rotation }
        return try #require(document.dataRepresentation())
    }

    private func texts(_ page: Docx.Page) -> [[Docx.Run]] {
        page.blocks.compactMap { if case .text(let runs) = $0 { runs } else { nil } }
    }

    private func paragraphs(_ page: Docx.Page) -> [String] { texts(page).map { $0.map(\.text).joined() } }

    private func picture(_ color: CGColor, side: Int = 200) throws -> CGImage {
        let context = try #require(CGContext(data: nil, width: side, height: side, bitsPerComponent: 8, bytesPerRow: 0,
                                             space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue))
        context.setFillColor(color)
        context.fill(CGRect(x: 0, y: 0, width: side, height: side))
        return try #require(context.makeImage())
    }

    @Test func copiesTheTextWithItsFontSizeAndStyle() throws {
        let source = try typed([[
            Piece(text: "Annual report", font: "Helvetica-Bold", size: 24, y: 700),
            Piece(text: "This is plain.", y: 650), Piece(text: "This is slanted.", font: "Helvetica-Oblique", x: 160, y: 650),
            Piece(text: "Serif line here.", font: "Times-Roman", y: 600),
        ]])
        let page = try #require(try PDFWord.pages(source).first)
        #expect(page.size == CGSize(width: 612, height: 792))
        #expect(paragraphs(page) == ["Annual report", "This is plain. This is slanted.", "Serif line here."])
        let runs = texts(page)
        #expect(runs[0] == [Docx.Run(text: "Annual report", font: "Arial", size: 24, bold: true, italic: false)])
        #expect(runs[1].count == 2)
        #expect(runs[1].first == Docx.Run(text: "This is plain. ", font: "Arial", size: 12, bold: false, italic: false), "The space between two words takes the style of the first")
        #expect(runs[1].last == Docx.Run(text: "This is slanted.", font: "Arial", size: 12, bold: false, italic: true))
        #expect(runs[2] == [Docx.Run(text: "Serif line here.", font: "Times New Roman", size: 12, bold: false, italic: false)])

        let read = try wordText(try PDFWord.document(source))
        #expect(read.string.contains("Annual report\nThis is plain. This is slanted.\nSerif line here."))
        let title = try #require(read.attribute(.font, at: 0, effectiveRange: nil) as? NSFont)
        #expect(title.pointSize == 24 && title.fontDescriptor.symbolicTraits.contains(.bold))
    }

    /// One Letter page with this content. F1 is Helvetica and F2 is Helvetica-Bold; `objects` come after, from number 7.
    private func page(_ content: String, inherited: Bool = false, objects: [String] = [], named: String = "") -> Data {
        let resources = "/Resources<</Font<</F1 5 0 R/F2 6 0 R>>\(named)>>"
        return serialize(objects: [
            "<</Type/Catalog/Pages 2 0 R>>",
            "<</Type/Pages/Count 1/Kids[3 0 R]\(inherited ? resources : "")>>",
            "<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]\(inherited ? "" : resources)/Contents 4 0 R>>",
            "<</Length \(content.utf8.count)>>stream\n\(content)\nendstream",
            "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
            "<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold>>",
        ] + objects)
    }

    @Test func aFontThatChangesInsideALineIsSeenAtTheRightLetter() throws {
        // One line of Core Text with three pieces, at the spacing of ordinary words.
        let data = NSMutableData()
        let consumer = try #require(CGDataConsumer(data: data))
        var box = CGRect(x: 0, y: 0, width: 612, height: 792)
        let context = try #require(CGContext(consumer: consumer, mediaBox: &box, nil))
        context.beginPDFPage(nil)
        let line = NSMutableAttributedString()
        for (text, font) in [("The report is ", "Helvetica"), ("very urgent", "Helvetica-Bold"), (" this week, and ", "Helvetica"), ("late", "Helvetica-Oblique"), (".", "Helvetica")] {
            line.append(NSAttributedString(string: text, attributes: [NSAttributedString.Key(kCTFontAttributeName as String): CTFontCreateWithName(font as CFString, 11, nil)]))
        }
        context.textPosition = CGPoint(x: 72, y: 700)
        CTLineDraw(CTLineCreateWithAttributedString(line), context)
        context.endPDFPage()
        context.closePDF()
        let page = try #require(try PDFWord.pages(data as Data).first)
        let runs = try #require(texts(page).first)
        #expect(runs.map(\.text) == ["The report is ", "very urgent ", "this week, and ", "late", "."], "\(runs)")
        #expect(runs.map(\.bold) == [false, true, false, false, false])
        #expect(runs.map(\.italic) == [false, false, false, true, false])
    }

    @Test func aFontChangedWithoutMovingThePenIsNotGuessedAndAFontIsRestoredWithItsState() throws {
        // Nothing says where « bold words » starts: the widths of the letters are in the font. The line keeps its first font.
        let run = try PDFWord.pages(page("BT /F1 12 Tf 72 700 Td (Plain text ) Tj /F2 12 Tf (bold words) Tj ET"))
        #expect(texts(try #require(run.first)) == [[Docx.Run(text: "Plain text bold words", font: "Arial", size: 12, bold: false, italic: false)]])
        let restored = try PDFWord.pages(page("BT /F2 12 Tf 72 700 Td (Bold first) Tj ET q BT /F1 12 Tf 72 650 Td (Plain inside) Tj ET Q BT 72 600 Td (Bold again) Tj ET"))
        #expect(texts(try #require(restored.first)).map { $0.map(\.bold) } == [[true], [false], [true]])
    }

    @Test func theFontsOfAPageMayComeFromItsParent() throws {
        let pages = try PDFWord.pages(page("BT /F2 12 Tf 72 700 Td (Bold title) Tj ET", inherited: true))
        #expect(texts(try #require(pages.first)) == [[Docx.Run(text: "Bold title", font: "Arial", size: 12, bold: true, italic: false)]])
    }

    @Test(.timeLimit(.minutes(1)))
    func aPageThatMisleadsTheReadingNeitherCrashesNorHangs() throws {
        // A matrix that sends the text beyond what a whole number holds.
        let far = String(repeating: "1000000 0 0 1000000 0 0 cm ", count: 4) + "BT /F1 12 Tf 72 700 Td (Far away) Tj ET q 1 0 0 1 0 0 cm /Im1 Do Q"
        _ = try PDFWord.pages(page(far))
        // A form that draws itself four times: without a guard, a billion readings.
        let inside = "/Fm0 Do /Fm0 Do /Fm0 Do /Fm0 Do BT /F1 12 Tf 72 600 Td (Inside the form) Tj ET"
        let form = "<</Type/XObject/Subtype/Form/BBox[0 0 612 792]/Resources<</Font<</F1 5 0 R>>/XObject<</Fm0 7 0 R>>>>/Length \(inside.utf8.count)>>stream\n\(inside)\nendstream"
        let looped = try PDFWord.pages(page("BT /F1 12 Tf 72 700 Td (Before the form) Tj ET /Fm0 Do", objects: [form], named: "/XObject<</Fm0 7 0 R>>"))
        #expect(paragraphs(try #require(looped.first)).contains("Before the form"))
    }

    @Test func aPictureWrittenInsideTheContentIsKeptAndAClippedOneKeepsWhatShows() throws {
        // One gray pixel written in the content itself, stretched to 200 × 100 points.
        let inline = try PDFWord.pages(page("BT /F1 12 Tf 72 700 Td (Above) Tj ET q 200 0 0 100 72 400 cm BI /W 1 /H 1 /CS /G /BPC 8 /F /AHx ID 80> EI Q"))
        let sizes = try #require(inline.first).blocks.compactMap { if case .picture(_, let size) = $0 { size } else { nil } }
        #expect(sizes.count == 1 && abs((sizes.first?.width ?? 0) - 200) < 1 && abs((sizes.first?.height ?? 0) - 100) < 1)

        let red = try picture(CGColor(red: 1, green: 0, blue: 0, alpha: 1))
        let clipped = try typed([[Piece(text: "Above the picture", y: 700)]]) { context, _ in
            context.saveGState()
            context.clip(to: CGRect(x: 72, y: 400, width: 150, height: 100))
            context.draw(red, in: CGRect(x: 72, y: 300, width: 400, height: 300))
            context.restoreGState()
        }
        let shown = try #require(try PDFWord.pages(clipped).first).blocks.compactMap { if case .picture(_, let size) = $0 { size } else { nil } }
        #expect(shown.count == 1 && abs((shown.first?.width ?? 0) - 150) < 1 && abs((shown.first?.height ?? 0) - 100) < 1, "\(shown)")
    }

    @Test(arguments: [("Roboto-Medium", "Roboto", false, false), ("HelveticaNeue-MediumItalic", "Helvetica Neue", false, true),
                     ("AECCXO+NimbusRomNo9L-Medi", "Times New Roman", true, false), ("NimbusRomNo9L-MediItal", "Times New Roman", true, true),
                     ("NimbusRomNo9L-ReguItal", "Times New Roman", false, true), ("DS-Digital", "DS", false, false),
                     ("ABCDEF+TimesNewRomanPS-BoldItalicMT", "Times New Roman", true, true), ("CMBX12", "CMBX12", true, false), ("CMTI10", "CMTI10", false, true),
                     ("Helvetica-Oblique", "Arial", false, true), ("", "Arial", false, false)])
    func aFontNameSaysItsFamilyItsWeightAndItsSlant(name: String, family: String, bold: Bool, italic: Bool) {
        let face = PageScan.Face(postScript: name)
        #expect(face.family == family && face.bold == bold && face.italic == italic, "\(face)")
    }

    @Test func aParagraphEndsAtAGapAtABulletAndAfterASentenceOnAShortLine() throws {
        let lines = [
            "The stairs of the building will be painted on Monday morning by the",
            "company that the owners chose at the meeting of last spring, and the",
            "work ends on Friday.",
            "Please keep the door of the hall closed while the paint is still wet,",
            "so that the dust of the street stays out, and tell",
            "your guests about it.",
        ]
        var pieces = lines.enumerated().map { Piece(text: $0.element, y: 700 - CGFloat($0.offset) * 14) }
        pieces.append(Piece(text: "A block after a gap, which goes on", y: 580))
        pieces.append(Piece(text: "• First item of a list", y: 566))
        pieces.append(Piece(text: "• Second item", y: 552))
        pieces.append(Piece(text: "A title in larger letters", size: 18, y: 520))
        pieces.append(Piece(text: "and its text, close under it.", y: 504))
        let page = try #require(try PDFWord.pages(try typed([pieces])).first)
        #expect(paragraphs(page) == [
            lines[0...2].joined(separator: " "),
            lines[3...5].joined(separator: " "),
            "A block after a gap, which goes on",
            "• First item of a list",
            "• Second item",
            "A title in larger letters",
            "and its text, close under it.",
        ])
    }

    @Test func twoColumnsAreReadOneAfterTheOther() throws {
        let left = ["Left one goes first,", "left two follows it,", "left three ends it."], right = ["Right one comes next,", "right two follows it,", "right three ends all."]
        let pieces = left.enumerated().map { Piece(text: $0.element, y: 700 - CGFloat($0.offset) * 14) }
            + right.enumerated().map { Piece(text: $0.element, x: 340, y: 700 - CGFloat($0.offset) * 14) }
        let page = try #require(try PDFWord.pages(try typed([pieces])).first)
        #expect(paragraphs(page) == [left.joined(separator: " "), right.joined(separator: " ")])
    }

    @Test func onePageOfWordForEachPageEvenTurned() throws {
        let source = try typed([[Piece(text: "First page", y: 700)], [Piece(text: "Second page", y: 700)], [Piece(text: "Third page", y: 700)]], rotation: 90)
        var steps: [Int] = []
        let pages = try PDFWord.pages(source) { done, total in
            #expect(total == 3)
            steps.append(done)
        }
        #expect(steps == [1, 2, 3])
        #expect(pages.map(paragraphs) == [["First page"], ["Second page"], ["Third page"]])
        #expect(pages[0].size == CGSize(width: 792, height: 612), "The page as the reader sees it")
        #expect(try wordText(try PDFWord.document(source)).string.components(separatedBy: "\u{0C}").count == 3)
    }

    @Test func aPictureStandsWhereThePageHasIt() throws {
        let red = try picture(CGColor(red: 1, green: 0, blue: 0, alpha: 1))
        let source = try typed([[Piece(text: "Above the picture", y: 700), Piece(text: "Below the picture", y: 300)]]) { context, _ in
            context.draw(red, in: CGRect(x: 72, y: 400, width: 200, height: 100))
            // A dot: rules and bullets are not pictures worth a place.
            context.draw(red, in: CGRect(x: 400, y: 700, width: 10, height: 10))
        }
        let page = try #require(try PDFWord.pages(source).first)
        try #require(page.blocks.count == 3)
        guard case .text(let above) = page.blocks[0], case .picture(let jpeg, let size) = page.blocks[1], case .text(let below) = page.blocks[2] else {
            Issue.record("Expected text, picture, text: \(page.blocks)")
            return
        }
        #expect(above.map(\.text).joined() == "Above the picture" && below.map(\.text).joined() == "Below the picture")
        #expect(abs(size.width - 200) < 1 && abs(size.height - 100) < 1)
        let image = try #require(NSBitmapImageRep(data: jpeg))
        #expect(image.pixelsWide > 400, "More than one pixel for a point")
        let middle = try #require(image.colorAt(x: image.pixelsWide / 2, y: image.pixelsHigh / 2)?.usingColorSpace(.deviceRGB))
        // Pure red moves a little on its way through JPEG and the screen's colour space.
        #expect(middle.redComponent > 0.8 && middle.greenComponent < 0.35 && middle.blueComponent < 0.35)
        #expect(try unzipped("word/media/image1.jpeg", from: try PDFWord.document(source)) == jpeg)
    }

    @Test func aScanKeepsItsPictureUnlessItsTextWasRead() throws {
        let gray = try picture(CGColor(gray: 0.8, alpha: 1))
        let scan = try typed([[]]) { context, _ in context.draw(gray, in: CGRect(x: 0, y: 0, width: 612, height: 792)) }
        let alone = try #require(try PDFWord.pages(scan).first)
        try #require(alone.blocks.count == 1)
        guard case .picture(_, let size) = alone.blocks[0] else {
            Issue.record("Expected the scan's picture")
            return
        }
        #expect(abs(size.width - 612) < 1 && abs(size.height - 792) < 1)

        let line = PDFTextLine(text: "Invoice 2026 of the plumber", box: CGRect(x: 0.1, y: 0.2, width: 0.6, height: 0.03))
        let read = try #require(try PDFTextLayer.adding(scan, read: { _ in [line, line, line] })).data
        let page = try #require(try PDFWord.pages(read).first)
        #expect(page.blocks.count == 1 && paragraphs(page).first?.contains("Invoice 2026") == true, "The picture would repeat what the text says")
    }

    @Test func aSignedPDFIsReadAndAProtectedOneAsksForItsPassword() throws {
        #expect(try PDFWord.pages(fixture("Signed", digitalSignature: true)).first.map(paragraphs) == ["Signed"], "No copy of the PDF is written: the signature has nothing to fear")
        let locked = try #require(PDFDocument(data: try typed([[Piece(text: "Secret", y: 700)]]))?.dataRepresentation(options: [
            PDFDocumentWriteOption.userPasswordOption: "open", PDFDocumentWriteOption.ownerPasswordOption: "owner",
        ]))
        #expect(throws: PDFToolError.passwordRequired) { try PDFWord.pages(locked) }
        #expect(try PDFWord.pages(locked, password: "open").first.map(paragraphs) == ["Secret"])
    }

    @Test func aCancelledCopyStopsAtTheNextPage() async throws {
        let source = try typed((1...3).map { [Piece(text: "Page \($0)", y: 700)] })
        let task = Task.detached { () -> Int in
            var pages = 0
            do {
                _ = try PDFWord.pages(source) { _, _ in
                    pages += 1
                    withUnsafeCurrentTask { $0?.cancel() }
                }
                return -1
            } catch PDFToolError.cancelled {
                return pages
            }
        }
        #expect(try await task.value == 1)
    }
}
