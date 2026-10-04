import SwiftUI
import Testing
@testable import PDFToolbox

/// Pixelize, Split pages in half and Pages per sheet: three screens of one choice each.
@Suite(.serialized)
@MainActor
struct SheetToolsSnapshots {
    private func source(_ name: String, in folder: URL) throws -> URL {
        let url = folder.appendingPathComponent("\(name).pdf")
        try demoPDF(title: name, pages: 5, color: 0).write(to: url)
        return url
    }

    @Test func pixelize() async throws {
        let shots = ScreenSnapshots.folder.appendingPathComponent("pixelize")
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        try await snapshot("start-light", PixelizeView().environment(PixelizeSession()), in: shots)
        let session = PixelizeSession()
        session.file.open(try source("Contrat", in: folder))
        try await waitUntil { session.file.state == .ready && session.file.preview != nil }
        for dark in [false, true] {
            try await snapshot("ready-\(dark ? "dark" : "light")", PixelizeView().environment(session), in: shots, dark: dark)
        }
        try await snapshot("ready-english", PixelizeView().environment(session), in: shots, language: "en")
        await session.saveCopy(to: folder.appendingPathComponent("Contrat-pixellise.pdf"))
        try await snapshot("saved-light", PixelizeView().environment(session), in: shots)
    }

    @Test func halves() async throws {
        let shots = ScreenSnapshots.folder.appendingPathComponent("halves")
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        try await snapshot("start-light", HalvesView().environment(HalvesSession()), in: shots)
        let session = HalvesSession()
        session.file.open(try source("Livre", in: folder))
        try await waitUntil { session.file.state == .ready && session.file.preview != nil }
        let leftRight = session.file.preview?.dataProvider?.data
        for dark in [false, true] {
            try await snapshot("ready-\(dark ? "dark" : "light")", HalvesView().environment(session), in: shots, dark: dark)
        }
        try await snapshot("ready-english", HalvesView().environment(session), in: shots, language: "en")
        session.cut = .topBottom
        try await waitUntil { session.file.preview.map { $0.dataProvider?.data != leftRight } ?? false }
        try await snapshot("top-bottom-light", HalvesView().environment(session), in: shots)
        await session.saveCopy(to: folder.appendingPathComponent("Livre-coupe.pdf"))
        try await snapshot("saved-light", HalvesView().environment(session), in: shots)
    }

    @Test func sheets() async throws {
        let shots = ScreenSnapshots.folder.appendingPathComponent("sheets")
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        try await snapshot("start-light", SheetsView().environment(SheetsSession()), in: shots)
        let session = SheetsSession()
        session.file.open(try source("Rapport", in: folder))
        try await waitUntil { session.file.state == .ready && session.file.preview != nil }
        for dark in [false, true] {
            try await snapshot("ready-\(dark ? "dark" : "light")", SheetsView().environment(session), in: shots, dark: dark)
        }
        try await snapshot("ready-english", SheetsView().environment(session), in: shots, language: "en")
        session.perSheet = 6
        try await snapshot("six-light", SheetsView().environment(session), in: shots)
        await session.saveCopy(to: folder.appendingPathComponent("Rapport-par-feuille.pdf"))
        try await snapshot("saved-light", SheetsView().environment(session), in: shots)
    }
}
