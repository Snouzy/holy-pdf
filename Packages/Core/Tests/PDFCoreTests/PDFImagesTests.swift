import CoreGraphics
import Foundation
import ImageIO
import PDFKit
import Testing
import UniformTypeIdentifiers
@testable import PDFCore

/// A picture of `width` × `height` pixels with a red left half, encoded as `type`, with an EXIF orientation.
private func picture(width: Int, height: Int, type: UTType = .jpeg, orientation: Int = 1, alpha: Bool = false) throws -> Data {
    let info = alpha ? CGImageAlphaInfo.premultipliedLast : CGImageAlphaInfo.noneSkipLast
    let context = try #require(CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
                                         space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: info.rawValue))
    if !alpha {
        context.setFillColor(CGColor(red: 0, green: 0, blue: 1, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    }
    context.setFillColor(CGColor(red: 1, green: 0, blue: 0, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: width / 2, height: height))
    let image = try #require(context.makeImage())
    let data = NSMutableData()
    let destination = try #require(CGImageDestinationCreateWithData(data, type.identifier as CFString, 1, nil))
    CGImageDestinationAddImage(destination, image, [kCGImagePropertyOrientation: orientation] as CFDictionary)
    try #require(CGImageDestinationFinalize(destination))
    return data as Data
}

/// A file of several pictures, as an office scanner writes a TIFF or as an animation is saved in a GIF.
private func frames(_ count: Int, type: UTType) throws -> Data {
    let data = NSMutableData()
    let destination = try #require(CGImageDestinationCreateWithData(data, type.identifier as CFString, count, nil))
    for index in 0..<count {
        let wide = index.isMultiple(of: 2)
        let context = try #require(CGContext(data: nil, width: wide ? 300 : 150, height: wide ? 150 : 300, bitsPerComponent: 8, bytesPerRow: 0,
                                             space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue))
        context.setFillColor(CGColor(gray: 0.5, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: 300, height: 300))
        CGImageDestinationAddImage(destination, try #require(context.makeImage()), nil)
    }
    try #require(CGImageDestinationFinalize(destination))
    return data as Data
}

struct PDFImagePagesTests {
    @Test func eachPageOfAScannedTIFFIsAPicture() throws {
        let scan = try frames(3, type: .tiff)
        #expect(PDFImagePages.pictures(in: scan) == 3)
        #expect(PDFImagePages.pictures(in: try picture(width: 10, height: 10)) == 1)
        #expect(PDFImagePages.pictures(in: try frames(4, type: .gif)) == 1, "An animation is one picture: its first")
        #expect(PDFImagePages.pictures(in: Data("not an image".utf8)) == 0)
        let output = try PDFImagePages.document(of: (0..<3).map { PDFImagePages.Picture(data: scan, frame: $0) })
        let document = try #require(PDFDocument(data: output))
        #expect(document.pageCount == 3)
        let sizes = (0..<3).compactMap { document.page(at: $0)?.bounds(for: .mediaBox).size }
        #expect(sizes.map { $0.width > $0.height } == [true, false, true], "Each frame has its own shape")
        #expect(throws: PDFToolError.invalidImage) { try PDFImagePages.document(of: [PDFImagePages.Picture(data: scan, frame: 3)]) }
    }

