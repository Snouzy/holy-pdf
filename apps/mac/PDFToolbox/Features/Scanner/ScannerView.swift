import ScanSession
import SwiftUI
import UniformTypeIdentifiers

struct ScannerView: View {
    @Environment(ScannerSession.self) private var session
    @State private var correcting: UUID?
    @State private var reviewOnly = false
    @State private var importing = false
    @State private var exporting = false
    @State private var exportFolder: URL?
    @State private var toast: Toast?

    var body: some View {
        Group {
            if session.isEmpty {
                StartView { importing = true }
            } else {
                BoardView(reviewOnly: $reviewOnly, toast: $toast, open: { correcting = $0 }, addPhotos: { importing = true }, export: { exporting = true })
            }
        }
        .navigationTitle("Scanner")
        .navigationDestination(item: $correcting) { page in
            CorrectionView(pageID: page, reviewOnly: reviewOnly, toast: $toast) { correcting = $0 }
        }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.heic, .heif, .jpeg, .png, .folder], allowsMultipleSelection: true) { result in
            if case .success(let urls) = result { session.add(urls) }
        }
        .sheet(isPresented: $exporting) {
            ExportSheet(folder: $exportFolder) { page in
                exporting = false
                reviewOnly = true
                correcting = page
            }
        }
        .focusedSceneValue(\.scannerMenu, menu)
        // Here, where the toast lives: the board and the correction each draw it, and VoiceOver must read it once.
        .onChange(of: toast?.id) { if let toast { AccessibilityNotification.Announcement(toast.message).post() } }
        .onAppear {
            session.showPage = { correcting = $0 }
            session.showBoard = { correcting = nil }
        }
    }

    /// The File menu works where the board's buttons do: not in a correction, not under the export sheet or the file panel.
    var menu: ScannerMenu? {
        guard correcting == nil, !exporting, !importing else { return nil }
        return ScannerMenu(addPhotos: { importing = true }, export: session.canExport ? { exporting = true } : nil)
    }
}

extension ScannerSession {
    var canExport: Bool { !documents.isEmpty && pending.isEmpty && duplicateNames.isEmpty }
}
