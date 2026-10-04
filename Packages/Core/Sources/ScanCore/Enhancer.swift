import CoreGraphics
import CoreImage

public enum RenderMode: String, Hashable, Sendable, Codable, CaseIterable {
    case document
    case color
}

public struct EnhanceSettings: Hashable, Sendable, Codable {
    public var mode: RenderMode
    public var keepWatermark: Bool

    public init(mode: RenderMode = .document, keepWatermark: Bool = false) {
        self.mode = mode
        self.keepWatermark = keepWatermark
    }
}

public enum Enhancer {
    public static let border = 24.0
    /// Stands in for the prototype's 21 px median, which Core Image does not have.
    static let smoothingSigma = 5.0

    /// Math runs on gamma-encoded sRGB values, like the prototype, so its thresholds carry over.
    public static func makeContext() -> CIContext {
        guard let sRGB = CGColorSpace(name: CGColorSpace.sRGB) else { return CIContext() }
        return CIContext(options: [.workingColorSpace: sRGB, .outputColorSpace: sRGB])
    }

    public static func enhance(_ page: CIImage, settings: EnhanceSettings, context: CIContext) -> CIImage {
        switch settings.mode {
        case .document: document(page, keepWatermark: settings.keepWatermark)
        case .color: color(page, context: context)
        }
    }

    static func document(_ page: CIImage, keepWatermark: Bool) -> CIImage {
        let extent = page.extent
        let fine = fineEstimate(page)
        var paper = fine
        if keepWatermark {
            // The closing fills the watermark strokes so they are not divided out. Inside a shadow it
            // also fills the narrow streak between two shadow lobes, so there the fine estimate wins.
            let closed = closedEstimate(fine)
            paper = fine.applyingFilter("CIBlendWithMask", parameters: [
                kCIInputBackgroundImageKey: closed,
                kCIInputMaskImageKey: shadeMask(closed, extent: extent),
            ])
        }
        let smoothed = paper.applyingGaussianBlur(sigma: smoothingSigma)
        let leveled = levels(divide(page, by: smoothed))
        let sharpened = leveled.applyingFilter("CIUnsharpMask", parameters: [
            kCIInputRadiusKey: 1.2,
            kCIInputIntensityKey: 0.5,
        ])
        return whiteBorder(sharpened.cropped(to: extent), width: border)
    }

    /// The paper without the ink: a dilation removes strokes thinner than about 15 px.
    static func fineEstimate(_ page: CIImage) -> CIImage {
        page.clampedToExtent().applyingFilter("CIMorphologyMaximum", parameters: [kCIInputRadiusKey: 7])
    }

    static func closedEstimate(_ fine: CIImage) -> CIImage {
        fine.applyingFilter("CIMorphologyMaximum", parameters: [kCIInputRadiusKey: 45])
            .applyingFilter("CIMorphologyMinimum", parameters: [kCIInputRadiusKey: 45])
    }

    /// 1 where the paper lies in a shadow, compared with the lit paper within about 200 px.
    static func shadeMask(_ closed: CIImage, extent: CGRect) -> CIImage {
        let gray = grayscale(closed)
        let lit = gray.cropped(to: extent)
            .transformed(by: CGAffineTransform(scaleX: 0.25, y: 0.25))
            .clampedToExtent()
            .applyingFilter("CIMorphologyMaximum", parameters: [kCIInputRadiusKey: 50])
            .transformed(by: CGAffineTransform(scaleX: 4, y: 4))
            .applyingGaussianBlur(sigma: 40)
        // (0.92 · lit − gray) / (0.1 · lit) = 9.2 − 10 · gray / lit
        return divide(gray, by: lit)
            .applyingFilter("CIColorMatrix", parameters: [
                "inputRVector": CIVector(x: -10, y: 0, z: 0, w: 0),
                "inputGVector": CIVector(x: 0, y: -10, z: 0, w: 0),
                "inputBVector": CIVector(x: 0, y: 0, z: -10, w: 0),
                "inputBiasVector": CIVector(x: 9.2, y: 9.2, z: 9.2, w: 0),
            ])
            .applyingFilter("CIColorClamp")
            .applyingGaussianBlur(sigma: 10)
    }

