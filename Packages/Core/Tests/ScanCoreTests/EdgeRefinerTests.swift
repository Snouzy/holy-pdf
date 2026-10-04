import CoreGraphics
import Testing
import TestSupport
@testable import ScanCore

struct EdgeRefinerTests {
    func shrunk(_ quad: Quad, by fraction: Double) -> Quad {
        let cx = quad.corners.map(\.x).reduce(0, +) / 4
        let cy = quad.corners.map(\.y).reduce(0, +) / 4
        return Quad(corners: quad.corners.map { NormalizedPoint(x: $0.x + (cx - $0.x) * fraction, y: $0.y + (cy - $0.y) * fraction) })
    }

    @Test func snapsARoughQuadToTheEdges() {
        let page = SyntheticPage()
        let refined = EdgeRefiner.refine(shrunk(page.quad, by: 0.03), in: page.render())
        #expect(Geometry.maxCornerShift(from: refined.quad, to: page.quad, in: page.size) < 0.005)
        #expect(refined.inlierRatios.allSatisfy { $0 > 0.7 })
    }

    @Test func keepsTheOutermostEdgeUnderABoldHeader() {
        var page = SyntheticPage()
        page.boldBandNearTop = true
        page.table = 0.3
        let refined = EdgeRefiner.refine(page.quad, in: page.render())
        #expect(Geometry.maxCornerShift(from: refined.quad, to: page.quad, in: page.size) < 0.005)
    }

    @Test func rebuildsACoveredCorner() {
        var page = SyntheticPage()
        page.coveredTopRightCorner = true
        let refined = EdgeRefiner.refine(page.quad, in: page.render())
        #expect(Geometry.maxCornerShift(from: refined.quad, to: page.quad, in: page.size) < 0.008)
    }

    @Test func intersectsLines() {
        let horizontal = EdgeLine(point: SIMD2(0, 1), direction: SIMD2(1, 0))
        let vertical = EdgeLine(point: SIMD2(2, 0), direction: SIMD2(0, 1))
        #expect(EdgeRefiner.intersect(horizontal, vertical) == SIMD2(2, 1))
        #expect(EdgeRefiner.intersect(horizontal, horizontal) == nil)
    }
}
