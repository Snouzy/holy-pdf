import SwiftUI
import Testing
@testable import PDFToolbox

@Suite(.serialized)
@MainActor
struct FlattenSnapshots {
    private static let folder = ScreenSnapshots.folder.appendingPathComponent("flatten")

    @Test func startReadyAndRefused() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        try await snapshot("start-light", FlattenView().environment(FlattenSession()), in: Self.folder)
        let source = folder.appendingPathComponent("Formulaire.pdf")
        try formPDF(title: "Formulaire", value: "Ada Lovelace").write(to: source)
        let session = FlattenSession()
        session.file.open(source)
        try await waitUntil { session.file.state == .ready && session.file.preview != nil }
        for dark in [false, true] {
            try await snapshot("ready-\(dark ? "dark" : "light")", FlattenView().environment(session), in: Self.folder, dark: dark)
        }
        try await snapshot("ready-english", FlattenView().environment(session), in: Self.folder, language: "en")
        await session.saveCopy(to: folder.appendingPathComponent("Formulaire-aplati.pdf"))
        try await snapshot("saved-light", FlattenView().environment(session), in: Self.folder)
        let letter = folder.appendingPathComponent("Lettre.pdf")
        try demoPDF(title: "Lettre", pages: 1, color: 0).write(to: letter)
        let plain = FlattenSession()
        plain.file.open(letter)
        try await waitUntil { plain.file.errorMessage != nil }
        try await snapshot("nothing-light", FlattenView().environment(plain), in: Self.folder)
    }
}
