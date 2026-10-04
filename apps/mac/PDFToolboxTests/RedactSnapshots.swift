import AppKit
import SwiftUI
import Testing
@testable import PDFToolbox

@Suite(.serialized)
@MainActor
struct RedactSnapshots {
    private static let folder = ScreenSnapshots.folder.appendingPathComponent("redact")

    private func opened(in folder: URL) async throws -> RedactSession {
        let source = folder.appendingPathComponent("Contrat.pdf")
        try demoPDF(title: "Contrat", pages: 3, color: 0).write(to: source)
        let session = RedactSession()
        session.file.open(source)
        try await waitUntil { session.file.state == .ready && session.file.preview != nil }
        return session
    }

    @Test func startAndAreas() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        try await snapshot("start-light", RedactView().environment(RedactSession()), in: Self.folder)
        let session = try await opened(in: folder)
        session.add(CGRect(x: 0.07, y: 0.16, width: 0.3, height: 0.03))
        session.add(CGRect(x: 0.07, y: 0.3, width: 0.86, height: 0.11))
        for dark in [false, true] {
            try await snapshot("areas-\(dark ? "dark" : "light")", RedactView().environment(session), in: Self.folder, dark: dark)
        }
        try await snapshot("areas-english", RedactView().environment(session), in: Self.folder, language: "en")
        await session.saveCopy(to: folder.appendingPathComponent("Contrat-noirci.pdf"))
        try await snapshot("saved-light", RedactView().environment(session), in: Self.folder)
    }

    @Test func aDragOnThePageDrawsAnArea() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let session = try await opened(in: folder)
        var size = CGSize.zero
        try await snapshot("after-drag", RedactView().environment(session), in: Self.folder, interact: { host, window in
            let page = try #require(descendants(host).first { $0 is DragTrackingView })
            // In the page's own space, origin top-left. The last drag is a click: it draws nothing.
            let drags: [[CGPoint]] = [[CGPoint(x: 40, y: 60), CGPoint(x: 90, y: 80), CGPoint(x: 190, y: 100)], [CGPoint(x: 300, y: 300), CGPoint(x: 301, y: 302)]]
            for points in drags {
                for (index, point) in points.enumerated() {
                    let event = try #require(NSEvent.mouseEvent(
                        with: index == 0 ? .leftMouseDown : .leftMouseDragged, location: page.convert(point, to: nil), modifierFlags: [],
                        timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber,
                        context: nil, eventNumber: index, clickCount: 1, pressure: 1))
                    if index == 0 { page.mouseDown(with: event) } else { page.mouseDragged(with: event) }
                }
                let last = try #require(points.last)
                page.mouseUp(with: try #require(NSEvent.mouseEvent(
                    with: .leftMouseUp, location: page.convert(last, to: nil), modifierFlags: [],
                    timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber,
                    context: nil, eventNumber: points.count, clickCount: 1, pressure: 0)))
            }
            size = page.bounds.size
        })
        #expect(abs(size.width / size.height - 595.0 / 842) < 0.01, "The tracker has the shape of the page: \(size)")
        #expect(session.areasOnPage.count == 1)
        let area = try #require(session.areasOnPage.first)
        #expect(abs(area.minX - 40 / size.width) < 0.001 && abs(area.minY - 60 / size.height) < 0.001, "\(area)")
        #expect(abs(area.width - 150 / size.width) < 0.001 && abs(area.height - 40 / size.height) < 0.001, "\(area)")
    }
}
