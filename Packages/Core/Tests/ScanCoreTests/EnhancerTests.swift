import CoreImage
import Testing
import TestSupport
@testable import ScanCore

struct EnhancerTests {
    let context = Enhancer.makeContext()

    func enhanced(_ page: FlatPage, _ settings: EnhanceSettings = EnhanceSettings()) -> Bitmap {
        let output = Enhancer.enhance(page.render(), settings: settings, context: context)
        return Bitmap(TestImages.render(output, context: context))
    }

    @Test func whitensPaperAndKeepsTextDark() {
        let bitmap = enhanced(FlatPage())
        #expect(bitmap.gray(at: FlatPage.paperPoint) > 245)
        #expect(bitmap.gray(at: FlatPage.textPoint, radius: 1) < 80)
    }

    @Test func removesShadows() {
        var page = FlatPage()
        page.shadow = true
        #expect(enhanced(page).gray(at: FlatPage.shadowPoint) > 245)
    }

    @Test func paintsAWhiteBorder() {
        var page = FlatPage()
        page.darkFrame = true
        #expect(enhanced(page).gray(x: 4, y: 4, radius: 1) > 254)
    }

    @Test func keepsTheWatermarkOnlyWhenAsked() {
        var page = FlatPage()
        page.watermark = true
        let kept = enhanced(page, EnhanceSettings(keepWatermark: true)).gray(at: FlatPage.watermarkPoint)
        let dropped = enhanced(page, EnhanceSettings(keepWatermark: false)).gray(at: FlatPage.watermarkPoint)
        #expect(kept < 230)
        #expect(dropped > kept + 20)
    }

    @Test func cleansTheStreakBetweenShadowsWhenTheWatermarkIsKept() {
        var page = FlatPage()
        page.shadow = true
        page.streakInShadow = true
        #expect(enhanced(page, EnhanceSettings(keepWatermark: true)).gray(at: FlatPage.streakPoint) > 235)
    }

    @Test func colorModeStretchesLevelsAndKeepsTheTint() {
        var page = FlatPage()
        page.tint = (0.80, 0.78, 0.92)
        let bitmap = enhanced(page, EnhanceSettings(mode: .color))
        let body = bitmap.rgb(x: Int(FlatPage.tintPoint.x * 1654), y: Int(FlatPage.tintPoint.y * 2339))
        #expect(body.blue > body.red + 20)
        #expect(bitmap.gray(at: FlatPage.marginPoint) > 250)
    }
}
