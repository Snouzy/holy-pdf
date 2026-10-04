import Foundation
import PDFKit
import ScanCore
import Testing
import TestSupport
@testable import ScanSession

@MainActor
struct ExportTests {
    /// Documents "2026-01-05_Factura" (1 page), then "2026-01-05_Contract" (2 pages).
    func board(delay: Duration = .zero) async throws -> ScannerSession {
        let fake = FakePages(lines: [
            "a.heic": [FakePages.line("FACTURA", y: 0.1, height: 0.04)],
            "b.heic": [FakePages.line("CONTRACT", y: 0.1, height: 0.04), FakePages.line("Pagina 1 din 2", y: 0.95)],
            "c.heic": [FakePages.line("Pagina 2 din 2", y: 0.95)],
        ], delay: delay)
        let session = fake.session()
        session.add(try photos("a.heic", "b.heic", "c.heic"))
        await session.waitUntilIdle()
        return session
    }

    func all(_ session: ScannerSession) -> [UUID] { session.documents.map(\.id) }

    func visibleFiles(_ folder: URL) throws -> [String] {
        try FileManager.default.contentsOfDirectory(atPath: folder.path).filter { !$0.hasPrefix(".") }.sorted()
    }

    @Test func writesOnePDFPerDocument() async throws {
        let session = try await board()
        let folder = try TestImages.emptyFolder()
        let report = await session.export(all(session), to: folder, searchableText: true, existing: .addSuffix)
        #expect(report.failures.isEmpty)
        #expect(try visibleFiles(folder) == ["2026-01-05_Contract.pdf", "2026-01-05_Factura.pdf"])
        let contract = try #require(PDFDocument(url: folder.appending(path: "2026-01-05_Contract.pdf")))
        #expect(contract.pageCount == 2)
        #expect(contract.string?.contains("CONTRACT") == true)
        #expect(session.documents.allSatisfy { $0.exported })
        #expect(!session.hasUnexportedDocuments)
    }

    @Test func withoutSearchableTextThePDFHasNoText() async throws {
        let session = try await board()
        let folder = try TestImages.emptyFolder()
        _ = await session.export(all(session), to: folder, searchableText: false, existing: .addSuffix)
        let invoice = try #require(PDFDocument(url: folder.appending(path: "2026-01-05_Factura.pdf")))
        #expect(invoice.string?.contains("FACTURA") != true)
    }

    @Test func anExistingFileGetsASuffixAndTheTitleFollows() async throws {
        let session = try await board()
        let folder = try TestImages.emptyFolder()
        try Data("old".utf8).write(to: folder.appending(path: "2026-01-05_factura.PDF"))
        #expect(session.existingFileNames(for: all(session), in: folder) == ["2026-01-05_Factura.pdf"])
        _ = await session.export(all(session), to: folder, searchableText: true, existing: .addSuffix)
        #expect(try Data(contentsOf: folder.appending(path: "2026-01-05_factura.PDF")) == Data("old".utf8))
        let renamed = try #require(PDFDocument(url: folder.appending(path: "2026-01-05_Factura-2.pdf")))
        #expect(renamed.documentAttributes?[PDFDocumentAttribute.titleAttribute] as? String == "2026-01-05_Factura-2")
    }

    @Test func replacingSwapsTheOldFileForTheNewOne() async throws {
        let session = try await board()
        let folder = try TestImages.emptyFolder()
        try Data("old".utf8).write(to: folder.appending(path: "2026-01-05_factura.pdf"))
        let report = await session.export([session.documents[0].id], to: folder, searchableText: true, existing: .replace)
        #expect(report.failures.isEmpty)
        #expect(try FileManager.default.contentsOfDirectory(atPath: folder.path) == ["2026-01-05_factura.pdf"])
        #expect(PDFDocument(url: folder.appending(path: "2026-01-05_factura.pdf"))?.pageCount == 1)
    }

