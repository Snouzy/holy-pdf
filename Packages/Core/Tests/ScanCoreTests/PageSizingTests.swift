import CoreGraphics
import Testing
import TestSupport
@testable import ScanCore

struct PageSizingTests {
    @Test func isoPortraitIsSnapped() {
        #expect(PageSizing.renderSize(measuredWidth: 1000, measuredHeight: 1440) == PixelSize(width: 1654, height: 2339))
    }

    @Test func isoLandscapeIsSnapped() {
        #expect(PageSizing.renderSize(measuredWidth: 1400, measuredHeight: 1000) == PixelSize(width: 2339, height: 1654))
    }

    @Test func otherRatioKeepsTheShortSide() {
        #expect(PageSizing.renderSize(measuredWidth: 1000, measuredHeight: 1600) == PixelSize(width: 1654, height: 2646))
    }

    @Test func ratioJustOutsideTheToleranceIsNotSnapped() {
        #expect(PageSizing.renderSize(measuredWidth: 1000, measuredHeight: 1500) == PixelSize(width: 1654, height: 2481))
    }

    @Test func aDegenerateSizeHasNoRender() {
        #expect(PageSizing.renderSize(measuredWidth: 0, measuredHeight: 100) == nil)
        #expect(PageSizing.renderSize(measuredWidth: .nan, measuredHeight: 100) == nil)
        #expect(PageSizing.renderSize(measuredWidth: .infinity, measuredHeight: 100) == nil)
    }

    @Test func aSliverIsCappedOnItsLongSide() {
        #expect(PageSizing.renderSize(measuredWidth: 10, measuredHeight: 1000) == PixelSize(width: 70, height: 7016))
        #expect(PageSizing.renderSize(measuredWidth: 1000, measuredHeight: 10) == PixelSize(width: 7016, height: 70))
    }

    @Test func knownRatios() {
        #expect(PageSizing.isKnownRatio(2.0.squareRoot()))
        #expect(PageSizing.isKnownRatio(11 / 8.5))
        #expect(!PageSizing.isKnownRatio(1.0))
        #expect(!PageSizing.isKnownRatio(1.65))
    }

    @Test func pdfPageSizes() {
        #expect(PageSizing.pdfPageSize(format: .auto, pixels: PixelSize(width: 1654, height: 2339)) == CGSize(width: 595.28, height: 841.89))
        #expect(PageSizing.pdfPageSize(format: .auto, pixels: PixelSize(width: 2339, height: 1654)) == CGSize(width: 841.89, height: 595.28))
        #expect(PageSizing.pdfPageSize(format: .a5, pixels: PixelSize(width: 2339, height: 1654)) == CGSize(width: 595.28, height: 419.53))
        #expect(PageSizing.pdfPageSize(format: .letter, pixels: PixelSize(width: 1654, height: 2140)) == CGSize(width: 612, height: 792))
        let other = PageSizing.pdfPageSize(format: .auto, pixels: PixelSize(width: 1654, height: 2140))
        #expect(isClose(other.width, 595.44, tolerance: 1e-6))
        #expect(isClose(other.height, 770.4, tolerance: 1e-6))
    }
}
