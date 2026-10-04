import CoreGraphics
import Foundation
import PDFKit
import Testing
@testable import PDFCore

struct PDFBookmarksTests {
    /// Blank pages of 300 × 400 points.
    private func pages(_ count: Int, rotation: Int = 0) throws -> Data {
        let data = NSMutableData()
        let consumer = try #require(CGDataConsumer(data: data))
        var box = CGRect(x: 0, y: 0, width: 300, height: 400)
        let context = try #require(CGContext(consumer: consumer, mediaBox: &box, nil))
        for _ in 0..<count {
            context.beginPDFPage(nil)
            context.endPDFPage()
        }
        context.closePDF()
        guard rotation != 0 else { return data as Data }
        let document = try #require(PDFDocument(data: data as Data))
        for index in 0..<count { document.page(at: index)?.rotation = rotation }
        return try #require(document.dataRepresentation())
    }

    private func plain(_ bookmarks: [PDFBookmark]) -> [PDFBookmark] {
        bookmarks.map { PDFBookmark(title: $0.title, pageIndex: $0.pageIndex, level: $0.level) }
    }

    private let chapters = [
        PDFBookmark(title: "Préface", pageIndex: 0),
        PDFBookmark(title: "Chapitre 1 — L'été", pageIndex: 1),
        PDFBookmark(title: "La mer", pageIndex: 1, level: 1),
        PDFBookmark(title: "Le port", pageIndex: 2, level: 2),
        PDFBookmark(title: "Chapitre 2", pageIndex: 3),
    ]

    @Test func readsTheBookmarksOfADocumentInOrder() throws {
        #expect(plain(try PDFBookmarks.list(fixture("Doc"))) == [PDFBookmark(title: "Doc last", pageIndex: 1)])
        #expect(try PDFBookmarks.list(try pages(2)).isEmpty)
    }

    @Test func writesTheBookmarksWithTheirLevelsAndKeepsThePages() throws {
        let source = try pages(4)
        let output = try PDFBookmarks.written(source, bookmarks: chapters)
        #expect(plain(try PDFBookmarks.list(output)) == chapters)
        let copy = try #require(PDFDocument(data: output))
        #expect(copy.pageCount == 4)
        #expect(copy.outlineRoot?.numberOfChildren == 3)
        #expect(copy.outlineRoot?.child(at: 1)?.child(at: 0)?.child(at: 0)?.label == "Le port")
    }

    @Test func replacesTheBookmarksThatWereThereAndCanRemoveThemAll() throws {
        let source = fixture("Doc")
        let renamed = try PDFBookmarks.written(source, bookmarks: [PDFBookmark(title: "Start", pageIndex: 0)])
        #expect(plain(try PDFBookmarks.list(renamed)) == [PDFBookmark(title: "Start", pageIndex: 0)])
        #expect(PDFDocument(data: renamed)?.page(at: 0)?.string?.contains("Doc") == true)
        #expect(try PDFBookmarks.list(try PDFBookmarks.written(source, bookmarks: [])).isEmpty)
    }

    @Test func aBookmarkThatWasReadKeepsItsPlaceOnThePage() throws {
        let source = try PDFBookmarks.written(try pages(2), bookmarks: [PDFBookmark(title: "Middle", pageIndex: 1, point: CGPoint(x: 40, y: 220))])
        let read = try PDFBookmarks.list(source)
        #expect(read.first?.point == CGPoint(x: 40, y: 220))
        #expect(try PDFBookmarks.list(try PDFBookmarks.written(source, bookmarks: read)) == read)
    }

    // The fixture's first page shows the box from (10, 20) to (280, 380): the corner the reader sees top left, for each turn.
    @Test(arguments: [(0, CGPoint(x: 10, y: 380)), (90, CGPoint(x: 10, y: 20)), (180, CGPoint(x: 280, y: 20)), (270, CGPoint(x: 280, y: 380))])
    func aNewBookmarkLandsAtTheTopOfThePageAsTheReaderSeesIt(rotation: Int, corner: CGPoint) throws {
        let output = try PDFBookmarks.written(fixture("Top", rotation: rotation), bookmarks: [PDFBookmark(title: "Top", pageIndex: 0)])
        // A bookmark finds its page through its document: the document must stay alive.
        let copy = try #require(PDFDocument(data: output))
        let point = try #require(copy.outlineRoot?.child(at: 0)?.destination?.point)
        #expect(abs(point.x - corner.x) < 0.5 && abs(point.y - corner.y) < 0.5, "\(point)")
    }

