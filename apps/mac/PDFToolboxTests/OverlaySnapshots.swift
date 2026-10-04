import SwiftUI
import Testing
@testable import PDFToolbox

@Suite(.serialized)
@MainActor
struct OverlaySnapshots {
    private static let folder = ScreenSnapshots.folder.appendingPathComponent("overlay")

    @Test func startReadyAndSaved() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        try await snapshot("start-light", OverlayView().environment(OverlaySession()), in: Self.folder)
        let letter = folder.appendingPathComponent("Lettre.pdf"), head = folder.appendingPathComponent("En-tête.pdf")
        try demoPDF(title: "Lettre", pages: 3, color: 0).write(to: letter)
        try photoPDF(title: "En-tête", side: 600).write(to: head)
        let session = OverlaySession()
        session.file.open(letter)
        try await waitUntil { session.file.state == .ready && session.file.preview != nil }
        let plain = session.file.preview?.dataProvider?.data
        try await snapshot("ready-light", OverlayView().environment(session), in: Self.folder)
        await session.setLayer(head)
        try await waitUntil { session.file.preview.map { $0.dataProvider?.data != plain } ?? false }
        let over = session.file.preview?.dataProvider?.data
        for dark in [false, true] {
            try await snapshot("chosen-\(dark ? "dark" : "light")", OverlayView().environment(session), in: Self.folder, dark: dark)
        }
        try await snapshot("chosen-english", OverlayView().environment(session), in: Self.folder, language: "en")
        session.position = .under
        try await waitUntil { session.file.preview.map { $0.dataProvider?.data != over } ?? false }
        try await snapshot("under-light", OverlayView().environment(session), in: Self.folder)
        await session.saveCopy(to: folder.appendingPathComponent("Lettre-superpose.pdf"))
        try await snapshot("saved-light", OverlayView().environment(session), in: Self.folder)
    }
}
