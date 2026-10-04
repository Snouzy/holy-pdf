import Foundation
import SwiftUI
import Testing
@testable import PDFToolbox

@Suite(.serialized)
@MainActor
struct WatermarkSnapshots {
    private static let folder = ScreenSnapshots.folder.appendingPathComponent("watermark")

    @Test func startAndWorkspace() async throws {
        for dark in [false, true] {
            try await snapshot("start-\(dark ? "dark" : "light")", WatermarkView().environment(WatermarkSession()), in: Self.folder, dark: dark)
        }
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let source = folder.appendingPathComponent("Rapport annuel.pdf")
        try demoPDF(title: "Rapport annuel", pages: 3, color: 0).write(to: source)
        let session = WatermarkSession()
        session.open(source)
        try await waitUntil { session.state == .ready && session.preview != nil && session.overlay(for: session.settings) != nil }
        for dark in [false, true] {
            try await snapshot("workspace-\(dark ? "dark" : "light")", WatermarkView().environment(session), in: Self.folder, dark: dark)
        }
        try await snapshot("workspace-english", WatermarkView().environment(session), in: Self.folder, language: "en")
        session.addPlacement()
        session.update { $0.text = "BROUILLON"; $0.center = CGPoint(x: 0.3, y: 0.2); $0.width = 0.35; $0.angle = 0 }
        try await waitUntil { session.overlay(for: session.settings) != nil }
        try await snapshot("two-light", WatermarkView().environment(session), in: Self.folder)
    }
}
