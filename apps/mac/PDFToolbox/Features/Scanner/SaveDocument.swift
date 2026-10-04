import AppKit
import ScanSession
import SwiftUI
import UniformTypeIdentifiers

@MainActor
enum SaveDocument {
    static func run(_ documentID: UUID, session: ScannerSession, toast: Binding<Toast?>) {
        guard let document = session.documents.first(where: { $0.id == documentID }) else { return }
        let panel = NSSavePanel()
        panel.nameFieldStringValue = document.name + ".pdf"
        panel.allowedContentTypes = [.pdf]
        panel.canCreateDirectories = true
        Task {
            let response = if let window = NSApp.keyWindow { await panel.beginSheetModal(for: window) } else { await panel.begin() }
            guard response == .OK, let url = panel.url, session.documents.contains(where: { $0.id == documentID }) else { return }
            let progress = Toast(kind: .progress, message: String(localized: "Saving “\(url.lastPathComponent)”…"))
            toast.wrappedValue = progress
            if await session.save(documentID, to: url) != nil {
                // Gone during the wait: the user deleted it, so nothing failed.
                if session.documents.contains(where: { $0.id == documentID }) {
                    toast.wrappedValue = Toast(kind: .error, message: ScannerText.message(for: .cannotWrite(documentName: url.lastPathComponent)))
                } else if toast.wrappedValue?.id == progress.id {
                    toast.wrappedValue = nil
                }
                return
            }
            var lines = [String(localized: "Saved “\(url.lastPathComponent)”")]
            if session.exportItems.first(where: { $0.id == documentID })?.failedPages ?? 0 > 0 {
                lines.append(String(localized: "A page could not be rendered again: the PDF keeps its last good render."))
            }
            toast.wrappedValue = Toast(kind: .success, message: lines.joined(separator: "\n"), reveal: url)
        }
    }
}
