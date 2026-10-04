import CoreGraphics
import CoreImage
import Vision

public enum Orientation {
    /// Turns `image` clockwise by `quarterTurns` × 90° and moves it back to the origin.
    public static func rotate(_ image: CIImage, quarterTurns: Int) -> CIImage {
        let turned: CIImage
        switch ((quarterTurns % 4) + 4) % 4 {
        case 1: turned = image.oriented(.right)
        case 2: turned = image.oriented(.down)
        case 3: turned = image.oriented(.left)
        default: return image
        }
        return turned.transformed(by: CGAffineTransform(translationX: -turned.extent.minX, y: -turned.extent.minY))
    }
}

public enum OrientationDetector {
    static let sampleLongSide = 1200.0

    /// Clockwise quarter turns that make the text upright: the fast OCR reads the page in the four
    /// directions and the one that reads the most text wins. 0 when no direction reads anything.
    public static func quarterTurns(for page: CIImage, context: CIContext) -> Int {
        let scale = min(1, sampleLongSide / max(page.extent.width, page.extent.height))
        let small = page.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        var best = (turns: 0, score: 0.0)
        for turns in 0..<4 {
            let turned = Orientation.rotate(small, quarterTurns: turns)
            guard let image = context.createCGImage(turned, from: turned.extent) else { continue }
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .fast
            request.usesLanguageCorrection = false
            let lines = (try? TextReader.perform(request, on: image)) ?? []
            let score = lines.reduce(0) { $0 + $1.confidence * Double($1.text.count) }
            if score > best.score { best = (turns, score) }
        }
        return best.turns
    }
}
