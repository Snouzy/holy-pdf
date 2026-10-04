import Foundation
import ScanCore

struct BatchReport: Codable, Equatable {
    struct Page: Codable, Equatable {
        var file: String
        var error: String?
        var reviewReasons: [ReviewReason]
        var inlierRatios: [Double]
        var quad: Quad?
        var quarterTurns: Int?
        var mode: RenderMode?
        var keepWatermark: Bool?
        var seconds: Double
    }

    struct Document: Codable, Equatable {
        var name: String
        var files: [String]
        var evidence: [Evidence]
        var bytes: Int
    }

    var pages: [Page]
    var documents: [Document]

    func write(to url: URL) throws {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try encoder.encode(self).write(to: url, options: .atomic)
    }

    var summary: String {
        var lines = ["\(pages.count) photos → \(documents.count) PDF"]
        lines += documents.map { "  \($0.name).pdf (\($0.files.count) p.)" }
        let toCheck = pages.filter { !$0.reviewReasons.isEmpty }.map(\.file)
        let failed = pages.filter { $0.error != nil }.map(\.file)
        if !toCheck.isEmpty { lines.append("To check: " + toCheck.joined(separator: ", ")) }
        if !failed.isEmpty { lines.append("Failed: " + failed.joined(separator: ", ")) }
        return lines.joined(separator: "\n")
    }
}
