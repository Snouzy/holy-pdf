import SwiftUI
import Testing
@testable import PDFToolbox

@Suite(.serialized)
@MainActor
struct OCRSnapshots {
    private static let folder = ScreenSnapshots.folder.appendingPathComponent("ocr")

    @Test func startReadAndNothing() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        try await snapshot("start-light", OCRView().environment(OCRSession()), in: Self.folder)
        let source = folder.appendingPathComponent("Facture scannée.pdf")
        try scannedPDF(pages: ["FACTURE 2026", "TOTAL 480 EUR", "MERCI"]).write(to: source)
        let session = OCRSession()
        session.file.open(source)
        try await waitUntil { session.file.state == .ready && session.file.preview != nil }
        try await snapshot("ready-light", OCRView().environment(session), in: Self.folder)
        let plain = session.file.preview?.dataProvider?.data
        await session.read()
        try await waitUntil { session.file.preview.map { $0.dataProvider?.data != plain } ?? false }
        for dark in [false, true] {
            try await snapshot("read-\(dark ? "dark" : "light")", OCRView().environment(session), in: Self.folder, dark: dark)
        }
        try await snapshot("read-english", OCRView().environment(session), in: Self.folder, language: "en")
        let letter = folder.appendingPathComponent("Lettre.pdf")
        try demoPDF(title: "Lettre", pages: 2, color: 0).write(to: letter)
        let typed = OCRSession()
        typed.file.open(letter)
        try await waitUntil { typed.file.state == .ready && typed.file.preview != nil }
        await typed.read()
        try await snapshot("nothing-light", OCRView().environment(typed), in: Self.folder)
    }
}
