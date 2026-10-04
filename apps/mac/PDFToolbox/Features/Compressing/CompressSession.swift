import Foundation
import Observation
import PDFCore

@MainActor
@Observable
final class CompressSession {
    enum Outcome: Equatable { case lighter(from: Int, to: Int), alreadyLight }

    let file = PDFCopySession(describe: CompressText.message)
    /// Kept from one PDF to the next.
    var level = CompressionLevel.recommended {
        didSet { if level != oldValue { drop() } }
    }
    /// After a compression the page on screen is the compressed one; the original is one click away.
    var showsCopy = true {
        didSet { if showsCopy != oldValue { file.showCopy(showsCopy ? copy : nil) } }
    }
    private(set) var outcome: Outcome?
    private var copy: PDFOpenedDocument?

    init() {
        file.onClosed = { [weak self] in self?.drop() }
        file.inspect = { data, password in
            guard PDFCompression.hasBilevelScan(data, password: password) else { return [] }
            return [String(localized: "This PDF has black-and-white scans. Compression can blur them: check the copy before you send it.")]
        }
    }

    var canSave: Bool { copy != nil }

    func compress() async {
        drop()
        let result = await file.prepare { [level] data, password in
            // Opened here, away from the main actor: the screen then only has to show it.
            (data.count, try PDFCompression.compressed(data, password: password, level: level).map { try PDFOpenedDocument(data: $0, allowsSigned: true) })
        }
        guard let (bytes, lighter) = result else { return }
        copy = lighter
        outcome = lighter.map { .lighter(from: bytes, to: $0.data.count) } ?? .alreadyLight
        showsCopy = true
        file.showCopy(lighter)
    }

    private func drop() {
        outcome = nil
        copy = nil
        file.showCopy(nil)
    }

    func export() {
        if let copy = copy?.data { file.export(suffix: String(localized: "compressed")) { _, _ in copy } }
    }

    func saveCopy(to url: URL) async {
        if let copy = copy?.data { await file.saveCopy(to: url) { _, _ in copy } }
    }
}

enum CompressText {
    static func message(_ error: Error) -> String {
        switch error as? PDFToolError {
        case .alreadySigned: String(localized: "This PDF has a digital signature. A compressed copy would lose it.")
        default: SigningText.message(error)
        }
    }
}
