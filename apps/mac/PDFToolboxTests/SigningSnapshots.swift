import AppKit
import CoreText
import SwiftUI
import Testing
@testable import PDFToolbox

@Suite(.serialized)
@MainActor
struct SigningSnapshots {
    private static let folder = ScreenSnapshots.folder.appendingPathComponent("signing")

    @Test func homeAndSigningStart() async throws {
        for dark in [false, true] {
            let suffix = dark ? "dark" : "light"
            try await snapshot("home-\(suffix)", HomeView { _ in }, in: Self.folder, dark: dark)
            try await snapshot("home-wide-\(suffix)", HomeView { _ in }, in: Self.folder, width: 1280, height: 760, dark: dark)
            try await snapshot("start-\(suffix)", SigningView().environment(SigningSession()), in: Self.folder, dark: dark)
        }
    }

    @Test func signingPageAndPanel() async throws {
        let temporary = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: temporary) }
        let source = temporary.appendingPathComponent("Example agreement.pdf")
        try demoPDF().write(to: source)
        let session = SigningSession()
        session.open(source)
        try await waitUntil { session.state == .ready && session.preview != nil }
        session.addSignature(data: try demoSignature())
        try await waitUntil { session.canExport }
        session.addText("Ada Lovelace", style: .handwritten)
        try await waitUntil { session.marks.count == 2 && session.placements.count == 2 }
        session.updatePlacement(id: session.placements[1].id, bounds: CGRect(x: 0.1, y: 0.86, width: 0.3, height: session.placements[1].bounds.height))
        let placement = try #require(session.placements.first)
        session.updatePlacement(id: placement.id, bounds: CGRect(x: 0.45, y: 0.73, width: 0.28, height: placement.bounds.height))
        #expect(session.pageSizes.count == 2)
        for dark in [false, true] {
            try await snapshot("page-\(dark ? "dark" : "light")", SigningView().environment(session), in: Self.folder, dark: dark,
                                until: pageContentIsVisible)
        }
        try await snapshot("page-english", SigningView().environment(session), in: Self.folder, language: "en",
                            until: pageContentIsVisible)
    }

    @Test func nativeSignatureDrawingSheet() async throws {
        for dark in [false, true] {
            try await snapshot(
                "drawing-\(dark ? "dark" : "light")",
                SignatureDrawingView(onUse: { _ in }, onImport: { _ in }),
                in: Self.folder, width: 660, height: 430, dark: dark,
                interact: { host, window in
                    let canvas = try #require(descendants(host).first { String(describing: type(of: $0)) == "DrawingCanvas" })
                    let points = [CGPoint(x: 80, y: 130), CGPoint(x: 110, y: 70), CGPoint(x: 96, y: 145),
                                  CGPoint(x: 150, y: 100), CGPoint(x: 180, y: 128), CGPoint(x: 220, y: 105),
                                  CGPoint(x: 240, y: 135), CGPoint(x: 300, y: 115), CGPoint(x: 365, y: 125)]
                    for (index, point) in points.enumerated() {
                        let type: NSEvent.EventType = index == 0 ? .leftMouseDown : .leftMouseDragged
                        let event = try #require(NSEvent.mouseEvent(
                            with: type, location: canvas.convert(point, to: nil), modifierFlags: [],
                            timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber,
                            context: nil, eventNumber: index, clickCount: 1, pressure: 1
                        ))
                        if index == 0 { canvas.mouseDown(with: event) } else { canvas.mouseDragged(with: event) }
                    }
                    let lastPoint = try #require(points.last)
                    let event = try #require(NSEvent.mouseEvent(
                        with: .leftMouseUp, location: canvas.convert(lastPoint, to: nil), modifierFlags: [],
                        timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber,
                        context: nil, eventNumber: points.count, clickCount: 1, pressure: 0
                    ))
                    canvas.mouseUp(with: event)
                }
            )
        }
    }

    private func pageContentIsVisible(_ bitmap: NSBitmapImageRep) -> Bool {
        let scale = CGFloat(bitmap.pixelsWide) / 960
        func pixels(in rect: CGRect, matching predicate: (NSColor) -> Bool) -> Int {
            var count = 0
            for y in stride(from: Int(rect.minY * scale), to: Int(rect.maxY * scale), by: 3) {
                for x in stride(from: Int(rect.minX * scale), to: Int(rect.maxX * scale), by: 3) {
                    if let color = bitmap.colorAt(x: x, y: y)?.usingColorSpace(.deviceRGB), predicate(color) { count += 1 }
                }
            }
            return count
        }
        let dark: (NSColor) -> Bool = { max($0.redComponent, $0.greenComponent, $0.blueComponent) < 0.3 }
        let white: (NSColor) -> Bool = { min($0.redComponent, $0.greenComponent, $0.blueComponent) > 0.98 }
        let blue: (NSColor) -> Bool = { $0.blueComponent > $0.redComponent + 0.2 && $0.blueComponent > $0.greenComponent + 0.1 }
        // The page's title, the marks on white in the panel, and the two blue buttons of the panel.
        return pixels(in: CGRect(x: 155, y: 60, width: 220, height: 28), matching: dark) > 20
            && pixels(in: CGRect(x: 660, y: 100, width: 280, height: 160), matching: white) > 30
            && pixels(in: CGRect(x: 660, y: 100, width: 280, height: 520), matching: blue) > 200
    }

    private func demoPDF() throws -> Data {
        let data = NSMutableData()
        let consumer = try #require(CGDataConsumer(data: data))
        var page = CGRect(x: 0, y: 0, width: 595, height: 842)
        let context = try #require(CGContext(consumer: consumer, mediaBox: &page, nil))
        for number in 1...2 {
            context.beginPDFPage(nil)
            let title = NSAttributedString(string: "EXAMPLE AGREEMENT — \(number)", attributes: [.font: NSFont.systemFont(ofSize: 21, weight: .bold)])
            context.textPosition = CGPoint(x: 50, y: 760)
            CTLineDraw(CTLineCreateWithAttributedString(title), context)
            context.setStrokeColor(CGColor(gray: 0.7, alpha: 1))
            context.setLineWidth(1)
            for row in 0..<10 {
                context.move(to: CGPoint(x: 50, y: CGFloat(700 - row * 24)))
                context.addLine(to: CGPoint(x: row.isMultiple(of: 3) ? 420 : 540, y: CGFloat(700 - row * 24)))
            }
            context.move(to: CGPoint(x: 275, y: 165))
            context.addLine(to: CGPoint(x: 495, y: 165))
            context.strokePath()
            let label = NSAttributedString(string: "Signature", attributes: [.font: NSFont.systemFont(ofSize: 12)])
            context.textPosition = CGPoint(x: 275, y: 145)
            CTLineDraw(CTLineCreateWithAttributedString(label), context)
            context.endPDFPage()
        }
        context.closePDF()
        return data as Data
    }

    private func demoSignature() throws -> Data {
        let context = try #require(CGContext(data: nil, width: 400, height: 130, bitsPerComponent: 8, bytesPerRow: 0,
                                            space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
        context.setStrokeColor(CGColor(gray: 0.05, alpha: 1))
        context.setLineWidth(4)
        context.setLineCap(.round)
        context.move(to: CGPoint(x: 25, y: 25))
        context.addCurve(to: CGPoint(x: 95, y: 50), control1: CGPoint(x: 100, y: 155), control2: CGPoint(x: 150, y: 100))
        context.addCurve(to: CGPoint(x: 340, y: 60), control1: CGPoint(x: 150, y: 10), control2: CGPoint(x: 200, y: 110))
        context.strokePath()
        let image = try #require(context.makeImage())
        return try #require(NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:]))
    }
}
