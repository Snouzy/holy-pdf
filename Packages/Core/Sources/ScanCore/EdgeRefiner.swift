import CoreGraphics
import simd

struct EdgeLine: Equatable {
    var point: SIMD2<Double>
    var direction: SIMD2<Double>
}

struct RefinedQuad: Equatable {
    var quad: Quad
    /// Share of edge samples kept by the line fit: top, right, bottom, left.
    var inlierRatios: [Double]
}

/// Moves each edge of a rough quad onto the paper edge, then rebuilds the corners as the
/// intersections of the edges. A corner hidden under another sheet is rebuilt that way too.
enum EdgeRefiner {
    static let scale = 0.25
    static let samplesPerEdge = 80
    static let minDrop: Float = 12
    static let strongFraction: Float = 0.6
    static let minPoints = 10

    static func refine(_ quad: Quad, in image: CGImage) -> RefinedQuad {
        guard let gray = GrayImage(image, scale: scale) else {
            return RefinedQuad(quad: quad, inlierRatios: [0, 0, 0, 0])
        }
        let size = PixelSize(width: gray.width, height: gray.height)
        let corners = quad.corners.map { corner -> SIMD2<Double> in
            let point = Geometry.pixel(corner, in: size)
            return SIMD2(point.x, point.y)
        }
        let center = corners.reduce(SIMD2<Double>.zero, +) / 4
        let band = max(2, Int(0.03 * Double(min(gray.width, gray.height))))
        var lines: [EdgeLine] = []
        var ratios: [Double] = []
        for index in 0..<4 {
            let start = corners[index], end = corners[(index + 1) % 4]
            if let fit = fitEdge(gray, from: start, to: end, center: center, band: band) {
                lines.append(fit.line)
                ratios.append(fit.inlierRatio)
            } else {
                let direction = simd_length(end - start) > 0 ? simd_normalize(end - start) : SIMD2(1, 0)
                lines.append(EdgeLine(point: start, direction: direction))
                ratios.append(0)
            }
        }
        let refined = (0..<4).map { index -> NormalizedPoint in
            let corner = intersect(lines[(index + 3) % 4], lines[index]) ?? corners[index]
            return Geometry.normalized(CGPoint(x: corner.x, y: corner.y), in: size)
        }
        return RefinedQuad(quad: Quad(corners: refined), inlierRatios: ratios)
    }

    static func fitEdge(_ gray: GrayImage, from start: SIMD2<Double>, to end: SIMD2<Double>,
                        center: SIMD2<Double>, band: Int) -> (line: EdgeLine, inlierRatio: Double)? {
        guard simd_length(end - start) > 1 else { return nil }
        let direction = simd_normalize(end - start)
        var normal = SIMD2(-direction.y, direction.x)
        if simd_dot(normal, (start + end) / 2 - center) < 0 { normal = -normal }

        var points: [SIMD2<Double>] = []
        for sample in 0..<samplesPerEdge {
            let t = 0.06 + 0.88 * Double(sample) / Double(samplesPerEdge - 1)
            let base = start + t * (end - start)
            let profile = (-band...band).map { gray.sample(base + Double($0) * normal) }
            let drops = (0..<(profile.count - 3)).map { profile[$0] - profile[$0 + 3] }
            // Bold text just inside the edge can drop more than the paper edge itself,
            // so the outermost strong drop wins, not the strongest one.
            guard let strongest = drops.max(), strongest > minDrop,
                  let outermost = drops.lastIndex(where: { $0 > strongFraction * strongest }) else { continue }
            points.append(base + Double(outermost + 1 - band) * normal)
        }
        guard points.count >= minPoints else { return nil }

        var keep = [Bool](repeating: true, count: points.count)
        var line = fitLine(points)
        for _ in 0..<4 {
            let residuals = points.map { distance($0, to: line) }
            let kept = zip(residuals, keep).compactMap { $1 ? $0 : nil }
            let limit = max(1.5, 2.5 * median(kept))
            keep = residuals.map { $0 < limit }
            let inliers = zip(points, keep).compactMap { $1 ? $0 : nil }
            guard inliers.count >= 2 else { break }
            line = fitLine(inliers)
        }
        return (line, Double(keep.filter { $0 }.count) / Double(points.count))
    }

    /// Total least squares: the direction is the main axis of the points.
    static func fitLine(_ points: [SIMD2<Double>]) -> EdgeLine {
        let mean = points.reduce(SIMD2<Double>.zero, +) / Double(points.count)
        var sxx = 0.0, sxy = 0.0, syy = 0.0
        for point in points {
            let d = point - mean
            sxx += d.x * d.x
            sxy += d.x * d.y
            syy += d.y * d.y
        }
        let angle = 0.5 * atan2(2 * sxy, sxx - syy)
        return EdgeLine(point: mean, direction: SIMD2(cos(angle), sin(angle)))
    }

    static func distance(_ point: SIMD2<Double>, to line: EdgeLine) -> Double {
        abs(cross(point - line.point, line.direction))
    }

    static func intersect(_ a: EdgeLine, _ b: EdgeLine) -> SIMD2<Double>? {
        let denominator = cross(a.direction, b.direction)
        guard abs(denominator) > 1e-9 else { return nil }
        return a.point + cross(b.point - a.point, b.direction) / denominator * a.direction
    }

    static func cross(_ a: SIMD2<Double>, _ b: SIMD2<Double>) -> Double {
        a.x * b.y - a.y * b.x
    }

    static func median(_ values: [Double]) -> Double {
        guard !values.isEmpty else { return 0 }
        return values.sorted()[values.count / 2]
    }
}