    @Test func aFailedWriteKeepsTheOldFileAndTheDocument() async throws {
        let session = try await board()
        let folder = try TestImages.emptyFolder()
        let old = folder.appending(path: "2026-01-05_Factura.pdf")
        try Data("old".utf8).write(to: old)
        try FileManager.default.setAttributes([.posixPermissions: 0o555], ofItemAtPath: folder.path)
        defer { try? FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: folder.path) }
        let invoice = session.documents[0].id
        let report = await session.export([invoice], to: folder, searchableText: true, existing: .replace)
        #expect(report.failures == [.cannotWrite(documentName: "2026-01-05_Factura")])
        #expect(try Data(contentsOf: old) == Data("old".utf8))
        #expect(session.documents.first { $0.id == invoice }?.exported == false)
    }

    @Test func duplicateNamesBlockTheExport() async throws {
        let session = try await board()
        session.rename(session.documents[1].id, to: "2026-01-05_FACTURA")
        let folder = try TestImages.emptyFolder()
        let report = await session.export(all(session), to: folder, searchableText: true, existing: .addSuffix)
        #expect(report.failures == [.duplicateNames])
        #expect(try visibleFiles(folder).isEmpty)
    }

    @Test func exportItemsAddUpThePages() async throws {
        let session = try await board()
        #expect(session.exportItems.map(\.pageCount) == [1, 2])
        #expect(session.exportItems[1].bytes == 2 * FakePages.jpeg.count)
    }

    @Test func aRenamedDocumentNoLongerMatchesItsPDF() async throws {
        let session = try await board()
        let invoice = session.documents[0]
        let job = session.job(for: invoice, fileName: invoice.name, searchableText: true)
        #expect(session.isUnchanged(since: job))
        session.rename(invoice.id, to: "Facture EDF")
        #expect(!session.isUnchanged(since: job))
    }

    @Test func aNewRenderAlsoCountsAsAChange() async throws {
        let session = try await board()
        let invoice = session.documents[0]
        let job = session.job(for: invoice, fileName: invoice.name, searchableText: true)
        session.setMode(.color, for: invoice.pageIDs[0], undoManager: nil)
        #expect(!session.isUnchanged(since: job))
    }

    @Test func aLockedOldFileIsKeptAndNoTemporaryFileIsLeft() async throws {
        let session = try await board()
        let folder = try TestImages.emptyFolder()
        let old = folder.appending(path: "2026-01-05_Factura.pdf")
        try Data("old".utf8).write(to: old)
        try FileManager.default.setAttributes([.immutable: true], ofItemAtPath: old.path)
        defer { try? FileManager.default.setAttributes([.immutable: false], ofItemAtPath: old.path) }
        let report = await session.export(all(session), to: folder, searchableText: true, existing: .replace)
        #expect(report.failures == [.cannotWrite(documentName: "2026-01-05_Factura")])
        #expect(try Data(contentsOf: old) == Data("old".utf8))
        #expect(try FileManager.default.contentsOfDirectory(atPath: folder.path).sorted() == ["2026-01-05_Contract.pdf", "2026-01-05_Factura.pdf"])
        #expect(session.documents.map { $0.exported } == [false, true])
    }

    @Test func aFailureNamesTheDocumentNotTheSuffixedFile() async throws {
        let session = try await board()
        let folder = try TestImages.emptyFolder()
        try Data("old".utf8).write(to: folder.appending(path: "2026-01-05_Factura.pdf"))
        try FileManager.default.setAttributes([.posixPermissions: 0o555], ofItemAtPath: folder.path)
        defer { try? FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: folder.path) }
        let report = await session.export([session.documents[0].id], to: folder, searchableText: true, existing: .addSuffix)
        #expect(report.failures == [.cannotWrite(documentName: "2026-01-05_Factura")])
    }

    @Test func aFailedReRenderIsWrittenButStaysUnexported() async throws {
        let session = FakePages(failingReRenders: ["a.heic"]).session()
        session.add(try photos("a.heic"))
        await session.waitUntilIdle()
        session.setMode(.color, for: try #require(session.pages.keys.first), undoManager: nil)
        await session.waitUntilIdle()
        #expect(session.exportItems[0].failedPages == 1)
        let folder = try TestImages.emptyFolder()
        let report = await session.export(all(session), to: folder, searchableText: true, existing: .addSuffix)
        #expect(report.failures.isEmpty)
        #expect(try visibleFiles(folder).count == 1)
        #expect(session.documents[0].exported == false)
    }

    @Test func aDocumentRenamedDuringItsExportStaysUnexported() async throws {
        let session = try await board()
        let id = session.documents[0].id
        let folder = try TestImages.emptyFolder()
        let export = Task { await session.export([id], to: folder, searchableText: true, existing: .addSuffix) }
        await Task.yield()
        session.rename(id, to: "Facture EDF")
        _ = await export.value
        #expect(session.documents.first { $0.id == id }?.exported == false)
    }

    @Test func savingWritesTheDocumentWhereThePanelSaid() async throws {
        let session = try await board()
        let url = try TestImages.emptyFolder().appending(path: "Facture EDF.pdf")
        #expect(await session.save(session.documents[0].id, to: url) == nil)
        let pdf = try #require(PDFDocument(url: url))
        #expect(pdf.documentAttributes?[PDFDocumentAttribute.titleAttribute] as? String == "Facture EDF")
        #expect(session.documents[0].exported)
    }

    @Test func savingOverAnExistingFileReplacesIt() async throws {
        let session = try await board()
        let url = try TestImages.emptyFolder().appending(path: "x.pdf")
        try Data("old".utf8).write(to: url)
        #expect(await session.save(session.documents[0].id, to: url) == nil)
        #expect(PDFDocument(url: url)?.pageCount == 1)
    }

    @Test func aDocumentDeletedWhileTheSaveWaitsIsNotSaved() async throws {
        let session = try await board(delay: .milliseconds(300))
        let contract = session.documents[1]
        let url = try TestImages.emptyFolder().appending(path: "x.pdf")
        session.setMode(.color, for: contract.pageIDs[0], undoManager: nil)
        let saving = Task { await session.save(contract.id, to: url) }
        await Task.yield()
        session.deleteDocument(contract.id, undoManager: nil)
        let result = await saving.value
        #expect(!FileManager.default.fileExists(atPath: url.path))
        guard case .cannotWrite = result else {
            Issue.record("A deleted document was reported as saved: \(String(describing: result))")
            return
        }
    }

    @Test func aSaveWaitsOnlyForItsOwnDocument() async throws {
        let fake = FakePages(gated: ["b.heic"])
        let session = fake.session()
        session.add(try photos("a.heic"))
        await session.waitUntilIdle()
        session.add(try photos("b.heic"))
        let url = try TestImages.emptyFolder().appending(path: "x.pdf")
        let saving = Task { await session.save(session.documents[0].id, to: url) }
        // Ends when the save has written its file or waits behind the other import, so a wrong wait fails instead of hanging.
        while session.idleWaiters.isEmpty, !FileManager.default.fileExists(atPath: url.path) { await Task.yield() }
        #expect(session.idleWaiters.isEmpty)
        await fake.gate.open()
        #expect(await saving.value == nil)
    }

    @Test func savingAnUnknownDocumentIsRefused() async throws {
        let session = try await board()
        let url = try TestImages.emptyFolder().appending(path: "x.pdf")
        #expect(await session.save(UUID(), to: url) == .cannotWrite(documentName: ""))
        #expect(!FileManager.default.fileExists(atPath: url.path))
    }

    @Test func aFailedSaveKeepsTheDocumentUnexported() async throws {
        let session = try await board()
        let folder = try TestImages.emptyFolder()
        try FileManager.default.setAttributes([.posixPermissions: 0o555], ofItemAtPath: folder.path)
        defer { try? FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: folder.path) }
        let invoice = session.documents[0]
        #expect(await session.save(invoice.id, to: folder.appending(path: "x.pdf")) == .cannotWrite(documentName: invoice.name))
        #expect(!session.documents[0].exported)
    }
}
