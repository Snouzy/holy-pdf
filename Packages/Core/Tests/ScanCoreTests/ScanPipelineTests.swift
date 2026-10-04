import Foundation
import ImageIO
import Testing
import TestSupport
@testable import ScanCore

struct ScanPipelineTests {
    let pipeline = ScanPipeline()

    func photo(_ page: SyntheticPage = SyntheticPage()) -> URL {
        TestImages.write(page.render(), type: .png)
    }

    @Test func turnsAPhotoIntoAPage() async throws {
        let page = try await pipeline.process(photo())
        #expect(page.pixelSize == PixelSize(width: 1654, height: 2339))
        #expect(!page.detection.needsReview)
        #expect(page.quarterTurns == 0)
        #expect(page.settings == EnhanceSettings(mode: .document, keepWatermark: false))
        #expect(!page.jpeg.isEmpty)
        #expect(!page.textUnread)
    }

    @Test func aKnownDetectionSkipsVision() async throws {
        // Vision finds no page on a blank photo, so a detection that comes back unchanged was not recomputed.
        let blank = TestImages.write(TestImages.draw(width: 800, height: 1131) { context in
            context.setFillColor(CGColor(gray: 0.5, alpha: 1))
            context.fill(CGRect(x: 0, y: 0, width: 800, height: 1131))
        }, type: .png)
        let known = Detection(quad: Quad(topLeft: .init(x: 0.1, y: 0.1), topRight: .init(x: 0.9, y: 0.1),
                                         bottomRight: .init(x: 0.9, y: 0.9), bottomLeft: .init(x: 0.1, y: 0.9)),
                              visionConfidence: 0.9, inlierRatios: [1, 1, 1, 1], reviewReasons: [])
        let page = try await pipeline.process(blank, edits: PageEdits(quarterTurns: 0), detection: known)
        #expect(page.detection == known)
        #expect(page.quad == known.quad)
    }

    @Test func aTextReadingFailureKeepsThePage() async throws {
        let failing = ScanPipeline(context: Enhancer.makeContext(), readText: { _ throws(ScanError) in throw .ocrUnavailable })
        let page = try await failing.process(photo(), edits: PageEdits(quarterTurns: 0))
        #expect(page.textUnread)
        #expect(page.lines.isEmpty)
        #expect(!page.jpeg.isEmpty)
    }

    @Test func editsWinOverAutomaticChoices() async throws {
        let synthetic = SyntheticPage()
        let everything = EraseMark.polygon(points: [.init(x: 0, y: 0), .init(x: 1, y: 0), .init(x: 1, y: 1), .init(x: 0, y: 1)])
        let edits = PageEdits(quad: synthetic.quad, quarterTurns: 1, mode: .color, erase: [everything])
        let page = try await pipeline.process(photo(synthetic), edits: edits)
        #expect(page.quad == synthetic.quad)
        #expect(page.quarterTurns == 1)
        #expect(page.pixelSize == PixelSize(width: 2339, height: 1654))
        #expect(page.settings.mode == .color)
        let image = try #require(CGImageSourceCreateWithData(page.jpeg as CFData, nil).flatMap { CGImageSourceCreateImageAtIndex($0, 0, nil) })
        #expect(Bitmap(image).gray(at: .init(x: 0.5, y: 0.5)) > 250)
    }

    @Test func pageEditsDecodeMissingKeysAsAutomatic() throws {
        let edits = try JSONDecoder().decode(PageEdits.self, from: Data(#"{"quarterTurns": 2}"#.utf8))
        #expect(edits == PageEdits(quarterTurns: 2))
    }

    @Test func aMissingPhotoThrows() async {
        let url = URL(fileURLWithPath: "/nonexistent/photo.png")
        await #expect(throws: ScanError.unreadableFile(url)) { try await pipeline.process(url) }
    }
}
