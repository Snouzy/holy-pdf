import AppKit
import SwiftUI
import UniformTypeIdentifiers

struct SignatureDrawingView: View {
    var onUse: (Data) -> Void
    var onImport: (URL) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var drawing: Data?
    @State private var resetID = UUID()
    @State private var importing = false

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Create your signature").font(.brandTitle(26))
            Text("Draw with your mouse or trackpad, or import a PNG or JPEG.")
                .foregroundStyle(.secondary)
            SignatureCanvas(resetID: resetID) { drawing = $0 }
                .frame(height: 220)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(nsColor: .separatorColor)))
                .accessibilityLabel("Signature drawing area")
                .accessibilityHint("Use Import image if you cannot draw a signature.")
            HStack {
                Button("Clear drawing") { resetID = UUID(); drawing = nil }
                    .buttonHover()
                    .disabled(drawing == nil)
                Button("Import image…") { importing = true }
                    .buttonHover()
                Spacer()
                Button("Cancel", role: .cancel) { dismiss() }.keyboardShortcut(.cancelAction)
                    .buttonHover()
                Button("Use this signature") {
                    guard let drawing else { return }
                    onUse(drawing)
                    dismiss()
                }
                .keyboardShortcut(.defaultAction)
                .buttonHover()
                .disabled(drawing == nil)
            }
        }
        .padding(24)
        .frame(width: 620)
        .fileImporter(isPresented: $importing, allowedContentTypes: [.png, .jpeg]) { result in
            if case .success(let url) = result {
                onImport(url)
                dismiss()
            }
        }
    }
}

private struct SignatureCanvas: NSViewRepresentable {
    let resetID: UUID
    var onChange: (Data?) -> Void

    func makeNSView(context: Context) -> DrawingCanvas {
        let view = DrawingCanvas()
        view.resetID = resetID
        view.onChange = onChange
        return view
    }

    func updateNSView(_ view: DrawingCanvas, context: Context) {
        view.onChange = onChange
        if view.resetID != resetID {
            view.resetID = resetID
            view.clear()
        }
    }
}

private final class DrawingCanvas: NSView {
    var resetID = UUID()
    var onChange: ((Data?) -> Void)?
    private var strokes: [NSBezierPath] = []
    override var isFlipped: Bool { true }

    func clear() {
        strokes.removeAll()
        needsDisplay = true
    }

    override func draw(_ dirtyRect: NSRect) {
        NSColor.white.setFill()
        bounds.fill()
        NSColor.black.setStroke()
        for path in strokes { path.stroke() }
    }

    override func mouseDown(with event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        let path = NSBezierPath()
        path.lineWidth = 2.5
        path.lineCapStyle = .round
        path.lineJoinStyle = .round
        path.move(to: point)
        path.line(to: CGPoint(x: point.x + 0.1, y: point.y))
        strokes.append(path)
        needsDisplay = true
    }

    override func mouseDragged(with event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        strokes.last?.line(to: CGPoint(x: min(max(point.x, 0), bounds.width), y: min(max(point.y, 0), bounds.height)))
        needsDisplay = true
    }

    override func mouseUp(with event: NSEvent) { onChange?(png()) }

    private func png() -> Data? {
        guard let first = strokes.first else { return nil }
        let crop = strokes.dropFirst().reduce(first.bounds) { $0.union($1.bounds) }.insetBy(dx: -5, dy: -5)
        let scale: CGFloat = 2
        guard let context = CGContext(
            data: nil, width: max(1, Int(ceil(crop.width * scale))), height: max(1, Int(ceil(crop.height * scale))),
            bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return nil }
        context.translateBy(x: 0, y: CGFloat(context.height))
        context.scaleBy(x: scale, y: -scale)
        context.translateBy(x: -crop.minX, y: -crop.minY)
        context.setStrokeColor(CGColor(gray: 0, alpha: 1))
        context.setLineWidth(2.5)
        context.setLineCap(.round)
        context.setLineJoin(.round)
        for stroke in strokes { context.addPath(stroke.cgPath); context.strokePath() }
        guard let image = context.makeImage() else { return nil }
        return NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:])
    }
}
