import Foundation
import ImageIO
import Observation
import PDFCore

@MainActor
@Observable
final class SigningSession {
    enum State { case empty, opening, locked, ready, exporting }

    /// A signature, an imported image or a typed line, placed as often as the user wants.
    struct Mark: Identifiable {
        let id: UUID
        let image: SignatureImage
        let preview: CGImage
        let title: String
        /// A typed line is placed as tall as a line of text; a picture, as wide as the web places a signature.
        let isText: Bool
    }

    /// Twenty marks at most: the list of the panel is no gallery.
    static let mostMarks = 20

    private(set) var state: State = .empty
    private(set) var sourceName = ""
    private(set) var sourceWasEncrypted = false
    private(set) var pageSizes: [CGSize] = []
    private(set) var pageIndex = 0
    private(set) var preview: CGImage?
    private(set) var marks: [Mark] = []
    /// The mark that « Place on this page » and a click on the page use.
    private(set) var currentMarkID: UUID?
    private(set) var placements: [SignaturePlacement] = []
    private(set) var selectedID: UUID?
    var errorMessage: String?
    private(set) var lastSavedURL: URL?

    private var document: PDFSigningDocument?
    private var source: FileIdentity?
    private var pendingData: Data?
    private var generation = 0
    private var revision = 0
    private var nextRevision = 0
    private var savedRevision = 0
    private var history: [(edit: Edit, revision: Int)] = []
    @ObservationIgnored private var openingTask: Task<Void, Never>?
    @ObservationIgnored private var previewTask: Task<Void, Never>?

    private enum Edit {
        case remove(UUID)
        case insert(SignaturePlacement, Int)
        case move(SignaturePlacement)
        case marks([Mark], UUID?, [SignaturePlacement])
    }

    var canUndo: Bool { state == .ready && !history.isEmpty }
    var canExport: Bool { state == .ready && !placements.isEmpty }
    var currentMark: Mark? { marks.first { $0.id == currentMarkID } }
    var canAddMark: Bool { state == .ready && marks.count < Self.mostMarks }

    func mark(_ id: UUID) -> Mark? { marks.first { $0.id == id } }
    var hasUnexportedChanges: Bool { !placements.isEmpty && revision != savedRevision }

    func open(_ url: URL) {
        guard state != .exporting else { return }
        reset()
        sourceName = url.lastPathComponent
        state = .opening
        let token = generation
        openingTask = Task {
            let access = url.startAccessingSecurityScopedResource()
            defer { if access { url.stopAccessingSecurityScopedResource() } }
            guard token == generation, !Task.isCancelled else { return }
            source = FileIdentity(url)
            do {
                let data = try await readFile(url, limit: 256 * 1024 * 1024)
                guard token == generation, !Task.isCancelled else { return }
                pendingData = data
                await load(data, password: "", token: token)
            } catch {
                guard token == generation else { return }
                state = .empty
                errorMessage = String(localized: "The PDF could not be opened. Choose a readable file under 256 MB.")
            }
        }
    }

    func unlock(_ password: String) {
        guard state == .locked, let pendingData else { return }
        state = .opening
        errorMessage = nil
        let token = generation
        openingTask = Task { await load(pendingData, password: password, token: token) }
    }

    private func load(_ data: Data, password: String, token: Int) async {
        do {
            let loaded = try await Task.detached(priority: .userInitiated) {
                try PDFSigningDocument(data: data, password: password)
            }.value
            let info = await loaded.information()
            guard token == generation, !Task.isCancelled else { return }
            document = loaded
            pendingData = nil
            sourceWasEncrypted = info.isEncrypted
            pageSizes = info.pageSizes
            state = .ready
            refreshPreview()
        } catch let error as PDFToolError {
            guard token == generation else { return }
            switch error {
            case .passwordRequired, .wrongPassword:
                state = .locked
            default:
                state = .empty
                pendingData = nil
            }
            errorMessage = error == .passwordRequired ? nil : SigningText.message(error)
        } catch {
            guard token == generation else { return }
            state = .empty
            pendingData = nil
            errorMessage = String(localized: "This PDF could not be read.")
        }
    }

    func goToPage(_ index: Int) {
        guard state == .ready, pageSizes.indices.contains(index), index != pageIndex else { return }
        pageIndex = index
        selectedID = placements.first(where: { $0.pageIndex == index })?.id
        refreshPreview()
    }

