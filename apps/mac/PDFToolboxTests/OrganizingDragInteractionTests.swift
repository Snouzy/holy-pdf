import AppKit
import SwiftUI
import Testing
@testable import PDFToolbox

@Suite(.serialized)
@MainActor
struct OrganizingDragInteractionTests {
    @Test(.timeLimit(.minutes(1)), .enabled(if: dragDriverIsWaiting("organize")))
    func draggingPagesToTheEndTheStartAndAfterACardChangesProductionOrder() async throws {
        let directory = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: directory) }
        let url = directory.appendingPathComponent("Synthetic three-page document.pdf")
        try dragFixture(pages: 3).write(to: url)
        let session = OrganizingSession()
        session.open(url)
        try await waitUntil { !session.isBusy }
        try #require(session.pages.map(\.id) == [0, 1, 2])
        try #require(session.canExport)

        let (host, window) = showDragWindow(OrganizingView().environment(session))
        defer { window.orderOut(nil); window.close() }
        try await Task.sleep(for: .milliseconds(700))
        host.layoutSubtreeIfNeeded()

        var receivedDown = 0
        var receivedDrag = 0
        let monitor = NSEvent.addLocalMonitorForEvents(matching: [.leftMouseDown, .leftMouseDragged]) { event in
            if event.windowNumber == window.windowNumber {
                if event.type == .leftMouseDown { receivedDown += 1 }
                if event.type == .leftMouseDragged { receivedDrag += 1 }
            }
            return event
        }
        defer { if let monitor { NSEvent.removeMonitor(monitor) } }

        let first = screenPoint(x: 128, fromTop: 190, host: host, window: window)
        let end = screenPoint(x: 480, fromTop: 408, host: host, window: window)
        try #require(window.frame.contains(first) && window.frame.contains(end))
        try await drag("organize", from: first, to: end, window: window)
        try #require(receivedDown > 0 && receivedDrag > 0, "The isolated window must receive actual mouse events")
        try await waitUntil { session.pages.map(\.id) == [1, 2, 0] }
        #expect(session.canUndo)

        host.layoutSubtreeIfNeeded()
        let moved = screenPoint(x: 597, fromTop: 190, host: host, window: window)
        let beforeFirst = screenPoint(x: 40, fromTop: 180, host: host, window: window)
        try #require(window.frame.contains(moved) && window.frame.contains(beforeFirst))
        try await drag("organize", from: moved, to: beforeFirst, window: window)
        try await waitUntil { session.pages.map(\.id) == [0, 1, 2] }
        try #require(session.canUndo)
        session.undo()
        #expect(session.pages.map(\.id) == [1, 2, 0])
        try #require(session.canUndo)
        session.undo()
        #expect(session.pages.map(\.id) == [0, 1, 2])

        host.layoutSubtreeIfNeeded()
        let afterSecond = screenPoint(x: 430, fromTop: 190, host: host, window: window)
        try #require(window.frame.contains(afterSecond))
        try await drag("organize", from: first, to: afterSecond, window: window)
        try await waitUntil { session.pages.map(\.id) == [1, 0, 2] }
    }
}
