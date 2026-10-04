import CoreGraphics
import CoreImage
import CoreImage.CIFilterBuiltins

public enum Rectifier {
    public static func outputSize(for quad: Quad, in size: PixelSize) -> PixelSize? {
        let measured = Geometry.measuredSize(of: quad, in: size)
        return PageSizing.renderSize(measuredWidth: measured.width, measuredHeight: measured.height)
    }

    /// The page inside `quad`, flattened and scaled to `outputSize(for:in:)`, with its extent at the origin.
    public static func rectify(_ image: CGImage, quad: Quad) throws(ScanError) -> CIImage {
        let size = PixelSize(image)
        let correction = CIFilter.perspectiveCorrection()
        correction.inputImage = CIImage(cgImage: image)
        correction.topLeft = Geometry.coreImagePoint(quad.topLeft, in: size)
        correction.topRight = Geometry.coreImagePoint(quad.topRight, in: size)
        correction.bottomRight = Geometry.coreImagePoint(quad.bottomRight, in: size)
        correction.bottomLeft = Geometry.coreImagePoint(quad.bottomLeft, in: size)
        guard let flat = correction.outputImage, flat.extent.width >= 1, flat.extent.height >= 1 else {
            throw .renderFailed
        }
        guard let target = outputSize(for: quad, in: size) else { throw .renderFailed }
        let atOrigin = flat.transformed(by: CGAffineTransform(translationX: -flat.extent.minX, y: -flat.extent.minY))
        let verticalScale = Double(target.height) / flat.extent.height
        let horizontalScale = Double(target.width) / flat.extent.width
        let scaling = CIFilter.lanczosScaleTransform()
        scaling.inputImage = atOrigin
        scaling.scale = Float(verticalScale)
        scaling.aspectRatio = Float(horizontalScale / verticalScale)
        guard let scaled = scaling.outputImage else { throw .renderFailed }
        // Lanczos output can end a fraction of a pixel short: clamp before cropping to whole pixels.
        return scaled.clampedToExtent().cropped(to: CGRect(x: 0, y: 0, width: target.width, height: target.height))
    }
}
