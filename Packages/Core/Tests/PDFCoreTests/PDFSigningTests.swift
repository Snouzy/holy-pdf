import CoreGraphics
import Foundation
import ImageIO
import PDFKit
import Testing
import TestSupport
import UniformTypeIdentifiers
@testable import PDFCore

struct PDFSigningTests {
    /// The one mark of the tests that place a single image.
    private let mark = UUID()

    @Test func eachPlacementShowsItsOwnMark() async throws {
        let signer = try PDFSigningDocument(data: fixture())
        let red = UUID(), blue = UUID()
        let marks = [red: try SignatureImage.load(data: image()), blue: try SignatureImage.load(data: image(color: CGColor(red: 0, green: 0, blue: 1, alpha: 1)))]
        let output = try await signer.signedData(marks: marks, placements: [
            SignaturePlacement(pageIndex: 0, bounds: CGRect(x: 0.05, y: 0.05, width: 0.4, height: 0.2), mark: red),
            SignaturePlacement(pageIndex: 0, bounds: CGRect(x: 0.55, y: 0.7, width: 0.4, height: 0.2), mark: blue),
        ])
        let shown = Bitmap(try await PDFSigningDocument(data: output).preview(pageIndex: 0, maxDimension: 600))
        // The left half of each image is painted: the top-left placement shows red, the bottom-right one blue.
        let top = shown.rgb(x: Int(Double(shown.width) * 0.1), y: Int(Double(shown.height) * 0.15))
        #expect(top.red > 200 && top.blue < 70, "\(top)")
        let bottom = shown.rgb(x: Int(Double(shown.width) * 0.6), y: Int(Double(shown.height) * 0.8))
        #expect(bottom.blue > 200 && bottom.red < 70, "\(bottom)")
        await #expect(throws: PDFToolError.invalidPlacement, "A placement whose mark is unknown has nothing to show") {
            try await signer.signedData(marks: marks, placements: [SignaturePlacement(pageIndex: 0, bounds: CGRect(x: 0.1, y: 0.1, width: 0.2, height: 0.1), mark: UUID())])
        }
    }

    @Test func aTypedLineBecomesAMarkOnATransparentGround() async throws {
        let written = try SignatureImage.text("Ada Lovelace", style: .handwritten)
        let plain = try SignatureImage.text("Ada Lovelace", style: .plain)
        #expect(written.width > written.height * 3 && written.width <= 1600)
        #expect(written.dataPNG != plain.dataPNG, "Two styles, two drawings")
        #expect(alpha(of: written, x: 0, y: 0) == 0, "Transparent ground")
        // On the blank top of a page, the ink shows where the mark goes and nowhere else.
        let signer = try PDFSigningDocument(data: fixture())
        let bare = Bitmap(try await signer.preview(pageIndex: 0, maxDimension: 600))
        let output = try await signer.signedData(marks: [mark: written], placements: [SignaturePlacement(pageIndex: 0, bounds: CGRect(x: 0.1, y: 0.05, width: 0.8, height: 0.15), mark: mark)])
        let shown = Bitmap(try await PDFSigningDocument(data: output).preview(pageIndex: 0, maxDimension: 600))
        func dark(_ bitmap: Bitmap, _ box: CGRect) -> Int {
            (Int(box.minY * Double(bitmap.height))..<Int(box.maxY * Double(bitmap.height))).reduce(0) { total, y in
                total + (Int(box.minX * Double(bitmap.width))..<Int(box.maxX * Double(bitmap.width))).count { bitmap.gray(x: $0, y: y, radius: 0) < 100 }
            }
        }
        #expect(dark(bare, CGRect(x: 0, y: 0, width: 1, height: 0.25)) == 0, "The top of the fixture is blank")
        #expect(dark(shown, CGRect(x: 0.1, y: 0.05, width: 0.8, height: 0.15)) > 50)
        #expect(dark(shown, CGRect(x: 0, y: 0.2, width: 1, height: 0.05)) == 0, "Nothing below the mark's box")
        // Letters with marks above and below, in a stand-in font: nothing is cut at the edges of the picture.
        let tall = try SignatureImage.text("Nguyễn Văn Ặ", style: .handwritten)
        #expect((0..<tall.height).allSatisfy { alpha(of: tall, x: tall.width - 1, y: $0) == 0 && alpha(of: tall, x: 0, y: $0) == 0 })
        #expect((0..<tall.width).allSatisfy { alpha(of: tall, x: $0, y: 0) == 0 && alpha(of: tall, x: $0, y: tall.height - 1) == 0 })
        #expect(throws: PDFToolError.invalidImage) { try SignatureImage.text("   ", style: .plain) }
        #expect(throws: PDFToolError.invalidImage) { try SignatureImage.text(String(repeating: "a", count: 121), style: .plain) }
    }

    @Test func rejectsInvalidAndDigitallySignedDocuments() throws {
        #expect(throws: PDFToolError.invalidDocument) { try PDFSigningDocument(data: Data("not PDF".utf8)) }
        #expect(throws: PDFToolError.alreadySigned) { try PDFSigningDocument(data: fixture(signed: true)) }
        #expect(throws: PDFToolError.alreadySigned) { try PDFSigningDocument(data: fixture(certified: true)) }
        #expect(throws: PDFToolError.alreadySigned) { try PDFSigningDocument(data: fixture(inheritedSignature: true)) }
        _ = try PDFSigningDocument(data: fixture(emptySignature: true))
    }

    @Test func opensAFormWithAdobeUsageRights() throws {
        _ = try PDFSigningDocument(data: fixture(usageRights: true))
    }

    @Test func persistentSignatureKeepsTextLinksFieldsOutlineAndTitle() async throws {
        let source = fixture()
        let signer = try PDFSigningDocument(data: source)
        let signature = try SignatureImage.load(data: image())
        let placement = SignaturePlacement(pageIndex: 0, bounds: CGRect(x: 0.1, y: 0.5, width: 0.4, height: 0.2), mark: mark)
        let output = try await signer.signedData(marks: [mark: signature], placements: [placement])
        let document = try #require(PDFDocument(data: output))
        let page = try #require(document.page(at: 0))
        #expect(document.string?.contains("Keep selectable text") == true)
        #expect(document.documentAttributes?[PDFDocumentAttribute.titleAttribute] as? String == "Keep title")
        #expect(document.outlineRoot?.child(at: 0)?.label == "Chapter")
        #expect(page.annotations.first(where: { $0.type == "Link" })?.url?.absoluteString == "https://example.com")
        let widget = try #require(page.annotations.first(where: { $0.widgetFieldType == .text }))
        #expect(widget.fieldName == "Person")
        #expect(widget.widgetStringValue == "Ada")
        let stamp = try #require(page.annotations.first(where: { $0.type == "Stamp" }))
        #expect(stamp.hasAppearanceStream)
        #expect(stamp.shouldPrint)
        #expect(stamp.userName == nil)
        let original = try #require(PDFDocument(data: source))
        #expect(original.page(at: 0)?.annotations.contains(where: { $0.type == "Stamp" }) == false)
    }

    @Test(arguments: [0, 90, 180, 270]) func cropAndRotationKeepPlacementAndTransparency(rotation: Int) async throws {
        let signer = try PDFSigningDocument(data: fixture(rotation: rotation, crop: true))
        let info = await signer.information()
        #expect(info.pageSizes == [rotation % 180 == 0 ? CGSize(width: 220, height: 300) : CGSize(width: 300, height: 220)])
        let before = Bitmap(try await signer.preview(pageIndex: 0, maxDimension: 600))
        let signature = try SignatureImage.load(data: image())
        let output = try await signer.signedData(marks: [mark: signature], placements: [
            SignaturePlacement(pageIndex: 0, bounds: CGRect(x: 0.1, y: 0.1, width: 0.4, height: 0.3), mark: mark),
        ])
        let reload = try PDFSigningDocument(data: output)
        let after = Bitmap(try await reload.preview(pageIndex: 0, maxDimension: 600))
        let color = after.rgb(x: Int(Double(after.width) * 0.15), y: Int(Double(after.height) * 0.2))
        #expect(color.red > 200 && color.green < 70 && color.blue < 70)
        let clearX = Int(Double(after.width) * 0.4)
        let clearY = Int(Double(after.height) * 0.2)
        #expect(abs(after.gray(x: clearX, y: clearY) - before.gray(x: clearX, y: clearY)) < 2)
        let unchanged = Bitmap(try await signer.preview(pageIndex: 0, maxDimension: 600))
        #expect(abs(unchanged.gray(x: clearX, y: clearY) - before.gray(x: clearX, y: clearY)) < 2)
    }

    @Test func repeatedExportsStartFromTheOriginalAndCanTargetSeveralPages() async throws {
        let source = try #require(PDFDocument(data: fixture()))
        let secondPage = try #require(PDFDocument(data: fixture()).flatMap { $0.page(at: 0) })
        source.insert(secondPage, at: 1)
        let signer = try PDFSigningDocument(data: #require(source.dataRepresentation()))
        let signature = try SignatureImage.load(data: image())
        let first = SignaturePlacement(pageIndex: 0, bounds: CGRect(x: 0.1, y: 0.6, width: 0.2, height: 0.1), mark: mark)
        let second = SignaturePlacement(pageIndex: 1, bounds: CGRect(x: 0.5, y: 0.6, width: 0.2, height: 0.1), mark: mark)
        let both = try await signer.signedData(marks: [mark: signature], placements: [first, second])
        let onlySecond = try await signer.signedData(marks: [mark: signature], placements: [second])
        let bothDocument = try #require(PDFDocument(data: both))
        let lastDocument = try #require(PDFDocument(data: onlySecond))
        #expect(bothDocument.page(at: 0)?.annotations.filter { $0.type == "Stamp" }.count == 1)
        #expect(bothDocument.page(at: 1)?.annotations.filter { $0.type == "Stamp" }.count == 1)
        #expect(lastDocument.page(at: 0)?.annotations.contains { $0.type == "Stamp" } == false)
        #expect(lastDocument.page(at: 1)?.annotations.filter { $0.type == "Stamp" }.count == 1)
    }

    @Test func lockedInputExportsWithoutAPasswordAndKeepsTheSourceLocked() async throws {
        let document = try #require(PDFDocument(data: fixture()))
        let source = try #require(document.dataRepresentation(options: [
            PDFDocumentWriteOption.ownerPasswordOption: "owner", PDFDocumentWriteOption.userPasswordOption: "secret",
        ]))
        #expect(throws: PDFToolError.passwordRequired) { try PDFSigningDocument(data: source) }
        #expect(throws: PDFToolError.wrongPassword) { try PDFSigningDocument(data: source, password: "wrong") }
        let signer = try PDFSigningDocument(data: source, password: "secret")
        #expect(await signer.information().isEncrypted)
        let output = try await signer.signedData(marks: [mark: try SignatureImage.load(data: image())], placements: [
            SignaturePlacement(pageIndex: 0, bounds: CGRect(x: 0.1, y: 0.5, width: 0.4, height: 0.2), mark: mark),
        ])
        _ = try PDFSigningDocument(data: output)
        let reloaded = try #require(PDFDocument(data: output))
        #expect(!reloaded.isLocked)
        #expect(reloaded.string?.contains("Keep selectable text") == true)
        #expect(PDFDocument(data: source)?.isLocked == true)
    }

    @Test func refusesInvalidPlacementsAndBoundsThePreview() async throws {
        let signer = try PDFSigningDocument(data: fixture())
        let signature = try SignatureImage.load(data: image())
        for bounds in [CGRect(x: -0.1, y: 0, width: 0.2, height: 0.1),
                       CGRect(x: 0.9, y: 0, width: 0.2, height: 0.1),
                       CGRect(x: 0.1, y: 0, width: -0.3, height: 0.1),
                       CGRect(x: 0, y: 0.1, width: 0.2, height: -0.3),
                       CGRect(x: 0, y: 0, width: 0, height: 0.1),
                       CGRect(x: .infinity, y: 0, width: 0.2, height: 0.1)] {
            await #expect(throws: PDFToolError.invalidPlacement) {
                try await signer.signedData(marks: [mark: signature], placements: [SignaturePlacement(pageIndex: 0, bounds: bounds, mark: mark)])
            }
        }
        await #expect(throws: PDFToolError.invalidPlacement) { try await signer.signedData(marks: [mark: signature], placements: []) }
        await #expect(throws: PDFToolError.invalidPlacement) { try await signer.preview(pageIndex: 2) }
        let preview = try await signer.preview(pageIndex: 0, maxDimension: Int.max)
        #expect(max(preview.width, preview.height) == 1600)
    }

    @Test func importedSignatureIsBoundedOrientedAndStrippedOfMetadata() throws {
        let large = try SignatureImage.load(data: image(width: 3000, height: 1200))
        #expect(large.width <= 1600 && large.height <= 1600 && large.width * large.height <= 1_000_000)
        let jpeg = try image(width: 100, height: 50, jpeg: true, orientation: 6)
        let jpegSource = try #require(CGImageSourceCreateWithData(jpeg as CFData, nil))
        let originalProperties = try #require(CGImageSourceCopyPropertiesAtIndex(jpegSource, 0, nil) as? [CFString: Any])
        #expect(originalProperties[kCGImagePropertyGPSDictionary] != nil)
        let oriented = try SignatureImage.load(data: jpeg)
        #expect(oriented.width == 50 && oriented.height == 100)
        let source = try #require(CGImageSourceCreateWithData(oriented.dataPNG as CFData, nil))
        let properties = try #require(CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any])
        #expect(properties[kCGImagePropertyGPSDictionary] == nil)
        #expect(properties[kCGImagePropertyOrientation] == nil || (properties[kCGImagePropertyOrientation] as? NSNumber)?.intValue == 1)
    }

    @Test func cancelledPreviewDoesNotRender() async throws {
        let signer = try PDFSigningDocument(data: fixture())
        let request = Task {
            withUnsafeCurrentTask { $0?.cancel() }
            return try await signer.preview(pageIndex: 0)
        }
        await #expect(throws: PDFToolError.renderFailed) { try await request.value }
    }

    @Test func refusesOversizedAndInvalidImagesBeforeDecoding() throws {
        #expect(throws: PDFToolError.invalidImage) { try SignatureImage.load(data: Data("bad image".utf8)) }
        #expect(throws: PDFToolError.imageTooLarge) { try SignatureImage.load(data: Data(repeating: 0, count: 10 * 1024 * 1024 + 1)) }
        var oversized = try image(jpeg: true)
        let frame = try #require((0..<(oversized.count - 9)).first {
            oversized[$0] == 0xff && [UInt8(0xc0), 0xc1, 0xc2].contains(oversized[$0 + 1])
        })
        oversized.replaceSubrange((frame + 5)..<(frame + 9), with: [0x13, 0x88, 0x13, 0x88])
        #expect(throws: PDFToolError.imageTooLarge) { try SignatureImage.load(data: oversized) }
    }

    /// The alpha of one pixel of a mark's PNG, 0 to 255.
    private func alpha(of mark: SignatureImage, x: Int, y: Int) -> UInt8 {
        guard let source = CGImageSourceCreateWithData(mark.dataPNG as CFData, nil), let image = CGImageSourceCreateImageAtIndex(source, 0, nil),
              let data = image.dataProvider?.data, let bytes = CFDataGetBytePtr(data) else { return 255 }
        return bytes[y * image.bytesPerRow + x * (image.bitsPerPixel / 8) + 3]
    }

    private func image(width: Int = 100, height: Int = 50, jpeg: Bool = false, orientation: Int = 1, color: CGColor = CGColor(red: 1, green: 0, blue: 0, alpha: 1)) throws -> Data {
        let space = try #require(CGColorSpace(name: CGColorSpace.sRGB))
        let context = try #require(CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
                                             space: space, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
        context.setFillColor(color)
        context.fill(CGRect(x: 0, y: 0, width: width / 2, height: height))
        let data = NSMutableData()
        let destination = try #require(CGImageDestinationCreateWithData(data, (jpeg ? UTType.jpeg : UTType.png).identifier as CFString, 1, nil))
        var properties: [CFString: Any] = [kCGImagePropertyOrientation: orientation]
        if jpeg {
            properties[kCGImagePropertyGPSDictionary] = [kCGImagePropertyGPSLatitude: 48.0, kCGImagePropertyGPSLatitudeRef: "N"]
        }
        CGImageDestinationAddImage(destination, try #require(context.makeImage()), properties as CFDictionary)
        #expect(CGImageDestinationFinalize(destination))
        return data as Data
    }

    private func fixture(rotation: Int = 0, crop: Bool = false, signed: Bool = false, certified: Bool = false,
                         inheritedSignature: Bool = false, emptySignature: Bool = false, usageRights: Bool = false) -> Data {
        let signatureField = signed || inheritedSignature || emptySignature
        let content = "0.8 g 0 0 300 400 re f 0 g BT /F1 12 Tf 60 170 Td (Keep selectable text) Tj ET"
        var objects = [
            "<</Type/Catalog/Pages 2 0 R/AcroForm<</Fields[8 0 R \(signatureField ? "11 0 R" : "") ]>>/Outlines 9 0 R\(certified ? "/Perms<</DocMDP 12 0 R>>" : "")\(usageRights ? "/Perms<</UR3 12 0 R>>" : "")>>",
            "<</Type/Pages/Count 1/Kids[3 0 R]>>",
            "<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 400]\(crop ? "/CropBox[40 50 260 350]" : "")/Rotate \(rotation)/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R/Annots[7 0 R 8 0 R]>>",
            "<</Length \(content.utf8.count)>>stream\n\(content)\nendstream",
            "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
            "<</Title(Keep title)>>",
            "<</Type/Annot/Subtype/Link/Rect[40 250 130 270]/A<</S/URI/URI(https://example.com)>>>>",
            "<</Type/Annot/Subtype/Widget/FT/Tx/T(Person)/V(Ada)/Rect[40 220 130 240]/P 3 0 R>>",
            "<</Type/Outlines/First 10 0 R/Last 10 0 R/Count 1>>",
            "<</Title(Chapter)/Parent 9 0 R/Dest[3 0 R /Fit]>>",
            inheritedSignature ? "<</FT/Sig/Kids[13 0 R]>>" : "<</FT/Sig/T(Signature)\(emptySignature ? "" : "/V 12 0 R")>>",
            "<</Type/Sig/Filter/Adobe.PPKLite/SubFilter/adbe.pkcs7.detached/ByteRange[0 1 2 3]/Contents<00>>>",
        ]
        if inheritedSignature { objects.append("<</Parent 11 0 R/T(Child)/V 12 0 R>>") }
        return serialize(objects: objects, info: 6)
    }
}
