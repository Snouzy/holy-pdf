import AppKit
import PDFCore
import Testing
@testable import PDFToolbox

@MainActor
struct EditCanvasTests {
    /// The page at 0.8 pixel per point, in a window: events need one to find their place.
    private func canvas() async throws -> (session: EditSession, view: EditCanvasView, window: NSWindow, folder: URL) {
        let folder = try temporaryFolder()
        let source = folder.appendingPathComponent("Contrat.pdf")
        try demoPDF(title: "Contrat", pages: 2, color: 0).write(to: source)
        let session = EditSession()
        session.file.open(source)
        try await waitUntil { session.file.state == .ready }
        let window = KeyWindow(contentRect: CGRect(x: 0, y: 0, width: 600, height: 800), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        let view = EditCanvasView(session: session)
        view.frame = CGRect(x: 0, y: 0, width: 476, height: 673.6)
        window.contentView?.addSubview(view)
        window.makeKeyAndOrderFront(nil)
        return (session, view, window, folder)
    }

    private func mouse(_ type: NSEvent.EventType, at point: CGPoint, on view: NSView, clicks: Int = 1) throws {
        let event = try #require(NSEvent.mouseEvent(with: type, location: view.convert(point, to: nil), modifierFlags: [],
                                                    timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: view.window?.windowNumber ?? 0,
                                                    context: nil, eventNumber: 0, clickCount: clicks, pressure: 1))
        switch type {
        case .leftMouseDown: view.mouseDown(with: event)
        case .leftMouseDragged: view.mouseDragged(with: event)
        default: view.mouseUp(with: event)
        }
    }

    /// In the view's own points, origin top-left. One point is a click.
    private func drag(_ points: [CGPoint], on view: NSView, clicks: Int = 1) throws {
        for (index, point) in points.enumerated() { try mouse(index == 0 ? .leftMouseDown : .leftMouseDragged, at: point, on: view, clicks: clicks) }
        try mouse(.leftMouseUp, at: try #require(points.last), on: view, clicks: clicks)
    }

    private func key(_ code: UInt16, shift: Bool = false, on view: NSView) throws {
        view.keyDown(with: try #require(NSEvent.keyEvent(
            with: .keyDown, location: .zero, modifierFlags: shift ? [.shift] : [], timestamp: ProcessInfo.processInfo.systemUptime,
            windowNumber: view.window?.windowNumber ?? 0, context: nil, characters: "", charactersIgnoringModifiers: "", isARepeat: false, keyCode: code)))
    }

    @Test func aDragDrawsTheShapeAndTheArrowComesBack() async throws {
        let (session, view, window, folder) = try await canvas()
        defer { window.close(); try? FileManager.default.removeItem(at: folder) }
        session.choose(.rectangle)
        try drag([CGPoint(x: 40, y: 60), CGPoint(x: 120, y: 80), CGPoint(x: 190, y: 100)], on: view)
        let box = try #require(session.items.first)
        #expect(abs(box.frame.minX - 40 / 476) < 1e-6 && abs(box.frame.minY - 60 / 673.6) < 1e-6)
        #expect(abs(box.frame.width - 150 / 476) < 1e-6 && abs(box.frame.height - 40 / 673.6) < 1e-6)
        #expect(session.tool == .select && session.selectedID == box.id)
        session.choose(.ellipse)
        try drag([CGPoint(x: 300, y: 300), CGPoint(x: 302, y: 301)], on: view)
        #expect(session.items.count == 1, "Under four points, the drag was a click")
        session.choose(.pen)
        try drag([CGPoint(x: 300, y: 300)], on: view)
        #expect(session.items.count == 1, "A click of the pen leaves nothing")
        try drag([CGPoint(x: 300, y: 300), CGPoint(x: 320, y: 340), CGPoint(x: 360, y: 320)], on: view)
        #expect(session.items.count == 2 && session.tool == .pen)
        try key(53, on: view)
        #expect(session.tool == .select, "Esc puts the arrow back in the hand")
    }

    @Test func theArrowMovesResizesNudgesAndDeletes() async throws {
        let (session, view, window, folder) = try await canvas()
        defer { window.close(); try? FileManager.default.removeItem(at: folder) }
        session.choose(.rectangle)
        try drag([CGPoint(x: 100, y: 100), CGPoint(x: 200, y: 180)], on: view)
        try drag([CGPoint(x: 150, y: 140), CGPoint(x: 170, y: 150)], on: view)
        let moved = try #require(session.items.first)
        #expect(abs(moved.frame.minX - 120 / 476) < 1e-6 && abs(moved.frame.minY - 110 / 673.6) < 1e-6)
        try drag([CGPoint(x: 220, y: 190), CGPoint(x: 260, y: 230)], on: view)
        let grown = try #require(session.items.first)
        #expect(abs(grown.frame.width - 140 / 476) < 1e-6 && abs(grown.frame.height - 120 / 673.6) < 1e-6, "The bottom-right handle grows it")
        try drag([CGPoint(x: 150, y: 150), CGPoint(x: -400, y: -400)], on: view)
        let edge = try #require(session.items.first)
        #expect(edge.frame.minX == 0 && edge.frame.minY == 0, "Dragged past the edge, it stops at the edge")
        try key(124, on: view)
        #expect(abs(session.items[0].frame.minX - 1.0 / 595) < 1e-9)
        try key(125, shift: true, on: view)
        #expect(abs(session.items[0].frame.minY - 10.0 / 842) < 1e-9)
        try drag([CGPoint(x: 400, y: 600)], on: view)
        #expect(session.selectedID == nil)
        try drag([CGPoint(x: 50, y: 50)], on: view)
        try key(51, on: view)
        #expect(session.items.isEmpty)
        session.undo()
        #expect(session.items.count == 1)
    }

    @Test func drawingResizingAndInkStopAtThePageEdge() async throws {
        let (session, view, window, folder) = try await canvas()
        defer { window.close(); try? FileManager.default.removeItem(at: folder) }
        func inside(_ frame: CGRect) -> Bool { frame.minX >= 0 && frame.minY >= 0 && frame.maxX <= 1 + 1e-9 && frame.maxY <= 1 + 1e-9 }
        session.choose(.rectangle)
        try drag([CGPoint(x: 300, y: 500), CGPoint(x: 2000, y: 2000)], on: view)
        #expect(session.items.last.map { inside($0.frame) } == true, "A new shape stops at the edge")
        session.choose(.rectangle)
        try drag([CGPoint(x: 100, y: 100), CGPoint(x: 200, y: 200)], on: view)
        try drag([CGPoint(x: 200, y: 200), CGPoint(x: 2000, y: -500)], on: view)
        #expect(session.items.last.map { inside($0.frame) } == true, "A handle stops at the edge")
        session.choose(.pen)
        try drag([CGPoint(x: 400, y: 600), CGPoint(x: 900, y: 900)], on: view)
        #expect(session.items.last.map { inside($0.frame) } == true, "Ink stops at the edge")
    }

    @Test func theTextToolTypesOnThePage() async throws {
        let (session, view, window, folder) = try await canvas()
        defer { window.close(); try? FileManager.default.removeItem(at: folder) }
        session.choose(.text)
        try drag([CGPoint(x: 80, y: 120)], on: view)
        let field = try #require(descendants(view).compactMap { $0 as? NSTextView }.first)
        #expect(abs(field.frame.minX - 80) < 0.5 && abs(field.frame.minY - 120) < 0.5, "The field sits where the text will be")
        field.insertText("Lu et approuvé", replacementRange: NSRange(location: NSNotFound, length: 0))
        #expect(session.draft?.content == .text("Lu et approuvé", EditTextStyle()))
        try drag([CGPoint(x: 400, y: 600)], on: view)
        #expect(session.draft == nil && session.items.count == 1, "A click elsewhere keeps the text")
        #expect(!descendants(view).contains { $0 is NSTextView })
        let text = try #require(session.items.first)
        try drag([CGPoint(x: 85, y: 128)], on: view)
        try drag([CGPoint(x: 85, y: 128)], on: view, clicks: 2)
        #expect(session.draft?.id == text.id, "A double click opens the text again")
        let again = try #require(descendants(view).compactMap { $0 as? NSTextView }.first)
        #expect(again.string == "Lu et approuvé")
        again.doCommand(by: #selector(NSResponder.cancelOperation(_:)))
        #expect(session.draft == nil && session.items == [text], "Esc keeps the text as it was")
    }

    @Test func theHighlighterShowsThePageUnderItOnScreen() async throws {
        let (session, view, window, folder) = try await canvas()
        defer { window.close(); try? FileManager.default.removeItem(at: folder) }
        try await waitUntil { session.file.preview != nil }
        session.choose(.highlighter)
        session.addShape(in: CGRect(x: 0.1, y: 0.02, width: 0.3, height: 0.06))
        view.refresh()
        let picture = try #require(view.bitmapImageRepForCachingDisplay(in: view.bounds))
        view.cacheDisplay(in: view.bounds, to: picture)
        let color = try #require(picture.colorAt(x: Int(0.25 * Double(picture.pixelsWide)), y: Int(0.05 * Double(picture.pixelsHigh)))?
            .usingColorSpace(.sRGB))
        #expect(color.redComponent < 0.4 && color.greenComponent < 0.6, "Over the blue band, the yellow multiplies: \(color)")
    }

    @Test func pastingAPictureAddsItAndOtherContentAddsNothing() async throws {
        let (session, view, window, folder) = try await canvas()
        defer { window.close(); try? FileManager.default.removeItem(at: folder) }
        let board = NSPasteboard(name: NSPasteboard.Name(UUID().uuidString))
        defer { board.releaseGlobally() }
        board.clearContents()
        board.setString("Bonjour", forType: .string)
        view.paste(from: board)
        let png = try Data(contentsOf: try pictureFile("capture.png", in: folder, width: 300, height: 200, type: .png))
        // Finder's ⌘C puts the file's icon next to its address: the icon is not the picture to paste.
        let copied = NSPasteboardItem()
        copied.setString(folder.appendingPathComponent("Contrat.pdf").absoluteString, forType: .fileURL)
        copied.setData(png, forType: .png)
        board.clearContents()
        board.writeObjects([copied])
        view.paste(from: board)
        try await Task.sleep(for: .milliseconds(200))
        #expect(session.items.isEmpty && session.file.errorMessage == nil && !session.isLoadingImage)
        board.clearContents()
        board.setData(png, forType: .png)
        view.paste(from: board)
        try await waitUntil { session.items.count == 1 }
    }
}
