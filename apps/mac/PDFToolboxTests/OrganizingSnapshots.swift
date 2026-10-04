import SwiftUI
import Testing
@testable import PDFToolbox

@Suite(.serialized)
@MainActor
struct OrganizingSnapshots {
    private static let folder = ScreenSnapshots.folder.appendingPathComponent("organizing")

    nonisolated private static var enabled: Bool {
        ProcessInfo.processInfo.environment["HOLY_PDF_ORGANIZE_SNAPSHOTS"] == "1"
            || FileManager.default.fileExists(atPath: FileManager.default.temporaryDirectory
                .appendingPathComponent("holy-pdf-organize-snapshots-enabled").path)
    }

    @Test(.enabled(if: enabled))
    func startAndEditedPagesInBothAppearances() async throws {
        let directory = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: directory) }
        let url = directory.appendingPathComponent("Dossier exemple.pdf")
        try demoPDF(title: "Synthetic application", pages: 3, color: 0).write(to: url)
        let session = OrganizingSession()
        session.open(url)
        try await waitUntil { !session.isBusy }
        try #require(session.pages.map(\.id) == [0, 1, 2])
        for id in 0..<3 { _ = await session.thumbnail(pageID: id) }
        try #require(session.cachedThumbnailCount == 3)
        for dark in [false, true] {
            try await snapshot("start-\(dark ? "dark" : "light")", OrganizingView().environment(OrganizingSession()), in: Self.folder, dark: dark)
            try await snapshot("pages-\(dark ? "dark" : "light")", OrganizingView().environment(session), in: Self.folder, dark: dark)
        }
        session.move(id: 0, before: nil)
        session.rotate(id: 1)
        #expect(session.pages.map(\.id) == [1, 2, 0])
        for dark in [false, true] {
            try await snapshot("edited-pages-\(dark ? "dark" : "light")", OrganizingView().environment(session), in: Self.folder, dark: dark)
        }
    }
}
