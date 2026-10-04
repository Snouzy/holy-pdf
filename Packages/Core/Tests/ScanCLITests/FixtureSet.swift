import Foundation

/// A folder of real photos with their expected results: `fixtures/` (committed, no personal data)
/// or `fixtures-private/` (gitignored). A missing folder turns its tests off.
struct FixtureSet: Sendable {
    struct Expected: Decodable {
        struct Page: Decodable {
            var file: String
            var quarterTurns: Int
            var badAutoCorners: Bool
            var watermark: Bool
            var mode: String
        }

        struct Document: Decodable {
            var files: [String]
            var date: String
        }

        var pages: [Page]
        var documents: [Document]
    }

    let root: URL

    init(folder: String) {
        // This file sits in Packages/Core/Tests/ScanCLITests/: five levels up is the repository root.
        var url = URL(fileURLWithPath: #filePath)
        for _ in 0..<5 { url.deleteLastPathComponent() }
        root = url.appending(path: folder)
    }

    static let privateBatch = FixtureSet(folder: "fixtures-private")
    static let publicBatch = FixtureSet(folder: "fixtures")

    var isAvailable: Bool {
        FileManager.default.fileExists(atPath: root.appending(path: "expected.json").path)
    }

    func expected() throws -> Expected {
        try JSONDecoder().decode(Expected.self, from: Data(contentsOf: root.appending(path: "expected.json")))
    }

    func photo(_ file: String) -> URL {
        root.appending(path: "photos/\(file)")
    }
}

/// Timings only mean something in an optimized build: `swift test -c release -Xswiftc -enable-testing --filter PrivateBatchTests`.
let isOptimizedBuild: Bool = {
    #if DEBUG
    false
    #else
    true
    #endif
}()
