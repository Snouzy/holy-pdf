import CoreGraphics
import Vision

public enum ReviewReason: String, Hashable, Sendable, Codable, CaseIterable {
    case noPageFound
    case unusualRatio
    case weakEdge
    case cornerMoved
}

public struct Detection: Hashable, Sendable, Codable {
    public var quad: Quad
    public var visionConfidence: Double
    public var inlierRatios: [Double]
    public var reviewReasons: [ReviewReason]

    public var needsReview: Bool { !reviewReasons.isEmpty }

    public init(quad: Quad, visionConfidence: Double, inlierRatios: [Double], reviewReasons: [ReviewReason]) {
        self.quad = quad
        self.visionConfidence = visionConfidence
        self.inlierRatios = inlierRatios
        self.reviewReasons = reviewReasons
    }
}

public enum PageDetector {
    public static let weakEdgeRatio = 0.7
    public static let maxCornerShift = 0.01
    /// Vision returns a low-confidence guess when there is no page or when the page fills the whole frame; real pages scored 0.82-0.99 on the real batch.
    public static let minVisionConfidence = 0.5

    public static func detect(in image: CGImage) -> Detection {
        guard let detected = visionQuad(in: image) else {
            return Detection(quad: .fullImage, visionConfidence: 0, inlierRatios: [], reviewReasons: [.noPageFound])
        }
        let refined = EdgeRefiner.refine(detected.quad, in: image)
        return Detection(quad: refined.quad, visionConfidence: detected.confidence, inlierRatios: refined.inlierRatios,
                         reviewReasons: reviewReasons(detected: detected.quad, refined: refined, size: PixelSize(image)))
    }

    static func reviewReasons(detected: Quad, refined: RefinedQuad, size: PixelSize) -> [ReviewReason] {
        var reasons: [ReviewReason] = []
        let measured = Geometry.measuredSize(of: refined.quad, in: size)
        let ratio = max(measured.width, measured.height) / max(min(measured.width, measured.height), 1)
        if !PageSizing.isKnownRatio(ratio) { reasons.append(.unusualRatio) }
        if refined.inlierRatios.contains(where: { $0 < weakEdgeRatio }) { reasons.append(.weakEdge) }
        if Geometry.maxCornerShift(from: detected, to: refined.quad, in: size) > maxCornerShift { reasons.append(.cornerMoved) }
        return reasons
    }

    static func visionQuad(in image: CGImage) -> (quad: Quad, confidence: Double)? {
        let request = VNDetectDocumentSegmentationRequest()
        do {
            try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
        } catch {
            return nil
        }
        guard let observation = request.results?.first, Double(observation.confidence) >= minVisionConfidence else { return nil }
        let quad = Quad(topLeft: Geometry.fromBottomLeft(observation.topLeft),
                        topRight: Geometry.fromBottomLeft(observation.topRight),
                        bottomRight: Geometry.fromBottomLeft(observation.bottomRight),
                        bottomLeft: Geometry.fromBottomLeft(observation.bottomLeft))
        return (quad, Double(observation.confidence))
    }
}
