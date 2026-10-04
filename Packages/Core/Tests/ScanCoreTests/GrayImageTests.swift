import Testing
import TestSupport
@testable import ScanCore

struct GrayImageTests {
    @Test func samplesBilinearly() {
        let gray = GrayImage(width: 2, height: 1, pixels: [0, 100])
        #expect(gray.sample(SIMD2(0.5, 0)) == 50)
    }

    @Test func readsZeroOutsideTheImage() {
        let gray = GrayImage(width: 2, height: 2, pixels: [200, 200, 200, 200])
        #expect(gray.sample(SIMD2(-1, 0)) == 0)
        #expect(gray.sample(SIMD2(0, 5)) == 0)
    }

    @Test func shrinksAnImageTopRowFirst() throws {
        let gray = try #require(GrayImage(TestImages.marked(width: 100, height: 100), scale: 0.5))
        #expect(gray.width == 50 && gray.height == 50)
        #expect(gray.sample(SIMD2(3, 3)) < 150)
        #expect(gray.sample(SIMD2(46, 46)) > 240)
    }
}
