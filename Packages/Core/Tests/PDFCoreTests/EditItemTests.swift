import CoreGraphics
import Foundation
import Testing
@testable import PDFCore

struct EditItemTests {
    private func close(_ a: CGRect, _ b: CGRect) -> Bool {
        [a.minX - b.minX, a.minY - b.minY, a.width - b.width, a.height - b.height].allSatisfy { abs($0) < 1e-9 }
    }

    private func close(_ a: [CGPoint], _ b: [CGPoint]) -> Bool {
        a.count == b.count && zip(a, b).allSatisfy { pair in abs(pair.0.x - pair.1.x) < 1e-9 && abs(pair.0.y - pair.1.y) < 1e-9 }
    }

    @Test func aStrokeKeepsItsPointsWhenItsFrameMovesOrGrows() {
        let through = [CGPoint(x: 0.2, y: 0.4), CGPoint(x: 0.4, y: 0.3), CGPoint(x: 0.6, y: 0.5)]
        var ink = EditItem.stroke(pageIndex: 0, through: through, content: .ink(EditStroke(color: .blue, thickness: .thin)))
        #expect(close(ink.frame, CGRect(x: 0.2, y: 0.3, width: 0.4, height: 0.2)))
        #expect(close(ink.pagePoints, through))
        ink.frame = CGRect(x: 0.5, y: 0.5, width: 0.8, height: 0.4)
        #expect(close(ink.pagePoints, [CGPoint(x: 0.5, y: 0.7), CGPoint(x: 0.9, y: 0.5), CGPoint(x: 1.3, y: 0.9)]))
    }

    @Test func aStraightLineHasAFlatFrame() {
        let ends = [CGPoint(x: 0.1, y: 0.5), CGPoint(x: 0.7, y: 0.5)]
        let line = EditItem.stroke(pageIndex: 0, through: ends, content: .line(EditStroke(color: .black, thickness: .medium), arrow: true))
        #expect(line.frame.height == 0 && line.isValid)
        #expect(close(line.pagePoints, ends))
    }

    @Test func theCropFollowsTheTurnsAndTheMirrors() {
        let left = EditPicture(image: UUID(), crop: CGRect(x: 0, y: 0, width: 0.5, height: 1))
        #expect(close(left.shownCrop, CGRect(x: 0, y: 0, width: 0.5, height: 1)))
        var turned = left
        turned.quarterTurns = 1
        #expect(close(turned.shownCrop, CGRect(x: 0, y: 0, width: 1, height: 0.5)), "Turned right, the left half is on top")
        var mirrored = left
        mirrored.flippedHorizontally = true
        #expect(close(mirrored.shownCrop, CGRect(x: 0.5, y: 0, width: 0.5, height: 1)))
        let part = CGRect(x: 0.1, y: 0.2, width: 0.3, height: 0.4)
        for turns in 0...3 {
            for horizontally in [false, true] {
                for vertically in [false, true] {
                    let picture = EditPicture(image: UUID(), quarterTurns: turns, flippedHorizontally: horizontally, flippedVertically: vertically)
                    #expect(close(picture.withShownCrop(part).shownCrop, part), "\(turns) \(horizontally) \(vertically)")
                }
            }
        }
    }

    @Test func aTurnGoesClockwiseAsTheReaderSeesItEvenMirrored() {
        var picture = EditPicture(image: UUID(), crop: CGRect(x: 0, y: 0, width: 0.5, height: 1))
        picture.flippedHorizontally = true
        let turned = picture.turned()
        #expect(turned.quarterTurns == 3)
        #expect(close(turned.shownCrop, CGRect(x: 0, y: 0.5, width: 1, height: 0.5)), "The half shown on the right, turned right, lies at the bottom")
        #expect(EditPicture(image: UUID()).turned().quarterTurns == 1)
    }

    @Test func refusesWhatCannotBeDrawn() {
        let box = CGRect(x: 0.1, y: 0.1, width: 0.2, height: 0.1)
        let thin = EditStroke(color: .red, thickness: .thin)
        #expect(EditItem(pageIndex: 0, frame: box, content: .text("Oui", EditTextStyle())).isValid)
        #expect(!EditItem(pageIndex: 0, frame: box, content: .text(" \n ", EditTextStyle())).isValid)
        #expect(!EditItem(pageIndex: 0, frame: box, content: .text("Oui", EditTextStyle(size: 7))).isValid)
        #expect(!EditItem(pageIndex: 0, frame: box, content: .text("Oui", EditTextStyle(size: 97))).isValid)
        #expect(!EditItem(pageIndex: 0, frame: CGRect(x: CGFloat.nan, y: 0, width: 1, height: 1), content: .highlight(.yellow)).isValid)
        #expect(!EditItem(pageIndex: -1, frame: box, content: .highlight(.yellow)).isValid)
        #expect(!EditItem(pageIndex: 0, frame: CGRect(x: 0.1, y: 0.1, width: 0, height: 0.1), content: .rectangle(EditShapeStyle())).isValid)
        #expect(!EditItem(pageIndex: 0, frame: box, content: .picture(EditPicture(image: UUID(), crop: CGRect(x: 0.5, y: 0, width: 0.6, height: 1)))).isValid)
        #expect(!EditItem(pageIndex: 0, frame: box, content: .picture(EditPicture(image: UUID(), quarterTurns: 4))).isValid)
        #expect(!EditItem(pageIndex: 0, frame: box, points: [CGPoint(x: 0, y: 0)], content: .ink(thin)).isValid)
        #expect(!EditItem(pageIndex: 0, frame: box, points: [.zero, .zero, .zero], content: .line(thin, arrow: false)).isValid)
    }
}
