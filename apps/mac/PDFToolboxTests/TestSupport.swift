import AppKit
import CoreText
import PDFKit
import ScreenCaptureKit
import SwiftUI
import Testing
@testable import PDFToolbox

@MainActor
func descendants(_ view: NSView) -> [NSView] {
    view.subviews.flatMap { [$0] + descendants($0) }
}

/// A borderless window can become key only through this override.
final class KeyWindow: NSWindow {
    override var canBecomeKey: Bool { true }
}

@MainActor
func waitUntil(_ condition: () -> Bool) async throws {
    let deadline = ContinuousClock.now.advanced(by: .seconds(10))
    while !condition(), ContinuousClock.now < deadline { try await Task.sleep(for: .milliseconds(10)) }
    try #require(condition())
}

func temporaryFolder() throws -> URL {
    let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
    try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    return url
}

func blankPDF(widths: [Int]) throws -> Data {
    let bytes = NSMutableData()
    let consumer = try #require(CGDataConsumer(data: bytes))
    let context = try #require(CGContext(consumer: consumer, mediaBox: nil, nil))
    for width in widths {
        var mediaBox = CGRect(x: 0, y: 0, width: width, height: 600)
        let boxData = Data(bytes: &mediaBox, count: MemoryLayout<CGRect>.size)
        context.beginPDFPage([kCGPDFContextMediaBox as String: boxData] as CFDictionary)
        context.setFillColor(CGColor(gray: 1, alpha: 1))
        context.fill(mediaBox)
        context.endPDFPage()
    }
    context.closePDF()
    return bytes as Data
}

/// A two-page PDF with one filled text field and one highlight on its first page.
@MainActor
func formPDF(title: String, value: String) throws -> Data {
    let document = try #require(PDFDocument(data: try demoPDF(title: title, pages: 2, color: 0)))
    let page = try #require(document.page(at: 0))
    let field = PDFAnnotation(bounds: CGRect(x: 45, y: 560, width: 240, height: 24), forType: .widget, withProperties: nil)
    field.widgetFieldType = .text
    field.fieldName = "Name"
    field.font = NSFont.systemFont(ofSize: 14)
    field.widgetStringValue = value
    page.addAnnotation(field)
    let highlight = PDFAnnotation(bounds: CGRect(x: 45, y: 670, width: 120, height: 22), forType: .highlight, withProperties: nil)
    highlight.color = .systemYellow
    page.addAnnotation(highlight)
    return try #require(document.dataRepresentation())
}

/// A picture file with a red left half and a blue right half.
func pictureFile(_ name: String, in folder: URL, width: Int, height: Int, type: NSBitmapImageRep.FileType = .jpeg) throws -> URL {
    let context = try #require(CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
                                         space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue))
    context.setFillColor(CGColor(red: 0, green: 0, blue: 1, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    context.setFillColor(CGColor(red: 1, green: 0, blue: 0, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: width / 2, height: height))
    let image = try #require(context.makeImage())
    let data = try #require(NSBitmapImageRep(cgImage: image).representation(using: type, properties: [:]))
    let url = folder.appendingPathComponent(name)
    try data.write(to: url)
    return url
}

/// Pages that are one image each, with large printed words that only a text reader finds.
func scannedPDF(pages words: [String]) throws -> Data {
    let data = NSMutableData()
    let consumer = try #require(CGDataConsumer(data: data))
    var box = CGRect(x: 0, y: 0, width: 595, height: 842)
    let context = try #require(CGContext(consumer: consumer, mediaBox: &box, nil))
    for text in words {
        let bitmap = try #require(CGContext(data: nil, width: 1190, height: 1684, bitsPerComponent: 8, bytesPerRow: 0,
                                            space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue))
        bitmap.setFillColor(gray: 1, alpha: 1)
        bitmap.fill(CGRect(x: 0, y: 0, width: 1190, height: 1684))
        let line = NSAttributedString(string: text, attributes: [.font: NSFont.systemFont(ofSize: 72, weight: .semibold), .foregroundColor: NSColor.black])
        bitmap.textPosition = CGPoint(x: 120, y: 1300)
        CTLineDraw(CTLineCreateWithAttributedString(line), bitmap)
        let image = try #require(bitmap.makeImage())
        context.beginPDFPage(nil)
        context.draw(image, in: box)
        context.endPDFPage()
    }
    context.closePDF()
    return data as Data
}

/// Work that ends only when the test says so, whatever happens to its task.
final class Gate: @unchecked Sendable {
    private let lock = NSLock()
    private var waiter: CheckedContinuation<Void, Never>?
    private var isOpen = false

    func wait() async {
        await withCheckedContinuation { continuation in
            let ready = lock.withLock {
                if !isOpen { waiter = continuation }
                return isOpen
            }
            if ready { continuation.resume() }
        }
    }

    func open() {
        let waiting = lock.withLock {
            isOpen = true
            defer { waiter = nil }
            return waiter
        }
        waiting?.resume()
    }
}

