import Foundation
import Observation
import PDFCore

@MainActor
@Observable
final class SheetsSession {
    // The sheets are new pages: they have no signature field that a change could break.
    let file = PDFCopySession(describe: SigningText.message, allowsSigned: true)
    /// Kept from one PDF to the next.
    var perSheet = 4 {
        didSet { if perSheet != oldValue { file.edited(unsaved: false) } }
    }

    private var make: PDFCopySession.ReportingMaker {
        { [perSheet] data, password, report in
            try PDFSheets.arranged(data, password: password, perSheet: perSheet) { report(WorkStep(done: $0, total: $1)) }
        }
    }

    func export() { file.export(suffix: String(localized: "per-sheet"), reporting: make) }

    func saveCopy(to url: URL) async { await file.saveCopy(to: url, reporting: make) }
}
