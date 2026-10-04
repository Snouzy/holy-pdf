import CoreGraphics
import Foundation
import PDFCore
import PDFKit
import Testing
@testable import PDFToolbox

@MainActor
struct PDFCopySessionTests {
    private func source(pages: Int = 3, password: String? = nil) throws -> (url: URL, folder: URL) {
        let folder = try temporaryFolder()
        let url = folder.appendingPathComponent("Report.pdf")
        var data = try demoPDF(title: "Report", pages: pages, color: 0)
        if let password {
            data = try #require(PDFDocument(data: data)?.dataRepresentation(options: [
                PDFDocumentWriteOption.userPasswordOption: password, PDFDocumentWriteOption.ownerPasswordOption: "owner",
            ]))
        }
        try data.write(to: url)
        return (url, folder)
    }

    private func opened(pages: Int = 3) async throws -> (session: PDFCopySession, url: URL, folder: URL) {
        let (url, folder) = try source(pages: pages)
        let session = PDFCopySession(describe: { "\($0)" })
        session.open(url)
        try await waitUntil { session.state == .ready && session.preview != nil }
        return (session, url, folder)
    }

    @Test func opensThePagesAndPreviewsTheOneOnScreen() async throws {
        let (session, _, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        #expect(session.sourceName == "Report.pdf")
        #expect(session.pageSizes.count == 3)
        #expect(!session.isEncrypted)
        let first = session.preview
        session.errorMessage = "This page could not be displayed."
        session.goToPage(2)
        #expect(session.pageIndex == 2)
        #expect(session.errorMessage == nil, "The message of one page does not follow the reader to the next")
        try await waitUntil { session.preview != nil && session.preview !== first }
        session.goToPage(7)
        #expect(session.pageIndex == 2)
    }

    @Test func asksForThePasswordUntilItIsRight() async throws {
        let (url, folder) = try source(password: "open")
        defer { try? FileManager.default.removeItem(at: folder) }
        let session = PDFCopySession(describe: { "\($0)" })
        session.open(url)
        try await waitUntil { session.state == .locked }
        #expect(session.errorMessage == nil)
        session.unlock("nope")
        try await waitUntil { session.state == .locked && session.errorMessage != nil }
        session.unlock("open")
        try await waitUntil { session.state == .ready }
        #expect(session.isEncrypted)
        #expect(session.errorMessage == nil)
    }

    @Test func drawsTheToolsMarksOverThePreview() async throws {
        let (session, _, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        session.overlay = { _ in { context, page in
            context.setFillColor(CGColor(red: 1, green: 0, blue: 1, alpha: 1))
            context.fill(page)
        } }
        session.refreshPreview()
        try await waitUntil {
            guard let image = session.preview, let data = image.dataProvider?.data, let bytes = CFDataGetBytePtr(data) else { return false }
            return bytes[0] > 200 && bytes[1] < 80 && bytes[2] > 200
        }
    }

    @Test func savesWhatTheToolMakesAndKeepsTheOriginal() async throws {
        let (session, url, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        let original = try Data(contentsOf: url)
        session.edited()
        #expect(session.hasUnsavedEdits)
        await session.saveCopy(to: url) { data, _ in data }
        #expect(session.errorMessage != nil)
        #expect(session.lastSavedURL == nil)
        #expect(try Data(contentsOf: url) == original)
        let output = folder.appendingPathComponent("copy.pdf")
        await session.saveCopy(to: output) { data, password in
            #expect(password.isEmpty)
            return data + Data("%made".utf8)
        }
        #expect(session.errorMessage == nil)
        #expect(session.lastSavedURL == output)
        #expect(!session.hasUnsavedEdits)
        #expect(try Data(contentsOf: output) == original + Data("%made".utf8))
        session.edited()
        #expect(session.lastSavedURL == nil)
    }

    @Test func aFailedCopyKeepsTheEditsAndSaysWhy() async throws {
        let (session, _, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        session.edited()
        struct Refused: Error {}
        await session.saveCopy(to: folder.appendingPathComponent("copy.pdf")) { _, _ in throw Refused() }
        #expect(session.errorMessage == "Refused()")
        #expect(session.hasUnsavedEdits)
        #expect(session.state == .ready)
        #expect(!FileManager.default.fileExists(atPath: folder.appendingPathComponent("copy.pdf").path))
    }

    @Test func waitsWhileTheDestinationIsChosen() async throws {
        let (session, url, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        let output = folder.appendingPathComponent("copy.pdf")
        let (panel, close) = AsyncStream<Void>.makeStream()
        session.export(choosing: {
            for await _ in panel { break }
            return output
        }) { data, _ in data }
        #expect(session.isBusy)
        session.open(url)
        session.reset()
        #expect(session.pageSizes.count == 3)
        close.yield()
        try await waitUntil { session.lastSavedURL == output }
        #expect(!session.isBusy)
    }

    @Test func showsTheCopyAToolIsAboutToSaveInPlaceOfTheDocument() async throws {
        let (session, _, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        let original = try #require(session.preview?.dataProvider?.data)
        let copy = try PDFOpenedDocument(data: try demoPDF(title: "Copy", pages: 3, color: 1))
        session.showCopy(copy)
        try await waitUntil { session.preview.map { $0.dataProvider?.data != original } ?? false }
        session.showCopy(nil)
        try await waitUntil { session.preview?.dataProvider?.data == original }
        session.showCopy(copy)
        try await waitUntil { session.preview.map { $0.dataProvider?.data != original } ?? false }
        session.goToPage(1)
        session.goToPage(0)
        try await waitUntil { session.preview != nil }
        #expect(session.preview?.dataProvider?.data != original, "The copy stays on screen from one page to the next")
    }

    @Test func aTypedNumberStaysInItsRange() {
        #expect(NumberField.typed(.min, in: 1...12) == 1, "The smallest number a field can parse must not reach the arithmetic behind it")
        #expect(NumberField.typed(.max, in: 1...12) == 12)
        #expect(NumberField.typed(7, in: 1...12) == 7)
    }

    @Test func keepsWhatTheToolReadsInTheDocumentUntilItCloses() async throws {
        let (url, folder) = try source()
        defer { try? FileManager.default.removeItem(at: folder) }
        let session = PDFCopySession(describe: { "\($0)" })
        session.survey = { data, password in "\(data.count) bytes, password « \(password) »" }
        #expect(session.findings == nil)
        session.open(url)
        try await waitUntil { session.state == .ready }
        #expect(session.findings as? String == "\(try Data(contentsOf: url).count) bytes, password «  »")
        session.reset()
        #expect(session.findings == nil)
        struct Unreadable: Error {}
        session.survey = { _, _ in throw Unreadable() }
        session.open(url)
        try await waitUntil { session.errorMessage != nil }
        #expect(session.state == .empty, "A document the tool cannot read does not open")
    }

    @Test func aLongCopyShowsItsStepsAndIsSaved() async throws {
        let (session, url, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        let output = folder.appendingPathComponent("copy.pdf")
        let gate = Gate()
        let saving = Task {
            await session.saveCopy(to: output, reporting: { data, _, report in
                report(WorkStep(done: 2, total: 3))
                await gate.wait()
                return data
            })
        }
        try await waitUntil { session.step == WorkStep(done: 2, total: 3) }
        #expect(session.state == .working)
        gate.open()
        await saving.value
        #expect(session.step == nil)
        #expect(session.lastSavedURL == output)
        #expect(try Data(contentsOf: output) == Data(contentsOf: url))
        await session.saveCopy(to: url, reporting: { data, _, _ in data + Data("%made".utf8) })
        #expect(session.errorMessage != nil, "The original is never the destination")
        #expect(try Data(contentsOf: url) == Data(contentsOf: output))
    }

    @Test func aCancelledCopyNeverReachesTheDisk() async throws {
        let (session, _, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        let output = folder.appendingPathComponent("copy.pdf")
        let gate = Gate()
        let saving = Task {
            await session.saveCopy(to: output, reporting: { data, _, report in
                report(WorkStep(done: 1, total: 3))
                await gate.wait()
                return data
            })
        }
        try await waitUntil { session.step != nil }
        session.cancelWork()
        #expect(session.state == .ready)
        #expect(session.step == nil)
        gate.open()
        await saving.value
        #expect(!FileManager.default.fileExists(atPath: output.path))
        #expect(session.lastSavedURL == nil && session.errorMessage == nil)
    }

    @Test func runsTheToolsWorkOnTheOpenDocument() async throws {
        let (session, url, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        let bytes = try Data(contentsOf: url).count
        #expect(await session.prepare { data, password in password.isEmpty ? data.count : 0 } == bytes)
        #expect(session.state == .ready)
        struct Refused: Error {}
        let nothing: Int? = await session.prepare { _, _ in throw Refused() }
        #expect(nothing == nil)
        #expect(session.errorMessage == "Refused()")
        #expect(session.state == .ready)
    }

    @Test func aCancelledWorkGivesNothingAndTheNextOneWaitsForItsEnd() async throws {
        let (session, url, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        // A PDFKit write does not stop when its task is cancelled: neither does this work.
        let write = Gate()
        async let cancelled: Int? = session.prepare { _, _ in
            await write.wait()
            return 1
        }
        try await waitUntil { session.state == .working }
        #expect(session.isBusy)
        session.open(url)
        #expect(session.state == .working, "A document does not close under the work that reads it")
        session.cancelWork()
        #expect(session.state == .ready)

        async let next: Int? = session.prepare { _, _ in 2 }
        try await waitUntil { session.state == .working }
        try await Task.sleep(for: .milliseconds(80))
        #expect(session.state == .working, "Two writes at once would fight for memory: the next one waits")
        write.open()
        #expect(await cancelled == nil)
        #expect(await next == 2)
        #expect(session.state == .ready)
        #expect(session.errorMessage == nil)
    }

    @Test func theSessionIsBusyWhileAPanelIsOpen() async throws {
        let (session, url, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        let panel = Gate()
        async let chosen: Int? = session.choosing {
            await panel.wait()
            return 7
        }
        try await waitUntil { session.state == .choosingDestination }
        session.open(url)
        #expect(session.state == .choosingDestination, "A drop does not replace the document under an open panel")
        panel.open()
        #expect(await chosen == 7)
        #expect(session.state == .ready)
        session.reset()
        #expect(await session.choosing { 1 } == nil, "Without a document, there is no panel to open")
    }

    @Test func newWorkTakesTheSavedLabelAway() async throws {
        let (session, _, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        let output = folder.appendingPathComponent("copy.pdf")
        await session.saveCopy(to: output) { data, _ in data }
        #expect(session.lastSavedURL == output)
        #expect(await session.prepare { _, _ in 1 } == 1)
        #expect(session.lastSavedURL == nil, "The file on disk is not what the tool just made")
    }

    @Test func aNewDocumentForgetsThePreviousOne() async throws {
        let (session, url, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        session.goToPage(1)
        session.edited()
        session.open(url)
        #expect(session.pageIndex == 0)
        #expect(!session.hasUnsavedEdits)
        #expect(session.preview == nil)
        session.reset()
        #expect(session.state == .empty)
        #expect(session.sourceName.isEmpty)
    }
}
