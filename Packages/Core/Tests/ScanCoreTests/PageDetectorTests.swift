import CoreGraphics
import Testing
import TestSupport
@testable import ScanCore

struct PageDetectorTests {
    @Test func findsASyntheticPage() {
        let page = SyntheticPage()
        let detection = PageDetector.detect(in: page.render())
        #expect(Geometry.maxCornerShift(from: detection.quad, to: page.quad, in: page.size) < 0.005)
        #expect(!detection.needsReview)
    }

    @Test func aWrongQuadIsNeverSilent() {
        var page = SyntheticPage()
        page.coveredTopRightCorner = true
        let detection = PageDetector.detect(in: page.render())
        let error = Geometry.maxCornerShift(from: detection.quad, to: page.quad, in: page.size)
        #expect(detection.needsReview || error < 0.008)
    }

    @Test func emptyTableNeedsReview() {
        let table = TestImages.draw(width: 1600, height: 1000) { context in
            context.setFillColor(CGColor(gray: 0.42, alpha: 1))
            context.fill(CGRect(x: 0, y: 0, width: 1600, height: 1000))
        }
        #expect(PageDetector.detect(in: table).reviewReasons == [.noPageFound])
    }

    @Test func pageFillingTheFrame() {
        var page = SyntheticPage()
        page.size = PixelSize(width: 1000, height: 1414)
        page.corners = [CGPoint(x: 0, y: 0), CGPoint(x: 1000, y: 0), CGPoint(x: 1000, y: 1414), CGPoint(x: 0, y: 1414)]
        let detection = PageDetector.detect(in: page.render())
        #expect(Geometry.maxCornerShift(from: detection.quad, to: .fullImage, in: page.size) < 0.02)
        #expect(detection.reviewReasons == [.noPageFound])
    }

    @Test func reviewReasons() {
        let size = PixelSize(width: 1000, height: 1000)
        let square = Quad(topLeft: .init(x: 0.1, y: 0.1), topRight: .init(x: 0.9, y: 0.1),
                          bottomRight: .init(x: 0.9, y: 0.9), bottomLeft: .init(x: 0.1, y: 0.9))
        var detected = square
        detected.topLeft = NormalizedPoint(x: 0.2, y: 0.1)
        let refined = RefinedQuad(quad: square, inlierRatios: [1, 0.5, 1, 1])
        #expect(PageDetector.reviewReasons(detected: detected, refined: refined, size: size) == [.unusualRatio, .weakEdge, .cornerMoved])
    }
}
