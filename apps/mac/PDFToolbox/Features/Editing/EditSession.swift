import CoreGraphics
import Foundation
import Observation
import PDFCore
import UniformTypeIdentifiers

enum EditTool: CaseIterable {
    case select, text, rectangle, ellipse, line, arrow, pen, highlighter
}

/// The style of the next additions, and of the chosen one.
struct EditStyle: Equatable {
    var color = EditColor.black
    var thickness = EditThickness.medium
    var fill = false
    var font = EditFont.helvetica
    var bold = false
    var size: CGFloat = 16
}

/// Which controls the panel shows.
enum EditStyleKind {
    case text, shape, stroke, highlight, picture
}

@MainActor
@Observable
final class EditSession {
    let file = PDFCopySession(describe: EditingText.message)
    /// Every page's additions, in the order they are drawn.
    private(set) var items: [EditItem] = []
    private(set) var images: [UUID: EditImage] = [:]
    private(set) var tool = EditTool.select
    private(set) var style = EditStyle()
    private(set) var selectedID: UUID?
    /// The text being typed, new or a copy of one on the page: it joins `items` in one step.
    private(set) var draft: EditItem?
    private(set) var isCropping = false
    private(set) var isLoadingImage = false
    /// The pictures decoded once for the screen.
    @ObservationIgnored private(set) var decoded: [UUID: CGImage] = [:]
    private var past: [[EditItem]] = []
    private var future: [[EditItem]] = []
    private var generation = 0

    init() {
        file.onClosed = { [weak self] in self?.clear() }
    }

    var pageSize: CGSize {
        file.pageSizes.indices.contains(file.pageIndex) ? file.pageSizes[file.pageIndex] : CGSize(width: 1, height: 1)
    }

    var itemsOnPage: [EditItem] { items.filter { $0.pageIndex == file.pageIndex } }
    var selected: EditItem? { itemsOnPage.first { $0.id == selectedID } }
    var canSave: Bool { !items.isEmpty || draft?.isValid == true }
    var canUndo: Bool { file.state == .ready && (!past.isEmpty || draft?.isValid == true) }
    var canRedo: Bool { file.state == .ready && draft == nil && !future.isEmpty }

    var styleKind: EditStyleKind? {
        if let item = draft ?? selected {
            return switch item.content {
            case .text: .text
            case .rectangle, .ellipse: .shape
            case .line, .ink: .stroke
            case .highlight: .highlight
            case .picture: .picture
            }
        }
        return switch tool {
        case .text: .text
        case .rectangle, .ellipse: .shape
        case .line, .arrow, .pen: .stroke
        case .highlighter: .highlight
        case .select: nil
        }
    }

    // MARK: Tools and style

    func choose(_ tool: EditTool) {
        commitText()
        isCropping = false
        self.tool = tool
        if tool != .select { selectedID = nil }
        // Black or white would hide the text under the highlighter.
        if tool == .highlighter, style.color == .black || style.color == .white { style.color = .yellow }
    }

    /// Out of the crop first, then back to the arrow, then nothing chosen.
    func escape() {
        commitText()
        if isCropping {
            isCropping = false
        } else if tool != .select {
            choose(.select)
        } else {
            selectedID = nil
        }
    }

    /// One step when it changes the chosen addition.
    func restyle(_ change: (inout EditStyle) -> Void) {
        change(&style)
        style.size = min(max(style.size, EditTextStyle.sizes.lowerBound), EditTextStyle.sizes.upperBound)
        if let item = draft {
            draft = restyled(item)
        } else if let item = selected {
            replace(restyled(item))
        }
    }

    private func restyled(_ item: EditItem) -> EditItem {
        var item = item
        item.content = switch item.content {
        case .text(let string, _): .text(string, textStyle)
        case .rectangle: .rectangle(shapeStyle)
        case .ellipse: .ellipse(shapeStyle)
        case .highlight: .highlight(style.color)
        case .line(_, let arrow): .line(stroke, arrow: arrow)
        case .ink: .ink(stroke)
        case .picture(let picture): .picture(picture)
        }
        if case .text(let string, let text) = item.content { item.frame.size = textFrameSize(string, style: text) }
        return item
    }

