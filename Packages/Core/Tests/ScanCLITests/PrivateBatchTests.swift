import CoreGraphics
import Foundation
import ImageIO
import Testing
import TestSupport
@testable import ScanCLI
@testable import ScanCore

@Suite(.enabled(if: FixtureSet.privateBatch.isAvailable, "fixtures-private/ is not on this machine"), .serialized)
struct PrivateBatchTests {
    let fixtures = FixtureSet.privateBatch

    /// A corner this far from the corrected one, as a share of the diagonal, gives a visibly wrong crop.
    static let wrongCropShift = 0.015

    @Test func automaticRunMeetsTheSpec() async throws {
        let expected = try fixtures.expected()
        let edits = try EditsFile.load(fixtures.root.appending(path: "edits.json"))
        // The PDFs are the user's real documents: they stay in the gitignored folder, never in $TMPDIR.
        let output = fixtures.root.appending(path: "runs/latest")
        try? FileManager.default.removeItem(at: output)
        try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
        let clock = ContinuousClock()
        let start = clock.now
        let report = try await BatchRunner().run(photos: expected.pages.map { fixtures.photo($0.file) }, edits: [:], outputDirectory: output)
        let batchSeconds = (clock.now - start) / .seconds(1)
        try report.write(to: output.appending(path: "report.json"))
        print("Private batch: \(report.documents.count) documents, \(String(format: "%.1f", batchSeconds)) s")
        print(report.documents.map { "\($0.files)" }.joined(separator: "\n"))

        let pages = Dictionary(uniqueKeysWithValues: report.pages.map { ($0.file, $0) })
        var falseAlarms: [String] = []
        var lines: [String] = []
        for page in expected.pages {
            let got = try #require(pages[page.file])
            #expect(got.error == nil, "\(page.file) failed: \(got.error ?? "")")
            #expect(got.quarterTurns == page.quarterTurns, "\(page.file): \(got.quarterTurns ?? -1) turns instead of \(page.quarterTurns)")
            if page.mode == "document" {
                #expect(got.keepWatermark == page.watermark, "\(page.file): watermark \(got.keepWatermark ?? false)")
            }
            let size = PixelSize(try ImageLoader.load(fixtures.photo(page.file)).image)
            let corrected = try #require(edits[page.file]?.quad)
            let error = got.quad.map { Geometry.maxCornerShift(from: $0, to: corrected, in: size) } ?? 1
            let flagged = !got.reviewReasons.isEmpty
            lines.append("\(page.file) cornerError=\(String(format: "%.4f", error)) flagged=\(flagged ? "yes" : "no")")
            if error > Self.wrongCropShift {
                #expect(flagged, "\(page.file) has a wrong crop (\(error)) but is not flagged")
            } else if flagged {
                falseAlarms.append(page.file)
            }
        }
        print(lines.joined(separator: "\n"))
        #expect(falseAlarms.count <= 2, "Good pages flagged: \(falseAlarms)")

        let exact = report.documents.filter { document in expected.documents.contains { $0.files == document.files } }
        let dated = exact.filter { document in expected.documents.contains { $0.files == document.files && document.name.hasPrefix($0.date) } }
        print("Grouped right: \(exact.count) of 11, dated right: \(dated.count) of 11")
        #expect(exact.count >= 10, "Only \(exact.count) of 11 documents grouped right")
        #expect(dated.count >= 9, "Only \(dated.count) of 11 dates right")

        let bytesPerPage = Double(report.documents.map(\.bytes).reduce(0, +)) / Double(report.pages.count)
        #expect(bytesPerPage < 500_000, "\(Int(bytesPerPage)) bytes per page")
        if isOptimizedBuild {
            #expect(batchSeconds < 20, "Batch took \(batchSeconds) s")
        }
    }

    @Test(.enabled(if: isOptimizedBuild, "timings need an optimized build"))
    func aPageTakesLessThanASecond() async throws {
        let expected = try fixtures.expected()
        let pipeline = ScanPipeline()
        _ = try await pipeline.process(fixtures.photo(expected.pages[0].file))
        let clock = ContinuousClock()
        for page in expected.pages.dropFirst().prefix(3) {
            var durations: [Duration] = []
            for _ in 0..<3 {
                durations.append(try await clock.measure { _ = try await pipeline.process(fixtures.photo(page.file)) })
            }
            let fastest = try #require(durations.min())
            print("\(page.file): fastest of 3 \(fastest)")
            #expect(fastest < .seconds(1), "\(page.file): \(durations)")
        }
    }

    @Test func editedPagesMatchThePrototype() async throws {
        let edits = try EditsFile.load(fixtures.root.appending(path: "edits.json"))
        let pipeline = ScanPipeline()
        var lines: [String] = []
        for (file, pageEdits) in edits.sorted(by: { $0.key < $1.key }) {
            let page = try await pipeline.process(fixtures.photo(file), edits: pageEdits)
            let ours = try #require(CGImageSourceCreateWithData(page.jpeg as CFData, nil).flatMap { CGImageSourceCreateImageAtIndex($0, 0, nil) })
            let referenceURL = fixtures.root.appending(path: "reference/\(file.replacingOccurrences(of: ".HEIC", with: ".jpg"))")
            let reference = try #require(CGImageSourceCreateWithURL(referenceURL as CFURL, nil).flatMap { CGImageSourceCreateImageAtIndex($0, 0, nil) })
            #expect(ours.width == reference.width && ours.height == reference.height, "\(file): \(ours.width)×\(ours.height)")
            let difference = meanGrayDifference(Bitmap(ours), Bitmap(reference))
            lines.append("\(file): \(String(format: "%.1f", difference))")
            #expect(difference < 10, "\(file) differs from the prototype by \(difference) gray levels")
        }
        print("Mean gray difference to the prototype:\n" + lines.joined(separator: "\n"))
    }

    @Test func watermarkRuleSeparatesThePages() throws {
        let expected = try fixtures.expected()
        let edits = try EditsFile.load(fixtures.root.appending(path: "edits.json"))
        let context = Enhancer.makeContext()
        var marked: [Double] = []
        var plain: [Double] = []
        var lines: [String] = []
        for page in expected.pages where page.mode == "document" {
            let loaded = try ImageLoader.load(fixtures.photo(page.file))
            let quad = edits[page.file]?.quad ?? PageDetector.detect(in: loaded.image).quad
            let upright = Orientation.rotate(try Rectifier.rectify(loaded.image, quad: quad), quarterTurns: page.quarterTurns)
            let coverage = WatermarkDetector.coverage(upright, context: context)
            lines.append("\(page.file) watermark=\(page.watermark) coverage=\(String(format: "%.4f", coverage))")
            if page.watermark { marked.append(coverage) } else { plain.append(coverage) }
        }
        print("Watermark coverage:\n" + lines.joined(separator: "\n"))
        #expect((marked.min() ?? 0) > WatermarkDetector.minCoverage)
        #expect((plain.max() ?? 1) < WatermarkDetector.minCoverage)
    }

    func meanGrayDifference(_ a: Bitmap, _ b: Bitmap) -> Double {
        guard a.width == b.width, a.height == b.height else { return .infinity }
        var total = 0.0
        var count = 0.0
        for y in stride(from: 0, to: a.height, by: 2) {
            for x in stride(from: 0, to: a.width, by: 2) {
                total += abs(a.gray(x: x, y: y, radius: 0) - b.gray(x: x, y: y, radius: 0))
                count += 1
            }
        }
        return total / count
    }
}