    /// « Kept », then « Web », which opens an address and holds « A » and « B », then a title made of spaces.
    private func mixedOutline() -> Data {
        serialize(objects: [
            "<</Type/Catalog/Pages 2 0 R/Outlines 5 0 R>>",
            "<</Type/Pages/Count 2/Kids[3 0 R 4 0 R]>>",
            "<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 400]>>",
            "<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 400]>>",
            "<</Type/Outlines/First 6 0 R/Last 10 0 R/Count 3>>",
            "<</Title(Kept)/Parent 5 0 R/Next 7 0 R/Dest[3 0 R /Fit]>>",
            "<</Title(Web)/Parent 5 0 R/Prev 6 0 R/Next 10 0 R/A<</S/URI/URI(https://example.com)>>/First 8 0 R/Last 9 0 R/Count 2>>",
            "<</Title(A)/Parent 7 0 R/Next 9 0 R/Dest[3 0 R /XYZ 0 400 null]>>",
            "<</Title( B )/Parent 7 0 R/Prev 8 0 R/Dest[4 0 R /XYZ 0 400 null]>>",
            "<</Title(   )/Parent 5 0 R/Prev 7 0 R/Dest[4 0 R /Fit]>>",
        ])
    }

    @Test func theChildrenOfABookmarkThatLeadsNowhereTakeItsPlaceAndTheScreenCanSayHowManyWereLeftOut() throws {
        let outline = try PDFBookmarks.outline(mixedOutline())
        #expect(plain(outline.bookmarks) == [PDFBookmark(title: "Kept", pageIndex: 0), PDFBookmark(title: "A", pageIndex: 0), PDFBookmark(title: " B ", pageIndex: 1)],
                "A and B do not become the children of « Kept »")
        #expect(outline.unlisted == 2, "The address and the title made of spaces")
        // What was read can be written as it is: a title keeps its own spaces.
        #expect(try PDFBookmarks.list(try PDFBookmarks.written(mixedOutline(), bookmarks: outline.bookmarks)).map(\.title) == ["Kept", "A", " B "])
        #expect(try PDFBookmarks.outline(fixture("Doc")).unlisted == 0)
    }

    @Test func aLevelNeverSkipsOneAndATitleOrAPageThatCannotBeIsRefused() throws {
        let source = try pages(2)
        let deep = [PDFBookmark(title: "First", pageIndex: 0, level: 3), PDFBookmark(title: "Second", pageIndex: 1, level: 5)]
        #expect(plain(try PDFBookmarks.list(try PDFBookmarks.written(source, bookmarks: deep)))
            == [PDFBookmark(title: "First", pageIndex: 0), PDFBookmark(title: "Second", pageIndex: 1, level: 1)])
        #expect(throws: PDFToolError.invalidOrder) { try PDFBookmarks.written(source, bookmarks: [PDFBookmark(title: "Far", pageIndex: 2)]) }
        #expect(throws: PDFToolError.invalidOrder) { try PDFBookmarks.written(source, bookmarks: [PDFBookmark(title: "  ", pageIndex: 0)]) }
    }

    @Test func refusesASignedPDFAndOpensAProtectedOne() throws {
        #expect(throws: PDFToolError.alreadySigned) { try PDFBookmarks.written(fixture("Signed", digitalSignature: true), bookmarks: chapters) }
        let locked = try #require(PDFDocument(data: try pages(4))?.dataRepresentation(options: [
            PDFDocumentWriteOption.userPasswordOption: "open", PDFDocumentWriteOption.ownerPasswordOption: "owner",
        ]))
        #expect(throws: PDFToolError.passwordRequired) { try PDFBookmarks.list(locked) }
        let output = try PDFBookmarks.written(locked, password: "open", bookmarks: chapters)
        #expect(PDFDocument(data: output)?.isLocked == false)
        #expect(plain(try PDFBookmarks.list(output)) == chapters)
    }
}
