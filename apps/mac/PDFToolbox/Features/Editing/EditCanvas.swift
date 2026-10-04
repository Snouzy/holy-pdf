import AppKit
import PDFCore
import SwiftUI
import UniformTypeIdentifiers

/// Laid over the page: the additions drawn by the export's painter, and the mouse and keys that change them.
struct EditCanvas: View {
    let session: EditSession
    @Environment(\.dropPDF) private var dropPDF

    var body: some View {
        // Read here, so that SwiftUI updates the canvas when one of them changes.
        EditCanvasRepresentable(session: session, dropPDF: dropPDF, state: .init(
            page: session.file.pageIndex, preview: session.file.preview, items: session.itemsOnPage, selected: session.selectedID,
            draft: session.draft, cropping: session.isCropping, tool: session.tool))
    }
}

private struct EditCanvasRepresentable: NSViewRepresentable {
    struct State {
        var page: Int
        var preview: CGImage?
        var items: [EditItem]
        var selected: UUID?
        var draft: EditItem?
        var cropping: Bool
        var tool: EditTool
    }

    let session: EditSession
    let dropPDF: ((URL) -> Bool)?
    let state: State

    func makeNSView(context: Context) -> EditCanvasView { EditCanvasView(session: session) }

    func updateNSView(_ view: EditCanvasView, context: Context) {
        view.dropPDF = dropPDF
        view.refresh()
    }
}

final class EditCanvasView: NSView, NSTextViewDelegate {
    private enum Handle { case topLeft, topRight, bottomLeft, bottomRight, start, end }

    private enum Drag {
        case move(EditItem, from: CGPoint)
        case resize(EditItem, Handle)
        case crop(EditItem, Handle)
        case shape(from: CGPoint, to: CGPoint)
        case line(from: CGPoint, to: CGPoint)
        case ink([CGPoint])
    }

    let session: EditSession
    var dropPDF: ((URL) -> Bool)?
    private var drag: Drag?
    /// The item as the drag leaves it, drawn in place of the session's until the mouse comes up.
    private var changed: EditItem?
    private var field: NSTextView?

    init(session: EditSession) {
        self.session = session
        super.init(frame: .zero)
        registerForDraggedTypes([.fileURL])
    }

    required init?(coder: NSCoder) { nil }

    override var isFlipped: Bool { true }
    override var acceptsFirstResponder: Bool { true }

    func refresh() {
        needsDisplay = true
        syncField()
        window?.invalidateCursorRects(for: self)
    }

    // MARK: Drawing

    override func draw(_ dirtyRect: NSRect) {
        guard let context = NSGraphicsContext.current?.cgContext, bounds.width > 0, bounds.height > 0 else { return }
        let page = CGRect(origin: .zero, size: session.pageSize)
        context.saveGState()
        // The painter's space: the page in points, origin bottom-left.
        context.translateBy(x: 0, y: bounds.height)
        context.scaleBy(x: bounds.width / page.width, y: -bounds.height / page.height)
        // The page again, under the additions: the highlighter multiplies with it, as in the copy.
        if let preview = session.file.preview { context.draw(preview, in: page) }
        for stored in session.itemsOnPage where stored.id != session.draft?.id {
            let item = if let changed, changed.id == stored.id { changed } else { stored }
            if session.isCropping, item.id == session.selectedID { drawWholePicture(of: item, in: context, page: page) }
            EditPainter.draw(item, picture: session.screenPicture(of: item), in: context, page: page)
        }
        if let drawing { EditPainter.draw(drawing, in: context, page: page) }
        context.restoreGState()
        drawSelection()
    }

    /// What the drag draws, before the mouse comes up.
    private var drawing: EditItem? {
        switch drag {
        case .shape(let start, let end)?: session.shape(in: normalizedRect(rect(start, end)))
        case .line(let start, let end)?: session.line(from: normalized(start), to: normalized(end))
        case .ink(let points)?: session.ink(points.map(normalized))
        default: nil
        }
    }

    /// While cropping, the parts that go are seen faintly around the part that stays.
    private func drawWholePicture(of item: EditItem, in context: CGContext, page: CGRect) {
        guard case .picture(let picture) = item.content, let whole = session.uncroppedFrame(of: item) else { return }
        var uncut = item
        uncut.frame = whole
        uncut.content = .picture(EditPicture(image: picture.image, quarterTurns: picture.quarterTurns,
                                             flippedHorizontally: picture.flippedHorizontally, flippedVertically: picture.flippedVertically))
        context.saveGState()
        context.setAlpha(0.35)
        EditPainter.draw(uncut, picture: session.decoded[picture.image], in: context, page: page)
        context.restoreGState()
    }

