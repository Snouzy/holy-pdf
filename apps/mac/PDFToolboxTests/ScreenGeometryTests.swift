import CoreGraphics
import ScanCore
import Testing
@testable import PDFToolbox

struct ScreenGeometryTests {
    @Test func aPortraitImageFitsCenteredInAWiderPane() {
        #expect(ScreenGeometry.fit(CGSize(width: 1000, height: 2000), in: CGSize(width: 800, height: 400))
                == CGRect(x: 300, y: 0, width: 200, height: 400))
    }

    @Test func pointAndNormalizedAreInverses() {
        let frame = CGRect(x: 300, y: 0, width: 200, height: 400)
        let corner = NormalizedPoint(x: 0.25, y: 0.75)
        #expect(ScreenGeometry.point(corner, in: frame) == CGPoint(x: 350, y: 300))
        #expect(ScreenGeometry.normalized(CGPoint(x: 350, y: 300), in: frame) == corner)
    }

    @Test func aPointOutsideTheImageStopsOnItsEdge() {
        #expect(ScreenGeometry.normalized(CGPoint(x: 100, y: 500), in: CGRect(x: 300, y: 0, width: 200, height: 400))
                == NormalizedPoint(x: 0, y: 1))
    }
}
