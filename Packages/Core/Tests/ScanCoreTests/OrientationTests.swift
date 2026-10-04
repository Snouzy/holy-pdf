import CoreGraphics
import CoreImage
import Testing
import TestSupport
@testable import ScanCore

struct OrientationTests {
    let context = CIContext()

    func marked() -> CIImage {
        CIImage(cgImage: TestImages.marked(width: 100, height: 50))
    }

    @Test func oneQuarterTurnIsClockwise() {
        let turned = Orientation.rotate(marked(), quarterTurns: 1)
        #expect(turned.extent == CGRect(x: 0, y: 0, width: 50, height: 100))
        let bitmap = Bitmap(TestImages.render(turned, context: context))
        #expect(bitmap.rgb(x: 45, y: 4).green < 60)
        #expect(bitmap.rgb(x: 4, y: 4).green > 200)
    }

    @Test func threeQuarterTurnsAreCounterClockwise() {
        let bitmap = Bitmap(TestImages.render(Orientation.rotate(marked(), quarterTurns: 3), context: context))
        #expect(bitmap.rgb(x: 4, y: 95).green < 60)
    }

    @Test func turnsWrapAround() {
        #expect(Orientation.rotate(marked(), quarterTurns: 4).extent == marked().extent)
        #expect(Orientation.rotate(marked(), quarterTurns: -1).extent == Orientation.rotate(marked(), quarterTurns: 3).extent)
    }
}
