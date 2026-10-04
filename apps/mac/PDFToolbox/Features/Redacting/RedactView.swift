import AppKit
import SwiftUI

struct RedactView: View {
    @Environment(RedactSession.self) private var session

    var body: some View {
        CopyToolView(file: session.file, tool: .redact,
                     startTitle: "What you cover is gone for good",
                     startHint: "Drop a PDF here, then drag over what must disappear.",
                     saveTitle: "Save the redacted copy…", savedTitle: "Redacted copy saved",
                     canSave: session.canSave, undo: session.canUndo ? { session.undo() } : nil,
                     onPage: AnyView(RedactCanvas(session: session)), save: session.export) {
            Text("Drag on the page to cover what must disappear.")
            Text("A page that carries a black area becomes an image: what the area covers is no longer in the file. On that page, the text can no longer be selected, and the links, notes and form fields are removed.")
                .font(.callout).foregroundStyle(.secondary)
            Label("Black areas: \(session.areaCount) (pages: \(session.pageCount))", systemImage: "rectangle.fill")
            Button("Remove the areas of this page", action: session.removeAllOnPage)
                .buttonHover().disabled(session.areasOnPage.isEmpty)
            Button(action: session.undo) { Label("Undo", systemImage: "arrow.uturn.backward") }
                .buttonHover().disabled(!session.canUndo)
            Label("Bookmarks and document properties (title, author) stay in the copy.", systemImage: "info.circle").font(.callout).foregroundStyle(.secondary)
            Label("Look at the saved copy before you share it.", systemImage: "eye").font(.callout).foregroundStyle(.secondary)
        }
    }
}

/// Laid over the page: a drag draws a black area, the cross on an area removes it.
struct RedactCanvas: View {
    let session: RedactSession
    @State private var drawing: CGRect?

    var body: some View {
        GeometryReader { geometry in
            let page = geometry.size
            ZStack(alignment: .topLeading) {
                DragTracker { start, now in
                    drawing = CGRect(x: start.x / page.width, y: start.y / page.height,
                                     width: (now.x - start.x) / page.width, height: (now.y - start.y) / page.height)
                } ended: {
                    // Under four points, the drag was a click.
                    if let drawing, abs(drawing.width) * page.width >= 4, abs(drawing.height) * page.height >= 4 { session.add(drawing) }
                    drawing = nil
                }
                ForEach(Array(session.areasOnPage.enumerated()), id: \.offset) { index, area in
                    // A new area may start over an old one: only the cross takes the click.
                    Rectangle().fill(.black).allowsHitTesting(false)
                        .overlay(alignment: .topTrailing) {
                            Button { session.remove(at: index) } label: {
                                Image(systemName: "xmark.circle.fill").symbolRenderingMode(.palette).foregroundStyle(.black, .white)
                            }
                            .buttonStyle(.plain).help("Remove this area").offset(x: 8, y: -8)
                        }
                        .frame(width: area.width * page.width, height: area.height * page.height)
                        .offset(x: area.minX * page.width, y: area.minY * page.height)
                }
                if let drawing = drawing?.standardized {
                    Rectangle().fill(.black.opacity(0.6))
                        .frame(width: drawing.width * page.width, height: drawing.height * page.height)
                        .offset(x: drawing.minX * page.width, y: drawing.minY * page.height)
                        .allowsHitTesting(false)
                }
            }
        }
    }
}

/// AppKit follows the mouse: a test can then drive the drag, which a SwiftUI gesture does not let it do.
private struct DragTracker: NSViewRepresentable {
    var changed: (_ start: CGPoint, _ now: CGPoint) -> Void
    var ended: () -> Void

    func makeNSView(context: Context) -> DragTrackingView { DragTrackingView() }

    func updateNSView(_ view: DragTrackingView, context: Context) {
        view.changed = changed
        view.ended = ended
    }
}

final class DragTrackingView: NSView {
    var changed: (CGPoint, CGPoint) -> Void = { _, _ in }
    var ended: () -> Void = {}
    private var start: CGPoint?

    override var isFlipped: Bool { true }

    override func mouseDown(with event: NSEvent) {
        start = convert(event.locationInWindow, from: nil)
    }

    override func mouseDragged(with event: NSEvent) {
        if let start { changed(start, convert(event.locationInWindow, from: nil)) }
    }

    override func mouseUp(with event: NSEvent) {
        start = nil
        ended()
    }

    override func resetCursorRects() {
        addCursorRect(bounds, cursor: .crosshair)
    }
}
