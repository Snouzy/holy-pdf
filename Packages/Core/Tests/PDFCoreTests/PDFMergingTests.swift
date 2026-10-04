import CoreGraphics
import Foundation
import ImageIO
import PDFKit
import Testing
import UniformTypeIdentifiers
@testable import PDFCore

struct PDFMergingTests {
    @Test func preservesPagesLinksBoxesAnnotationsAndBookmarksInTheChosenOrder() async throws {
        let collection = PDFMergeCollection()
        let first = try await collection.add(data: fixture("Ada", rotation: 90))
        let second = try await collection.add(data: fixture("Grace", rotation: 270))
        let output = try await collection.mergedData(order: [second.id, first.id])
        let document = try #require(PDFDocument(data: output))
        #expect(document.pageCount == 4)
        let page = try #require(document.page(at: 0))
        #expect(page.string?.contains("Grace") == true)
        #expect(document.page(at: 2)?.string?.contains("Ada") == true)
        #expect(page.rotation == 270)
        #expect(document.page(at: 2)?.rotation == 90)
        #expect(page.bounds(for: .cropBox) == CGRect(x: 10, y: 20, width: 270, height: 360))
        #expect(page.bounds(for: .mediaBox) == CGRect(x: 0, y: 0, width: 300, height: 400))
        #expect(page.annotations.contains { $0.url?.absoluteString == "https://example.com/Grace" })
        #expect(page.annotations.contains { $0.type == "Square" })
        for pageIndex in [0, 2] {
            let current = try #require(document.page(at: pageIndex))
            let link = try #require(current.annotations.compactMap { $0.action as? PDFActionGoTo }.first)
            let destination = try #require(link.destination.page)
            #expect(document.index(for: destination) == pageIndex + 1)
        }
        let outlines = try #require(document.outlineRoot)
        #expect(outlines.numberOfChildren == 2)
        #expect(outlines.child(at: 0)?.label == "Grace last")
        #expect(outlines.child(at: 1)?.label == "Ada last")
        for index in 0..<2 {
            let destination = try #require(outlines.child(at: index)?.destination?.page)
            #expect(document.index(for: destination) == index * 2 + 1)
        }
    }

    @Test(arguments: [false, true]) func homonymousFieldsStayIndependentAndSharedWidgetsStayLinked(sharedWidgets: Bool) async throws {
        let collection = PDFMergeCollection()
        let first = try await collection.add(data: fixture("Ada", sharedWidgets: sharedWidgets))
        let second = try await collection.add(data: fixture("Grace", sharedWidgets: sharedWidgets))
        let output = try await collection.mergedData(order: [first.id, second.id])
        let document = try #require(PDFDocument(data: output))
        let ada = try widget(document, page: 0)
        let grace = try widget(document, page: 2)
        #expect(ada.fieldName != grace.fieldName)
        #expect(ada.widgetStringValue == "Ada")
        #expect(grace.widgetStringValue == "Grace")
        ada.widgetStringValue = "Changed"
        let editedData = try #require(document.dataRepresentation())
        let edited = try #require(PDFDocument(data: editedData))
        #expect(try widget(edited, page: 0).widgetStringValue == "Changed")
        #expect(try widget(edited, page: 2).widgetStringValue == "Grace")
        if sharedWidgets {
            #expect(try widget(edited, page: 1).widgetStringValue == "Changed")
            #expect(try widget(edited, page: 3).widgetStringValue == "Grace")
        }
    }

    @Test func repeatedExportsUseUnchangedSourcesAndMayExcludeRetainedUndoDocuments() async throws {
        let data = fixture("Ada")
        let collection = PDFMergeCollection()
        let first = try await collection.add(data: data)
        let second = try await collection.add(data: fixture("Grace"))
        _ = try await collection.add(data: fixture("Retained for undo"))
        let before = try await collection.mergedData(order: [first.id, second.id])
        let after = try await collection.mergedData(order: [second.id, first.id])
        let earlier = try #require(PDFDocument(data: before))
        let later = try #require(PDFDocument(data: after))
        #expect(earlier.pageCount == 4 && later.pageCount == 4)
        #expect(earlier.page(at: 0)?.string?.contains("Ada") == true)
        #expect(later.page(at: 0)?.string?.contains("Grace") == true)
        #expect(try widget(earlier, page: 0).fieldName == "HolyPDF1.Person")
        #expect(try widget(later, page: 2).fieldName == "HolyPDF2.Person")
        let source = try #require(PDFDocument(data: data))
        #expect(try widget(source, page: 0).fieldName == "Person")
    }

