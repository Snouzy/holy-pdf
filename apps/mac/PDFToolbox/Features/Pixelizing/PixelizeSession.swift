import Foundation
import Observation
import PDFCore

@MainActor
@Observable
final class PixelizeSession {
    // The copy is made of new pages: it has no signature field that a change could break.
    let file = PDFCopySession(describe: { ($0 as? PDFToolError) == .renderFailed ? PageImagesText.message($0) : SigningText.message($0) },
                              allowsSigned: true)
    /// Kept from one PDF to the next.
    var quality = PDFPageImages.Quality.normal {
        didSet { if quality != oldValue { file.edited(unsaved: false) } }
    }

    private var make: PDFCopySession.ReportingMaker {
        { [quality] data, password, report in
            try PDFPixelizing.pixelized(data, password: password, quality: quality) { report(WorkStep(done: $0, total: $1)) }
        }
    }

    func export() { file.export(suffix: String(localized: "pixelized"), reporting: make) }

    func saveCopy(to url: URL) async { await file.saveCopy(to: url, reporting: make) }
}
