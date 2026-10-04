import SwiftUI
import Testing
@testable import PDFToolbox

@Suite(.serialized)
@MainActor
struct WordSnapshots {
    private static let folder = ScreenSnapshots.folder.appendingPathComponent("word")

    @Test func startReadyAndSaved() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        try await snapshot("start-light", WordView().environment(WordSession()), in: Self.folder)
        let source = folder.appendingPathComponent("Rapport.pdf")
        try demoPDF(title: "Rapport", pages: 3, color: 0).write(to: source)
        let session = WordSession()
        session.file.open(source)
        try await waitUntil { session.file.state == .ready && session.file.preview != nil }
        for dark in [false, true] {
            try await snapshot("ready-\(dark ? "dark" : "light")", WordView().environment(session), in: Self.folder, dark: dark)
        }
        try await snapshot("ready-english", WordView().environment(session), in: Self.folder, language: "en")
        await session.save(to: folder.appendingPathComponent("Rapport-word.docx"))
        try await snapshot("saved-light", WordView().environment(session), in: Self.folder)
    }
}
