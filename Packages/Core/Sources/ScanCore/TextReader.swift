import CoreGraphics
import Vision

public struct TextLine: Hashable, Sendable, Codable {
    public var text: String
    public var box: NormalizedRect
    public var confidence: Double

    public init(text: String, box: NormalizedRect, confidence: Double) {
        self.text = text
        self.box = box
        self.confidence = confidence
    }
}

public enum TextReader {
    public static let languages = ["ro-RO", "fr-FR", "en-US"]

    /// The languages this Mac reads at the accurate level.
    public static let supported: [String] = {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        return (try? request.supportedRecognitionLanguages()) ?? languages
    }()

    public static func read(_ image: CGImage, languages: [String] = languages) throws(ScanError) -> [TextLine] {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        // Language correction rewrites names, numbers and dates of administrative documents.
        request.usesLanguageCorrection = false
        request.recognitionLanguages = languages
        return try perform(request, on: image)
    }

    static func perform(_ request: VNRecognizeTextRequest, on image: CGImage) throws(ScanError) -> [TextLine] {
        do {
            try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
        } catch {
            throw .ocrUnavailable
        }
        let lines = (request.results ?? []).compactMap { observation -> TextLine? in
            guard let candidate = observation.topCandidates(1).first else { return nil }
            return TextLine(text: candidate.string, box: Geometry.fromBottomLeft(observation.boundingBox),
                            confidence: Double(candidate.confidence))
        }
        return lines.sorted { ($0.box.y, $0.box.x) < ($1.box.y, $1.box.x) }
    }
}
