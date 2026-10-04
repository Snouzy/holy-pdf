import Foundation
import Testing
import TestSupport
@testable import ScanCLI

struct BatchRunnerTests {
    func emptyFolder() throws -> URL { try TestImages.emptyFolder() }

    func pdfs(in folder: URL) throws -> [String] {
        try FileManager.default.contentsOfDirectory(atPath: folder.path).filter { $0.hasSuffix(".pdf") }
    }

    @Test func writesOnePDFPerDocumentAndAReport() async throws {
        let output = try emptyFolder()
        let photos = [TestImages.write(SyntheticPage().render(), type: .png), TestImages.write(SyntheticPage().render(), type: .png)]
        let report = try await BatchRunner().run(photos: photos, edits: [:], outputDirectory: output)
        #expect(report.pages.count == 2)
        #expect(report.pages.allSatisfy { $0.error == nil })
        #expect(report.documents.count == 2)
        #expect(try pdfs(in: output).count == 2)
    }

    @Test func aBadPhotoDoesNotStopTheBatch() async throws {
        let output = try emptyFolder()
        let bad = TestImages.temporaryURL("bad.png")
        try Data("nope".utf8).write(to: bad)
        let photos = [TestImages.write(SyntheticPage().render(), type: .png), bad]
        let report = try await BatchRunner().run(photos: photos, edits: [:], outputDirectory: output)
        #expect(report.pages.map(\.file) == photos.map(\.lastPathComponent))
        #expect(report.pages[0].error == nil)
        #expect(report.pages[1].error != nil)
        #expect(report.documents.count == 1)
    }

    /// More photos than cores, all blocking in Vision: a pipeline run on the Swift concurrency pool deadlocks here.
    @Test(.timeLimit(.minutes(2))) func moreThanOneBatchOfCoresKeepsOrderAndErrors() async throws {
        let output = try emptyFolder()
        let count = ProcessInfo.processInfo.activeProcessorCount + 2
        let photos: [URL] = try (0..<count).map { index in
            guard index % 3 == 2 else { return TestImages.write(SyntheticPage().render(), type: .png) }
            let bad = TestImages.temporaryURL("bad-\(index).png")
            try Data("nope".utf8).write(to: bad)
            return bad
        }
        let report = try await BatchRunner().run(photos: photos, edits: [:], outputDirectory: output)
        #expect(report.pages.map(\.file) == photos.map(\.lastPathComponent))
        for (index, page) in report.pages.enumerated() {
            #expect((page.error != nil) == (index % 3 == 2))
        }
    }

    @Test func batchNeverOverwritesExistingPDF() async throws {
        let output = try emptyFolder()
        let photo = TestImages.write(SyntheticPage().render(), type: .png)
        let first = try await BatchRunner().run(photos: [photo], edits: [:], outputDirectory: output)
        let second = try await BatchRunner().run(photos: [photo], edits: [:], outputDirectory: output)
        #expect(first.documents[0].name != second.documents[0].name)
        #expect(try pdfs(in: output).count == 2)
    }

    @Test(arguments: ["2026-09-30_document-1.pdf", "2026-09-30_Document-1.PDF"])
    func anExistingPDFSurvivesWhateverItsCase(existing: String) async throws {
        let output = try emptyFolder()
        let old = output.appending(path: existing)
        try Data("old".utf8).write(to: old)
        let today = try #require(Calendar(identifier: .gregorian).date(from: DateComponents(year: 2026, month: 9, day: 30, hour: 12)))
        let photo = TestImages.write(SyntheticPage().render(), type: .png)
        let report = try await BatchRunner(today: today).run(photos: [photo], edits: [:], outputDirectory: output)
        #expect(report.documents.map(\.name) == ["2026-09-30_Document-1-2"])
        #expect(try Data(contentsOf: old) == Data("old".utf8))
        #expect(try FileManager.default.contentsOfDirectory(atPath: output.path).count == 2)
    }
}
