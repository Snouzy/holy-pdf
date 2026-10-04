import AppKit
import CoreGraphics
import SwiftUI
import Testing
@testable import PDFToolbox

@Suite(.serialized)
@MainActor
struct MergeDragInteractionTests {
    @Test(.timeLimit(.minutes(1)), .enabled(if: dragDriverIsWaiting("merge")))
    func draggingFirstDocumentToEndAndBackChangesProductionOrder() async throws {
        let directory = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: directory) }
        let names = ["Drag A.pdf", "Drag B.pdf", "Drag C.pdf"]
        let files = try names.map { name in
            let url = directory.appendingPathComponent(name)
            try dragFixture(pages: 1).write(to: url)
            return url
        }
        let session = MergeSession()
        session.add(files)
        try await waitUntil { !session.isBusy }
        try #require(session.items.map(\.name) == names)
        try #require(session.canExport)

        let (host, window) = showDragWindow(MergeView().environment(session))
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

        let first = screenPoint(x: 350, fromTop: 151, host: host, window: window)
        let end = screenPoint(x: 350, fromTop: 465, host: host, window: window)
        print("merge native drag geometry: host=\(host.bounds), flipped=\(host.isFlipped), window=\(window.frame), start=\(first), end=\(end)")
        try #require(window.frame.contains(end), "End destination must stay inside the isolated test window")
        try await drag("merge", from: first, to: end, window: window)
        print("merge native drag: down=\(receivedDown), drag=\(receivedDrag), pasteboard=\(NSPasteboard(name: .drag).types ?? []), order=\(session.items.map(\.name))")
        try #require(receivedDown > 0 && receivedDrag > 0, "The isolated window must receive actual mouse events before diagnosing production reordering")
        try await waitUntil { session.items.map(\.name) == [names[1], names[2], names[0]] }
        #expect(session.canUndo)

        let moved = screenPoint(x: 108, fromTop: 367, host: host, window: window)
        let beforeFirst = screenPoint(x: 350, fromTop: 115, host: host, window: window)
        try await drag("merge", from: moved, to: beforeFirst, window: window)
        try await waitUntil { session.items.map(\.name) == names }
        try #require(session.canUndo)
        session.undo()
        #expect(session.items.map(\.name) == [names[1], names[2], names[0]])
        try #require(session.canUndo)
        session.undo()
        #expect(session.items.map(\.name) == names)
    }
}
