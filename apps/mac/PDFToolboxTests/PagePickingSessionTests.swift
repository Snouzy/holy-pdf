import Foundation
import PDFKit
import Testing
@testable import PDFToolbox

@MainActor
struct PagePickingSessionTests {
    private func opened(_ mode: PagePickingSession.Mode, pages: Int = 5) async throws -> (session: PagePickingSession, source: URL, folder: URL) {
        let folder = try temporaryFolder()
        let source = folder.appendingPathComponent("Report.pdf")
        try demoPDF(title: "Report", pages: pages, color: 0).write(to: source)
        let session = PagePickingSession(mode: mode)
        session.open(source)
        try await waitUntil { session.pageCount == pages }
        return (session, source, folder)
    }

    private func headings(_ url: URL) throws -> [Int] {
        let document = try #require(PDFDocument(url: url))
        return try (0..<document.pageCount).map { index in
            let text = try #require(document.page(at: index)?.string)
            return try #require(Int(text.split(separator: "\n")[0].dropFirst("EXAMPLE ".count)))
        }
    }

    @Test func extractSavesThePickedPagesInDocumentOrder() async throws {
        let (session, source, folder) = try await opened(.extract)
        defer { try? FileManager.default.removeItem(at: folder) }
        let original = try Data(contentsOf: source)
        #expect(!session.canExport)
        session.toggle(3)
        session.toggle(0)
        session.toggle(4)
        session.toggle(4)
        #expect(session.picked == [0, 3])
        #expect(session.hasUnexportedChanges)
        let output = folder.appendingPathComponent("Report-extrait.pdf")
        try await session.extract(to: output)
        #expect(try headings(output) == [1, 4])
        #expect(session.savedURLs == [output])
        #expect(!session.hasUnexportedChanges)
        #expect(try Data(contentsOf: source) == original)
    }

    @Test func extractRefusesTheOriginalAndAnEmptySelection() async throws {
        let (session, source, folder) = try await opened(.extract)
        defer { try? FileManager.default.removeItem(at: folder) }
        let original = try Data(contentsOf: source)
        await #expect(throws: (any Error).self) { try await session.extract(to: folder.appendingPathComponent("empty.pdf")) }
        session.toggle(1)
        await #expect(throws: (any Error).self) { try await session.extract(to: source) }
        #expect(try Data(contentsOf: source) == original)
    }

    @Test func selectingAllNoneAndUndo() async throws {
        let (session, _, folder) = try await opened(.extract, pages: 3)
        defer { try? FileManager.default.removeItem(at: folder) }
        session.toggle(1)
        session.pickAll()
        #expect(session.picked == [0, 1, 2])
        session.pickNone()
        #expect(session.picked.isEmpty)
        session.undo()
        #expect(session.picked == [0, 1, 2])
        session.undo()
        #expect(session.picked == [1])
        session.undo()
        #expect(session.picked.isEmpty)
        #expect(!session.canUndo)
        session.toggle(7)
        #expect(session.picked.isEmpty)
    }

    @Test func cutsMakeTheParts() async throws {
        let (session, _, folder) = try await opened(.split)
        defer { try? FileManager.default.removeItem(at: folder) }
        #expect(session.parts == [0...4])
        #expect(!session.canExport)
        session.toggle(1)
        session.toggle(2)
        #expect(session.parts == [0...1, 2...2, 3...4])
        #expect(session.part(of: 3) == 2)
        session.toggle(4)
        #expect(session.picked == [1, 2], "No cut after the last page")
        session.cutEvery(2)
        #expect(session.parts == [0...1, 2...3, 4...4])
        session.cutEvery(5)
        #expect(session.parts == [0...4])
        session.undo()
        #expect(session.parts == [0...1, 2...3, 4...4])
        session.cutEvery(0)
        #expect(session.parts == [0...1, 2...3, 4...4])
    }

