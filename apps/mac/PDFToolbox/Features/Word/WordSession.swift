import Foundation
import Observation
import PDFCore

/// PDF to Word: the text and the pictures of the PDF in a .docx file the user chooses.
@MainActor
@Observable
final class WordSession {
    // No copy of the PDF is written: a signature has nothing to fear.
    let file = PDFCopySession(describe: WordText.message, allowsSigned: true)
    private(set) var savedURL: URL?

    init() {
        file.onClosed = { [weak self] in self?.savedURL = nil }
    }

    func export() {
        let name = URL(fileURLWithPath: file.sourceName).deletingPathExtension().lastPathComponent + "-word.docx"
        Task {
            if let url = await file.choosing({ await chooseDestination(name: name, type: .word) }) { await save(to: url) }
        }
    }

    func save(to url: URL) async {
        savedURL = nil
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        let written = await file.prepare(reporting: { data, password, report in
            let document = try PDFWord.document(data, password: password) { report(WorkStep(done: $0, total: $1)) }
            // A copy that ends after its cancel must not reach the disk.
            try Task.checkCancellation()
            try document.write(to: url, options: .atomic)
            return url
        })
        // Nil for a cancelled run, which may end after the next one started.
        if let written { savedURL = written }
    }
}

enum WordText {
    static func message(_ error: Error) -> String {
        switch error as? PDFToolError {
        case .renderFailed: PageImagesText.message(error)
        case nil: String(localized: "The Word document could not be written. Check the folder access and the free space.")
        default: SigningText.message(error)
        }
    }
}