    private func refreshPreview() {
        previewTask?.cancel()
        preview = nil
        guard let document else { return }
        let index = pageIndex
        let token = generation
        previewTask = Task {
            do {
                // Collapse rapid page navigation before queuing another PDF render.
                try await Task.sleep(for: .milliseconds(35))
                let image = try await document.preview(pageIndex: index, maxDimension: 1600)
                guard !Task.isCancelled, token == generation, index == pageIndex else { return }
                preview = image
            } catch is CancellationError {
            } catch {
                guard !Task.isCancelled, token == generation, index == pageIndex else { return }
                errorMessage = String(localized: "This page could not be displayed. Try another page.")
            }
        }
    }

    func importSignature(url: URL) {
        addMark(titled: url.deletingPathExtension().lastPathComponent, isText: false) {
            let access = url.startAccessingSecurityScopedResource()
            defer { if access { url.stopAccessingSecurityScopedResource() } }
            let data = try await readFile(url, limit: 10 * 1024 * 1024, tooLarge: .imageTooLarge)
            return try SignatureImage.load(data: data)
        }
    }

    func addSignature(data: Data) {
        addMark(titled: String(localized: "Signature"), isText: false) { try SignatureImage.load(data: data) }
    }

    /// A name, initials, a date: typed, in a handwritten or a plain style.
    func addText(_ text: String, style: SignatureImage.TextStyle) {
        let line = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !line.isEmpty, line.count <= 120 else {
            errorMessage = String(localized: "Type a line of 120 characters at most.")
            return
        }
        addMark(titled: line, isText: true, failed: { _ in String(localized: "This text could not be drawn. Try a shorter one.") }) {
            try SignatureImage.text(line, style: style)
        }
    }

    /// The new mark becomes the current one and goes on the page at once. The marks of before stay, and so does a
    /// mark still being made: two adds in a row give two marks.
    private func addMark(titled title: String, isText: Bool, failed: @escaping (Error) -> String = SigningText.message,
                         _ make: @escaping @Sendable () async throws -> SignatureImage) {
        guard canAddMark else {
            errorMessage = String(localized: "Twenty marks at most: remove one to add another.")
            return
        }
        let token = generation
        Task {
            do {
                let asset = try await Task.detached(priority: .userInitiated) { try await make() }.value
                guard token == generation, let source = CGImageSourceCreateWithData(asset.dataPNG as CFData, nil),
                      let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { return }
                guard canAddMark else {
                    errorMessage = String(localized: "Twenty marks at most: remove one to add another.")
                    return
                }
                remember(.marks(marks, currentMarkID, placements))
                let mark = Mark(id: UUID(), image: asset, preview: image, title: title, isText: isText)
                marks.append(mark)
                currentMarkID = mark.id
                errorMessage = nil
                addPlacement()
            } catch {
                guard token == generation else { return }
                errorMessage = failed(error)
            }
        }
    }

    func selectMark(_ id: UUID) {
        if marks.contains(where: { $0.id == id }) { currentMarkID = id }
    }

    /// The mark leaves with every place it had on the pages.
    func removeMark(_ id: UUID) {
        guard state == .ready, marks.contains(where: { $0.id == id }) else { return }
        remember(.marks(marks, currentMarkID, placements))
        marks.removeAll { $0.id == id }
        placements.removeAll { $0.mark == id }
        if currentMarkID == id { currentMarkID = marks.last?.id }
        if !placements.contains(where: { $0.id == selectedID }) { selectedID = nil }
    }

    /// The current mark on the page on screen: in the middle, or centered on `point` (normalized, top-left origin).
    func addPlacement(at point: CGPoint? = nil) {
        guard state == .ready, let mark = currentMark, pageSizes.indices.contains(pageIndex), placements.count < 100 else { return }
        let page = pageSizes[pageIndex]
        let aspect = CGFloat(mark.image.height) / CGFloat(mark.image.width)
        var width: CGFloat = 0.28
        var height = width * page.width / page.height * aspect
        if mark.isText {
            // A line of 24 points, as on the web, however long the text.
            height = 24 / page.height
            width = min(0.9, height * page.height / page.width / aspect)
        } else if height > 0.4 {
            width *= 0.4 / height
            height = 0.4
        }
        let center = point ?? CGPoint(x: 0.5, y: 0.5)
        let bounds = CGRect(x: min(max(0, center.x - width / 2), 1 - width), y: min(max(0, center.y - height / 2), 1 - height), width: width, height: height)
        let placement = SignaturePlacement(pageIndex: pageIndex, bounds: bounds, mark: mark.id)
        placements.append(placement)
        selectedID = placement.id
        remember(.remove(placement.id))
    }

