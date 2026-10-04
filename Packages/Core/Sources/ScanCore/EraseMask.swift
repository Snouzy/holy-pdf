import CoreGraphics
import CoreImage

public enum EraseMark: Hashable, Sendable, Codable {
    case polygon(points: [NormalizedPoint])
    /// A brush stroke; `radius` is a fraction of the page width.
    case stroke(points: [NormalizedPoint], radius: Double)
}

extension EraseMark {
    /// The same mark on the page turned clockwise by `quarterTurns`. `pageSize` is the size before the turn.
    public func rotated(quarterTurns: Int, pageSize: PixelSize) -> EraseMark {
        let turns = ((quarterTurns % 4) + 4) % 4
        let turn = { (point: NormalizedPoint) in Geometry.rotatedClockwise(point, quarterTurns: turns) }
        switch self {
        case .polygon(let points):
            return .polygon(points: points.map(turn))
        case .stroke(let points, let radius):
            // The radius is a fraction of the page width, and an odd turn swaps width and height.
            let scale = turns % 2 == 1 ? Double(pageSize.width) / Double(pageSize.height) : 1
            return .stroke(points: points.map(turn), radius: radius * scale)
        }
    }
}

public enum EraseMask {
    public static func apply(_ marks: [EraseMark], to page: CIImage) -> CIImage {
        let extent = page.extent
        let size = PixelSize(width: Int(extent.width.rounded()), height: Int(extent.height.rounded()))
        guard !marks.isEmpty, size.width > 0, size.height > 0, let mask = maskImage(marks, size: size) else { return page }
        let white = CIImage(color: .white).cropped(to: extent)
        return white.applyingFilter("CIBlendWithMask", parameters: [
            kCIInputBackgroundImageKey: page,
            kCIInputMaskImageKey: CIImage(cgImage: mask).transformed(by: CGAffineTransform(translationX: extent.minX, y: extent.minY)),
        ])
    }

    /// White where the page is erased, black elsewhere.
    static func maskImage(_ marks: [EraseMark], size: PixelSize) -> CGImage? {
        guard let context = CGContext(data: nil, width: size.width, height: size.height, bitsPerComponent: 8, bytesPerRow: 0,
                                      space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue) else {
            return nil
        }
        context.setFillColor(gray: 0, alpha: 1)
        context.fill(CGRect(x: 0, y: 0, width: size.width, height: size.height))
        context.concatenate(Geometry.topLeftToBottomLeft(height: size.height))
        context.setFillColor(gray: 1, alpha: 1)
        context.setStrokeColor(gray: 1, alpha: 1)
        context.setLineCap(.round)
        context.setLineJoin(.round)
        for mark in marks {
            switch mark {
            case .polygon(let points):
                guard points.count >= 3 else { continue }
                context.addLines(between: points.map { Geometry.pixel($0, in: size) })
                context.closePath()
                context.fillPath()
            case .stroke(let points, let radius):
                let pixels = points.map { Geometry.pixel($0, in: size) }
                let width = 2 * radius * Double(size.width)
                guard let first = pixels.first, width > 0 else { continue }
                if pixels.count == 1 {
                    context.fillEllipse(in: CGRect(x: first.x - width / 2, y: first.y - width / 2, width: width, height: width))
                } else {
                    context.setLineWidth(width)
                    context.addLines(between: pixels)
                    context.strokePath()
                }
            }
        }
        return context.makeImage()
    }
}
