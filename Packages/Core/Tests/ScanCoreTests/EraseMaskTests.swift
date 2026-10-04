import CoreImage
import Foundation
import Testing
import TestSupport
@testable import ScanCore

struct EraseMaskTests {
    let context = CIContext()

    func grey() -> CIImage {
        CIImage(color: CIColor(red: 0.5, green: 0.5, blue: 0.5)).cropped(to: CGRect(x: 0, y: 0, width: 400, height: 600))
    }

    func gray(_ image: CIImage, at point: NormalizedPoint) -> Double {
        Bitmap(TestImages.render(image, context: context)).gray(at: point)
    }

    @Test func whitensAPolygon() {
        let erased = EraseMask.apply([.polygon(points: [.init(x: 0, y: 0), .init(x: 0.5, y: 0), .init(x: 0, y: 0.5)])], to: grey())
        #expect(gray(erased, at: .init(x: 0.05, y: 0.05)) > 250)
        #expect(gray(erased, at: .init(x: 0.9, y: 0.9)) < 140)
    }

    @Test func whitensABrushStroke() {
        let erased = EraseMask.apply([.stroke(points: [.init(x: 0.2, y: 0.5), .init(x: 0.8, y: 0.5)], radius: 0.05)], to: grey())
        #expect(gray(erased, at: .init(x: 0.5, y: 0.5)) > 250)
        #expect(gray(erased, at: .init(x: 0.5, y: 0.2)) < 140)
    }

    @Test func aSingleTapErasesADot() {
        let erased = EraseMask.apply([.stroke(points: [.init(x: 0.5, y: 0.5)], radius: 0.05)], to: grey())
        #expect(gray(erased, at: .init(x: 0.5, y: 0.5)) > 250)
    }

    @Test func ignoresDegenerateMarks() {
        let erased = EraseMask.apply([.polygon(points: [.init(x: 0, y: 0), .init(x: 1, y: 1)]), .stroke(points: [], radius: 0.1)], to: grey())
        #expect(gray(erased, at: .init(x: 0.5, y: 0.5)) < 140)
    }

    @Test func marksRoundTripThroughJSON() throws {
        let marks: [EraseMark] = [.polygon(points: [.init(x: 0.1, y: 0.2)]), .stroke(points: [.init(x: 0.3, y: 0.4)], radius: 0.02)]
        let data = try JSONEncoder().encode(marks)
        #expect(try JSONDecoder().decode([EraseMark].self, from: data) == marks)
        #expect(String(decoding: data, as: UTF8.self).contains("\"polygon\":{\"points\""))
    }

    @Test func aRotatedStrokeFollowsTheTurnedPage() throws {
        let mark = EraseMark.stroke(points: [.init(x: 0.2, y: 0.1)], radius: 0.05)
        let turned = mark.rotated(quarterTurns: 1, pageSize: PixelSize(width: 200, height: 300))
        let mask = Bitmap(try #require(EraseMask.maskImage([turned], size: PixelSize(width: 300, height: 200))))
        // (0.2, 0.1) lands on (0.9, 0.2), and the dot keeps its 10 px radius on the wider page.
        #expect(mask.gray(x: 270, y: 40, radius: 0) > 250)
        #expect(mask.gray(x: 278, y: 40, radius: 0) > 250)
        #expect(mask.gray(x: 282, y: 40, radius: 0) < 5)
    }

    @Test func aRotatedPolygonTurnsItsPoints() {
        let mark = EraseMark.polygon(points: [.init(x: 0, y: 0), .init(x: 0.5, y: 0), .init(x: 0, y: 0.5)])
        #expect(mark.rotated(quarterTurns: 2, pageSize: PixelSize(width: 10, height: 20))
                == .polygon(points: [.init(x: 1, y: 1), .init(x: 0.5, y: 1), .init(x: 1, y: 0.5)]))
    }
}
