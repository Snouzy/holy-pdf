import CoreImage
import Testing
import TestSupport
@testable import ScanCore

struct OrientationDetectorTests {
    let context = Enhancer.makeContext()

    func page() -> CIImage {
        let lines = (0..<12).map { TestImages.Line("Camera de comerț, pagina \($0 + 1) din 12", x: 0.1, y: 0.1 + 0.06 * Double($0), size: 40) }
        return CIImage(cgImage: TestImages.textPage(lines: lines))
    }

    @Test(arguments: [0, 1, 2, 3])
    func findsTheTurnsThatUndoARotation(turns: Int) async {
        let sideways = Orientation.rotate(page(), quarterTurns: (4 - turns) % 4)
        #expect(await offPool { OrientationDetector.quarterTurns(for: sideways, context: context) } == turns)
    }

    @Test func blankPageStaysUpright() async {
        let blank = CIImage(cgImage: TestImages.textPage(lines: []))
        #expect(await offPool { OrientationDetector.quarterTurns(for: blank, context: context) } == 0)
    }
}
