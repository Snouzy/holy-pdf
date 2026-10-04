import Foundation
import Observation
import PDFCore

@MainActor
@Observable
final class ProtectionSession {
    enum Mode { case protect, unlock }

    let mode: Mode
    let file = PDFCopySession(describe: ProtectionText.message)
    var password = ""
    var confirmation = ""

    init(mode: Mode) {
        self.mode = mode
        // A password left in the fields would lock the next PDF without the user typing it.
        let forget: @MainActor () -> Void = { [weak self] in
            self?.password = ""
            self?.confirmation = ""
        }
        file.onSaved = forget
        file.onClosed = forget
        guard mode == .unlock else { return }
        // Unlock writes through Organize: what Organize refuses or loses is said at the opening, not after the save panel.
        file.inspect = { data, password in
            OrganizingText.conservation(try await PDFOrganizingDocument(data: data, password: password).information().notices)
        }
    }

    var passwordIsRefused: Bool { !password.isEmpty && !PDFProtection.accepts(password) }
    /// True once the confirmation cannot become the password any more, not at its first letter.
    var confirmationDiffers: Bool { !password.hasPrefix(confirmation) }

    var canSave: Bool {
        switch mode {
        case .protect: PDFProtection.accepts(password) && password == confirmation
        case .unlock: file.isEncrypted
        }
    }

    private var maker: PDFCopySession.Maker? {
        guard canSave else { return nil }
        switch mode {
        case .protect: return { [password] data, source in try PDFProtection.protected(data, password: source, with: password) }
        case .unlock: return { data, source in try await PDFProtection.unlocked(data, password: source) }
        }
    }

    func export() {
        guard let maker else { return }
        file.export(suffix: mode == .protect ? String(localized: "protected") : String(localized: "unlocked"), make: maker)
    }

    func saveCopy(to url: URL) async {
        if let maker { await file.saveCopy(to: url, make: maker) }
    }
}

enum ProtectionText {
    static func message(_ error: Error) -> String {
        switch error as? PDFToolError {
        case .alreadySigned: String(localized: "This PDF has a digital signature. A protected or unlocked copy would lose it.")
        case .writeFailed: String(localized: "The copy could not be written. Your original PDF has not changed.")
        case .unsupportedDocument: String(localized: "This PDF contains features that cannot be preserved, such as attachments, layers or dynamic forms.")
        default: OrganizingText.message(error)
        }
    }
}
