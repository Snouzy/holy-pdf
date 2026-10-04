import CoreGraphics
import ScanCore

/// A document photo drawn in code: a sheet of paper on a grey table, with optional traps
/// taken from the real batch.
public struct SyntheticPage {
    public var size = PixelSize(width: 1200, height: 1600)
    /// Pixel corners, top-left origin, clockwise from the top-left.
    public var corners = [CGPoint(x: 180, y: 150), CGPoint(x: 1010, y: 175), CGPoint(x: 1040, y: 1340), CGPoint(x: 150, y: 1320)]
    public var table: CGFloat = 0.42
    public var paper: CGFloat = 0.9
    public var textLines = true
    /// A dark header just under the top edge. Use it with a darker `table`: its drop must beat
    /// the paper-to-table drop (so a strongest-drop rule picks the header) while the table drop
    /// stays above 60 % of it (so the outermost-drop rule still picks the paper edge).
    public var boldBandNearTop = false
    /// Another sheet lying over the top-right corner, as on 9 of the 17 real photos.
    public var coveredTopRightCorner = false
    public var shadowOverBottom = false
    /// Page position of a black square, to check where the page content lands.
    public var marker: NormalizedPoint?

    public init() {}

    public var quad: Quad { Quad(corners: corners.map { Geometry.normalized($0, in: size) }) }

    /// The photo point at page position (u, v), both in 0…1.
    public func point(u: Double, v: Double) -> CGPoint {
        mix(mix(corners[0], corners[1], u), mix(corners[3], corners[2], u), v)
    }

    public func render() -> CGImage {
        TestImages.draw(width: size.width, height: size.height) { context in
            context.setFillColor(CGColor(gray: table, alpha: 1))
            context.fill(CGRect(x: 0, y: 0, width: size.width, height: size.height))
            polygon(context, gray: paper, corners)
            if textLines {
                for row in 0..<16 {
                    let v = 0.12 + 0.045 * Double(row)
                    let end = 0.55 + 0.35 * Double((row * 7) % 5) / 4
                    band(context, gray: 0.15, u: 0.1...end, v: v...(v + 0.005))
                }
            }
            if boldBandNearTop {
                band(context, gray: 0.1, u: 0.08...0.92, v: 0.014...0.025)
            }
            if let marker {
                band(context, gray: 0, u: (marker.x - 0.03)...(marker.x + 0.03), v: (marker.y - 0.02)...(marker.y + 0.02))
            }
            if shadowOverBottom {
                polygon(context, gray: 0, alpha: 0.3, [point(u: 0, v: 0.72), point(u: 1, v: 0.72), point(u: 1, v: 1), point(u: 0, v: 1)])
            }
            if coveredTopRightCorner {
                let onTop = point(u: 0.7, v: 0)
                let onRight = point(u: 1, v: 0.22)
                let outside = CGPoint(x: corners[1].x + 120, y: corners[1].y - 120)
                polygon(context, gray: 0.97, [onTop, CGPoint(x: onTop.x, y: onTop.y - 120), outside,
                                              CGPoint(x: onRight.x + 120, y: onRight.y), onRight])
            }
        }
    }

    func mix(_ a: CGPoint, _ b: CGPoint, _ t: Double) -> CGPoint {
        CGPoint(x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t)
    }

    func polygon(_ context: CGContext, gray: CGFloat, alpha: CGFloat = 1, _ points: [CGPoint]) {
        context.setFillColor(CGColor(gray: gray, alpha: alpha))
        context.addLines(between: points)
        context.closePath()
        context.fillPath()
    }

    func band(_ context: CGContext, gray: CGFloat, u: ClosedRange<Double>, v: ClosedRange<Double>) {
        polygon(context, gray: gray, [point(u: u.lowerBound, v: v.lowerBound), point(u: u.upperBound, v: v.lowerBound),
                                      point(u: u.upperBound, v: v.upperBound), point(u: u.lowerBound, v: v.upperBound)])
    }
}
