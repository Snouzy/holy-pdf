import Foundation
import ScanCore

struct UsageError: Error, Equatable {
    var message: String
}

struct Options: Equatable {
    var photos: [URL]
    var outputDirectory: URL
    var editsFile: URL?

    static let usage = """
    Usage: scan-cli --out <folder> [--edits <edits.json>] <photo or folder>...

    Turns document photos (HEIC, JPEG, PNG) into one PDF per suggested document, plus report.json.
    """

    static func parse(_ arguments: [String], fileManager: FileManager = .default) throws(UsageError) -> Options {
        var photos: [URL] = []
        var output: URL?
        var edits: URL?
        var remaining = arguments[...]
        while let argument = remaining.popFirst() {
            switch argument {
            case "--out":
                guard let value = remaining.popFirst() else { throw UsageError(message: "--out needs a folder.\n\n\(usage)") }
                output = URL(fileURLWithPath: value)
            case "--edits":
                guard let value = remaining.popFirst() else { throw UsageError(message: "--edits needs a file.\n\n\(usage)") }
                edits = URL(fileURLWithPath: value)
            case "-h", "--help":
                throw UsageError(message: usage)
            default:
                photos += expand(URL(fileURLWithPath: argument), fileManager: fileManager)
            }
        }
        guard let output else { throw UsageError(message: "Missing --out.\n\n\(usage)") }
        guard !photos.isEmpty else { throw UsageError(message: "No photo given.\n\n\(usage)") }
        return Options(photos: photos, outputDirectory: output, editsFile: edits)
    }

    /// A folder stands for its images, sorted by name like a camera roll.
    static func expand(_ url: URL, fileManager: FileManager) -> [URL] {
        var isDirectory: ObjCBool = false
        guard fileManager.fileExists(atPath: url.path, isDirectory: &isDirectory), isDirectory.boolValue else { return [url] }
        let extensions: Set<String> = ["heic", "jpg", "jpeg", "png"]
        let contents = (try? fileManager.contentsOfDirectory(at: url, includingPropertiesForKeys: nil)) ?? []
        return contents
            .filter { extensions.contains($0.pathExtension.lowercased()) }
            .sorted { $0.lastPathComponent < $1.lastPathComponent }
    }
}

/// `{"IMG_7984.HEIC": {PageEdits}, …}`, keyed by photo file name.
enum EditsFile {
    static func load(_ url: URL) throws -> [String: PageEdits] {
        try JSONDecoder().decode([String: PageEdits].self, from: Data(contentsOf: url))
    }
}
