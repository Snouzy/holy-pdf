import CoreGraphics

/// A position in normalized page coordinates: 0 to 1, origin top-left.
public struct NormalizedPoint: Hashable, Sendable, Codable {
    public var x: Double
    public var y: Double

    public init(x: Double, y: Double) {
        self.x = x
        self.y = y
    }
}

public struct NormalizedRect: Hashable, Sendable, Codable {
    public var x: Double
    public var y: Double
    public var width: Double
    public var height: Double

    public init(x: Double, y: Double, width: Double, height: Double) {
        self.x = x
        self.y = y
        self.width = width
        self.height = height
    }

    public var maxX: Double { x + width }
    public var maxY: Double { y + height }
    public var midX: Double { x + width / 2 }
    public var cgRect: CGRect { CGRect(x: x, y: y, width: width, height: height) }
}

public struct Quad: Hashable, Sendable, Codable {
    public var topLeft: NormalizedPoint
    public var topRight: NormalizedPoint
    public var bottomRight: NormalizedPoint
    public var bottomLeft: NormalizedPoint

    public init(topLeft: NormalizedPoint, topRight: NormalizedPoint, bottomRight: NormalizedPoint, bottomLeft: NormalizedPoint) {
        self.topLeft = topLeft
        self.topRight = topRight
        self.bottomRight = bottomRight
        self.bottomLeft = bottomLeft
    }

    public init(corners: [NormalizedPoint]) {
        precondition(corners.count == 4, "A quad has four corners")
        self.init(topLeft: corners[0], topRight: corners[1], bottomRight: corners[2], bottomLeft: corners[3])
    }

    public static let fullImage = Quad(topLeft: .init(x: 0, y: 0), topRight: .init(x: 1, y: 0),
                                       bottomRight: .init(x: 1, y: 1), bottomLeft: .init(x: 0, y: 1))

    public var corners: [NormalizedPoint] { [topLeft, topRight, bottomRight, bottomLeft] }
}

public struct PixelSize: Hashable, Sendable, Codable {
    public var width: Int
    public var height: Int

    public init(width: Int, height: Int) {
        self.width = width
        self.height = height
    }

    public init(_ image: CGImage) {
        self.init(width: image.width, height: image.height)
    }
}

public enum Geometry {
    public static func pixel(_ point: NormalizedPoint, in size: PixelSize) -> CGPoint {
        CGPoint(x: point.x * Double(size.width), y: point.y * Double(size.height))
    }

    public static func normalized(_ point: CGPoint, in size: PixelSize) -> NormalizedPoint {
        NormalizedPoint(x: point.x / Double(size.width), y: point.y / Double(size.height))
    }

    public static func coreImagePoint(_ point: NormalizedPoint, in size: PixelSize) -> CGPoint {
        CGPoint(x: point.x * Double(size.width), y: (1 - point.y) * Double(size.height))
    }

    public static func fromBottomLeft(_ point: CGPoint) -> NormalizedPoint {
        NormalizedPoint(x: point.x, y: 1 - point.y)
    }

    public static func fromBottomLeft(_ rect: CGRect) -> NormalizedRect {
        NormalizedRect(x: rect.minX, y: 1 - rect.maxY, width: rect.width, height: rect.height)
    }

    static func topLeftToBottomLeft(height: Int) -> CGAffineTransform {
        CGAffineTransform(a: 1, b: 0, c: 0, d: -1, tx: 0, ty: CGFloat(height))
    }

    public static func measuredSize(of quad: Quad, in size: PixelSize) -> (width: Double, height: Double) {
        let c = quad.corners.map { pixel($0, in: size) }
        let top = distance(c[0], c[1]), right = distance(c[1], c[2])
        let bottom = distance(c[2], c[3]), left = distance(c[3], c[0])
        return ((top + bottom) / 2, (left + right) / 2)
    }

    /// Where a point of an upright page lands when the page turns clockwise by `quarterTurns`.
    public static func rotatedClockwise(_ point: NormalizedPoint, quarterTurns: Int) -> NormalizedPoint {
        var turned = point
        for _ in 0..<(((quarterTurns % 4) + 4) % 4) {
            turned = NormalizedPoint(x: 1 - turned.y, y: turned.x)
        }
        return turned
    }

    /// A quad the user can keep: corners inside the photo, in clockwise order, convex, over at least 1 % of the photo.
    public static func isUsable(_ quad: Quad) -> Bool {
        let c = quad.corners
        guard c.allSatisfy({ (0...1).contains($0.x) && (0...1).contains($0.y) }) else { return false }
        for i in 0..<4 {
            let a = c[i], b = c[(i + 1) % 4], next = c[(i + 2) % 4]
            if (b.x - a.x) * (next.y - b.y) - (b.y - a.y) * (next.x - b.x) <= 0 { return false }
        }
        return area(quad) >= 0.01
    }

    /// Shoelace area, as a fraction of the photo.
    static func area(_ quad: Quad) -> Double {
        let c = quad.corners
        return (0..<4).reduce(0) { sum, i in sum + c[i].x * c[(i + 1) % 4].y - c[(i + 1) % 4].x * c[i].y } / 2
    }

    public static func maxCornerShift(from a: Quad, to b: Quad, in size: PixelSize) -> Double {
        let diagonal = (Double(size.width * size.width + size.height * size.height)).squareRoot()
        let moves = zip(a.corners, b.corners).map { distance(pixel($0, in: size), pixel($1, in: size)) }
        return (moves.max() ?? 0) / diagonal
    }

    static func distance(_ a: CGPoint, _ b: CGPoint) -> Double {
        ((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y)).squareRoot()
    }
}