    /// The panel shows the chosen addition's style, so that changing one setting keeps the others.
    private func adopt(_ content: EditItem.Content) {
        switch content {
        case .text(_, let text):
            style.font = text.font
            style.bold = text.bold
            style.size = text.size
            style.color = text.color
        case .rectangle(let shape), .ellipse(let shape):
            style.color = shape.color
            style.fill = shape.filled
            style.thickness = shape.thickness
        case .highlight(let color):
            style.color = color
        case .line(let stroke, _), .ink(let stroke):
            style.color = stroke.color
            style.thickness = stroke.thickness
        case .picture:
            break
        }
    }

    private var stroke: EditStroke { EditStroke(color: style.color, thickness: style.thickness) }
    private var shapeStyle: EditShapeStyle { EditShapeStyle(color: style.color, filled: style.fill, thickness: style.thickness) }
    private var textStyle: EditTextStyle { EditTextStyle(font: style.font, bold: style.bold, size: style.size, color: style.color) }

    // MARK: Additions

    /// What a drag of the rectangle, ellipse or highlighter draws; nil for another tool.
    func shape(in rect: CGRect) -> EditItem? {
        let content: EditItem.Content
        switch tool {
        case .rectangle: content = .rectangle(shapeStyle)
        case .ellipse: content = .ellipse(shapeStyle)
        case .highlighter: content = .highlight(style.color)
        default: return nil
        }
        return EditItem(pageIndex: file.pageIndex, frame: rect.standardized, content: content)
    }

    func line(from start: CGPoint, to end: CGPoint) -> EditItem? {
        guard tool == .line || tool == .arrow else { return nil }
        return .stroke(pageIndex: file.pageIndex, through: [start, end], content: .line(stroke, arrow: tool == .arrow))
    }

    func ink(_ points: [CGPoint]) -> EditItem? {
        guard tool == .pen, points.count >= 2 else { return nil }
        return .stroke(pageIndex: file.pageIndex, through: points, content: .ink(stroke))
    }

    func addShape(in rect: CGRect) {
        if let item = shape(in: rect) { add(item) }
    }

    func addLine(from start: CGPoint, to end: CGPoint) {
        if let item = line(from: start, to: end) { add(item) }
    }

    func addInk(_ points: [CGPoint]) {
        if let item = ink(points) { add(item) }
    }

    /// The arrow comes back after an addition, except with the pen and the highlighter, used many times in a row.
    private func add(_ item: EditItem) {
        guard file.state == .ready, item.isValid else { return }
        remember()
        items.append(item)
        if tool != .pen && tool != .highlighter {
            tool = .select
            selectedID = item.id
        }
        file.edited()
    }

    // MARK: Text

    func beginText(at point: CGPoint) {
        commitText()
        draft = EditItem(pageIndex: file.pageIndex, frame: CGRect(origin: point, size: textFrameSize("", style: textStyle)),
                         content: .text("", textStyle))
        selectedID = nil
        isCropping = false
    }

    func editText(_ id: UUID) {
        commitText()
        guard let item = itemsOnPage.first(where: { $0.id == id }), case .text = item.content else { return }
        adopt(item.content)
        draft = item
        selectedID = id
        isCropping = false
    }

    func typeText(_ string: String) {
        guard var item = draft, case .text(_, let style) = item.content else { return }
        item.content = .text(string, style)
        item.frame.size = textFrameSize(string, style: style)
        draft = item
        file.edited(unsaved: canSave)
    }

    /// One step, none when nothing changed; an empty text goes away.
    func commitText() {
        guard let item = draft else { return }
        draft = nil
        guard let index = items.firstIndex(where: { $0.id == item.id }) else { return add(item) }
        guard items[index] != item else { return }
        remember()
        if item.isValid {
            items[index] = item
        } else {
            items.remove(at: index)
            selectedID = nil
        }
        file.edited(unsaved: canSave)
    }

    /// The text with its font `factor` times larger, from 8 to 96 points.
    func scaledText(_ item: EditItem, by factor: CGFloat) -> EditItem {
        guard case .text(let string, var text) = item.content else { return item }
        text.size = min(max((text.size * factor).rounded(), EditTextStyle.sizes.lowerBound), EditTextStyle.sizes.upperBound)
        var scaled = item
        scaled.content = .text(string, text)
        scaled.frame.size = textFrameSize(string, style: text)
        return scaled
    }

    private func textFrameSize(_ string: String, style: EditTextStyle) -> CGSize {
        let size = EditPainter.textSize(string, style: style)
        return CGSize(width: size.width / pageSize.width, height: size.height / pageSize.height)
    }

