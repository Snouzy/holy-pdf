import CoreGraphics
import CoreImage
import Testing
import TestSupport
@testable import ScanCore

struct RectifierTests {
    let context = CIContext()

    @Test func outputSizeFollowsTheMeasuredPage() {
        let page = SyntheticPage()
        #expect(Rectifier.outputSize(for: page.quad, in: page.size) == PixelSize(width: 1654, height: 2339))
    }

    @Test func flattensThePageContent() throws {
        var page = SyntheticPage()
        page.textLines = false
        page.marker = NormalizedPoint(x: 0.2, y: 0.15)
        let flat = try Rectifier.rectify(page.render(), quad: page.quad)
        #expect(flat.extent == CGRect(x: 0, y: 0, width: 1654, height: 2339))
        let bitmap = Bitmap(TestImages.render(flat, context: context))
        #expect(bitmap.gray(at: NormalizedPoint(x: 0.2, y: 0.15)) < 60)
        #expect(bitmap.gray(at: NormalizedPoint(x: 0.8, y: 0.15)) > 200)
        #expect(bitmap.gray(at: NormalizedPoint(x: 0.5, y: 0.5)) > 200)
    }

    @Test func aDegenerateQuadHasNoOutputSize() {
        let point = NormalizedPoint(x: 0.5, y: 0.5)
        #expect(Rectifier.outputSize(for: Quad(topLeft: point, topRight: point, bottomRight: point, bottomLeft: point),
                                     in: PixelSize(width: 100, height: 100)) == nil)
    }
}
