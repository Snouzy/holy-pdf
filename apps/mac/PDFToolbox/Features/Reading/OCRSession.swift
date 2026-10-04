import Foundation
import Observation
import PDFCore
import ScanCore

@MainActor
@Observable
final class OCRSession {
    enum Outcome: Equatable { case added(pages: Int), nothing }
    let file = PDFCopySession(describe: OCRText.message)
    /// Nil reads the three languages of the Scanner. Kept from one PDF to the next. The next reading uses it: what
    /// was read already stays, since a click on a list must not throw minutes of reading away.
    var language: String?
    private(set) var outcome: Outcome?
    private var result: PDFTextLayer.Result?

    init() {
        file.onClosed = { [weak self] in self?.drop() }
        file.overlay = { [weak self] index in
            guard let lines = self?.result?.lines[index] else { return nil }
            return { context, page in PDFTextLayer.highlight(lines, in: context, displayed: page) }
        }
    }

    var canSave: Bool { result != nil }

    func read() async {
        drop()
        let found = await file.prepare(reporting: { [languages = language.map { [$0] } ?? TextReader.languages] data, password, report in
            try PDFTextLayer.adding(data, password: password, read: { image in
                try TextReader.read(image, languages: languages).map { PDFTextLine(text: $0.text, box: $0.box.cgRect) }
            }, progress: { done, total in
                report(WorkStep(done: done, total: total))
            })
        })
        guard let found else { return }
        result = found
        outcome = found.map { .added(pages: $0.pages) } ?? .nothing
        // Minutes of reading: the session asks before another PDF or a quit drops them.
        if found != nil { file.edited() }
        file.refreshPreview()
    }

    private func drop() {
        outcome = nil
        result = nil
        file.refreshPreview()
    }

    func export() {
        if let copy = result?.data { file.export(suffix: "ocr") { _, _ in copy } }
    }

    func saveCopy(to url: URL) async {
        if let copy = result?.data { await file.saveCopy(to: url) { _, _ in copy } }
    }
}

enum OCRText {
    static func message(_ error: Error) -> String {
        switch error as? PDFToolError {
        case .alreadySigned: String(localized: "This PDF has a digital signature. A copy with added text would lose it.")
        case .renderFailed: String(localized: "The text of a page could not be read. Your original PDF has not changed.")
        default: SigningText.message(error)
        }
    }
}
