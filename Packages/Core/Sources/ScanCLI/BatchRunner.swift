import Foundation
import PDFCore
import ScanCore
import ScanSession

struct BatchRunner {
    var pipeline = ScanPipeline()
    var today = Date()

    struct Outcome: Sendable {
        var result: Result<ProcessedPage, ScanError>
        var seconds: Double
    }

    func run(photos: [URL], edits: [String: PageEdits], outputDirectory: URL) async throws -> BatchReport {
        let outcomes = await process(photos, edits: edits)
        let ids = photos.map { _ in UUID() }
        var processed: [UUID: (file: String, page: ProcessedPage)] = [:]
        var texts: [PageText] = []
        for (index, outcome) in outcomes.enumerated() {
            guard case .success(let page) = outcome.result else { continue }
            processed[ids[index]] = (photos[index].lastPathComponent, page)
            texts.append(PageText(id: ids[index], lines: page.lines, captureDate: page.captureDate))
        }

        let suggestions = DocumentSuggester.suggest(texts, today: today)
        let existing = Set(((try? FileManager.default.contentsOfDirectory(atPath: outputDirectory.path)) ?? [])
            .filter { $0.lowercased().hasSuffix(".pdf") }
            .map { String($0.dropLast(4)) })
        let names = NameFormatting.uniqued(suggestions.map(\.name), avoiding: existing)

        var documents: [BatchReport.Document] = []
        for (suggestion, name) in zip(suggestions, names) {
            let pages = suggestion.pageIDs.compactMap { processed[$0] }
            let url = try PDFWriter.write(pages: pages.map { PDFPageInput($0.page) }, title: name,
                                          to: outputDirectory.appending(path: "\(name).pdf"))
            let bytes = (try? FileManager.default.attributesOfItem(atPath: url.path))?[.size] as? Int ?? 0
            documents.append(BatchReport.Document(name: url.deletingPathExtension().lastPathComponent, files: pages.map(\.file),
                                                  evidence: suggestion.evidence, bytes: bytes))
        }
        let pages = zip(photos, outcomes).map { Self.reportPage($0.lastPathComponent, $1) }
        return BatchReport(pages: pages, documents: documents)
    }

    /// Pages run in parallel, as many as there are cores; the results keep the photo order.
    func process(_ photos: [URL], edits: [String: PageEdits]) async -> [Outcome] {
        let pipeline = self.pipeline
        return await withTaskGroup(of: (Int, Outcome).self) { group in
            var outcomes = [Outcome?](repeating: nil, count: photos.count)
            let limit = max(1, ProcessInfo.processInfo.activeProcessorCount)
            for (index, url) in photos.enumerated() {
                if index >= limit, let done = await group.next() {
                    outcomes[done.0] = done.1
                }
                let pageEdits = edits[url.lastPathComponent] ?? PageEdits()
                group.addTask {
                    let clock = ContinuousClock()
                    let start = clock.now
                    let result: Result<ProcessedPage, ScanError>
                    do throws(ScanError) {
                        result = .success(try await pipeline.process(url, edits: pageEdits))
                    } catch {
                        result = .failure(error)
                    }
                    return (index, Outcome(result: result, seconds: (clock.now - start) / .seconds(1)))
                }
            }
            for await (index, outcome) in group {
                outcomes[index] = outcome
            }
            return outcomes.map { $0 ?? Outcome(result: .failure(.renderFailed), seconds: 0) }
        }
    }

    static func reportPage(_ file: String, _ outcome: Outcome) -> BatchReport.Page {
        switch outcome.result {
        case .success(let page):
            BatchReport.Page(file: file, error: nil, reviewReasons: page.detection.reviewReasons,
                             inlierRatios: page.detection.inlierRatios, quad: page.quad,
                             quarterTurns: page.quarterTurns, mode: page.settings.mode,
                             keepWatermark: page.settings.keepWatermark, seconds: outcome.seconds)
        case .failure(let error):
            BatchReport.Page(file: file, error: String(describing: error), reviewReasons: [], inlierRatios: [], quad: nil,
                             quarterTurns: nil, mode: nil, keepWatermark: nil, seconds: outcome.seconds)
        }
    }
}
