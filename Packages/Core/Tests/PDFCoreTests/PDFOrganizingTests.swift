import CoreGraphics
import Foundation
import PDFKit
import Testing
@testable import PDFCore

struct PDFOrganizingTests {
    @Test func reordersRotatesAndDeletesWithoutRasterizingOrMutatingTheSource() async throws {
        let data = fixture("Ada", rotation: 90)
        let organizer = try PDFOrganizingDocument(data: data)
        let info = await organizer.information()
        #expect(info.pageSizes == [CGSize(width: 360, height: 270), CGSize(width: 300, height: 400)])
        let output = try await organizer.organizedData(pages: [.init(id: 1, rotation: 180), .init(id: 0, rotation: 270)])
        let result = try #require(PDFDocument(data: output))
        #expect(result.pageCount == 2)
        #expect(result.page(at: 0)?.rotation == 180)
        #expect(result.page(at: 1)?.rotation == 0)
        #expect(result.page(at: 1)?.bounds(for: .cropBox) == CGRect(x: 10, y: 20, width: 270, height: 360))
        #expect(result.page(at: 1)?.string?.contains("Ada") == true)
        #expect(result.page(at: 1)?.annotations.contains { $0.type == "Square" } == true)
        let again = try #require(PDFDocument(data: await organizer.organizedData(pages: [.init(id: 0)])))
        #expect(again.pageCount == 1)
        #expect(again.page(at: 0)?.rotation == 90)
        #expect(PDFDocument(data: data)?.page(at: 0)?.annotations.count == 4)
    }

    @Test func remapsNamedLinksAndBookmarksAndRemovesDeletedTargets() async throws {
        let organizer = try PDFOrganizingDocument(data: fixture("Ada"))
        let result = try #require(PDFDocument(data: await organizer.organizedData(pages: [.init(id: 1), .init(id: 0)])))
        let page = try #require(result.page(at: 1))
        let link = try #require(page.annotations.compactMap { $0.action as? PDFActionGoTo }.first)
        #expect(result.index(for: try #require(link.destination.page)) == 0)
        #expect(result.index(for: try #require(result.outlineRoot?.child(at: 0)?.destination?.page)) == 0)
        let deleted = try #require(PDFDocument(data: await organizer.organizedData(pages: [.init(id: 0)])))
        #expect(deleted.page(at: 0)?.annotations.compactMap { $0.action as? PDFActionGoTo }.isEmpty == true)
        #expect(deleted.page(at: 0)?.annotations.contains { $0.url?.absoluteString == "https://example.com/Ada" } == true)
        #expect(deleted.outlineRoot == nil || deleted.outlineRoot?.numberOfChildren == 0)
    }