    private func drawSelection() {
        guard let stored = session.selected else { return }
        let item = if let changed, changed.id == stored.id { changed } else { stored }
        NSColor.controlAccentColor.setStroke()
        let isLine = if case .line = item.content { true } else { false }
        if !isLine {
            let outline = NSBezierPath(rect: viewRect(item.frame).insetBy(dx: -2, dy: -2))
            outline.lineWidth = 1
            outline.stroke()
        }
        for (_, center) in handles(of: item) {
            let square = NSBezierPath(rect: CGRect(x: center.x - 4, y: center.y - 4, width: 8, height: 8))
            NSColor.white.setFill()
            square.fill()
            square.lineWidth = 1.5
            square.stroke()
        }
    }

    // MARK: Mouse

    override func mouseDown(with event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        window?.makeFirstResponder(self)
        session.commitText()
        switch session.tool {
        case .select: pick(at: point, clicks: event.clickCount)
        case .text:
            if let hit = item(at: point), case .text = hit.content { session.editText(hit.id) } else { session.beginText(at: normalized(point)) }
        case .rectangle, .ellipse, .highlighter: drag = .shape(from: point, to: point)
        case .line, .arrow: drag = .line(from: point, to: point)
        case .pen: drag = .ink([point])
        }
        syncField()
        needsDisplay = true
    }

    private func pick(at point: CGPoint, clicks: Int) {
        if let selected = session.selected, let handle = handles(of: selected).first(where: { hypot($0.1.x - point.x, $0.1.y - point.y) <= 8 })?.0 {
            drag = session.isCropping ? .crop(selected, handle) : .resize(selected, handle)
        } else if let hit = item(at: point) {
            if clicks == 2, case .text = hit.content { return session.editText(hit.id) }
            session.select(hit.id)
            drag = .move(hit, from: point)
        } else {
            session.select(nil)
        }
    }

    override func mouseDragged(with event: NSEvent) {
        let pointer = convert(event.locationInWindow, from: nil)
        // Past the page edge, the pointer counts as on the edge: what it draws stays where a handle can reach it.
        let point = CGPoint(x: min(max(pointer.x, 0), bounds.width), y: min(max(pointer.y, 0), bounds.height))
        switch drag {
        case .move(let item, let start)?:
            changed = session.moved(item, by: CGSize(width: (point.x - start.x) / bounds.width, height: (point.y - start.y) / bounds.height))
        case .resize(let item, let handle)?: changed = resized(item, handle, to: point)
        case .crop(let item, let handle)?: changed = session.cropped(item, to: normalizedRect(rect(anchor(of: item, across: handle), point))) ?? changed
        case .shape(let start, _)?: drag = .shape(from: start, to: point)
        case .line(let start, _)?: drag = .line(from: start, to: point)
        case .ink(let points)?: drag = .ink(points + [point])
        case nil: return
        }
        needsDisplay = true
    }

    override func mouseUp(with event: NSEvent) {
        defer {
            drag = nil
            changed = nil
            needsDisplay = true
        }
        switch drag {
        case .move?, .resize?, .crop?: if let changed { session.replace(changed) }
        case .shape(let start, let end)?:
            // Under four points, the drag was a click.
            if abs(end.x - start.x) >= 4, abs(end.y - start.y) >= 4 { session.addShape(in: normalizedRect(rect(start, end))) }
        case .line(let start, let end)?:
            if hypot(end.x - start.x, end.y - start.y) >= 4 { session.addLine(from: normalized(start), to: normalized(end)) }
        case .ink(let points)?:
            if let first = points.first, points.contains(where: { hypot($0.x - first.x, $0.y - first.y) >= 2 }) { session.addInk(points.map(normalized)) }
        case nil: break
        }
    }