    /// A click on the bare page: the first one only puts the selected placement down, the next one places the current mark there.
    func pageTapped(at point: CGPoint) {
        if selectedID != nil { selectedID = nil } else { addPlacement(at: point) }
    }

    func select(_ id: UUID) { selectedID = id }

    func updatePlacement(id: UUID, bounds: CGRect) {
        guard state == .ready, let index = placements.firstIndex(where: { $0.id == id }),
              PageGeometry.isValid(bounds), bounds != placements[index].bounds else { return }
        let previous = placements[index]
        remember(.move(previous))
        placements[index] = SignaturePlacement(id: id, pageIndex: previous.pageIndex, bounds: bounds, mark: previous.mark)
    }

    func removeSelected() {
        guard state == .ready, let index = placements.firstIndex(where: { $0.id == selectedID }) else { return }
        remember(.insert(placements[index], index))
        placements.remove(at: index)
        selectedID = nil
    }

    private func remember(_ edit: Edit) {
        history.append((edit, revision))
        if history.count > 100 { history.removeFirst() }
        nextRevision += 1
        revision = nextRevision
        lastSavedURL = nil
    }

    func undo() {
        guard state == .ready, let record = history.popLast() else { return }
        switch record.edit {
        case .remove(let id):
            placements.removeAll { $0.id == id }
            selectedID = nil
        case .insert(let placement, let index):
            placements.insert(placement, at: min(index, placements.count))
            goToPage(placement.pageIndex)
            selectedID = placement.id
        case .move(let placement):
            if let index = placements.firstIndex(where: { $0.id == placement.id }) { placements[index] = placement }
            goToPage(placement.pageIndex)
            selectedID = placement.id
        case .marks(let previousMarks, let current, let previous):
            marks = previousMarks
            currentMarkID = current
            placements = previous
            // The page first: going to a page selects its first placement.
            if let last = previous.last { goToPage(last.pageIndex) }
            selectedID = previous.last?.id
        }
        revision = record.revision
        lastSavedURL = nil
    }

    func export() {
        guard canExport else { return }
        let token = generation
        let name = URL(fileURLWithPath: sourceName).deletingPathExtension().lastPathComponent + "-" + String(localized: "signed") + ".pdf"
        Task {
            guard let url = await choosePDFDestination(name: name), token == generation else { return }
            await saveCopy(to: url)
        }
    }

    func saveCopy(to url: URL) async {
        guard canExport, let document else { return }
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        guard FileIdentity(url) != source else {
            errorMessage = String(localized: "Choose a different name or folder to keep your original PDF.")
            return
        }
        state = .exporting
        errorMessage = nil
        let placements = self.placements
        let images = Dictionary(uniqueKeysWithValues: marks.map { ($0.id, $0.image) })
        let exportingRevision = revision
        defer { state = .ready }
        do {
            let bytes = try await document.signedData(marks: images, placements: placements)
            try await Task.detached(priority: .userInitiated) { try bytes.write(to: url, options: .atomic) }.value
            savedRevision = exportingRevision
            lastSavedURL = url
        } catch {
            errorMessage = SigningText.message(error)
        }
    }

    func reset() {
        guard state != .exporting else { return }
        generation += 1
        openingTask?.cancel()
        previewTask?.cancel()
        document = nil
        source = nil
        pendingData = nil
        sourceName = ""
        sourceWasEncrypted = false
        state = .empty
        pageSizes = []
        pageIndex = 0
        preview = nil
        marks = []
        currentMarkID = nil
        placements = []
        selectedID = nil
        history = []
        revision = 0
        nextRevision = 0
        savedRevision = 0
        errorMessage = nil
        lastSavedURL = nil
    }
}

enum SigningText {
    static func message(_ error: Error) -> String {
        guard let error = error as? PDFToolError else { return String(localized: "The operation could not be completed. Your original PDF has not changed.") }
        switch error {
        case .alreadySigned: return String(localized: "This PDF already has a digital signature. Adding a signature would invalidate it.")
        case .invalidImage: return String(localized: "Choose a readable PNG or JPEG signature.")
        case .imageTooLarge: return String(localized: "Choose an image under 10 MB and 16 million pixels.")
        case .invalidPlacement: return String(localized: "Place the signature inside a page before saving.")
        case .renderFailed: return String(localized: "This page could not be displayed. Try another page.")
        default: return MergeText.message(error)
        }
    }
}
