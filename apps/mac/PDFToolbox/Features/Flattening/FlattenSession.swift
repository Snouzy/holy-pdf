import Foundation
import Observation
import PDFCore

@MainActor
@Observable
final class FlattenSession {
    struct NothingToFlatten: Error {}

    let file = PDFCopySession(describe: FlattenText.message)

    init() {
        // A PDF without field nor annotation would give a copy that changes nothing: it is refused when it opens.
        file.inspect = { data, password in
            let survey = try PDFFlattening.survey(data, password: password)
            guard survey.marks > 0 else { throw NothingToFlatten() }
            var notes = [String(localized: "Fields and annotations to flatten: \(survey.marks)")]
            if survey.attachments > 0 { notes.append(String(localized: "This PDF has files attached to its pages: the flattened copy does not keep them.")) }
            return notes
        }
    }

    private static let make: PDFCopySession.Maker = { data, password in try PDFFlattening.flattened(data, password: password) }

    func export() { file.export(suffix: String(localized: "flattened"), make: Self.make) }

    func saveCopy(to url: URL) async { await file.saveCopy(to: url, make: Self.make) }
}

enum FlattenText {
    static func message(_ error: Error) -> String {
        if error is FlattenSession.NothingToFlatten {
            return String(localized: "This PDF has no field or annotation to flatten.")
        }
        switch error as? PDFToolError {
        case .alreadySigned: return String(localized: "This PDF has a digital signature. A flattened copy would lose it.")
        default: return SigningText.message(error)
        }
    }
}