    static func grayscale(_ image: CIImage) -> CIImage {
        let third = CIVector(x: 1.0 / 3, y: 1.0 / 3, z: 1.0 / 3, w: 0)
        return image.applyingFilter("CIColorMatrix", parameters: [
            "inputRVector": third, "inputGVector": third, "inputBVector": third,
        ])
    }

    /// `CIDivideBlendMode` computes background ÷ input.
    static func divide(_ numerator: CIImage, by denominator: CIImage) -> CIImage {
        denominator.applyingFilter("CIDivideBlendMode", parameters: [kCIInputBackgroundImageKey: numerator])
    }

    static func levels(_ image: CIImage) -> CIImage {
        let scale = 1 / (0.86 - 0.12)
        let bias = -0.12 * scale
        return image.applyingFilter("CIColorMatrix", parameters: [
            "inputRVector": CIVector(x: scale, y: 0, z: 0, w: 0),
            "inputGVector": CIVector(x: 0, y: scale, z: 0, w: 0),
            "inputBVector": CIVector(x: 0, y: 0, z: scale, w: 0),
            "inputBiasVector": CIVector(x: bias, y: bias, z: bias, w: 0),
        ])
        .applyingFilter("CIColorClamp")
        .applyingFilter("CIGammaAdjust", parameters: ["inputPower": 1.35])
    }

    static func whiteBorder(_ image: CIImage, width: Double) -> CIImage {
        let extent = image.extent
        let white = CIImage(color: .white).cropped(to: extent)
        return image.cropped(to: extent.insetBy(dx: width, dy: width)).composited(over: white)
    }

    static func color(_ page: CIImage, context: CIContext) -> CIImage {
        let (low, high) = channelPercentiles(page, context: context)
        func vector(_ channel: Int) -> CIVector {
            let scale = 1 / max(high[channel] - low[channel], 1e-3)
            return CIVector(x: channel == 0 ? scale : 0, y: channel == 1 ? scale : 0, z: channel == 2 ? scale : 0, w: 0)
        }
        let bias = (0..<3).map { -low[$0] / max(high[$0] - low[$0], 1e-3) }
        return page.applyingFilter("CIColorMatrix", parameters: [
            "inputRVector": vector(0), "inputGVector": vector(1), "inputBVector": vector(2),
            "inputBiasVector": CIVector(x: bias[0], y: bias[1], z: bias[2], w: 0),
        ])
        .applyingFilter("CIColorClamp")
        .cropped(to: page.extent)
    }

    static func channelPercentiles(_ page: CIImage, context: CIContext) -> (low: [Double], high: [Double]) {
        let scale = min(1, 512 / max(page.extent.width, page.extent.height))
        let small = page.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        let width = max(1, Int(small.extent.width)), height = max(1, Int(small.extent.height))
        var bytes = [UInt8](repeating: 0, count: width * height * 4)
        context.render(small, toBitmap: &bytes, rowBytes: width * 4,
                       bounds: CGRect(x: small.extent.minX, y: small.extent.minY, width: Double(width), height: Double(height)),
                       format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB))
        var low: [Double] = [], high: [Double] = []
        for channel in 0..<3 {
            let values = stride(from: channel, to: bytes.count, by: 4).map { bytes[$0] }.sorted()
            low.append(Double(values[Int(0.005 * Double(values.count - 1))]) / 255)
            high.append(Double(values[Int(0.99 * Double(values.count - 1))]) / 255)
        }
        return (low, high)
    }

    /// `image` must have a finite extent: crop estimates built on `clampedToExtent()` first.
    static func grayValues(_ image: CIImage, scale: Double, context: CIContext) -> (width: Int, height: Int, values: [Float]) {
        let small = image.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        let width = max(1, Int(small.extent.width)), height = max(1, Int(small.extent.height))
        var pixels = [Float](repeating: 0, count: width * height * 4)
        context.render(small, toBitmap: &pixels, rowBytes: width * 16,
                       bounds: CGRect(x: small.extent.minX, y: small.extent.minY, width: Double(width), height: Double(height)),
                       format: .RGBAf, colorSpace: CGColorSpace(name: CGColorSpace.sRGB))
        let values: [Float] = stride(from: 0, to: pixels.count, by: 4).map { (i: Int) -> Float in
            let sum: Float = pixels[i] + pixels[i + 1] + pixels[i + 2]
            return sum / 3
        }
        return (width, height, values)
    }
}
