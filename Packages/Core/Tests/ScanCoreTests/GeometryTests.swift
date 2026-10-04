import CoreGraphics
import Testing
import TestSupport
@testable import ScanCore

struct GeometryTests {
    let size = PixelSize(width: 2000, height: 1000)

    @Test func pixelAndNormalizedRoundTrip() {
        let point = NormalizedPoint(x: 0.25, y: 0.75)
        let pixel = Geometry.pixel(point, in: size)
        #expect(pixel == CGPoint(x: 500, y: 750))
        #expect(isClose(Geometry.normalized(pixel, in: size), point))
    }

    @Test func coreImagePointHasBottomLeftOrigin() {
        #expect(Geometry.coreImagePoint(NormalizedPoint(x: 0.25, y: 0.75), in: size) == CGPoint(x: 500, y: 250))
    }

    @Test func visionPointsAreFlipped() {
        #expect(isClose(Geometry.fromBottomLeft(CGPoint(x: 0.2, y: 0.9)), NormalizedPoint(x: 0.2, y: 0.1)))
    }

    @Test func visionRectsAreFlipped() {
        let rect = Geometry.fromBottomLeft(CGRect(x: 0.1, y: 0.7, width: 0.5, height: 0.2))
        #expect(isClose(rect.x, 0.1))
        #expect(isClose(rect.y, 0.1))
        #expect(isClose(rect.width, 0.5))
        #expect(isClose(rect.height, 0.2))
    }

    @Test func topLeftPixelsFlipToBottomLeft() {
        let flip = Geometry.topLeftToBottomLeft(height: 100)
        #expect(CGPoint(x: 10, y: 0).applying(flip) == CGPoint(x: 10, y: 100))
        #expect(CGPoint(x: 10, y: 30).applying(flip) == CGPoint(x: 10, y: 70))
    }

    @Test func measuredSizeAveragesOppositeEdges() {
        let quad = Quad(topLeft: .init(x: 0.1, y: 0.1), topRight: .init(x: 0.6, y: 0.1),
                        bottomRight: .init(x: 0.7, y: 0.9), bottomLeft: .init(x: 0.1, y: 0.9))
        let measured = Geometry.measuredSize(of: quad, in: size)
        let expectedWidth = Double(1000 + 1200) / 2
        let rightEdgeLength = (200.0 * 200 + 800 * 800).squareRoot()
        let expectedHeight = (800 + rightEdgeLength) / 2
        #expect(isClose(measured.width, expectedWidth))
        #expect(isClose(measured.height, expectedHeight))
    }

    @Test func cornerShiftIsAFractionOfTheDiagonal() {
        let moved = Quad(topLeft: .init(x: 0.1, y: 0), topRight: .init(x: 1, y: 0),
                         bottomRight: .init(x: 1, y: 1), bottomLeft: .init(x: 0, y: 1))
        let expected = 200 / (2000.0 * 2000 + 1000 * 1000).squareRoot()
        #expect(isClose(Geometry.maxCornerShift(from: .fullImage, to: moved, in: size), expected))
    }

    @Test func quadCornersAreClockwiseFromTopLeft() {
        let corners = Quad.fullImage.corners
        #expect(corners == [.init(x: 0, y: 0), .init(x: 1, y: 0), .init(x: 1, y: 1), .init(x: 0, y: 1)])
        #expect(Quad(corners: corners) == .fullImage)
    }

    @Test func quarterTurnsMovePointsClockwise() {
        let topLeft = NormalizedPoint(x: 0, y: 0)
        #expect(Geometry.rotatedClockwise(topLeft, quarterTurns: 1) == NormalizedPoint(x: 1, y: 0))
        #expect(Geometry.rotatedClockwise(topLeft, quarterTurns: 2) == NormalizedPoint(x: 1, y: 1))
        #expect(Geometry.rotatedClockwise(topLeft, quarterTurns: 3) == NormalizedPoint(x: 0, y: 1))
        #expect(Geometry.rotatedClockwise(topLeft, quarterTurns: -1) == NormalizedPoint(x: 0, y: 1))
        #expect(isClose(Geometry.rotatedClockwise(NormalizedPoint(x: 0.2, y: 0.1), quarterTurns: 1), NormalizedPoint(x: 0.9, y: 0.2)))
    }

    @Test func usableQuads() {
        let full = Quad.fullImage
        #expect(Geometry.isUsable(full))
        #expect(Geometry.isUsable(SyntheticPage().quad))
        // Two corners swapped: the outline crosses itself.
        #expect(!Geometry.isUsable(Quad(topLeft: full.topRight, topRight: full.topLeft, bottomRight: full.bottomRight, bottomLeft: full.bottomLeft)))
        // A corner dragged outside the photo.
        #expect(!Geometry.isUsable(Quad(topLeft: .init(x: -0.1, y: 0), topRight: full.topRight, bottomRight: full.bottomRight, bottomLeft: full.bottomLeft)))
        // A dent: one corner pushed inside the page.
        #expect(!Geometry.isUsable(Quad(topLeft: .init(x: 0.6, y: 0.6), topRight: full.topRight, bottomRight: full.bottomRight, bottomLeft: full.bottomLeft)))
        // A sliver.
        #expect(!Geometry.isUsable(Quad(topLeft: .init(x: 0.5, y: 0), topRight: .init(x: 0.505, y: 0),
                                        bottomRight: .init(x: 0.505, y: 1), bottomLeft: .init(x: 0.5, y: 1))))
    }
}