    @Test func checkboxFieldsFromDifferentDocumentsRemainIndependent() async throws {
        let collection = PDFMergeCollection()
        let first = try await collection.add(data: fixture("Ada", checkbox: true))
        let second = try await collection.add(data: fixture("Grace", checkbox: true))
        let output = try await collection.mergedData(order: [first.id, second.id])
        let document = try #require(PDFDocument(data: output))
        let ada = try #require(document.page(at: 0)?.annotations.first { $0.widgetFieldType == .button })
        let grace = try #require(document.page(at: 2)?.annotations.first { $0.widgetFieldType == .button })
        #expect(ada.buttonWidgetState == .onState && grace.buttonWidgetState == .onState)
        ada.buttonWidgetState = .offState
        let editedData = try #require(document.dataRepresentation())
        let edited = try #require(PDFDocument(data: editedData))
        #expect(edited.page(at: 0)?.annotations.first(where: { $0.widgetFieldType == .button })?.buttonWidgetState == .offState)
        #expect(edited.page(at: 2)?.annotations.first(where: { $0.widgetFieldType == .button })?.buttonWidgetState == .onState)
    }

    @Test func preservesAnEntirelyBlankPageAndItsSerializedBoxes() async throws {
        let blank = PDFDocument()
        let page = PDFPage()
        let media = CGRect(x: 30, y: 40, width: 300, height: 400)
        let crop = CGRect(x: 40, y: 50, width: 270, height: 360)
        page.setBounds(media, for: .mediaBox)
        page.setBounds(crop, for: .cropBox)
        page.rotation = 180
        blank.insert(page, at: 0)
        let originalData = try #require(blank.dataRepresentation())
        let original = try #require(PDFDocument(data: originalData)?.page(at: 0))
        let collection = PDFMergeCollection()
        let first = try await collection.add(data: originalData)
        let second = try await collection.add(data: fixture("Text"))
        let result = try #require(PDFDocument(data: await collection.mergedData(order: [first.id, second.id])))
        let reloaded = try #require(result.page(at: 0))
        #expect(result.pageCount == 3)
        #expect((reloaded.string ?? "").isEmpty)
        #expect(reloaded.bounds(for: .mediaBox) == original.bounds(for: .mediaBox))
        #expect(reloaded.bounds(for: .cropBox) == original.bounds(for: .cropBox))
        #expect(reloaded.rotation == 180)
    }

    @Test func acceptsVisualSignaturesWrittenByTheSigningTool() async throws {
        let signing = try PDFSigningDocument(data: fixture("Ada"))
        let mark = UUID()
        let signed = try await signing.signedData(marks: [mark: try signature()], placements: [
            SignaturePlacement(pageIndex: 0, bounds: CGRect(x: 0.1, y: 0.6, width: 0.4, height: 0.2), mark: mark),
        ])
        let collection = PDFMergeCollection()
        let first = try await collection.add(data: signed)
        let second = try await collection.add(data: fixture("Grace"))
        let output = try await collection.mergedData(order: [first.id, second.id])
        let document = try #require(PDFDocument(data: output))
        let stamp = try #require(document.page(at: 0)?.annotations.first { $0.type == "Stamp" })
        #expect(stamp.hasAppearanceStream)
        #expect(stamp.shouldPrint)
        #expect(stamp.userName == nil)
        #expect(document.page(at: 0)?.string?.contains("Ada") == true)
    }

