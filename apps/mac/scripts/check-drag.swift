#!/usr/bin/env swift
// Start this helper before running only PDFToolboxTests/MergeDragInteractionTests or OrganizingDragInteractionTests.
// It enables the opt-in test for 90 seconds and sends real drags to its isolated window.
import AppKit
import ApplicationServices
import CoreGraphics

private struct DragInstruction: Decodable {
    let id: String
    let created: Double
    let pid: Int32
    let window: Int
    let sx: Double
    let sy: Double
    let ex: Double
    let ey: Double
}

private struct DriverFailure: Error, CustomStringConvertible {
    let description: String
}

private func report(_ message: String) {
    FileHandle.standardError.write(Data((message + "\n").utf8))
}

private func post(_ type: CGEventType, at point: CGPoint) throws {
    guard let event = CGEvent(mouseEventSource: nil, mouseType: type,
                              mouseCursorPosition: point, mouseButton: .left) else {
        throw DriverFailure(description: "Could not create a mouse event")
    }
    event.flags = []
    event.setIntegerValueField(.mouseEventClickState, value: 1)
    event.post(tap: .cghidEventTap)
}

@MainActor
private func drag(_ instruction: DragInstruction, app: NSRunningApplication) throws {
    let start = CGPoint(x: instruction.sx, y: instruction.sy)
    let end = CGPoint(x: instruction.ex, y: instruction.ey)
    app.activate(options: [.activateAllWindows])
    Thread.sleep(forTimeInterval: 0.25)
    guard NSWorkspace.shared.frontmostApplication?.processIdentifier == instruction.pid else {
        throw DriverFailure(description: "The isolated test process did not gain focus")
    }
    report("Dragging test pid=\(instruction.pid) window=\(instruction.window): \(start) → \(end)")
    var mouseDown = false
    var lastPoint = start
    defer {
        if mouseDown { try? post(.leftMouseUp, at: lastPoint) }
    }
    try post(.mouseMoved, at: start)
    try post(.leftMouseDown, at: start)
    mouseDown = true
    Thread.sleep(forTimeInterval: 0.2)
    for step in 1...40 {
        guard NSWorkspace.shared.frontmostApplication?.processIdentifier == instruction.pid else {
            throw DriverFailure(description: "Focus changed during the isolated test drag")
        }
        let fraction = CGFloat(step) / 40
        lastPoint = CGPoint(x: start.x + (end.x - start.x) * fraction,
                            y: start.y + (end.y - start.y) * fraction)
        try post(.leftMouseDragged, at: lastPoint)
        Thread.sleep(forTimeInterval: 0.02)
    }
    Thread.sleep(forTimeInterval: 0.3)
    try post(.leftMouseUp, at: end)
    mouseDown = false
}

@MainActor
private func run(tool: String, test: String, gestures: Int) throws {
    guard AXIsProcessTrusted() else {
        throw DriverFailure(description: "Accessibility access is required for the terminal running this opt-in interaction check")
    }
    let directory = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent("Library/Containers/com.snouzy.pdftoolbox/Data/tmp", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let handshake = directory.appendingPathComponent("holy-pdf-\(tool)-drag-handshake.json")
    let enabled = directory.appendingPathComponent("holy-pdf-\(tool)-drag-enabled")
    try Data().write(to: enabled)
    defer { try? FileManager.default.removeItem(at: enabled) }
    let earliest = Date().timeIntervalSince1970 - 60
    let deadline = Date().addingTimeInterval(90)
    var handled = Set<String>()
    report("Waiting for the isolated \(test) window")
    while Date() < deadline {
        Thread.sleep(forTimeInterval: 0.1)
        guard let data = try? Data(contentsOf: handshake),
              let instruction = try? JSONDecoder().decode(DragInstruction.self, from: data),
              instruction.created > earliest, !handled.contains(instruction.id),
              let app = NSRunningApplication(processIdentifier: instruction.pid),
              app.bundleIdentifier == "com.snouzy.pdftoolbox" else { continue }
        let windows = CGWindowListCopyWindowInfo(.optionOnScreenOnly, kCGNullWindowID) as? [[String: Any]] ?? []
        guard let window = windows.first(where: { ($0[kCGWindowNumber as String] as? Int) == instruction.window }),
              window[kCGWindowOwnerPID as String] as? Int32 == instruction.pid,
              window[kCGWindowName as String] as? String == "Holy PDF — isolated drag interaction test",
              let bounds = window[kCGWindowBounds as String] as? [String: Double],
              let x = bounds["X"], let y = bounds["Y"], let width = bounds["Width"], let height = bounds["Height"] else { continue }
        let frame = CGRect(x: x, y: y, width: width, height: height)
        guard frame.contains(CGPoint(x: instruction.sx, y: instruction.sy)),
              frame.contains(CGPoint(x: instruction.ex, y: instruction.ey)) else {
            throw DriverFailure(description: "Refusing a gesture outside the isolated test window")
        }
        try drag(instruction, app: app)
        handled.insert(instruction.id)
        try Data(instruction.id.utf8).write(to: URL(fileURLWithPath: handshake.path + ".done"), options: .atomic)
        if handled.count == gestures {
            report("Completed the \(gestures) isolated-window drag gestures")
            return
        }
    }
    throw DriverFailure(description: "Timed out after 90 seconds; completed \(handled.count) of \(gestures) gestures")
}

let checks = ["merge": (test: "MergeDragInteractionTests", gestures: 2),
              "organize": (test: "OrganizingDragInteractionTests", gestures: 3)]
let tool = CommandLine.arguments.dropFirst().first ?? ""
guard let check = checks[tool] else {
    report("Usage: swift apps/mac/scripts/check-drag.swift merge|organize")
    exit(2)
}

MainActor.assumeIsolated {
    do {
        try run(tool: tool, test: check.test, gestures: check.gestures)
    } catch {
        report("\(check.test) drag check failed: \(error)")
        exit(1)
    }
}
