import AppKit
import ScanSession

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    let signingSession = SigningSession()
    let mergeSession = MergeSession()
    let organizingSession = OrganizingSession()
    let splitSession = PagePickingSession(mode: .split)
    let extractSession = PagePickingSession(mode: .extract)
    let watermarkSession = WatermarkSession()
    let pageNumberSession = PageNumberSession()
    let protectSession = ProtectionSession(mode: .protect)
    let unlockSession = ProtectionSession(mode: .unlock)
    let compressSession = CompressSession()
    let ocrSession = OCRSession()
    let redactSession = RedactSession()
    let imagesSession = ImagesSession()
    let pageImagesSession = PageImagesSession()
    let flattenSession = FlattenSession()
    let pixelizeSession = PixelizeSession()
    let halvesSession = HalvesSession()
    let sheetsSession = SheetsSession()
    let bookmarksSession = BookmarksSession()
    let overlaySession = OverlaySession()
    let wordSession = WordSession()
    let editSession = EditSession()
    let session: ScannerSession = {
        let session = ScannerSession()
        session.describeAction = ScannerText.title(of:)
        return session
    }()

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        guard session.hasUnexportedDocuments || signingSession.hasUnexportedChanges || mergeSession.hasUnexportedChanges || organizingSession.hasUnexportedChanges
            || splitSession.hasUnexportedChanges || extractSession.hasUnexportedChanges || watermarkSession.hasUnexportedChanges
            || pageNumberSession.file.hasUnsavedEdits || ocrSession.file.hasUnsavedEdits
            || redactSession.file.hasUnsavedEdits || imagesSession.hasUnsavedChanges
            || bookmarksSession.file.hasUnsavedEdits || editSession.file.hasUnsavedEdits else { return .terminateNow }
        let alert = NSAlert()
        alert.messageText = String(localized: "Quit without exporting?")
        alert.informativeText = String(localized: "The documents you have not exported will be lost.")
        alert.addButton(withTitle: String(localized: "Quit"))
        alert.addButton(withTitle: String(localized: "Cancel"))
        return alert.runModal() == .alertFirstButtonReturn ? .terminateNow : .terminateCancel
    }
}