    // MARK: Changes

    func select(_ id: UUID?) {
        commitText()
        if id != selectedID { isCropping = false }
        selectedID = id
        if let item = selected { adopt(item.content) }
    }

    /// `item` back on its page, moved, resized, restyled or cropped: one step.
    func replace(_ item: EditItem) {
        guard file.state == .ready, let index = items.firstIndex(where: { $0.id == item.id }), items[index] != item else { return }
        remember()
        items[index] = item
        file.edited()
    }

    /// Shifted by `offset`, normalized, and kept on the page when it fits there.
    func moved(_ item: EditItem, by offset: CGSize) -> EditItem {
        var moved = item
        moved.frame.origin.x = min(max(0, item.frame.minX + offset.width), max(0, 1 - item.frame.width))
        moved.frame.origin.y = min(max(0, item.frame.minY + offset.height), max(0, 1 - item.frame.height))
        return moved
    }

    /// In the page's points.
    func nudge(dx: CGFloat, dy: CGFloat) {
        if let item = selected { replace(moved(item, by: CGSize(width: dx / pageSize.width, height: dy / pageSize.height))) }
    }

    func deleteSelected() {
        guard file.state == .ready, let id = selected?.id else { return }
        if draft?.id == id { draft = nil }
        remember()
        items.removeAll { $0.id == id }
        selectedID = nil
        isCropping = false
        file.edited(unsaved: canSave)
    }

    /// Before or behind the page's other additions. The page's own content stays under all of them.
    func moveSelected(toFront: Bool) {
        guard file.state == .ready, let item = selected, let index = items.firstIndex(of: item) else { return }
        let page = items.indices.filter { items[$0].pageIndex == item.pageIndex }
        guard index != (toFront ? page.last : page.first) else { return }
        remember()
        items.remove(at: index)
        // The writer draws page by page: only the order within a page counts.
        if toFront { items.append(item) } else { items.insert(item, at: 0) }
        file.edited()
    }

    // MARK: Pictures

    func chooseImage() {
        Task {
            if let url = await file.choosing({ await chooseFile([.image]) }) { addImage(from: url) }
        }
    }

    /// `point` is where the picture's centre goes, the middle of the page without one.
    func addImage(from url: URL, at point: CGPoint? = nil) {
        loadImage(at: point) {
            let access = url.startAccessingSecurityScopedResource()
            defer { if access { url.stopAccessingSecurityScopedResource() } }
            return try await readFile(url, limit: EditImage.maxBytes, tooLarge: .imageTooLarge)
        }
    }

    func addImage(data: Data, at point: CGPoint? = nil) {
        loadImage(at: point) { data }
    }

    private func loadImage(at point: CGPoint?, read: @escaping @Sendable () async throws -> Data) {
        guard file.state == .ready, !isLoadingImage else { return }
        commitText()
        isLoadingImage = true
        let token = generation
        Task {
            do {
                let (asset, image) = try await Task.detached(priority: .userInitiated) {
                    let asset = try EditImage.load(data: try await read())
                    return (asset, try asset.decoded())
                }.value
                guard token == generation else { return }
                isLoadingImage = false
                place(asset, image: image, at: point)
            } catch {
                guard token == generation else { return }
                isLoadingImage = false
                file.errorMessage = EditingText.message(error)
            }
        }
    }

    private func place(_ asset: EditImage, image: CGImage, at point: CGPoint?) {
        // The same picture placed twice is one picture in the file.
        let id = images.first { $0.value == asset }?.key ?? UUID()
        images[id] = asset
        decoded[id] = image
        // One point for one pixel, half the page at most.
        let page = pageSize
        let scale = min(1, 0.5 * page.width / CGFloat(asset.width), 0.5 * page.height / CGFloat(asset.height))
        let size = CGSize(width: CGFloat(asset.width) * scale / page.width, height: CGFloat(asset.height) * scale / page.height)
        let center = point ?? CGPoint(x: 0.5, y: 0.5)
        let origin = CGPoint(x: min(max(0, center.x - size.width / 2), 1 - size.width), y: min(max(0, center.y - size.height / 2), 1 - size.height))
        tool = .select
        add(EditItem(pageIndex: file.pageIndex, frame: CGRect(origin: origin, size: size), content: .picture(EditPicture(image: id))))
    }

