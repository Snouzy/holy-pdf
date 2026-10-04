import ImageIO
import Testing
import TestSupport
import UniformTypeIdentifiers
@testable import ScanCore

struct JPEGEncoderTests {
    @Test func encodesAJPEGWithoutLocationOrDate() throws {
        let data = try JPEGEncoder.encode(TestImages.marked(width: 200, height: 100))
        let source = try #require(CGImageSourceCreateWithData(data as CFData, nil))
        #expect(CGImageSourceGetType(source) as String? == UTType.jpeg.identifier)
        let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any] ?? [:]
        #expect(properties[kCGImagePropertyGPSDictionary] == nil)
        let exif = properties[kCGImagePropertyExifDictionary] as? [CFString: Any] ?? [:]
        #expect(exif[kCGImagePropertyExifDateTimeOriginal] == nil)
    }
}
