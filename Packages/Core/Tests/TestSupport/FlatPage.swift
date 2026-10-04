import CoreGraphics
import CoreImage
import ScanCore

public struct FlatPage {
    public var size = PixelSize(width: 1654, height: 2339)
    public var paper: CGFloat = 0.85
    public var shadow = false
    public var streakInShadow = false
    public var watermark = false
    /// Tinted body inside white margins: the margins keep the 99th percentile on white, as on a real certificate.
    public var tint: (red: CGFloat, green: CGFloat, blue: CGFloat)?
    public var darkFrame = false

    public static let textPoint = NormalizedPoint(x: 0.3, y: 0.1817)
    public static let paperPoint = NormalizedPoint(x: 0.5, y: 0.6)
    public static let watermarkPoint = NormalizedPoint(x: 0.4, y: 0.5)
    public static let shadowPoint = NormalizedPoint(x: 0.3, y: 0.85)
    /// Close to the lit paper: deeper in a wide shadow, the streak stays grey, as in the prototype.
    public static let streakPoint = NormalizedPoint(x: 0.5, y: 0.74)
    public static let tintPoint = NormalizedPoint(x: 0.5, y: 0.6)
    public static let marginPoint = NormalizedPoint(x: 0.03, y: 0.5)

    public init() {}

    public func render() -> CIImage {
        let w = Double(size.width), h = Double(size.height)
        let image = TestImages.draw(width: size.width, height: size.height) { context in
            context.setFillColor(CGColor(gray: paper, alpha: 1))
            context.fill(CGRect(x: 0, y: 0, width: w, height: h))
            if let tint {
                context.setFillColor(CGColor(gray: 1, alpha: 1))
                context.fill(CGRect(x: 0, y: 0, width: w, height: h))
                context.setFillColor(CGColor(red: tint.red, green: tint.green, blue: tint.blue, alpha: 1))
                context.fill(CGRect(x: 0.08 * w, y: 0.08 * h, width: 0.84 * w, height: 0.84 * h))
            }
            context.setFillColor(CGColor(gray: 0.1, alpha: 1))
            for row in 0..<6 {
                context.fill(CGRect(x: 0.1 * w, y: (0.18 + 0.02 * Double(row)) * h, width: 0.7 * w, height: 8))
            }
            if watermark {
                context.setStrokeColor(CGColor(gray: 0.6, alpha: 1))
                context.setLineWidth(40)
                for offset in [-0.1, 0, 0.1, 0.2] {
                    context.move(to: CGPoint(x: (0.3 + offset) * w, y: 0.65 * h))
                    context.addLine(to: CGPoint(x: (0.5 + offset) * w, y: 0.35 * h))
                    context.strokePath()
                }
            }
            if shadow {
                context.setFillColor(CGColor(gray: 0, alpha: 0.25))
                context.fill(CGRect(x: 0, y: 0.7 * h, width: w, height: 0.3 * h))
                if streakInShadow {
                    context.setFillColor(CGColor(gray: 0, alpha: 0.12))
                    context.fill(CGRect(x: 0.5 * w - 12, y: 0.7 * h, width: 24, height: 0.3 * h))
                }
            }
            if darkFrame {
                context.setStrokeColor(CGColor(gray: 0, alpha: 1))
                context.setLineWidth(24)
                context.stroke(CGRect(x: 0, y: 0, width: w, height: h))
            }
        }
        return CIImage(cgImage: image)
    }
}
