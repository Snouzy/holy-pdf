import Foundation
import Testing
import TestSupport
import UniformTypeIdentifiers
@testable import ScanCore

struct ImageLoaderTests {
    @Test func loadsPNGAsIs() throws {
        let url = TestImages.write(TestImages.marked(width: 300, height: 200), type: .png)
        let image = try ImageLoader.load(url).image
        #expect(image.width == 300 && image.height == 200)
        let corner = Bitmap(image).rgb(x: 5, y: 5)
        #expect(corner.red > 200 && corner.green < 60)
    }

    @Test func appliesExifOrientation() throws {
        // Orientation 6 means the stored pixels must turn 90° clockwise to display upright.
        let url = TestImages.write(TestImages.marked(width: 300, height: 200), type: .jpeg, orientation: .right)
        let image = try ImageLoader.load(url).image
        #expect(image.width == 200 && image.height == 300)
        let bitmap = Bitmap(image)
        #expect(bitmap.rgb(x: 195, y: 5).red > 200 && bitmap.rgb(x: 195, y: 5).green < 60)
        #expect(bitmap.rgb(x: 5, y: 5).green > 200)
    }

    @Test func loadsHEIC() throws {
        let url = TestImages.write(TestImages.marked(width: 300, height: 200), type: .heic)
        #expect(try ImageLoader.load(url).image.width == 300)
    }

    @Test func loadsLargePhotoDownsampled() throws {
        let url = TestImages.write(TestImages.marked(width: 8000, height: 6000), type: .jpeg)
        let image = try ImageLoader.load(url).image
        #expect(image.width == ImageLoader.maxLongSide)
        #expect(image.height == 3072)
    }

    @Test func readsCaptureDate() throws {
        let url = TestImages.write(TestImages.marked(width: 100, height: 100), type: .jpeg, captureDate: "2026:09:26 23:43:10")
        let date = try #require(try ImageLoader.load(url).captureDate)
        let parts = Calendar(identifier: .gregorian).dateComponents(in: .current, from: date)
        #expect(parts.year == 2026 && parts.month == 9 && parts.day == 26 && parts.hour == 23)
    }

    @Test func rejectsTextFile() throws {
        let url = TestImages.temporaryURL("notes.txt")
        try Data("hello".utf8).write(to: url)
        #expect(throws: ScanError.unsupportedFormat(url)) { try ImageLoader.load(url) }
    }

    @Test func rejectsMissingFile() {
        let url = URL(fileURLWithPath: "/nonexistent/photo.heic")
        #expect(throws: ScanError.unreadableFile(url)) { try ImageLoader.load(url) }
    }

    @Test func loadsASmallerCopyOnRequest() throws {
        let url = TestImages.write(TestImages.marked(width: 3000, height: 2000), type: .png)
        let image = try ImageLoader.load(url, maxLongSide: 1000).image
        #expect(image.width == 1000 && image.height == 667)
    }
}