    private func resized(_ item: EditItem, _ handle: Handle, to point: CGPoint) -> EditItem {
        switch item.content {
        case .line:
            var ends = item.pagePoints
            ends[handle == .start ? 0 : 1] = normalized(point)
            return .stroke(id: item.id, pageIndex: item.pageIndex, through: ends, content: item.content)
        case .text:
            let box = viewRect(item.frame)
            return session.scaledText(item, by: (point.y - box.minY) / max(1, box.height))
        default:
            let start = anchor(of: item, across: handle)
            var size = CGSize(width: max(8, abs(point.x - start.x)), height: max(8, abs(point.y - start.y)))
            if case .picture = item.content {
                let box = viewRect(item.frame)
                let ratio = box.width / max(1, box.height)
                size = size.width / size.height > ratio ? CGSize(width: size.height * ratio, height: size.height) : CGSize(width: size.width, height: size.width / ratio)
            }
            var resized = item
            resized.frame = normalizedRect(CGRect(x: point.x < start.x ? start.x - size.width : start.x,
                                                  y: point.y < start.y ? start.y - size.height : start.y, width: size.width, height: size.height))
            return resized
        }
    }

    /// The corner across from `handle`: it stays put while the handle moves.
    private func anchor(of item: EditItem, across handle: Handle) -> CGPoint {
        let box = viewRect(item.frame)
        return CGPoint(x: handle == .topLeft || handle == .bottomLeft ? box.maxX : box.minX,
                       y: handle == .topLeft || handle == .topRight ? box.maxY : box.minY)
    }

    private func handles(of item: EditItem) -> [(Handle, CGPoint)] {
        let box = viewRect(item.frame)
        switch item.content {
        case .line:
            let ends = item.pagePoints.map(viewPoint)
            return ends.count == 2 ? [(.start, ends[0]), (.end, ends[1])] : []
        case .text:
            return [(.bottomRight, CGPoint(x: box.maxX, y: box.maxY))]
        default:
            return [(.topLeft, CGPoint(x: box.minX, y: box.minY)), (.topRight, CGPoint(x: box.maxX, y: box.minY)),
                    (.bottomLeft, CGPoint(x: box.minX, y: box.maxY)), (.bottomRight, CGPoint(x: box.maxX, y: box.maxY))]
        }
    }

    /// The topmost addition under `point`.
    private func item(at point: CGPoint) -> EditItem? {
        session.itemsOnPage.last { hits($0, point) }
    }

    private func hits(_ item: EditItem, _ point: CGPoint) -> Bool {
        switch item.content {
        case .line(let stroke, _), .ink(let stroke):
            let reach = max(4, stroke.thickness.rawValue * bounds.width / session.pageSize.width / 2 + 2)
            let points = item.pagePoints.map(viewPoint)
            return zip(points, points.dropFirst()).contains { pair in distance(from: point, to: pair.0, pair.1) <= reach }
        default:
            return viewRect(item.frame).insetBy(dx: -4, dy: -4).contains(point)
        }
    }

    private func distance(from point: CGPoint, to start: CGPoint, _ end: CGPoint) -> CGFloat {
        let dx = end.x - start.x, dy = end.y - start.y
        let length = dx * dx + dy * dy
        let t = length > 0 ? min(1, max(0, ((point.x - start.x) * dx + (point.y - start.y) * dy) / length)) : 0
        return hypot(point.x - start.x - t * dx, point.y - start.y - t * dy)
    }

    // MARK: Keys

    override func keyDown(with event: NSEvent) {
        let step: CGFloat = event.modifierFlags.contains(.shift) ? 10 : 1
        switch event.keyCode {
        case 51, 117: session.deleteSelected()
        case 53: session.escape()
        case 123: session.nudge(dx: -step, dy: 0)
        case 124: session.nudge(dx: step, dy: 0)
        case 125: session.nudge(dx: 0, dy: step)
        case 126: session.nudge(dx: 0, dy: -step)
        default: return super.keyDown(with: event)
        }
        needsDisplay = true
    }

    override func resetCursorRects() {
        addCursorRect(bounds, cursor: session.tool == .select ? .arrow : session.tool == .text ? .iBeam : .crosshair)
    }

    // MARK: Pictures from elsewhere

    @objc func paste(_ sender: Any?) {
        paste(from: .general)
    }

    func paste(from board: NSPasteboard) {
        // Finder's ⌘C puts the file's icon next to its address: a copied file that is not a picture pastes nothing.
        if board.canReadObject(forClasses: [NSURL.self], options: [.urlReadingFileURLsOnly: true]) {
            if let url = fileURL(on: board, conformingTo: .image) { session.addImage(from: url) }
        } else if let data = board.data(forType: .png) ?? board.data(forType: .tiff) {
            session.addImage(data: data)
        }
    }

    override func draggingEntered(_ sender: NSDraggingInfo) -> NSDragOperation {
        let board = sender.draggingPasteboard
        return !session.file.isBusy && (fileURL(on: board, conformingTo: .image) ?? fileURL(on: board, conformingTo: .pdf)) != nil ? .copy : []
    }

