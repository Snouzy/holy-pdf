import CoreGraphics
import Foundation
import ImageIO
import PDFCore
import Testing
import TestSupport
import UniformTypeIdentifiers
import ScanSession
@testable import ScanCLI
@testable import ScanCore

struct PhotoMetadataTests {
    let make = "Zorblax"
    let model = "Zorblax Q7"
    let captured = "2026:07:14 10:20:30"

    func photo() throws -> URL {
        let url = TestImages.temporaryURL("photo.jpg")
        let destination = try #require(CGImageDestinationCreateWithURL(url as CFURL, UTType.jpeg.identifier as CFString, 1, nil))
        let properties: [CFString: Any] = [
            kCGImagePropertyGPSDictionary: [kCGImagePropertyGPSLatitude: 45.1234, kCGImagePropertyGPSLatitudeRef: "N",
                                            kCGImagePropertyGPSLongitude: 25.5678, kCGImagePropertyGPSLongitudeRef: "E"],
            kCGImagePropertyTIFFDictionary: [kCGImagePropertyTIFFMake: make, kCGImagePropertyTIFFModel: model],
            kCGImagePropertyExifDictionary: [kCGImagePropertyExifDateTimeOriginal: captured],
        ]
        CGImageDestinationAddImage(destination, SyntheticPage().render(), properties as CFDictionary)
        #expect(CGImageDestinationFinalize(destination))
        return url
    }

    func properties(_ source: CGImageSource?) -> [CFString: Any] {
        source.flatMap { CGImageSourceCopyPropertiesAtIndex($0, 0, nil) } as? [CFString: Any] ?? [:]
    }

    func contains(_ data: Data, _ text: String) -> Bool {
        data.range(of: Data(text.utf8)) != nil
    }

    @Test func photoMetadataNeverReachesThePDF() async throws {
        let url = try photo()
        let input = properties(CGImageSourceCreateWithURL(url as CFURL, nil))
        #expect(input[kCGImagePropertyGPSDictionary] != nil)
        #expect((input[kCGImagePropertyTIFFDictionary] as? [CFString: Any])?[kCGImagePropertyTIFFModel] as? String == model)
        #expect((input[kCGImagePropertyExifDictionary] as? [CFString: Any])?[kCGImagePropertyExifDateTimeOriginal] as? String == captured)

        let page = try await ScanPipeline().process(url)
        let output = properties(CGImageSourceCreateWithData(page.jpeg as CFData, nil))
        #expect(output[kCGImagePropertyGPSDictionary] == nil)
        #expect((output[kCGImagePropertyTIFFDictionary] as? [CFString: Any])?[kCGImagePropertyTIFFMake] == nil)
        #expect((output[kCGImagePropertyExifDictionary] as? [CFString: Any])?[kCGImagePropertyExifDateTimeOriginal] == nil)

        let pdf = try PDFWriter.data(pages: [PDFPageInput(page)], title: "x")
        let embedded = try #require(pdf.range(of: page.jpeg))
        var outsideTheImage = pdf
        outsideTheImage.removeSubrange(embedded)
        #expect(!contains(outsideTheImage, "GPS"))
        for text in [make, model, "2026:07:14", "D:20260714"] {
            #expect(!contains(pdf, text), "\(text) leaked into the PDF")
        }
    }
}
