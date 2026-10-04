import SwiftUI

@main
struct PDFToolboxApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    init() {
        Brand.registerFonts()
    }

    var body: some Scene {
        Window("Holy PDF", id: "main") {
            RootView(split: appDelegate.splitSession, extract: appDelegate.extractSession,
                     protect: appDelegate.protectSession, unlock: appDelegate.unlockSession)
                .environment(appDelegate.session)
                .environment(appDelegate.signingSession)
                .environment(appDelegate.mergeSession)
                .environment(appDelegate.organizingSession)
                .environment(appDelegate.watermarkSession)
                .environment(appDelegate.pageNumberSession)
                .environment(appDelegate.compressSession)
                .environment(appDelegate.ocrSession)
                .environment(appDelegate.redactSession)
                .environment(appDelegate.imagesSession)
                .environment(appDelegate.pageImagesSession)
                .environment(appDelegate.flattenSession)
                .environment(appDelegate.pixelizeSession)
                .environment(appDelegate.halvesSession)
                .environment(appDelegate.sheetsSession)
                .environment(appDelegate.bookmarksSession)
                .environment(appDelegate.overlaySession)
                .environment(appDelegate.wordSession)
                .environment(appDelegate.editSession)
                .frame(minWidth: 960, minHeight: 640)
        }
        .commands { ScannerCommands() }
    }
}