    @Test func retainsChildrenWhenTheirBookmarkParentTargetsARemovedPage() async throws {
        let source = try #require(PDFDocument(data: fixture("Ada")))
        let root = try #require(source.outlineRoot)
        let parent = try #require(root.child(at: 0))
        let child = PDFOutline()
        child.label = "Retained child"
        child.destination = PDFDestination(page: try #require(source.page(at: 0)), at: .zero)
        parent.insertChild(child, at: 0)
        let data = try #require(source.dataRepresentation())
        let organizer = try PDFOrganizingDocument(data: data)
        let result = try #require(PDFDocument(data: await organizer.organizedData(pages: [.init(id: 0)])))
        let group = try #require(result.outlineRoot?.child(at: 0))
        #expect(group.label == "Ada last" && group.action == nil)
        #expect(group.numberOfChildren == 1)
        #expect(result.index(for: try #require(group.child(at: 0)?.destination?.page)) == 0)
    }

    @Test func keepsSharedFormFieldsEditableAfterDeletingOneWidgetPage() async throws {
        let organizer = try PDFOrganizingDocument(data: fixture("Ada", sharedWidgets: true))
        for order in [[1, 0], [0], [1]] {
            let result = try #require(PDFDocument(data: await organizer.organizedData(pages: order.map { .init(id: $0) })))
            let first = try #require(result.page(at: 0)?.annotations.first { $0.widgetFieldType == .text })
            #expect(first.fieldName == "Person" && first.widgetStringValue == "Ada")
            first.widgetStringValue = "Grace"
            let edited = try #require(result.dataRepresentation())
            let reloaded = try #require(PDFDocument(data: edited))
            for index in 0..<reloaded.pageCount {
                #expect(reloaded.page(at: index)?.annotations.first { $0.widgetFieldType == .text }?.widgetStringValue == "Grace")
            }
        }
    }

    @Test func opensProtectedFilesAndExportsAnUnlockedCopy() async throws {
        let source = try #require(PDFDocument(data: fixture("Ada")))
        let data = try #require(source.dataRepresentation(options: [PDFDocumentWriteOption.ownerPasswordOption: "owner", PDFDocumentWriteOption.userPasswordOption: "secret"]))
        #expect(throws: PDFToolError.passwordRequired) { try PDFOrganizingDocument(data: data) }
        #expect(throws: PDFToolError.wrongPassword) { try PDFOrganizingDocument(data: data, password: "wrong") }
        let organizer = try PDFOrganizingDocument(data: data, password: "secret")
        #expect(await organizer.information().isEncrypted)
        let output = try #require(PDFDocument(data: await organizer.organizedData(pages: [.init(id: 1)])))
        #expect(!output.isEncrypted && !output.isLocked)
        #expect(PDFDocument(data: data)?.isLocked == true)
    }

    @Test func refusesInvalidOrdersAndUnsupportedOrSignedDocuments() async throws {
        let organizer = try PDFOrganizingDocument(data: fixture("Ada"))
        let orders: [[OrganizedPage]] = [[], [.init(id: -1)], [.init(id: 2)], [.init(id: 0), .init(id: 0)], [.init(id: 0, rotation: 45)], [.init(id: 0, rotation: Int.max)]]
        for pages in orders {
            await #expect(throws: PDFToolError.invalidOrder) { try await organizer.organizedData(pages: pages) }
        }
        #expect(throws: PDFToolError.invalidDocument) { try PDFOrganizingDocument(data: Data("bad PDF".utf8)) }
        for catalog in ["/OCProperties<<>>", "/AF[]", "/Names<</EmbeddedFiles<</Names[]>>>>", "/OpenAction<</S/JavaScript/JS(app.alert)>>"] {
            #expect(throws: PDFToolError.unsupportedDocument) { try PDFOrganizingDocument(data: fixture("A", catalog: catalog)) }
        }
        #expect(throws: PDFToolError.alreadySigned) { try PDFOrganizingDocument(data: fixture("A", digitalSignature: true)) }
        let tagged = try PDFOrganizingDocument(data: fixture("A", catalog: "/StructTreeRoot<<>>/OutputIntents[]"))
        #expect(await tagged.information().notices == [.accessibilityTags, .archivalProfile])
    }

    @Test func boundsAndCancelsPreviewsAndExports() async throws {
        let organizer = try PDFOrganizingDocument(data: fixture("Ada", rotation: 90))
        let thumbnail = try await organizer.preview(pageIndex: 0)
        #expect(thumbnail.width == 240 && thumbnail.height == 180)
        let full = try await organizer.preview(pageIndex: 1, maxDimension: Int.max)
        #expect(full.width == 1200 && full.height == 1600)
        await #expect(throws: PDFToolError.invalidDocument) { try await organizer.preview(pageIndex: 2) }
        await #expect(throws: PDFToolError.renderFailed) { try await organizer.preview(pageIndex: 0, maxDimension: 0) }
        let preview = Task {
            withUnsafeCurrentTask { $0?.cancel() }
            return try await organizer.preview(pageIndex: 0)
        }
        await #expect(throws: PDFToolError.cancelled) { try await preview.value }
        let export = Task {
            withUnsafeCurrentTask { $0?.cancel() }
            return try await organizer.organizedData(pages: [.init(id: 0)])
        }
        await #expect(throws: PDFToolError.cancelled) { try await export.value }
    }

    @Test func previewsAndExportsTheChosenPageContent() async throws {
        let bytes = NSMutableData()
        let consumer = try #require(CGDataConsumer(data: bytes))
        var media = CGRect(x: 0, y: 0, width: 300, height: 400)
        let context = try #require(CGContext(consumer: consumer, mediaBox: &media, nil))
        for color in [CGColor(red: 1, green: 0, blue: 0, alpha: 1), CGColor(red: 0, green: 0, blue: 1, alpha: 1)] {
            context.beginPDFPage(nil)
            context.setFillColor(color)
            context.fill(media)
            context.endPDFPage()
        }
        context.closePDF()
        let organizer = try PDFOrganizingDocument(data: bytes as Data)
        let output = try await organizer.organizedData(pages: [.init(id: 1, rotation: 90), .init(id: 0)])
        let reordered = try PDFOrganizingDocument(data: output)
        for (document, index, channel) in [(organizer, 0, 0), (organizer, 1, 2), (reordered, 0, 2), (reordered, 1, 0)] {
            let image = try await document.preview(pageIndex: index)
            let pixels = try #require(image.dataProvider?.data) as Data
            let offset = image.bytesPerRow * (image.height / 2) + (image.width / 2) * 4
            #expect(pixels[offset + channel] > 240)
            for other in 0..<3 where other != channel { #expect(pixels[offset + other] < 80) }
        }
        #expect(await organizer.information().pageSizes[1] == CGSize(width: 300, height: 400))
        #expect(await reordered.information().pageSizes[0] == CGSize(width: 400, height: 300))
    }

    @Test func measuresOneHundredVectorPagesWithoutReparsingEachPreview() async throws {
        let bytes = NSMutableData()
        let consumer = try #require(CGDataConsumer(data: bytes))
        var media = CGRect(x: 0, y: 0, width: 600, height: 800)
        let context = try #require(CGContext(consumer: consumer, mediaBox: &media, nil))
        for index in 0..<100 {
            context.beginPDFPage(nil)
            context.setFillColor(CGColor(gray: CGFloat(index) / 100, alpha: 1))
            context.fill(media)
            context.endPDFPage()
        }
        context.closePDF()
        let data = bytes as Data
        let start = ContinuousClock.now
        let organizer = try PDFOrganizingDocument(data: data)
        let opened = ContinuousClock.now
        for index in 0..<100 {
            let image = try await organizer.preview(pageIndex: index)
            #expect(image.width <= 240 && image.height == 240)
        }
        let rendered = ContinuousClock.now
        let output = try await organizer.organizedData(pages: (0..<100).reversed().map { .init(id: $0, rotation: 90) })
        let exported = ContinuousClock.now
        #expect(PDFDocument(data: output)?.pageCount == 100)
        #expect(output.count < 500_000)
        print("Organizing 100 vector pages: open=\(start.duration(to: opened)), thumbnails=\(opened.duration(to: rendered)), export=\(rendered.duration(to: exported)), bytes=\(output.count)")
    }
}
