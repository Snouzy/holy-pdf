import CoreGraphics
import Foundation
import ImageIO
import Testing
import TestSupport
import UniformTypeIdentifiers
@testable import PDFCore

struct EditImageTests {
    @Test func loadsAPhotoUprightAndShrinksIt() throws {
        // A phone held sideways stores the picture lying down, with orientation 6.
        let data = try encoded(try halves(width: 3000, height: 1500), as: .jpeg, properties: [kCGImagePropertyOrientation: 6])
        let image = try EditImage.load(data: data)
        #expect(image.width == 1200 && image.height == 2400)
        #expect(image.isOpaque && image.data.starts(with: [0xFF, 0xD8]))
        let bitmap = Bitmap(try image.decoded())
        #expect(bitmap.rgb(x: 600, y: 100).red > 200 && bitmap.rgb(x: 600, y: 2300).blue > 200, "Upright, the left half is on top")
    }

    @Test func keepsTransparencyAsPNGAndOpaquePicturesAsJPEG() throws {
        let clear = try EditImage.load(data: try encoded(try halves(width: 200, height: 100, clearBottom: true), as: .png))
        #expect(!clear.isOpaque && clear.data.starts(with: [0x89, 0x50, 0x4E, 0x47]))
        let flat = try EditImage.load(data: try encoded(try halves(width: 200, height: 100), as: .png))
        #expect(flat.isOpaque && flat.data.starts(with: [0xFF, 0xD8]), "A PNG with nothing see-through becomes a JPEG")
    }

    @Test(arguments: [UTType.heic, .tiff, .gif, .bmp])
    func readsWhatImageIOReads(type: UTType) throws {
        let image = try EditImage.load(data: try encoded(try halves(width: 300, height: 200), as: type))
        #expect(image.width == 300 && image.height == 200)
    }

    @Test func refusesTooLargeAndUnreadablePictures() throws {
        #expect(throws: PDFToolError.imageTooLarge) { try EditImage.load(data: Data(count: EditImage.maxBytes + 1)) }
        let context = try #require(CGContext(data: nil, width: 7100, height: 7100, bitsPerComponent: 8, bytesPerRow: 0,
                                             space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue))
        let huge = try encoded(try #require(context.makeImage()), as: .png)
        #expect(throws: PDFToolError.imageTooLarge) { try EditImage.load(data: huge) }
        #expect(throws: PDFToolError.invalidImage) { try EditImage.load(data: Data("not a picture".utf8)) }
    }

    @Test func takesTodaysPhonePhotos() throws {
        // 24 million pixels: the default of the iPhones of 2023 and later.
        let photo = try #require(CGContext(data: nil, width: 5712, height: 4284, bitsPerComponent: 8, bytesPerRow: 0,
                                           space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue))
        let image = try EditImage.load(data: try encoded(try #require(photo.makeImage()), as: .jpeg))
        #expect(image.width == EditImage.maxSide)
    }

    @Test func aCropKeepsOnlyItsPixels() throws {
        let image = try EditImage.load(data: try encoded(try halves(width: 400, height: 200), as: .jpeg))
        let right = Bitmap(try image.cropped(CGRect(x: 0.5, y: 0, width: 0.5, height: 1)))
        #expect(right.width == 200 && right.height == 200)
        // JPEG blurs colour across a few pixels at the border: the cut is exact, the colour is not.
        #expect((8..<right.width).allSatisfy { right.rgb(x: $0, y: 100).red < 120 })
        let tall = try EditImage.load(data: try encoded(try halves(width: 200, height: 400, vertical: true), as: .jpeg))
        let top = Bitmap(try tall.cropped(CGRect(x: 0, y: 0, width: 1, height: 0.5)))
        #expect(top.height == 200 && (0..<top.height - 8).allSatisfy { top.rgb(x: 100, y: $0).red > 180 }, "The top half is the red one")
        #expect(image.pixels(of: CGRect(x: 0.25, y: 0.5, width: 0.5, height: 0.5)) == CGRect(x: 100, y: 100, width: 200, height: 100))
    }
}
