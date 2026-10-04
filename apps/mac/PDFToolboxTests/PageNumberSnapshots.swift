import SwiftUI
import Testing
@testable import PDFToolbox

@Suite(.serialized)
@MainActor
struct PageNumberSnapshots {
    private static let folder = ScreenSnapshots.folder.appendingPathComponent("page-numbers")

    @Test func startAndWorkspace() async throws {
        try await snapshot("start-light", PageNumberView().environment(PageNumberSession()), in: Self.folder)
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let source = folder.appendingPathComponent("Rapport annuel.pdf")
        try demoPDF(title: "Rapport annuel", pages: 12, color: 0).write(to: source)
        let session = PageNumberSession()
        session.file.open(source)
        try await waitUntil { session.file.state == .ready }
        session.update {
            $0.format = .numberOfTotal
            $0.fontSize = 16
            $0.allPages = false
            $0.firstPage = 1
            $0.lastPage = 11
        }
        session.file.goToPage(3)
        try await waitUntil { session.file.preview != nil }
        for dark in [false, true] {
            try await snapshot("workspace-\(dark ? "dark" : "light")", PageNumberView().environment(session), in: Self.folder, dark: dark)
        }
        try await snapshot("workspace-english", PageNumberView().environment(session), in: Self.folder, language: "en")
    }
}
