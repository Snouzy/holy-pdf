import AppKit
import PDFCore
import SwiftUI
import Testing
@testable import PDFToolbox

@Suite(.serialized)
@MainActor
struct EditSnapshots {
    private static let folder = ScreenSnapshots.folder.appendingPathComponent("edit")

    @Test func startWorkspaceAndCrop() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        try await snapshot("start-light", EditView().environment(EditSession()), in: Self.folder)
        let source = folder.appendingPathComponent("Contrat.pdf")
        try demoPDF(title: "Contrat", pages: 2, color: 0).write(to: source)
        let session = EditSession()
        session.file.open(source)
        try await waitUntil { session.file.state == .ready && session.file.preview != nil }
        session.choose(.text)
        session.beginText(at: CGPoint(x: 0.08, y: 0.22))
        session.typeText("Lu et approuvé")
        session.commitText()
        session.choose(.rectangle)
        session.addShape(in: CGRect(x: 0.07, y: 0.3, width: 0.5, height: 0.1))
        session.choose(.arrow)
        session.addLine(from: CGPoint(x: 0.6, y: 0.5), to: CGPoint(x: 0.85, y: 0.4))
        session.choose(.highlighter)
        session.addShape(in: CGRect(x: 0.07, y: 0.185, width: 0.3, height: 0.03))
        session.addImage(from: try pictureFile("photo.jpg", in: folder, width: 400, height: 300), at: CGPoint(x: 0.7, y: 0.72))
        try await waitUntil { session.items.count == 5 }
        for dark in [false, true] {
            try await snapshot("workspace-\(dark ? "dark" : "light")", EditView().environment(session), in: Self.folder, dark: dark)
        }
        try await snapshot("workspace-english", EditView().environment(session), in: Self.folder, language: "en")
        session.toggleCropping()
        try await snapshot("cropping-light", EditView().environment(session), in: Self.folder)
    }
}
