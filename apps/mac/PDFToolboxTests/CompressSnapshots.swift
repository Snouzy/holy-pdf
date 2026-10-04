import SwiftUI
import Testing
@testable import PDFToolbox

@Suite(.serialized)
@MainActor
struct CompressSnapshots {
    private static let folder = ScreenSnapshots.folder.appendingPathComponent("compress")

    private func opened(_ data: Data, in folder: URL) async throws -> CompressSession {
        let source = folder.appendingPathComponent("Album de vacances.pdf")
        try data.write(to: source)
        let session = CompressSession()
        session.file.open(source)
        try await waitUntil { session.file.state == .ready && session.file.preview != nil }
        return session
    }

    @Test func startLevelsAndResults() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        try await snapshot("start-light", CompressView().environment(CompressSession()), in: Self.folder)
        let session = try await opened(try photoPDF(title: "Album de vacances"), in: folder)
        try await snapshot("ready-light", CompressView().environment(session), in: Self.folder)
        await session.compress()
        for dark in [false, true] {
            try await snapshot("lighter-\(dark ? "dark" : "light")", CompressView().environment(session), in: Self.folder, dark: dark)
        }
        try await snapshot("lighter-english", CompressView().environment(session), in: Self.folder, language: "en")
        await session.saveCopy(to: folder.appendingPathComponent("Album de vacances-compressé.pdf"))
        try await snapshot("saved-light", CompressView().environment(session), in: Self.folder)
        let letter = try await opened(try demoPDF(title: "Lettre", pages: 2, color: 0), in: folder)
        await letter.compress()
        #expect(letter.outcome == .alreadyLight)
        try await snapshot("already-light", CompressView().environment(letter), in: Self.folder)
    }

    @Test func theWorkShowsItsProgressAndACancelButton() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let session = try await opened(try photoPDF(title: "Album de vacances"), in: folder)
        let (gate, lift) = AsyncStream<Void>.makeStream()
        async let waiting: Int? = session.file.prepare { _, _ in
            for await _ in gate { break }
            return 1
        }
        defer { lift.finish() }
        try await waitUntil { session.file.state == .working }
        try await snapshot("working-light", CompressView().environment(session), in: Self.folder)
        lift.yield()
        #expect(await waiting == 1)
    }
}