    @Test func splitWritesOneFilePerPartAndNeverReplacesAFile() async throws {
        let (session, source, folder) = try await opened(.split)
        defer { try? FileManager.default.removeItem(at: folder) }
        let original = try Data(contentsOf: source)
        let existing = folder.appendingPathComponent("Report-1.pdf")
        try Data("mine".utf8).write(to: existing)
        session.toggle(0)
        session.toggle(2)
        try await session.split(into: folder)
        #expect(session.savedURLs.map(\.lastPathComponent) == ["Report-1-2.pdf", "Report-2.pdf", "Report-3.pdf"])
        #expect(try session.savedURLs.map(headings) == [[1], [2, 3], [4, 5]])
        #expect(try Data(contentsOf: existing) == Data("mine".utf8))
        #expect(try Data(contentsOf: source) == original)
        #expect(!session.hasUnexportedChanges)
        session.toggle(3)
        #expect(session.hasUnexportedChanges)
        #expect(session.savedURLs.isEmpty)
    }

    @Test func openingAnotherPDFClearsThePicks() async throws {
        let (session, source, folder) = try await opened(.extract)
        defer { try? FileManager.default.removeItem(at: folder) }
        session.toggle(2)
        session.open(source)
        #expect(session.picked.isEmpty)
        #expect(!session.canUndo)
        try await waitUntil { session.pageCount == 5 }
        #expect(!session.hasUnexportedChanges)
    }

    @Test func theSessionWaitsWhileTheDestinationIsChosen() async throws {
        let (session, source, folder) = try await opened(.extract)
        defer { try? FileManager.default.removeItem(at: folder) }
        session.toggle(1)
        let output = folder.appendingPathComponent("picked.pdf")
        let (panel, close) = AsyncStream<Void>.makeStream()
        session.export {
            for await _ in panel { break }
            return output
        }
        #expect(session.isBusy)
        session.toggle(2)
        session.undo()
        session.open(source)
        #expect(session.picked == [1])
        close.yield()
        try await waitUntil { session.savedURLs == [output] }
        #expect(try headings(output) == [2])
        #expect(!session.isBusy)
    }

    @Test func marksOutsideThePagesAreIgnored() async throws {
        let empty = PagePickingSession(mode: .split)
        empty.toggle(0)
        #expect(empty.picked.isEmpty && empty.parts.isEmpty)
        let (session, _, folder) = try await opened(.extract, pages: 2)
        defer { try? FileManager.default.removeItem(at: folder) }
        session.toggle(1)
        session.toggle(-1)
        #expect(session.picked == [1])
        #expect(session.parts.isEmpty, "Only Split has parts")
    }

    @Test func aSplitThatCannotWriteSavesNothing() async throws {
        let (session, _, folder) = try await opened(.split)
        defer { try? FileManager.default.removeItem(at: folder) }
        let locked = folder.appendingPathComponent("locked", isDirectory: true)
        try FileManager.default.createDirectory(at: locked, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o555])
        defer { try? FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: locked.path) }
        session.toggle(1)
        await #expect(throws: (any Error).self) { try await session.split(into: locked) }
        #expect(session.savedURLs.isEmpty)
        #expect(try FileManager.default.contentsOfDirectory(atPath: locked.path).isEmpty)
        #expect(session.hasUnexportedChanges)
    }

    @Test func measuresSplittingOneHundredPagesIntoOneHundredFiles() async throws {
        let (session, _, folder) = try await opened(.split, pages: 100)
        defer { try? FileManager.default.removeItem(at: folder) }
        session.cutEvery(1)
        #expect(session.parts.count == 100)
        let output = folder.appendingPathComponent("parts", isDirectory: true)
        try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
        let start = ContinuousClock.now
        try await session.split(into: output)
        print("Splitting 100 pages into 100 files: \(start.duration(to: .now))")
        #expect(session.savedURLs.count == 100)
        #expect(try headings(session.savedURLs[99]) == [100])
    }
}