    @Test func aPhotoLosesWhereAndByWhomItWasTaken() throws {
        let context = try #require(CGContext(data: nil, width: 300, height: 200, bitsPerComponent: 8, bytesPerRow: 0,
                                             space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue))
        context.setFillColor(CGColor(red: 0.2, green: 0.6, blue: 0.3, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: 300, height: 200))
        let image = try #require(context.makeImage())
        let data = NSMutableData()
        let destination = try #require(CGImageDestinationCreateWithData(data, UTType.jpeg.identifier as CFString, 1, nil))
        CGImageDestinationAddImage(destination, image, [
            kCGImagePropertyGPSDictionary: [kCGImagePropertyGPSLatitude: 48.8584, kCGImagePropertyGPSLatitudeRef: "N"],
            kCGImagePropertyExifDictionary: [kCGImagePropertyExifUserComment: "SECRETCOMMENT"],
            kCGImagePropertyTIFFDictionary: [kCGImagePropertyTIFFArtist: "SECRETARTIST"],
        ] as CFDictionary)
        try #require(CGImageDestinationFinalize(destination))
        let photo = data as Data
        try #require(photo.range(of: Data("SECRETCOMMENT".utf8)) != nil && photo.range(of: Data("SECRETARTIST".utf8)) != nil)
        let output = try PDFImagePages.document(of: [PDFImagePages.Picture(data: photo)])
        #expect(output.range(of: Data("SECRETCOMMENT".utf8)) == nil)
        #expect(output.range(of: Data("SECRETARTIST".utf8)) == nil)
        #expect(output.range(of: photo.suffix(120)) != nil, "The picture itself is not compressed a second time")
    }

    @Test func eachImageTakesAnA4PageTurnedToItsShape() throws {
        let wide = try picture(width: 400, height: 200)
        let tall = try picture(width: 200, height: 400)
        let output = try PDFImagePages.document(of: [wide, tall].map { PDFImagePages.Picture(data: $0) })
        let document = try #require(PDFDocument(data: output))
        #expect(document.pageCount == 2)
        let first = try #require(document.page(at: 0)?.bounds(for: .mediaBox).size)
        let second = try #require(document.page(at: 1)?.bounds(for: .mediaBox).size)
        #expect(abs(first.width - 841.89) < 0.01 && abs(first.height - 595.28) < 0.01)
        #expect(abs(second.width - 595.28) < 0.01 && abs(second.height - 841.89) < 0.01)
        #expect(document.documentAttributes?[PDFDocumentAttribute.creatorAttribute] as? String == "Holy PDF")
    }

    @Test func aJPEGIsEmbeddedAsItIs() throws {
        let photo = try picture(width: 400, height: 200)
        let output = try PDFImagePages.document(of: [PDFImagePages.Picture(data: photo)])
        #expect(output.range(of: photo.suffix(200)) != nil, "The bytes of the JPEG are in the PDF: no second compression")
    }

    @Test func theImageIsFittedAndCenteredOnItsPage() async throws {
        // 400 × 200 on a landscape A4: full width, 421 points high, centered.
        let output = try PDFImagePages.document(of: [PDFImagePages.Picture(data: try picture(width: 400, height: 200))])
        let shown = pixels(of: try await PDFOpenedDocument(data: output).preview(pageIndex: 0, maxDimension: 400))
        #expect(shown.filter { $0.y < 0.12 || $0.y > 0.88 }.allSatisfy { $0.red > 230 && $0.blue > 230 }, "White bands above and under")
        #expect(shown.filter { $0.x < 0.45 && $0.y > 0.2 && $0.y < 0.8 }.allSatisfy { $0.red > 200 && $0.blue < 80 }, "Red on the left")
        #expect(shown.filter { $0.x > 0.55 && $0.y > 0.2 && $0.y < 0.8 }.allSatisfy { $0.blue > 200 && $0.red < 80 }, "Blue on the right")
    }

    @Test func aPhotoTakenSidewaysIsSetUpright() async throws {
        // Orientation 6: the camera was turned; the picture must be shown rotated by 90 degrees clockwise.
        let sideways = try picture(width: 400, height: 200, orientation: 6)
        let document = try PDFOpenedDocument(data: try PDFImagePages.document(of: [PDFImagePages.Picture(data: sideways)]))
        #expect(document.info.pageSizes[0].height > document.info.pageSizes[0].width, "A portrait page for a picture that is tall once upright")
        let shown = pixels(of: try await document.preview(pageIndex: 0, maxDimension: 400))
        #expect(shown.filter { $0.y < 0.45 && $0.x > 0.2 && $0.x < 0.8 }.allSatisfy { $0.red > 200 && $0.blue < 80 }, "The red half is on top")
    }

    @Test func aPNGWithTransparencyLandsOnWhite() async throws {
        let png = try picture(width: 300, height: 300, type: .png, alpha: true)
        let shown = pixels(of: try await PDFOpenedDocument(data: try PDFImagePages.document(of: [PDFImagePages.Picture(data: png)])).preview(pageIndex: 0, maxDimension: 400))
        #expect(shown.filter { $0.x > 0.6 && $0.y > 0.4 && $0.y < 0.6 }.allSatisfy { $0.red > 230 && $0.green > 230 && $0.blue > 230 })
        #expect(shown.contains { $0.x < 0.4 && $0.red > 200 && $0.green < 80 })
    }

    @Test func refusesWhatIsNotAnImage() throws {
        #expect(throws: PDFToolError.invalidOrder) { try PDFImagePages.document(of: []) }
        #expect(throws: PDFToolError.invalidImage) { try PDFImagePages.document(of: [PDFImagePages.Picture(data: try picture(width: 10, height: 10)), PDFImagePages.Picture(data: Data("not an image".utf8))]) }
    }
}

