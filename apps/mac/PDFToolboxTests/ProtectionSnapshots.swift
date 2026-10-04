import PDFKit
import SwiftUI
import Testing
@testable import PDFToolbox

@Suite(.serialized)
@MainActor
struct ProtectionSnapshots {
    private static let folder = ScreenSnapshots.folder.appendingPathComponent("protection")

    private func opened(_ mode: ProtectionSession.Mode, in folder: URL, password: String? = nil) async throws -> ProtectionSession {
        let source = folder.appendingPathComponent("Bulletin de paie.pdf")
        var data = try demoPDF(title: "Bulletin de paie", pages: 3, color: 0)
        if let password {
            data = try #require(PDFDocument(data: data)?.dataRepresentation(options: [
                PDFDocumentWriteOption.userPasswordOption: password, PDFDocumentWriteOption.ownerPasswordOption: password,
            ]))
        }
        try data.write(to: source)
        let session = ProtectionSession(mode: mode)
        session.file.open(source)
        try await waitUntil { session.file.state == .ready || session.file.state == .locked }
        return session
    }

    @Test func protect() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        try await snapshot("protect-start-light", ProtectionView(session: ProtectionSession(mode: .protect)), in: Self.folder)
        let session = try await opened(.protect, in: folder)
        try await waitUntil { session.file.preview != nil }
        session.password = "s3same-ouvre-toi"
        session.confirmation = "s3same-ouvre-toi"
        for dark in [false, true] {
            try await snapshot("protect-ready-\(dark ? "dark" : "light")", ProtectionView(session: session), in: Self.folder, dark: dark)
        }
        try await snapshot("protect-ready-english", ProtectionView(session: session), in: Self.folder, language: "en")
        session.confirmation = "s3same"
        try await snapshot("protect-different-light", ProtectionView(session: session), in: Self.folder)
        session.password = "sésame"
        try await snapshot("protect-refused-light", ProtectionView(session: session), in: Self.folder)
        session.password = "s3same"
        await session.saveCopy(to: folder.appendingPathComponent("Bulletin de paie-protégé.pdf"))
        try await snapshot("protect-saved-light", ProtectionView(session: session), in: Self.folder)
    }

    @Test func unlock() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        try await snapshot("unlock-start-dark", ProtectionView(session: ProtectionSession(mode: .unlock)), in: Self.folder, dark: true)
        let session = try await opened(.unlock, in: folder, password: "1234")
        try await snapshot("unlock-locked-light", ProtectionView(session: session), in: Self.folder)
        session.file.unlock("1234")
        try await waitUntil { session.file.state == .ready && session.file.preview != nil }
        try await snapshot("unlock-ready-light", ProtectionView(session: session), in: Self.folder)
        let plain = try await opened(.unlock, in: folder)
        try await waitUntil { plain.file.preview != nil }
        try await snapshot("unlock-nothing-light", ProtectionView(session: plain), in: Self.folder)
    }
}