    /// A quarter turn to the right around its centre: its width and height in points swap.
    func turnSelected() {
        guard var item = selected, case .picture(let picture) = item.content else { return }
        let size = CGSize(width: item.frame.height * pageSize.height / pageSize.width, height: item.frame.width * pageSize.width / pageSize.height)
        item.frame = CGRect(x: item.frame.midX - size.width / 2, y: item.frame.midY - size.height / 2, width: size.width, height: size.height)
        item.content = .picture(picture.turned())
        replace(moved(item, by: .zero))
    }

    func flipSelected(horizontally: Bool) {
        guard var item = selected, case .picture(var picture) = item.content else { return }
        if horizontally { picture.flippedHorizontally.toggle() } else { picture.flippedVertically.toggle() }
        item.content = .picture(picture)
        replace(item)
    }

    func toggleCropping() {
        guard let item = selected, case .picture = item.content else {
            isCropping = false
            return
        }
        isCropping.toggle()
    }

    /// Where the whole picture would be: the kept part sits on the picture's frame.
    func uncroppedFrame(of item: EditItem) -> CGRect? {
        guard case .picture(let picture) = item.content else { return nil }
        let shown = picture.shownCrop
        let width = item.frame.width / shown.width, height = item.frame.height / shown.height
        return CGRect(x: item.frame.minX - shown.minX * width, y: item.frame.minY - shown.minY * height, width: width, height: height)
    }

    /// The picture keeping what lies under `frame`, inside the whole picture.
    func cropped(_ item: EditItem, to frame: CGRect) -> EditItem? {
        guard case .picture(let picture) = item.content, let whole = uncroppedFrame(of: item) else { return nil }
        let kept = frame.standardized.intersection(whole)
        guard kept.width > 0, kept.height > 0 else { return nil }
        var cropped = item
        cropped.frame = kept
        cropped.content = .picture(picture.withShownCrop(CGRect(x: (kept.minX - whole.minX) / whole.width, y: (kept.minY - whole.minY) / whole.height,
                                                                 width: kept.width / whole.width, height: kept.height / whole.height)))
        return cropped
    }

    /// The kept part of a picture, for the screen.
    func screenPicture(of item: EditItem) -> CGImage? {
        guard case .picture(let picture) = item.content, let image = decoded[picture.image], let asset = images[picture.image] else { return nil }
        return picture.crop == EditPicture.whole ? image : image.cropping(to: asset.pixels(of: picture.crop))
    }

    // MARK: History

    private func remember() {
        past.append(items)
        if past.count > 100 { past.removeFirst() }
        future = []
    }

    func undo() {
        commitText()
        guard file.state == .ready, let before = past.popLast() else { return }
        future.append(items)
        items = before
        afterHistory()
    }

    func redo() {
        guard canRedo, let after = future.popLast() else { return }
        past.append(items)
        items = after
        afterHistory()
    }

    private func afterHistory() {
        if !items.contains(where: { $0.id == selectedID }) { selectedID = nil }
        if let item = selected { adopt(item.content) }
        isCropping = false
        file.edited(unsaved: canSave)
    }

    // MARK: Saving

    private var maker: PDFCopySession.Maker? {
        guard canSave else { return nil }
        return { [items, images] data, password in try PDFEditing.editedData(data, password: password, items: items, images: images) }
    }

    func export() {
        commitText()
        if let maker { file.export(suffix: String(localized: "edited"), make: maker) }
    }

    func saveCopy(to url: URL) async {
        commitText()
        if let maker { await file.saveCopy(to: url, make: maker) }
    }

    private func clear() {
        generation += 1
        items = []
        images = [:]
        decoded = [:]
        tool = .select
        selectedID = nil
        draft = nil
        isCropping = false
        isLoadingImage = false
        past = []
        future = []
    }
}

enum EditingText {
    static func message(_ error: Error) -> String {
        switch error as? PDFToolError {
        case .alreadySigned: String(localized: "This PDF has a digital signature. An edited copy would invalidate it.")
        case .invalidImage: String(localized: "Choose a readable image: JPEG, PNG, HEIC, WebP, TIFF or GIF.")
        case .imageTooLarge: String(localized: "Choose an image under 50 MB and 50 million pixels.")
        case .invalidPlacement: String(localized: "An addition could not be written. Check it, then save again.")
        default: SigningText.message(error)
        }
    }
}
