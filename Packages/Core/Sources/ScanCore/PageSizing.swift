import CoreGraphics

public enum PageFormat: String, Sendable, Codable, CaseIterable {
    case auto, a4, a5, letter
}

public enum PageSizing {
    public static let isoRatio = 2.0.squareRoot()
    public static let letterRatio = 11.0 / 8.5
    public static let ratioTolerance = 0.06
    public static let isoLongSide = 2339
    public static let shortSide = 1654
    public static let dpi = 200.0
    /// About 89 cm at 200 dpi. A quad dragged into a sliver would otherwise ask for millions of pixels.
    public static let maxLongSide = 7016

    public static func isKnownRatio(_ ratio: Double) -> Bool {
        isNear(ratio, isoRatio) || isNear(ratio, letterRatio)
    }

    /// `nil` when the measured size is not a real size (a degenerate quad).
    public static func renderSize(measuredWidth width: Double, measuredHeight height: Double) -> PixelSize? {
        guard width.isFinite, height.isFinite, width > 0, height > 0 else { return nil }
        let ratio = max(width, height) / max(min(width, height), 1)
        var short = shortSide
        var long = isNear(ratio, isoRatio) ? isoLongSide : Int((Double(shortSide) * ratio).rounded())
        if long > maxLongSide {
            short = max(1, Int((Double(maxLongSide) / ratio).rounded()))
            long = maxLongSide
        }
        return height >= width ? PixelSize(width: short, height: long) : PixelSize(width: long, height: short)
    }

    public static func pdfPageSize(format: PageFormat, pixels: PixelSize) -> CGSize {
        let landscape = pixels.width > pixels.height
        func oriented(_ short: Double, _ long: Double) -> CGSize {
            landscape ? CGSize(width: long, height: short) : CGSize(width: short, height: long)
        }
        switch format {
        case .a4:
            return oriented(595.28, 841.89)
        case .a5:
            return oriented(419.53, 595.28)
        case .letter:
            return oriented(612, 792)
        case .auto:
            let ratio = Double(max(pixels.width, pixels.height)) / Double(max(min(pixels.width, pixels.height), 1))
            if abs(ratio / isoRatio - 1) < 0.01 { return oriented(595.28, 841.89) }
            return CGSize(width: Double(pixels.width) / dpi * 72, height: Double(pixels.height) / dpi * 72)
        }
    }

    static func isNear(_ ratio: Double, _ target: Double) -> Bool {
        abs(ratio / target - 1) < ratioTolerance
    }
}