struct PDFPageImagesTests {
    @Test func eachPageBecomesAJPEGAtTheChosenResolution() throws {
        let source = fixture("Pages")
        for (quality, sizes) in [(PDFPageImages.Quality.normal, [CGSize(width: 563, height: 750), CGSize(width: 625, height: 833)]),
                                 (.high, [CGSize(width: 1125, height: 1500), CGSize(width: 1250, height: 1667)])] {
            var written: [(Int, Data)] = []
            try PDFPageImages.export(source, quality: quality) { index, jpeg in written.append((index, jpeg)) }
            #expect(written.map(\.0) == [0, 1])
            for (index, jpeg) in written {
                let image = try #require(CGImageSourceCreateWithData(jpeg as CFData, nil))
                #expect(CGImageSourceGetType(image) as String? == UTType.jpeg.identifier)
                let picture = try #require(CGImageSourceCreateImageAtIndex(image, 0, nil))
                // The first page is cropped to 270 × 360 points, the second is 300 × 400.
                #expect(abs(CGFloat(picture.width) - sizes[index].width) <= 1 && abs(CGFloat(picture.height) - sizes[index].height) <= 1,
                        "\(picture.width) × \(picture.height)")
            }
        }
    }

    @Test func theImageShowsThePageAsTheReaderSeesIt() throws {
        var first: Data?
        try PDFPageImages.export(fixture("Seen", rotation: 90), quality: .normal) { index, jpeg in if index == 0 { first = jpeg } }
        let jpeg = try #require(first)
        let source = try #require(CGImageSourceCreateWithData(jpeg as CFData, nil))
        let image = try #require(CGImageSourceCreateImageAtIndex(source, 0, nil))
        #expect(image.width > image.height, "The page is rotated: the image is wide")
        #expect(pixels(of: image).contains { $0.red < 90 && $0.green < 90 && $0.blue < 90 }, "The text is drawn")
    }

    @Test func aSignedPDFCanBeTurnedIntoImages() throws {
        var pages = 0
        try PDFPageImages.export(fixture("Signed", digitalSignature: true), quality: .normal) { _, _ in pages += 1 }
        #expect(pages == 2)
    }

    @Test func stopsWhenAnImageCannotBeWrittenAndAsksForThePassword() throws {
        struct Full: Error {}
        var calls = 0
        #expect(throws: PDFToolError.writeFailed) {
            try PDFPageImages.export(fixture("Disk"), quality: .normal) { _, _ in
                calls += 1
                throw Full()
            }
        }
        #expect(calls == 1)
        let locked = try #require(PDFDocument(data: fixture("Locked"))?.dataRepresentation(options: [
            PDFDocumentWriteOption.userPasswordOption: "open", PDFDocumentWriteOption.ownerPasswordOption: "owner",
        ]))
        #expect(throws: PDFToolError.passwordRequired) { try PDFPageImages.export(locked, quality: .normal) { _, _ in } }
        var pages = 0
        try PDFPageImages.export(locked, password: "open", quality: .normal) { _, _ in pages += 1 }
        #expect(pages == 2)
    }
}
