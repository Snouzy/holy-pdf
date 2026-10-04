import CoreGraphics
import CoreText
import Foundation

/// Draws the additions, for the copy and for the screen alike.
public enum EditPainter {
    /// `context` is in the page's space as the reader sees it, in points, origin bottom-left; `page` is its bounds.
    /// `picture` is a picture item's image, already cropped.
    public static func draw(_ item: EditItem, picture: CGImage? = nil, in context: CGContext, page: CGRect) {
        let box = rect(item.frame, in: page)
        context.saveGState()
        defer { context.restoreGState() }
        switch item.content {
        case .rectangle(let style): shape(CGPath(rect: inset(box, style), transform: nil), style: style, in: context)
        case .ellipse(let style): shape(CGPath(ellipseIn: inset(box, style), transform: nil), style: style, in: context)
        case .highlight(let color):
            context.setBlendMode(.multiply)
            context.setFillColor(color.cgColor)
            context.fill(box)
        case .line(let stroke, let arrow):
            let ends = item.points.map { point($0, in: box) }
            if ends.count == 2 { line(from: ends[0], to: ends[1], stroke: stroke, arrow: arrow, in: context) }
        case .ink(let stroke):
            setStroke(stroke, in: context)
            context.addLines(between: item.points.map { point($0, in: box) })
            context.strokePath()
        case .text(let string, let style):
            text(string, style: style, top: CGPoint(x: box.minX, y: box.maxY), in: context)
        case .picture(let shown):
            if let picture { draw(picture, as: shown, in: box, context: context) }
        }
    }

    /// In points: the widest line, and one line height per line.
    public static func textSize(_ string: String, style: EditTextStyle) -> CGSize {
        let font = font(style)
        let lines = string.components(separatedBy: "\n")
        let width = lines.map { CGFloat(CTLineGetTypographicBounds(line($0, style: style, font: font), nil, nil, nil)) }.max() ?? 0
        return CGSize(width: width, height: CGFloat(lines.count) * lineHeight(font))
    }

    /// The PostScript name, for a text field that must look like the page.
    public static func fontName(_ style: EditTextStyle) -> String {
        switch (style.font, style.bold) {
        case (.helvetica, false): "Helvetica"
        case (.helvetica, true): "Helvetica-Bold"
        case (.times, false): "Times-Roman"
        case (.times, true): "Times-Bold"
        case (.courier, false): "Courier"
        case (.courier, true): "Courier-Bold"
        }
    }

    /// From one baseline to the next, in points.
    public static func lineHeight(_ style: EditTextStyle) -> CGFloat { lineHeight(font(style)) }

    static func rect(_ normalized: CGRect, in page: CGRect) -> CGRect {
        CGRect(x: page.minX + normalized.minX * page.width, y: page.maxY - normalized.maxY * page.height,
               width: normalized.width * page.width, height: normalized.height * page.height)
    }

    private static func point(_ relative: CGPoint, in box: CGRect) -> CGPoint {
        CGPoint(x: box.minX + relative.x * box.width, y: box.maxY - relative.y * box.height)
    }

    private static func font(_ style: EditTextStyle) -> CTFont { CTFontCreateWithName(fontName(style) as CFString, style.size, nil) }

    private static func lineHeight(_ font: CTFont) -> CGFloat { CTFontGetAscent(font) + CTFontGetDescent(font) + CTFontGetLeading(font) }

    private static func line(_ string: String, style: EditTextStyle, font: CTFont) -> CTLine {
        let attributes = [kCTFontAttributeName: font, kCTForegroundColorAttributeName: style.color.cgColor] as CFDictionary
        return CTLineCreateWithAttributedString(CFAttributedStringCreate(nil, string as CFString, attributes))
    }

    private static func text(_ string: String, style: EditTextStyle, top: CGPoint, in context: CGContext) {
        let font = font(style)
        let height = lineHeight(font)
        context.textMatrix = .identity
        for (index, part) in string.components(separatedBy: "\n").enumerated() where !part.isEmpty {
            context.textPosition = CGPoint(x: top.x, y: top.y - CTFontGetAscent(font) - CGFloat(index) * height)
            CTLineDraw(line(part, style: style, font: font), context)
        }
    }

    /// The outline stays inside the box the user drew.
    private static func inset(_ box: CGRect, _ style: EditShapeStyle) -> CGRect {
        let half = style.thickness.rawValue / 2
        return style.filled || box.width <= 2 * half || box.height <= 2 * half ? box : box.insetBy(dx: half, dy: half)
    }

    private static func shape(_ path: CGPath, style: EditShapeStyle, in context: CGContext) {
        context.addPath(path)
        if style.filled {
            context.setFillColor(style.color.cgColor)
            context.fillPath()
        } else {
            setStroke(EditStroke(color: style.color, thickness: style.thickness), in: context)
            context.strokePath()
        }
    }

    private static func setStroke(_ stroke: EditStroke, in context: CGContext) {
        context.setStrokeColor(stroke.color.cgColor)
        context.setLineWidth(stroke.thickness.rawValue)
        context.setLineCap(.round)
        context.setLineJoin(.round)
    }

    private static func line(from start: CGPoint, to end: CGPoint, stroke: EditStroke, arrow: Bool, in context: CGContext) {
        setStroke(stroke, in: context)
        let length = hypot(end.x - start.x, end.y - start.y)
        guard arrow, length > 0 else { return context.strokeLineSegments(between: [start, end]) }
        let head = min(length, max(8, 4 * stroke.thickness.rawValue))
        let direction = CGPoint(x: (end.x - start.x) / length, y: (end.y - start.y) / length)
        let base = CGPoint(x: end.x - direction.x * head, y: end.y - direction.y * head)
        let side = CGPoint(x: -direction.y * head / 2, y: direction.x * head / 2)
        context.strokeLineSegments(between: [start, base])
        context.setFillColor(stroke.color.cgColor)
        context.addLines(between: [end, CGPoint(x: base.x + side.x, y: base.y + side.y), CGPoint(x: base.x - side.x, y: base.y - side.y)])
        context.closePath()
        context.fillPath()
    }

    private static func draw(_ image: CGImage, as picture: EditPicture, in box: CGRect, context: CGContext) {
        context.translateBy(x: box.midX, y: box.midY)
        context.scaleBy(x: picture.flippedHorizontally ? -1 : 1, y: picture.flippedVertically ? -1 : 1)
        context.rotate(by: -CGFloat(picture.quarterTurns) * .pi / 2)
        let size = picture.quarterTurns % 2 == 1 ? CGSize(width: box.height, height: box.width) : box.size
        context.interpolationQuality = .high
        context.draw(image, in: CGRect(x: -size.width / 2, y: -size.height / 2, width: size.width, height: size.height))
    }
}
