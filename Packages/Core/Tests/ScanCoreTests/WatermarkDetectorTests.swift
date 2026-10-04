import Testing
import TestSupport
@testable import ScanCore

struct WatermarkDetectorTests {
    let context = Enhancer.makeContext()

    @Test func findsWideGreyStrokes() {
        var page = FlatPage()
        page.watermark = true
        #expect(WatermarkDetector.detect(page.render(), context: context))
    }

    @Test func ignoresPlainText() {
        #expect(!WatermarkDetector.detect(FlatPage().render(), context: context))
    }

    @Test func ignoresAStreakBetweenShadows() {
        var page = FlatPage()
        page.shadow = true
        page.streakInShadow = true
        #expect(!WatermarkDetector.detect(page.render(), context: context))
    }
}
