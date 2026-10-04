import AppKit
import SwiftUI
import Testing
@testable import PDFToolbox

@Suite(.serialized)
@MainActor
struct PagePickingSnapshots {
    private static let folder = ScreenSnapshots.folder.appendingPathComponent("picking")

    private func opened(_ mode: PagePickingSession.Mode, in folder: URL) async throws -> PagePickingSession {
        let source = folder.appendingPathComponent("Rapport annuel.pdf")
        try demoPDF(title: "Rapport annuel", pages: 7, color: 0).write(to: source)
        let session = PagePickingSession(mode: mode)
        session.open(source)
        try await waitUntil { session.pageCount == 7 }
        for page in 0..<7 { _ = await session.deck.thumbnail(pageID: page) }
        return session
    }

    @Test func splitStartAndCuts() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        try await snapshot("split-start-light", PagePickingView(session: PagePickingSession(mode: .split)), in: Self.folder)
        let session = try await opened(.split, in: folder)
        session.toggle(1)
        session.toggle(4)
        #expect(session.parts == [0...1, 2...4, 5...6])
        for dark in [false, true] {
            try await snapshot("split-cuts-\(dark ? "dark" : "light")", PagePickingView(session: session), in: Self.folder, dark: dark)
        }
        try await snapshot("split-cuts-english", PagePickingView(session: session), in: Self.folder, language: "en")
    }

    @Test func aClickOnTheScissorsBetweenTwoPagesCutsThere() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let session = try await opened(.split, in: folder)
        // The scissors sit in the gap after the first card, outside that card's bounds: (255, 220) from the top left at 960 × 640.
        try await snapshot("split-after-click", PagePickingView(session: session), in: Self.folder, interact: { _, window in
            let events = try [NSEvent.EventType.leftMouseDown, .leftMouseUp].map { type in
                try #require(NSEvent.mouseEvent(
                    with: type, location: CGPoint(x: 255, y: 640 - 220), modifierFlags: [],
                    timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber,
                    context: nil, eventNumber: 0, clickCount: 1, pressure: 1))
            }
            NSApp.postEvent(events[1], atStart: false)
            window.sendEvent(events[0])
        })
        try await waitUntil { session.picked == [0] }
    }

    @Test func extractStartAndSelection() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        try await snapshot("extract-start-dark", PagePickingView(session: PagePickingSession(mode: .extract)), in: Self.folder, dark: true)
        let session = try await opened(.extract, in: folder)
        session.toggle(0)
        session.toggle(2)
        session.toggle(5)
        for dark in [false, true] {
            try await snapshot("extract-selection-\(dark ? "dark" : "light")", PagePickingView(session: session), in: Self.folder, dark: dark)
        }
    }
}
