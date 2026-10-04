import CoreImage

/// A watermark shows up as wide strokes that the closing fills but the fine paper estimate keeps.
public enum WatermarkDetector {
    static let fillThreshold: Float = 0.08
    static let minCoverage = 0.024
    static let scale = 0.25

    public static func detect(_ page: CIImage, context: CIContext) -> Bool {
        coverage(page, context: context) > minCoverage
    }

    /// Share of the page interior (10 % margins left out) filled by the closing outside shadows.
    public static func coverage(_ page: CIImage, context: CIContext) -> Double {
        let extent = page.extent
        let fineImage = Enhancer.fineEstimate(page)
        let closedImage = Enhancer.closedEstimate(fineImage)
        let fine = Enhancer.grayValues(fineImage.cropped(to: extent), scale: scale, context: context)
        let closed = Enhancer.grayValues(closedImage.cropped(to: extent), scale: scale, context: context)
        let shade = Enhancer.grayValues(Enhancer.shadeMask(closedImage, extent: extent).cropped(to: extent), scale: scale, context: context)
        guard fine.values.count == closed.values.count, fine.values.count == shade.values.count else { return 0 }
        var filled = 0
        var total = 0
        for y in Int(0.1 * Double(fine.height))..<Int(0.9 * Double(fine.height)) {
            for x in Int(0.1 * Double(fine.width))..<Int(0.9 * Double(fine.width)) {
                let index = y * fine.width + x
                total += 1
                if shade.values[index] < 0.5 && closed.values[index] - fine.values[index] > fillThreshold {
                    filled += 1
                }
            }
        }
        return total > 0 ? Double(filled) / Double(total) : 0
    }
}
