import Foundation
import Observation
import PDFCore

@MainActor
@Observable
final class HalvesSession {
    let file = PDFCopySession(describe: HalvesText.message)
    /// Kept from one PDF to the next.
    var cut = PDFPageHalves.Cut.leftRight {
        didSet {
            guard cut != oldValue else { return }
            file.edited(unsaved: false)
            file.refreshPreview()
        }
    }

    init() {
        file.overlay = { [weak self] _ in
            guard let cut = self?.cut else { return nil }
            return { context, page in PDFPageHalves.mark(cut, in: context, displayed: page) }
        }
    }

    private var make: PDFCopySession.ReportingMaker {
        { [cut] data, password, _ in try PDFPageHalves.halved(data, password: password, cut: cut) }
    }

    func export() { file.export(suffix: String(localized: "halves"), reporting: make) }

    func saveCopy(to url: URL) async { await file.saveCopy(to: url, reporting: make) }
}

enum HalvesText {
    static func message(_ error: Error) -> String {
        (error as? PDFToolError) == .alreadySigned
            ? String(localized: "This PDF has a digital signature. A copy cut in half would lose it.") : SigningText.message(error)
    }
}
