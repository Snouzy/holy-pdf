import CoreGraphics
import ScanCore
import SwiftUI

/// Normalized page coordinates ↔ points on screen, for the correction views. Origin top-left, like the engine.
enum ScreenGeometry {
    static func fit(_ size: CGSize, in bounds: CGSize) -> CGRect {
        guard size.width > 0, size.height > 0 else { return .zero }
        let scale = min(bounds.width / size.width, bounds.height / size.height)
        let fitted = CGSize(width: size.width * scale, height: size.height * scale)
        return CGRect(x: (bounds.width - fitted.width) / 2, y: (bounds.height - fitted.height) / 2,
                      width: fitted.width, height: fitted.height)
    }

    static func point(_ point: NormalizedPoint, in frame: CGRect) -> CGPoint {
        CGPoint(x: frame.minX + point.x * frame.width, y: frame.minY + point.y * frame.height)
    }

    /// Clamped to the image: a corner dragged past the edge stops on it.
    static func normalized(_ location: CGPoint, in frame: CGRect) -> NormalizedPoint {
        NormalizedPoint(x: min(max((location.x - frame.minX) / frame.width, 0), 1),
                        y: min(max((location.y - frame.minY) / frame.height, 0), 1))
    }

    static func outline(_ quad: Quad, in frame: CGRect) -> Path {
        Path { path in
            path.addLines(quad.corners.map { point($0, in: frame) })
            path.closeSubpath()
        }
    }
}