/// One page with a title and a heavy photo: noise that no lossless filter shrinks.
func photoPDF(title: String, side: Int = 1200, at: CGPoint = CGPoint(x: 45, y: 200)) throws -> Data {
    var bytes = [UInt8](repeating: 255, count: side * side * 4)
    var noise: UInt32 = 2_463_534_242
    bytes.withUnsafeMutableBufferPointer { pixels in
        for at in stride(from: 0, to: pixels.count, by: 4) {
            noise ^= noise << 13
            noise ^= noise >> 17
            noise ^= noise << 5
            pixels[at] = UInt8(truncatingIfNeeded: at / 4 % side * 255 / side)
            pixels[at + 1] = UInt8(truncatingIfNeeded: noise >> 8)
            pixels[at + 2] = UInt8(truncatingIfNeeded: noise)
        }
    }
    let provider = try #require(CGDataProvider(data: Data(bytes) as CFData))
    let photo = try #require(CGImage(width: side, height: side, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: side * 4,
                                     space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipLast.rawValue),
                                     provider: provider, decode: nil, shouldInterpolate: true, intent: .defaultIntent))
    let data = NSMutableData()
    let consumer = try #require(CGDataConsumer(data: data))
    var page = CGRect(x: 0, y: 0, width: 595, height: 842)
    let context = try #require(CGContext(consumer: consumer, mediaBox: &page, nil))
    context.beginPDFPage(nil)
    let heading = NSAttributedString(string: title, attributes: [.font: NSFont.systemFont(ofSize: 28, weight: .bold)])
    context.textPosition = CGPoint(x: 45, y: 775)
    CTLineDraw(CTLineCreateWithAttributedString(heading), context)
    context.draw(photo, in: CGRect(origin: at, size: CGSize(width: 505, height: 505)))
    context.endPDFPage()
    context.closePDF()
    return data as Data
}

func demoPDF(title: String, pages: Int, color: Int) throws -> Data {
    let data = NSMutableData()
    let consumer = try #require(CGDataConsumer(data: data))
    var page = CGRect(x: 0, y: 0, width: 595, height: 842)
    let context = try #require(CGContext(consumer: consumer, mediaBox: &page, nil))
    let colors = [NSColor.systemBlue, .systemGreen, .systemOrange]
    for number in 1...pages {
        context.beginPDFPage(nil)
        context.setFillColor(colors[(color + number - 1) % colors.count].cgColor)
        context.fill(CGRect(x: 0, y: 740, width: 595, height: 102))
        let heading = NSAttributedString(string: "EXAMPLE \(number)", attributes: [
            .font: NSFont.systemFont(ofSize: 28, weight: .bold), .foregroundColor: NSColor.white,
        ])
        context.textPosition = CGPoint(x: 45, y: 775)
        CTLineDraw(CTLineCreateWithAttributedString(heading), context)
        let caption = NSAttributedString(string: title, attributes: [.font: NSFont.systemFont(ofSize: 14)])
        context.textPosition = CGPoint(x: 45, y: 680)
        CTLineDraw(CTLineCreateWithAttributedString(caption), context)
        context.setStrokeColor(CGColor(gray: 0.6, alpha: 1))
        context.setLineWidth(2)
        for row in 0..<14 {
            context.move(to: CGPoint(x: 45, y: CGFloat(630 - row * 24)))
            context.addLine(to: CGPoint(x: row.isMultiple(of: 3) ? 430 : 550, y: CGFloat(630 - row * 24)))
        }
        context.strokePath()
        context.endPDFPage()
    }
    context.closePDF()
    return data as Data
}

