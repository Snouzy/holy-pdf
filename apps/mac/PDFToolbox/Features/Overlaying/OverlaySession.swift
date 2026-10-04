import Foundation
import Observation
import PDFCore

@MainActor
@Observable
final class OverlaySession {
    struct Layer: Equatable {
        let name: String
        let data: Data
        let pages: Int
    }

    let file = PDFCopySession(describe: OverlayText.message)
    /// Kept from one PDF to the next: the same letterhead often goes on several documents.
    private(set) var layer: Layer?
    var position = PDFOverlay.Position.over {
        didSet { if position != oldValue { changed() } }
    }

    init() {
        file.overlay = { [weak self] index in self?.shown(on: index, when: .over) }
        file.underlay = { [weak self] index in self?.shown(on: index, when: .under) }
    }

    private func shown(on index: Int, when wanted: PDFOverlay.Position) -> PDFCopySession.Overlay? {
        guard position == wanted, let data = layer?.data else { return nil }
        return { context, page in PDFOverlay.show(data, onto: index, in: context, displayed: page) }
    }

    /// The session is busy from the panel to the end of the reading: no save starts with the layer of before.
    func chooseLayer() {
        Task {
            _ = await file.choosing { [self] () -> Bool? in
                guard let url = await chooseFile([.pdf]) else { return nil }
                await setLayer(url)
                return true
            }
        }
    }

    /// The layer is only read: a signed PDF is accepted. A protected one is refused, with the way out.
    func setLayer(_ url: URL) async {
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        do {
            let data = try await readFile(url, limit: 256 * 1024 * 1024)
            let pages = try await Task.detached(priority: .userInitiated) {
                try PDFOpenedDocument(data: data, allowsSigned: true).info.pageSizes.count
            }.value
            layer = Layer(name: url.lastPathComponent, data: data, pages: pages)
            file.errorMessage = nil
            changed()
        } catch PDFToolError.passwordRequired {
            file.errorMessage = String(localized: "This PDF is protected. Unlock it first, then choose its copy.")
        } catch {
            file.errorMessage = String(localized: "The PDF could not be opened. Choose a readable file under 256 MB.")
        }
    }

    private func changed() {
        file.edited(unsaved: false)
        file.refreshPreview()
    }

    private var make: PDFCopySession.ReportingMaker? {
        guard let data = layer?.data else { return nil }
        return { [position] base, password, _ in try PDFOverlay.overlaid(base, password: password, layer: data, position: position) }
    }

    func export() {
        if let make { file.export(suffix: String(localized: "overlaid"), reporting: make) }
    }

    func saveCopy(to url: URL) async {
        if let make { await file.saveCopy(to: url, reporting: make) }
    }
}

enum OverlayText {
    static func message(_ error: Error) -> String {
        (error as? PDFToolError) == .alreadySigned
            ? String(localized: "This PDF has a digital signature. A copy with another PDF laid on it would lose it.") : SigningText.message(error)
    }
}
