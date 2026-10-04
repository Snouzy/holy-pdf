import CoreGraphics
import Foundation

/// The site's six colours, in its order.
public enum EditColor: CaseIterable, Sendable {
    case black, blue, red, green, yellow, white

    public var cgColor: CGColor {
        let (red, green, blue): (CGFloat, CGFloat, CGFloat) = switch self {
        case .black: (0, 0, 0)
        case .blue: (29, 78, 216)
        case .red: (220, 38, 38)
        case .green: (22, 163, 74)
        case .yellow: (250, 204, 21)
        case .white: (255, 255, 255)
        }
        return CGColor(srgbRed: red / 255, green: green / 255, blue: blue / 255, alpha: 1)
    }
}

public enum EditFont: CaseIterable, Sendable {
    case helvetica, times, courier
}

public struct EditTextStyle: Equatable, Sendable {
    public static let sizes: ClosedRange<CGFloat> = 8...96

    public var font: EditFont
    public var bold: Bool
    /// In points.
    public var size: CGFloat
    public var color: EditColor

    public init(font: EditFont = .helvetica, bold: Bool = false, size: CGFloat = 16, color: EditColor = .black) {
        self.font = font
        self.bold = bold
        self.size = size
        self.color = color
    }
}

/// In points.
public enum EditThickness: CGFloat, CaseIterable, Sendable {
    case thin = 1, medium = 2.5, thick = 5
}

public struct EditStroke: Equatable, Sendable {
    public var color: EditColor
    public var thickness: EditThickness

    public init(color: EditColor, thickness: EditThickness) {
        self.color = color
        self.thickness = thickness
    }
}

public struct EditShapeStyle: Equatable, Sendable {
    public var color: EditColor
    public var filled: Bool
    /// The outline's, when the shape is not filled.
    public var thickness: EditThickness

    public init(color: EditColor = .black, filled: Bool = false, thickness: EditThickness = .medium) {
        self.color = color
        self.filled = filled
        self.thickness = thickness
    }
}

/// A picture as the page shows it: the part kept, then turned, then mirrored.
public struct EditPicture: Equatable, Sendable {
    public static let whole = CGRect(x: 0, y: 0, width: 1, height: 1)

    /// The key of its `EditImage`.
    public var image: UUID
    /// The part of the upright image that stays, normalized, origin top-left. It does not move when the picture turns.
    public var crop: CGRect
    /// Clockwise.
    public var quarterTurns: Int
    /// After the turns: as the reader sees the picture.
    public var flippedHorizontally: Bool
    public var flippedVertically: Bool

    public init(image: UUID, crop: CGRect = whole, quarterTurns: Int = 0, flippedHorizontally: Bool = false, flippedVertically: Bool = false) {
        self.image = image
        self.crop = crop
        self.quarterTurns = quarterTurns
        self.flippedHorizontally = flippedHorizontally
        self.flippedVertically = flippedVertically
    }

    public var isValid: Bool {
        [crop.minX, crop.minY, crop.width, crop.height].allSatisfy(\.isFinite) && crop.width > 0 && crop.height > 0
            && crop.minX >= 0 && crop.minY >= 0 && crop.maxX <= 1 && crop.maxY <= 1 && (0...3).contains(quarterTurns)
    }

    /// `crop` as the reader sees the picture.
    public var shownCrop: CGRect { mapped(crop, by: shown) }

    /// The same picture keeping `rect`, given as the reader sees the picture.
    public func withShownCrop(_ rect: CGRect) -> EditPicture {
        var picture = self
        picture.crop = mapped(rect, by: source).intersection(Self.whole)
        return picture
    }

    /// A quarter turn to the right as the reader sees it: under one mirror, the stored turn goes the other way.
    public func turned() -> EditPicture {
        var picture = self
        picture.quarterTurns = (quarterTurns + (flippedHorizontally != flippedVertically ? 3 : 1)) % 4
        return picture
    }

    private func shown(_ point: CGPoint) -> CGPoint {
        var point = point
        for _ in 0..<quarterTurns { point = CGPoint(x: 1 - point.y, y: point.x) }
        if flippedHorizontally { point.x = 1 - point.x }
        if flippedVertically { point.y = 1 - point.y }
        return point
    }

    private func source(_ point: CGPoint) -> CGPoint {
        var point = point
        if flippedVertically { point.y = 1 - point.y }
        if flippedHorizontally { point.x = 1 - point.x }
        for _ in 0..<quarterTurns { point = CGPoint(x: point.y, y: 1 - point.x) }
        return point
    }

    private func mapped(_ rect: CGRect, by map: (CGPoint) -> CGPoint) -> CGRect {
        let a = map(CGPoint(x: rect.minX, y: rect.minY)), b = map(CGPoint(x: rect.maxX, y: rect.maxY))
        return CGRect(x: min(a.x, b.x), y: min(a.y, b.y), width: abs(a.x - b.x), height: abs(a.y - b.y))
    }
}

/// One addition to a page.
public struct EditItem: Identifiable, Equatable, Sendable {
    public enum Content: Equatable, Sendable {
        case text(String, EditTextStyle)
        case picture(EditPicture)
        case rectangle(EditShapeStyle)
        case ellipse(EditShapeStyle)
        case highlight(EditColor)
        case line(EditStroke, arrow: Bool)
        case ink(EditStroke)
    }

    public let id: UUID
    public var pageIndex: Int
    /// Normalized to the page as the reader sees it, origin top-left. A text starts at the top-left corner of its first
    /// line; its size serves the screen, the export measures the text again.
    public var frame: CGRect
    /// A line's start and end, or an ink's stroke, normalized to `frame`: moving or resizing changes the frame only.
    public var points: [CGPoint]
    public var content: Content

    public init(id: UUID = UUID(), pageIndex: Int, frame: CGRect, points: [CGPoint] = [], content: Content) {
        self.id = id
        self.pageIndex = pageIndex
        self.frame = frame
        self.points = points
        self.content = content
    }

    /// A line or an ink through `points`, given on the page.
    public static func stroke(id: UUID = UUID(), pageIndex: Int, through points: [CGPoint], content: Content) -> EditItem {
        let xs = points.map(\.x), ys = points.map(\.y)
        let frame = CGRect(x: xs.min() ?? 0, y: ys.min() ?? 0, width: (xs.max() ?? 0) - (xs.min() ?? 0), height: (ys.max() ?? 0) - (ys.min() ?? 0))
        let relative = points.map {
            CGPoint(x: frame.width > 0 ? ($0.x - frame.minX) / frame.width : 0, y: frame.height > 0 ? ($0.y - frame.minY) / frame.height : 0)
        }
        return EditItem(id: id, pageIndex: pageIndex, frame: frame, points: relative, content: content)
    }

    public var pagePoints: [CGPoint] {
        points.map { CGPoint(x: frame.minX + $0.x * frame.width, y: frame.minY + $0.y * frame.height) }
    }

    public var isValid: Bool {
        let numbers = [frame.minX, frame.minY, frame.width, frame.height] + points.flatMap { [$0.x, $0.y] }
        guard pageIndex >= 0, numbers.allSatisfy(\.isFinite) else { return false }
        let hasArea = frame.width > 0 && frame.height > 0
        switch content {
        case .text(let string, let style):
            return !string.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && EditTextStyle.sizes.contains(style.size)
        case .picture(let picture): return hasArea && picture.isValid
        case .rectangle, .ellipse, .highlight: return hasArea
        case .line: return points.count == 2
        case .ink: return points.count >= 2
        }
    }
}
