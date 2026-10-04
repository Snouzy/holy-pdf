import AppKit
import PDFCore
import UniformTypeIdentifiers

func readFile(_ url: URL, limit: Int, tooLarge: PDFToolError = .fileTooLarge) async throws -> Data {
    try await Task.detached(priority: .userInitiated) {
        let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
        guard size <= limit else { throw tooLarge }
        return try Data(contentsOf: url)
    }.value
}

/// Two identities are equal when they name the same file: by path once symbolic links are resolved, or through a hard link.
struct FileIdentity: Equatable {
    let path: URL
    let resource: NSObject?

    init(_ url: URL) {
        path = url.resolvingSymlinksInPath().standardizedFileURL
        resource = (try? url.resourceValues(forKeys: [.fileResourceIdentifierKey]))?.fileResourceIdentifier as? NSObject
    }

    static func == (lhs: FileIdentity, rhs: FileIdentity) -> Bool {
        lhs.path == rhs.path || (lhs.resource != nil && lhs.resource == rhs.resource)
    }
}

extension UTType {
    /// A Word document (.docx).
    static let word = UTType(filenameExtension: "docx") ?? .data
}

@MainActor
func choosePDFDestination(name: String) async -> URL? {
    await chooseDestination(name: name, type: .pdf)
}

@MainActor
func chooseDestination(name: String, type: UTType) async -> URL? {
    let panel = NSSavePanel()
    panel.allowedContentTypes = [type]
    panel.nameFieldStringValue = name
    panel.canCreateDirectories = true
    let response = if let window = NSApp.keyWindow { await panel.beginSheetModal(for: window) } else { await panel.begin() }
    return response == .OK ? panel.url : nil
}

/// For a second file on a screen that already opens its document with `fileImporter`: of two importers, one on a view
/// and one on a view inside it, SwiftUI presents only the outer one.
@MainActor
func chooseFile(_ types: [UTType]) async -> URL? {
    let panel = NSOpenPanel()
    panel.allowedContentTypes = types
    let response = if let window = NSApp.keyWindow { await panel.beginSheetModal(for: window) } else { await panel.begin() }
    return response == .OK ? panel.url : nil
}

@MainActor
func chooseFolder(prompt: String) async -> URL? {
    let panel = NSOpenPanel()
    panel.canChooseDirectories = true
    panel.canChooseFiles = false
    panel.canCreateDirectories = true
    panel.prompt = prompt
    let response = if let window = NSApp.keyWindow { await panel.beginSheetModal(for: window) } else { await panel.begin() }
    return response == .OK ? panel.url : nil
}

/// `name` in `folder`, or `name-2`, `name-3`… when a file already has that name.
func unusedURL(named name: String, in folder: URL) -> URL {
    let file = URL(fileURLWithPath: name)
    let stem = file.deletingPathExtension().lastPathComponent
    var candidate = folder.appendingPathComponent(name)
    var suffix = 2
    while FileManager.default.fileExists(atPath: candidate.path) {
        candidate = folder.appendingPathComponent("\(stem)-\(suffix).\(file.pathExtension)")
        suffix += 1
    }
    return candidate
}

/// Writes the whole file or nothing, and never replaces a file: a write that fails halfway leaves nothing at `url`.
func writeNewFile(_ data: Data, at url: URL) throws {
    let files = FileManager.default
    let staging = try files.url(for: .itemReplacementDirectory, in: .userDomainMask, appropriateFor: url, create: true)
    defer { try? files.removeItem(at: staging) }
    let temporary = staging.appendingPathComponent(url.lastPathComponent)
    try data.write(to: temporary)
    try files.moveItem(at: temporary, to: url)
}