    @Test func opensProtectedSourcesAndProducesAnUnlockedMerge() async throws {
        let source = try #require(PDFDocument(data: fixture("Ada")))
        let protected = try #require(source.dataRepresentation(options: [
            PDFDocumentWriteOption.ownerPasswordOption: "owner", PDFDocumentWriteOption.userPasswordOption: "secret",
        ]))
        let collection = PDFMergeCollection()
        await #expect(throws: PDFToolError.passwordRequired) { try await collection.add(data: protected) }
        await #expect(throws: PDFToolError.wrongPassword) { try await collection.add(data: protected, password: "wrong") }
        let first = try await collection.add(data: protected, password: "secret")
        #expect(first.isEncrypted)
        let second = try await collection.add(data: fixture("Grace"))
        let document = try #require(PDFDocument(data: await collection.mergedData(order: [first.id, second.id])))
        #expect(!document.isLocked && !document.isEncrypted)
        #expect(document.page(at: 0)?.string?.contains("Ada") == true)
        #expect(PDFDocument(data: protected)?.isLocked == true)
    }

    @Test func returnsNoticesForTaggedAndArchivalPDFsInsteadOfRejectingThem() async throws {
        let collection = PDFMergeCollection()
        let tagged = try await collection.add(data: fixture("Tagged", catalog: "/StructTreeRoot<</Type/StructTreeRoot/K[]>>/MarkInfo<</Marked true>>"))
        let archival = try await collection.add(data: fixture("Archive", catalog: "/OutputIntents[]"))
        #expect(tagged.notices == [.accessibilityTags])
        #expect(archival.notices == [.archivalProfile])
        let output = try await collection.mergedData(order: [tagged.id, archival.id])
        #expect(PDFDocument(data: output)?.pageCount == 4)
    }

    @Test func refusesUnsupportedGlobalStructuresAndActions() async throws {
        let collection = PDFMergeCollection()
        for catalog in ["/OCProperties<<>>", "/AF[]", "/OpenAction<</S/JavaScript/JS(app.alert)>>", "/Names<</EmbeddedFiles<</Names[]>>>>"] {
            await #expect(throws: PDFToolError.unsupportedDocument) { try await collection.add(data: fixture("A", catalog: catalog)) }
        }
        for form in ["/XFA(unsupported)", "/CO[8 0 R]"] {
            await #expect(throws: PDFToolError.unsupportedDocument) { try await collection.add(data: fixture("A", form: form)) }
        }
        await #expect(throws: PDFToolError.unsupportedDocument) {
            try await collection.add(data: fixture("A", widgetExtra: "/AA<</K<</S/JavaScript/JS(app.alert)>>>>"))
        }
    }

    @Test func acceptsAnInitialPageDestinationWithoutAnActiveAction() async throws {
        let collection = PDFMergeCollection()
        let first = try await collection.add(data: fixture("A", catalog: "/OpenAction[3 0 R /Fit]"))
        let second = try await collection.add(data: fixture("B", catalog: "/OpenAction<</S/GoTo/D[9 0 R /Fit]>>"))
        #expect(PDFDocument(data: try await collection.mergedData(order: [first.id, second.id]))?.pageCount == 4)
    }

    @Test func refusesBrokenAndDigitallySignedPDFs() async throws {
        let collection = PDFMergeCollection()
        await #expect(throws: PDFToolError.invalidDocument) { try await collection.add(data: Data("bad PDF".utf8)) }
        await #expect(throws: PDFToolError.alreadySigned) { try await collection.add(data: fixture("A", digitalSignature: true)) }
    }

    @Test func validatesOrderRemovalsAndRetainedDocumentBudget() async throws {
        let collection = PDFMergeCollection()
        let first = try await collection.add(data: fixture("A"))
        let second = try await collection.add(data: fixture("B"))
        for order in [[], [first.id], [first.id, first.id], [first.id, UUID()]] {
            await #expect(throws: PDFToolError.invalidOrder) { try await collection.mergedData(order: order) }
        }
        await collection.remove(id: second.id)
        await #expect(throws: PDFToolError.invalidOrder) { try await collection.mergedData(order: [first.id, second.id]) }
        let third = try await collection.add(data: fixture("C"))
        #expect(PDFDocument(data: try await collection.mergedData(order: [third.id, first.id]))?.pageCount == 4)
        #expect(throws: PDFToolError.fileTooLarge) {
            try PDFMergeCollection.validateCapacity(existingCount: 0, existingBytes: 0, newBytes: PDFMergeCollection.maxDocumentBytes + 1)
        }
        #expect(throws: PDFToolError.collectionTooLarge) {
            try PDFMergeCollection.validateCapacity(existingCount: 2, existingBytes: PDFMergeCollection.maxTotalBytes, newBytes: 1)
        }
        #expect(throws: PDFToolError.tooManyDocuments) {
            try PDFMergeCollection.validateCapacity(existingCount: 100, existingBytes: 100, newBytes: 1)
        }
        try PDFMergeCollection.validateCapacity(existingCount: 1, existingBytes: PDFMergeCollection.maxDocumentBytes,
                                                 newBytes: PDFMergeCollection.maxDocumentBytes)
    }

    @Test func boundsAndCancelsPreviews() async throws {
        let collection = PDFMergeCollection()
        let document = try await collection.add(data: fixture("A", rotation: 90))
        let image = try await collection.preview(id: document.id, maxDimension: Int.max)
        #expect(image.width == 1600 && image.height == 1200)
        let thumbnail = try await collection.preview(id: document.id)
        #expect(thumbnail.width == 240 && thumbnail.height == 180)
        for index in [-1, document.pageCount, Int.max] {
            await #expect(throws: PDFToolError.invalidDocument) {
                try await collection.preview(id: document.id, pageIndex: index)
            }
        }
        await #expect(throws: PDFToolError.renderFailed) {
            try await collection.preview(id: document.id, maxDimension: 0)
        }
        let request = Task {
            withUnsafeCurrentTask { $0?.cancel() }
            return try await collection.preview(id: document.id)
        }
        await #expect(throws: PDFToolError.cancelled) { try await request.value }
        await collection.remove(id: document.id)
        await #expect(throws: PDFToolError.invalidOrder) { try await collection.preview(id: document.id) }
    }

    @Test func previewsTheSelectedPageWithItsOwnContentAndRotatedCropBox() async throws {
        let data = NSMutableData()
        let consumer = try #require(CGDataConsumer(data: data))
        var media = CGRect(x: 0, y: 0, width: 300, height: 400)
        let context = try #require(CGContext(consumer: consumer, mediaBox: &media, nil))
        for color in [CGColor(red: 1, green: 0, blue: 0, alpha: 1), CGColor(red: 0, green: 0, blue: 1, alpha: 1)] {
            context.beginPDFPage(nil)
            context.setFillColor(color)
            context.fill(media)
            context.endPDFPage()
        }
        context.closePDF()
        let source = try #require(PDFDocument(data: data as Data))
        let first = try #require(source.page(at: 0))
        first.rotation = 90
        first.setBounds(CGRect(x: 10, y: 20, width: 270, height: 360), for: .cropBox)
        let collection = PDFMergeCollection()
        let info = try await collection.add(data: #require(source.dataRepresentation()))
        let red = try await collection.preview(id: info.id, pageIndex: 0, maxDimension: 400)
        let blue = try await collection.preview(id: info.id, pageIndex: 1, maxDimension: 400)
        #expect(red.width == 400 && red.height == 300)
        #expect(blue.width == 300 && blue.height == 400)
        for (image, dominantChannel) in [(red, 0), (blue, 2)] {
            let pixels = try #require(image.dataProvider?.data) as Data
            let offset = image.bytesPerRow * (image.height / 2) + (image.width / 2) * 4
            // PDFKit applies color management; distinguish page content without requiring identical RGB values.
            #expect(pixels[offset + dominantChannel] > 240)
            for channel in 0..<3 where channel != dominantChannel {
                #expect(pixels[offset + channel] < 80)
            }
        }
    }

    private func widget(_ document: PDFDocument, page: Int) throws -> PDFAnnotation {
        try #require(document.page(at: page)?.annotations.first { $0.widgetFieldType == .text })
    }

    private func signature() throws -> SignatureImage {
        let context = try #require(CGContext(data: nil, width: 100, height: 50, bitsPerComponent: 8, bytesPerRow: 0,
                                             space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
        context.setFillColor(CGColor(gray: 0, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: 100, height: 50))
        let data = NSMutableData()
        let destination = try #require(CGImageDestinationCreateWithData(data, UTType.png.identifier as CFString, 1, nil))
        CGImageDestinationAddImage(destination, try #require(context.makeImage()), nil)
        #expect(CGImageDestinationFinalize(destination))
        return try SignatureImage.load(data: data as Data)
    }
}