/// Captures the window compositor: cacheDisplay and CALayer.render omit native glass controls and image surfaces.
@MainActor
func snapshot(
    _ name: String, _ view: some View, in folder: URL, width: CGFloat = 960, height: CGFloat = 640,
    dark: Bool = false, language: String = "fr",
    interact: ((NSView, NSWindow) throws -> Void)? = nil,
    until ready: (NSBitmapImageRep) -> Bool = { _ in true }
) async throws {
    Brand.registerFonts()
    let frame = CGRect(x: 0, y: 0, width: width, height: height)
    let host = NSHostingView(rootView: view
        .frame(width: width, height: height)
        .background(Color(nsColor: .windowBackgroundColor))
        .environment(\.controlActiveState, .active)
        .environment(\.locale, Locale(identifier: language))
        .environment(\.colorScheme, dark ? .dark : .light))
    host.frame = frame
    host.wantsLayer = true
    let window = KeyWindow(contentRect: frame, styleMask: [.borderless], backing: .buffered, defer: false)
    window.isReleasedWhenClosed = false
    window.appearance = NSAppearance(named: dark ? .darkAqua : .aqua)
    window.contentView = host
    window.center()
    NSApp.activate()
    window.makeKeyAndOrderFront(nil)
    defer { window.orderOut(nil); window.close() }
    host.layoutSubtreeIfNeeded()
    try await Task.sleep(for: .milliseconds(700))
    try interact?(host, window)
    try await Task.sleep(for: .milliseconds(100))
    host.layoutSubtreeIfNeeded()
    host.displayIfNeeded()
    window.display()
    CATransaction.flush()
    let content = try await SCShareableContent.currentProcess
    let capturedWindow = try #require(content.windows.first { $0.windowID == CGWindowID(window.windowNumber) })
    let filter = SCContentFilter(desktopIndependentWindow: capturedWindow)
    let configuration = SCStreamConfiguration()
    configuration.width = Int(width * window.backingScaleFactor)
    configuration.height = Int(height * window.backingScaleFactor)
    configuration.showsCursor = false
    configuration.ignoreShadowsSingleWindow = true
    var bitmap: NSBitmapImageRep?
    for _ in 0..<10 {
        let image = try await SCScreenshotManager.captureImage(contentFilter: filter, configuration: configuration)
        let candidate = NSBitmapImageRep(cgImage: image)
        if ready(candidate) {
            bitmap = candidate
            break
        }
        try await Task.sleep(for: .milliseconds(200))
    }
    let captured = try #require(bitmap, "The composited page did not finish drawing its images and controls")
    #expect(captured.pixelsWide >= Int(width))
    #expect(captured.pixelsHigh >= Int(height))
    let png = try #require(captured.representation(using: .png, properties: [:]))
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    let destination = folder.appendingPathComponent("\(name).png")
    try png.write(to: destination)
    print("snapshot: \(destination.path)")
}

// MARK: - Opt-in drag tests, driven by `swift apps/mac/scripts/check-drag.swift merge|organize`

/// The driver refuses any window without this title.
let dragWindowTitle = "Holy PDF — isolated drag interaction test"

func dragDriverFile(_ tool: String, _ suffix: String) -> URL {
    FileManager.default.temporaryDirectory.appendingPathComponent("holy-pdf-\(tool)-drag-\(suffix)")
}

func dragDriverIsWaiting(_ tool: String) -> Bool {
    FileManager.default.fileExists(atPath: dragDriverFile(tool, "enabled").path)
}

func dragFixture(pages: Int) throws -> Data {
    let data = NSMutableData()
    let consumer = try #require(CGDataConsumer(data: data))
    var page = CGRect(x: 0, y: 0, width: 300, height: 400)
    let context = try #require(CGContext(consumer: consumer, mediaBox: &page, nil))
    for color in [NSColor.systemBlue, .systemGreen, .systemOrange].prefix(pages) {
        context.beginPDFPage(nil)
        context.setFillColor(color.cgColor)
        context.fill(CGRect(x: 30, y: 30, width: 240, height: 340))
        context.endPDFPage()
    }
    context.closePDF()
    return data as Data
}

@MainActor
func showDragWindow(_ view: some View) -> (host: NSView, window: NSWindow) {
    Brand.registerFonts()
    let size = CGSize(width: 960, height: 640)
    let host = NSHostingView(rootView: view
        .environment(\.locale, Locale(identifier: "en"))
        .environment(\.controlActiveState, .active)
        .frame(width: size.width, height: size.height))
    host.frame = CGRect(origin: .zero, size: size)
    let window = KeyWindow(contentRect: host.frame, styleMask: [.titled], backing: .buffered, defer: false)
    window.title = dragWindowTitle
    window.isReleasedWhenClosed = false
    window.contentView = host
    window.center()
    NSApp.activate()
    window.makeKeyAndOrderFront(nil)
    return (host, window)
}

@MainActor
func screenPoint(x: CGFloat, fromTop y: CGFloat, host: NSView, window: NSWindow) -> CGPoint {
    let local = CGPoint(x: x, y: host.isFlipped ? y : host.bounds.height - y)
    return window.convertPoint(toScreen: host.convert(local, to: nil))
}

@MainActor
func drag(_ tool: String, from start: CGPoint, to end: CGPoint, window: NSWindow) async throws {
    window.title = dragWindowTitle
    let displayHeight = CGDisplayBounds(CGMainDisplayID()).height
    let id = UUID().uuidString
    let instruction: [String: Any] = [
        "id": id, "created": Date().timeIntervalSince1970, "pid": getpid(), "window": window.windowNumber,
        "sx": start.x, "sy": displayHeight - start.y, "ex": end.x, "ey": displayHeight - end.y,
    ]
    let handshake = dragDriverFile(tool, "handshake.json")
    try JSONSerialization.data(withJSONObject: instruction).write(to: handshake, options: .atomic)
    defer { try? FileManager.default.removeItem(at: handshake) }
    let done = URL(fileURLWithPath: handshake.path + ".done")
    for _ in 0..<1000 {
        if (try? String(contentsOf: done, encoding: .utf8)) == id {
            try? FileManager.default.removeItem(at: done)
            try await Task.sleep(for: .milliseconds(600))
            return
        }
        try await Task.sleep(for: .milliseconds(20))
    }
    try #require(Bool(false), "External drag driver did not complete this isolated-window gesture within 20 seconds")
}