    override func performDragOperation(_ sender: NSDraggingInfo) -> Bool {
        let board = sender.draggingPasteboard
        if let url = fileURL(on: board, conformingTo: .pdf) { return dropPDF?(url) ?? false }
        guard let url = fileURL(on: board, conformingTo: .image) else { return false }
        session.addImage(from: url, at: normalized(convert(sender.draggingLocation, from: nil)))
        return true
    }

    private func fileURL(on board: NSPasteboard, conformingTo type: UTType) -> URL? {
        guard let url = (board.readObjects(forClasses: [NSURL.self], options: [.urlReadingFileURLsOnly: true]) as? [URL])?.first,
              UTType(filenameExtension: url.pathExtension)?.conforms(to: type) == true else { return nil }
        return url
    }

    // MARK: Text on the page

    /// The native field sits where the page will show the text, in its font and size.
    private func syncField() {
        guard let draft = session.draft, draft.pageIndex == session.file.pageIndex, case .text(let string, let style) = draft.content else {
            field?.removeFromSuperview()
            field = nil
            return
        }
        let field = self.field ?? makeField()
        let scale = bounds.width / session.pageSize.width
        let lines = NSMutableParagraphStyle()
        lines.minimumLineHeight = EditPainter.lineHeight(style) * scale
        lines.maximumLineHeight = lines.minimumLineHeight
        field.typingAttributes = [
            .font: NSFont(name: EditPainter.fontName(style), size: style.size * scale) ?? .systemFont(ofSize: style.size * scale),
            .foregroundColor: NSColor(cgColor: style.color.cgColor) ?? .black,
            .paragraphStyle: lines,
        ]
        if field.string != string { field.string = string }
        field.textStorage?.setAttributes(field.typingAttributes, range: NSRange(location: 0, length: field.textStorage?.length ?? 0))
        let box = viewRect(draft.frame)
        // Room for the next letter: the field must not wrap before the session widens it.
        field.frame = CGRect(x: box.minX, y: box.minY, width: box.width + 2 * style.size * scale, height: max(box.height, lines.minimumLineHeight))
        if window?.firstResponder !== field { window?.makeFirstResponder(field) }
    }

    private func makeField() -> NSTextView {
        let field = NSTextView(frame: .zero)
        field.drawsBackground = false
        field.isRichText = false
        field.allowsUndo = false
        field.textContainerInset = .zero
        field.textContainer?.lineFragmentPadding = 0
        field.textContainer?.widthTracksTextView = false
        field.textContainer?.containerSize = CGSize(width: CGFloat.greatestFiniteMagnitude, height: CGFloat.greatestFiniteMagnitude)
        field.isHorizontallyResizable = true
        field.delegate = self
        addSubview(field)
        self.field = field
        return field
    }

    func textDidChange(_ notification: Notification) {
        if let field { session.typeText(field.string) }
    }

    func textDidEndEditing(_ notification: Notification) {
        session.commitText()
    }

    func textView(_ textView: NSTextView, doCommandBy commandSelector: Selector) -> Bool {
        guard commandSelector == #selector(cancelOperation(_:)) else { return false }
        session.commitText()
        window?.makeFirstResponder(self)
        // Not now: the field is still handling its key.
        DispatchQueue.main.async { [weak self] in self?.syncField() }
        return true
    }

    // MARK: Geometry

    private func viewRect(_ rect: CGRect) -> CGRect {
        CGRect(x: rect.minX * bounds.width, y: rect.minY * bounds.height, width: rect.width * bounds.width, height: rect.height * bounds.height)
    }

    private func viewPoint(_ point: CGPoint) -> CGPoint { CGPoint(x: point.x * bounds.width, y: point.y * bounds.height) }
    private func normalized(_ point: CGPoint) -> CGPoint { CGPoint(x: point.x / bounds.width, y: point.y / bounds.height) }

    private func normalizedRect(_ rect: CGRect) -> CGRect {
        CGRect(x: rect.minX / bounds.width, y: rect.minY / bounds.height, width: rect.width / bounds.width, height: rect.height / bounds.height)
    }

    private func rect(_ start: CGPoint, _ end: CGPoint) -> CGRect {
        CGRect(x: min(start.x, end.x), y: min(start.y, end.y), width: abs(end.x - start.x), height: abs(end.y - start.y))
    }
}
