import CoreGraphics
import Foundation
import ImageIO
import PDFKit
import Testing
import UniformTypeIdentifiers
@testable import PDFCore

private extension PDFOpenedDocument {
    nonisolated func previewSync(pageIndex: Int, maxDimension: Int) throws -> CGImage {
        let document = try PDFDocumentValidation.open(data, password: password)
        guard let page = document.page(at: pageIndex) else { throw PDFToolError.renderFailed }
        return try render(page, size: info.pageSizes[pageIndex], maxDimension: maxDimension)
    }
}

struct PDFPhotosTests {
    private func bitmap(width: Int, height: Int, color: CGColor, alpha: Bool = false) throws -> CGImage {
        let info = alpha ? CGImageAlphaInfo.premultipliedLast.rawValue : CGImageAlphaInfo.noneSkipLast.rawValue
        let context = try #require(CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
                                             space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: info))
        context.setFillColor(color)
        // With alpha, the left half stays clear.
        context.fill(CGRect(x: alpha ? width / 2 : 0, y: 0, width: alpha ? width / 2 : width, height: height))
        return try #require(context.makeImage())
    }

    /// Letter pages; `draw` paints each page.
    private func pdf(pages: Int, rotation: Int = 0, draw: (CGContext, Int) throws -> Void) throws -> Data {
        let data = NSMutableData()
        let consumer = try #require(CGDataConsumer(data: data))
        var box = CGRect(x: 0, y: 0, width: 612, height: 792)
        let context = try #require(CGContext(consumer: consumer, mediaBox: &box, nil))
        for index in 0..<pages {
            context.beginPDFPage(nil)
            try draw(context, index)
            context.endPDFPage()
        }
        context.closePDF()
        guard rotation != 0 else { return data as Data }
        let document = try #require(PDFDocument(data: data as Data))
        for index in 0..<pages { document.page(at: index)?.rotation = rotation }
        return try #require(document.dataRepresentation())
    }

    private func photos(_ data: Data, password: String = "") throws -> [(Data, [Int])] {
        var found: [(Data, [Int])] = []
        var steps: [Int] = []
        try PDFPhotos.export(data, password: password, progress: { done, _ in steps.append(done) }) { jpeg in found.append((jpeg, steps)) }
        return found
    }

    private func size(_ jpeg: Data) throws -> (Int, Int) {
        let source = try #require(CGImageSourceCreateWithData(jpeg as CFData, nil))
        let properties = try #require(CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any])
        return (properties[kCGImagePropertyPixelWidth] as? Int ?? 0, properties[kCGImagePropertyPixelHeight] as? Int ?? 0)
    }

    private func middle(_ jpeg: Data, x: Double = 0.5) throws -> (red: Double, green: Double, blue: Double) {
        let source = try #require(CGImageSourceCreateWithData(jpeg as CFData, nil))
        let image = try #require(CGImageSourceCreateImageAtIndex(source, 0, nil))
        let pixel = try #require(pixels(of: image).min { hypot($0.x - x, $0.y - 0.5) < hypot($1.x - x, $1.y - 0.5) })
        return (pixel.red, pixel.green, pixel.blue)
    }

    @Test func aJPEGComesOutAsItWentInAndAPaintedPictureAtItsOwnPixels() throws {
        let original = try #require(jpegData(try bitmap(width: 300, height: 200, color: CGColor(red: 1, green: 0, blue: 0, alpha: 1)), quality: 0.8))
        let photo = try #require(PDFWriter.jpegImage(original))
        let blue = try bitmap(width: 120, height: 90, color: CGColor(red: 0, green: 0, blue: 1, alpha: 1))
        let source = try pdf(pages: 1) { context, _ in
            context.draw(photo, in: CGRect(x: 72, y: 500, width: 150, height: 100))
            context.draw(blue, in: CGRect(x: 300, y: 100, width: 240, height: 180))
        }
        let found = try photos(source)
        try #require(found.count == 2)
        #expect(found[0].0 == original, "The JPEG of the PDF, byte for byte")
        #expect(try size(found[1].0) == (120, 90), "The painted picture at its own pixels, not at the size it is drawn")
        let color = try middle(found[1].0)
        #expect(color.blue > 200 && color.red < 60)
        #expect(try PDFPhotos.count(source) == 2)
    }

    @Test func smallPicturesAndRepeatsAreLeftOutAndTheOrderIsThePagesOrder() throws {
        let red = try bitmap(width: 100, height: 100, color: CGColor(red: 1, green: 0, blue: 0, alpha: 1))
        let green = try bitmap(width: 100, height: 100, color: CGColor(red: 0, green: 1, blue: 0, alpha: 1))
        let dot = try bitmap(width: 40, height: 63, color: CGColor(gray: 0, alpha: 1))
        let source = try pdf(pages: 3) { context, page in
            // The same logo on every page, a dot, and one picture of its own on pages 1 and 3.
            context.draw(green, in: CGRect(x: 500, y: 700, width: 60, height: 60))
            context.draw(dot, in: CGRect(x: 72, y: 72, width: 20, height: 30))
            if page != 1 { context.draw(page == 0 ? red : try bitmap(width: 100, height: 100, color: CGColor(red: 0, green: 0, blue: 1, alpha: 1)), in: CGRect(x: 72, y: 300, width: 200, height: 200)) }
        }
        let found = try photos(source)
        #expect(found.count == 3, "\(found.count) photos: the logo once, then the two pictures")
        let colors = try found.map { try middle($0.0) }
        #expect(colors[0].green > 200 && colors[1].red > 200 && colors[2].blue > 200, "\(colors)")
        #expect(found[2].1.last == 3, "The third photo came while reading page 3")
        #expect(try PDFPhotos.count(source) == 3)
    }

    @Test func aPictureWithAMaskIsDrawnOnWhiteAtItsOwnSize() throws {
        let half = try bitmap(width: 200, height: 100, color: CGColor(red: 1, green: 0, blue: 0, alpha: 1), alpha: true)
        let source = try pdf(pages: 1) { context, _ in context.draw(half, in: CGRect(x: 100, y: 300, width: 300, height: 150)) }
        let found = try photos(source)
        try #require(found.count == 1)
        let cut = try size(found[0].0)
        #expect(abs(cut.0 - 200) <= 2 && abs(cut.1 - 100) <= 2, "Its own pixels, as the page draws them: \(cut)")
        let source2 = try #require(CGImageSourceCreateWithData(found[0].0 as CFData, nil))
        let image = try #require(CGImageSourceCreateImageAtIndex(source2, 0, nil))
        let left = try #require(pixels(of: image).min { hypot($0.x - 0.25, $0.y - 0.5) < hypot($1.x - 0.25, $1.y - 0.5) })
        let right = try #require(pixels(of: image).min { hypot($0.x - 0.75, $0.y - 0.5) < hypot($1.x - 0.75, $1.y - 0.5) })
        #expect(left.green > 200 && left.red > 200, "The clear half is white")
        #expect(right.red > 200 && right.green < 60)
    }

    /// One Letter page whose content `place` draws `/Im0`, `/Im1`… : the image objects 5, 6…, each a dictionary and its
    /// bytes. `more` adds other stream objects after them, numbered on.
    private func page(images: [(String, Data)], place: String = "q 300 0 0 200 100 400 cm /Im0 Do Q", more: [(String, Data)] = []) -> Data {
        let names = images.indices.map { "/Im\($0) \($0 + 5) 0 R" }.joined()
        var objects: [Data] = [
            Data("<</Type/Catalog/Pages 2 0 R>>".utf8),
            Data("<</Type/Pages/Count 1/Kids[3 0 R]>>".utf8),
            Data("<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</XObject<<\(names)>>>>/Contents 4 0 R>>".utf8),
            Data("<</Length \(place.utf8.count)>>stream\n\(place)\nendstream".utf8),
        ]
        for (dictionary, bytes) in images.map({ ("<</Type/XObject/Subtype/Image" + $0.0, $0.1) }) + more {
            objects.append(Data("\(dictionary)/Length \(bytes.count)>>stream\n".utf8) + bytes + Data("\nendstream".utf8))
        }
        var result = Data("%PDF-1.7\n".utf8)
        var offsets: [Int] = []
        for (index, object) in objects.enumerated() {
            offsets.append(result.count)
            result += Data("\(index + 1) 0 obj\n".utf8) + object + Data("\nendobj\n".utf8)
        }
        let at = result.count
        result += Data("xref\n0 \(objects.count + 1)\n0000000000 65535 f \n".utf8)
        result += Data(offsets.map { String(format: "%010d 00000 n \n", $0) }.joined().utf8)
        result += Data("trailer\n<</Size \(objects.count + 1)/Root 1 0 R>>\nstartxref\n\(at)\n%%EOF\n".utf8)
        return result
    }

    private func page(image: String, stream: Data, place: String = "q 300 0 0 200 100 400 cm /Im0 Do Q") -> Data {
        page(images: [(image, stream)], place: place)
    }

    private func sound(_ jpeg: Data) -> Bool {
        guard let source = CGImageSourceCreateWithData(jpeg as CFData, nil),
              CGImageSourceCreateImageAtIndex(source, 0, [kCGImageSourceShouldCacheImmediately: true] as CFDictionary) != nil else { return false }
        return CGImageSourceGetStatusAtIndex(source, 0) == .statusComplete
    }

    @Test func aPictureThatLiesAboutItsSizeOrItsPlaceCrashesNothing() throws {
        // Two billion pixels a side, then a picture drawn so small it does not exist.
        let huge = page(image: "/Width 2000000000/Height 2000000000/ColorSpace/DeviceRGB/BitsPerComponent 8", stream: Data(repeating: 0x80, count: 300))
        #expect(try PDFPhotos.count(huge) == 0 && photos(huge).isEmpty, "A picture that cannot be a photo of a document is left out")
        let tiny = page(image: "/Width 100/Height 100/ColorSpace/DeviceGray/BitsPerComponent 8/Decode[1 0]", stream: Data(repeating: 0x40, count: 10_000),
                        place: "q 0.000000000000001 0 0 0.000000000000001 1 1 cm /Im0 Do Q")
        #expect(try photos(tiny).isEmpty, "Nothing to see, nothing to cut")
        let away = page(image: "/Width 100/Height 100/ColorSpace/DeviceRGB/BitsPerComponent 8", stream: Data(repeating: 0x40, count: 30_000),
                        place: "q 300 0 0 200 1000 1000 cm /Im0 Do Q")
        #expect(try photos(away).isEmpty && PDFPhotos.count(away) == 1, "Drawn off the page: counted, not shown, not written")
        let short = page(image: "/Width 100/Height 100/ColorSpace/DeviceRGB/BitsPerComponent 8", stream: Data(repeating: 0x40, count: 300),
                         place: "q 100 0 0 100 100 400 cm /Im0 Do Q")
        let shorts = try photos(short).map { try (sound($0.0), size($0.0)) }
        #expect(shorts.allSatisfy { $0.0 && $0.1 == (100, 100) }, "Fewer bytes than pixels: what comes out is a sound file at the declared size: \(shorts)")
        let whole = try #require(jpegData(try bitmap(width: 100, height: 100, color: CGColor(red: 1, green: 0, blue: 0, alpha: 1)), quality: 0.8))
        let torn = page(image: "/Width 100/Height 100/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode", stream: whole.prefix(whole.count * 6 / 10))
        let files = try photos(torn)
        #expect(files.allSatisfy { sound($0.0) }, "A JPEG cut off in the PDF is not copied as it is")
        let flagged = page(image: "/Width 100/Height 100/ColorSpace/DeviceGray/BitsPerComponent 8/ImageMask false", stream: Data(repeating: 0x40, count: 10_000))
        #expect(try PDFPhotos.count(flagged) == 1, "« ImageMask false » is no mask")
    }

    @Test func coloursFollowThePageNotTheBytes() throws {
        // A Display P3 picture: its bytes read as sRGB would give another green.
        let p3 = try #require(CGColorSpace(name: CGColorSpace.displayP3))
        let context = try #require(CGContext(data: nil, width: 120, height: 120, bitsPerComponent: 8, bytesPerRow: 0, space: p3, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue))
        context.setFillColor(CGColor(colorSpace: p3, components: [0, 0.8, 0.2, 1])!)
        context.fill(CGRect(x: 0, y: 0, width: 120, height: 120))
        let green = try #require(context.makeImage())
        let source = try pdf(pages: 1) { context, _ in context.draw(green, in: CGRect(x: 100, y: 400, width: 240, height: 240)) }
        let found = try photos(source)
        try #require(found.count == 1)
        let file = try middle(found[0].0)
        let shown = pixels(of: try PDFOpenedDocument(data: source).previewSync(pageIndex: 0, maxDimension: 600))
        let onPage = try #require(shown.min { hypot($0.x - 0.36, $0.y - 0.34) < hypot($1.x - 0.36, $1.y - 0.34) })
        #expect(abs(file.red - onPage.red) < 12 && abs(file.green - onPage.green) < 12 && abs(file.blue - onPage.blue) < 12, "file \(file), page \(onPage)")
        // A CMYK JPEG: ImageIO would hand it out inverted. It comes as the page shows it.
        let cmyk = try #require(CGColorSpace(name: CGColorSpace.genericCMYK))
        let ink = try #require(CGContext(data: nil, width: 100, height: 100, bitsPerComponent: 8, bytesPerRow: 0, space: cmyk, bitmapInfo: CGImageAlphaInfo.none.rawValue))
        ink.setFillColor(CGColor(colorSpace: cmyk, components: [1, 0, 0, 0, 1])!)
        ink.fill(CGRect(x: 0, y: 0, width: 100, height: 100))
        let inked = try #require(ink.makeImage())
        let cyan = try #require(jpegData(inked, quality: 0.9))
        let stamp = try #require(PDFWriter.jpegImage(cyan))
        let stamped = try pdf(pages: 1) { context, _ in context.draw(stamp, in: CGRect(x: 100, y: 400, width: 200, height: 200)) }
        let out = try photos(stamped)
        try #require(out.count == 1)
        let color = try middle(out[0].0)
        #expect(color.red < 90 && color.green > 120 && color.blue > 180, "cyan, not its negative: \(color)")
        // A JPEG whose profile is in the PDF, not in the file: copied as it is, it would lose the profile.
        let profile = try #require(p3.copyICCData() as Data?)
        let leaf = try #require(CGContext(data: nil, width: 100, height: 100, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue))
        leaf.setFillColor(CGColor(red: 0.2, green: 0.6, blue: 0.2, alpha: 1))
        leaf.fill(CGRect(x: 0, y: 0, width: 100, height: 100))
        let leafImage = try #require(leaf.makeImage())
        let bytes = try #require(jpegData(leafImage, quality: 0.9))
        let tagged = page(images: [("/Width 100/Height 100/ColorSpace[/ICCBased 6 0 R]/BitsPerComponent 8/Filter/DCTDecode", bytes)],
                          place: "q 200 0 0 200 100 400 cm /Im0 Do Q", more: [("<</N 3", profile)])
        let kept = try photos(tagged)
        try #require(kept.count == 1)
        #expect(kept[0].0 != bytes)
        let seen = try middle(kept[0].0)
        let page = pixels(of: try PDFOpenedDocument(data: tagged).previewSync(pageIndex: 0, maxDimension: 600))
        let there = try #require(page.min { hypot($0.x - 0.33, $0.y - 0.37) < hypot($1.x - 0.33, $1.y - 0.37) })
        #expect(abs(seen.red - there.red) < 12 && abs(seen.green - there.green) < 12 && abs(seen.blue - there.blue) < 12, "file \(seen), page \(there)")
    }

    @Test func theTextOfAScanStoredAsAMaskStaysOnItsBackground() throws {
        // Adaptive compression: a flat background and the sharp text as a one-bit mask on the same frame.
        let background = Data((0..<(192 * 192)).flatMap { _ in [UInt8(240), 224, 176] })
        let text = Data((0..<192).flatMap { _ in [UInt8](repeating: 0xFF, count: 12) + [UInt8](repeating: 0x00, count: 12) })
        let scan = page(images: [("/Width 192/Height 192/ColorSpace/DeviceRGB/BitsPerComponent 8", background),
                                 ("/Width 192/Height 192/ImageMask true/BitsPerComponent 1", text)],
                        place: "q 384 0 0 384 100 300 cm /Im0 Do Q q 384 0 0 384 100 300 cm /Im1 Do Q")
        let found = try photos(scan)
        try #require(found.count == 1)
        #expect(try PDFPhotos.count(scan) == 1)
        let left = try middle(found[0].0, x: 0.25), right = try middle(found[0].0, x: 0.75)
        #expect(left.red > 220 && left.blue < 200 && right.red < 60, "The text in black on its background: \(left), \(right)")
        #expect(try size(found[0].0) == (192, 192))
    }

    @Test func aTurnedPictureKeepsItsNeighboursOutOfItsCorners() throws {
        let blue = try bitmap(width: 100, height: 100, color: CGColor(red: 0, green: 0, blue: 1, alpha: 1))
        let source = try pdf(pages: 1) { context, _ in
            context.setFillColor(CGColor(red: 1, green: 0, blue: 0, alpha: 1))
            context.fill(CGRect(x: 0, y: 0, width: 612, height: 792))
            context.translateBy(x: 300, y: 400)
            context.rotate(by: .pi / 4)
            context.draw(blue, in: CGRect(x: -50, y: -50, width: 100, height: 100))
        }
        let found = try photos(source)
        try #require(found.count == 1)
        let side = try size(found[0].0)
        #expect(abs(side.0 - 141) <= 2 && abs(side.1 - 141) <= 2, "The box of the turned picture, at the picture's own sharpness: \(side)")
        let source2 = try #require(CGImageSourceCreateWithData(found[0].0 as CFData, nil))
        let image = try #require(CGImageSourceCreateImageAtIndex(source2, 0, nil))
        let corner = try #require(pixels(of: image).min { hypot($0.x - 0.04, $0.y - 0.04) < hypot($1.x - 0.04, $1.y - 0.04) })
        #expect(corner.red > 230 && corner.green > 230 && corner.blue > 230, "White, not the red page: \(corner)")
        let centre = try middle(found[0].0)
        #expect(centre.blue > 200 && centre.red < 60)
    }

    @Test func aPictureSeenUnderAnotherComesOutWhenItShowsAlone() throws {
        let red = try bitmap(width: 100, height: 100, color: CGColor(red: 1, green: 0, blue: 0, alpha: 1))
        let green = try bitmap(width: 100, height: 100, color: CGColor(red: 0, green: 1, blue: 0, alpha: 1))
        let source = try pdf(pages: 2) { context, page in
            context.draw(red, in: CGRect(x: 100, y: 400, width: 200, height: 200))
            if page == 0 { context.draw(green, in: CGRect(x: 100, y: 400, width: 200, height: 200)) }
        }
        let found = try photos(source)
        #expect(found.count == 2, "\(found.count): the pair on page 1, the red one alone on page 2")
        #expect(try found.map { try middle($0.0).green > 200 } == [true, false])
    }

    @Test func aCancelledExportStopsOnAPageWithoutPictures() async throws {
        let source = try pdf(pages: 40) { context, _ in
            context.setFillColor(CGColor(gray: 0.5, alpha: 1))
            context.fill(CGRect(x: 100, y: 100, width: 50, height: 50))
        }
        let task = Task.detached { () -> Int in
            var pages = 0
            do {
                try PDFPhotos.export(source, progress: { _, _ in
                    pages += 1
                    withUnsafeCurrentTask { $0?.cancel() }
                }) { _ in }
                return -1
            } catch PDFToolError.cancelled {
                return pages
            }
        }
        #expect(try await task.value == 1)
    }

    @Test func layersOfOnePictureAndSamePixelsStoredTwiceComeOnce() throws {
        // A scanned page as scanners save it: a blurred background and a sharp layer with a mask on the same frame.
        let layer = try bitmap(width: 200, height: 200, color: CGColor(gray: 0, alpha: 1), alpha: true)
        let scan = try pdf(pages: 2) { context, page in
            context.draw(try bitmap(width: 200, height: 200, color: CGColor(red: 0.9, green: 0.9, blue: CGFloat(page) * 0.5, alpha: 1)), in: CGRect(x: 0, y: 0, width: 612, height: 792))
            context.draw(layer, in: CGRect(x: 0, y: 0, width: 612, height: 792))
        }
        let found = try photos(scan)
        #expect(found.count == 2, "One file for each page, not one for each layer: \(found.count)")
        let colors = try found.map { try (left: middle($0.0, x: 0.25), right: middle($0.0, x: 0.75)) }
        #expect(colors.allSatisfy { $0.left.red > 200 && $0.right.red < 60 }, "The sharp layer is drawn over the background: \(colors)")
        // The same JPEG stored as two objects of the document.
        let bytes = try #require(jpegData(try bitmap(width: 100, height: 100, color: CGColor(red: 1, green: 0, blue: 0, alpha: 1)), quality: 0.8))
        let photo = "/Width 100/Height 100/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode"
        let twice = page(images: [(photo, bytes), (photo, bytes)], place: "q 100 0 0 100 72 500 cm /Im0 Do Q q 100 0 0 100 300 100 cm /Im1 Do Q")
        #expect(try PDFPhotos.count(twice) == 2, "Counted without reading the bytes")
        #expect(try photos(twice).count == 1)
    }

    @Test func aPDFWithoutPhotosGivesNothingAndAProtectedOneAsksForItsPassword() throws {
        let plain = fixture("Plain")
        #expect(try PDFPhotos.count(plain) == 0)
        #expect(try photos(plain).isEmpty)
        let red = try bitmap(width: 100, height: 100, color: CGColor(red: 1, green: 0, blue: 0, alpha: 1))
        let open = try pdf(pages: 1) { context, _ in context.draw(red, in: CGRect(x: 72, y: 300, width: 200, height: 200)) }
        let locked = try #require(PDFDocument(data: open)?.dataRepresentation(options: [
            PDFDocumentWriteOption.userPasswordOption: "open", PDFDocumentWriteOption.ownerPasswordOption: "owner",
        ]))
        #expect(throws: PDFToolError.passwordRequired) { try PDFPhotos.count(locked) }
        #expect(try photos(locked, password: "open").count == 1)
        #expect(try photos(fixture("Signed", digitalSignature: true)).isEmpty, "A signed PDF is read like any other")
    }
}
