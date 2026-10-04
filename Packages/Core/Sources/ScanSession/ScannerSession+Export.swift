import Foundation
import PDFCore
import ScanCore

public struct ExportItem: Identifiable, Sendable {
    public let id: UUID
    public var fileName: String
    public var pageCount: Int
    /// The page JPEGs, which make almost all of the PDF.
    public var bytes: Int
    /// The pages whose latest render failed and whose PDF uses the last good render.
    public var failedPages: Int
}

public enum ConflictChoice: Sendable {
    case replace
    /// "-2", "-3"… after the name, as the spec asks: no space and no parenthesis in file names.
    case addSuffix
}

public enum ExportError: Error, Equatable, Sendable {
    case duplicateNames
    case cannotWrite(documentName: String)
}

public struct ExportReport: Sendable {
    public var written: [URL] = []
    public var failures: [ExportError] = []
}

extension ScannerSession {
    public var exportItems: [ExportItem] {
        documents.map { document in
            ExportItem(id: document.id, fileName: document.name + ".pdf", pageCount: document.pageIDs.count,
                       bytes: document.pageIDs.compactMap { pages[$0]?.status.result?.processed.jpeg.count }.reduce(0, +),
                       failedPages: document.pageIDs.filter(hasFailedRender).count)
        }
    }

    func hasFailedRender(_ pageID: UUID) -> Bool {
        if case .failed? = pages[pageID]?.status { true } else { false }
    }

    /// The file names among `documentIDs` that `folder` already holds, compared without case like APFS.
    public func existingFileNames(for documentIDs: [UUID], in folder: URL) -> [String] {
        let scoped = folder.startAccessingSecurityScopedResource()
        defer { if scoped { folder.stopAccessingSecurityScopedResource() } }
        let present = Set(Self.fileNames(in: folder).map { $0.lowercased() })
        return documents.filter { documentIDs.contains($0.id) }.map { $0.name + ".pdf" }.filter { present.contains($0.lowercased()) }
    }

    /// One PDF per document, in board order. Running renders finish first, so the PDFs hold the latest edits.
    public func export(_ documentIDs: [UUID], to folder: URL, searchableText: Bool, existing: ConflictChoice) async -> ExportReport {
        repeat { await waitUntilIdle() } while isProcessing
        guard duplicateNames.isEmpty else { return ExportReport(failures: [.duplicateNames]) }
        let chosen = documents.filter { documentIDs.contains($0.id) }
        let scoped = folder.startAccessingSecurityScopedResource()
        defer { if scoped { folder.stopAccessingSecurityScopedResource() } }
        let taken = Set(Self.fileNames(in: folder).filter { $0.lowercased().hasSuffix(".pdf") }.map { String($0.dropLast(4)) })
        let names = existing == .addSuffix ? NameFormatting.uniqued(chosen.map(\.name), avoiding: taken) : chosen.map(\.name)
        let jobs = zip(chosen, names).map { job(for: $0, fileName: $1, searchableText: searchableText) }
        let replace = existing == .replace
        let outcomes = await Task.detached { jobs.map { Self.write($0, in: folder, replace: replace) } }.value
        var report = ExportReport()
        for (job, outcome) in zip(jobs, outcomes) {
            switch outcome {
            case .success(let url):
                report.written.append(url)
                markExported(job)
            case .failure(let error):
                report.failures.append(error)
            }
        }
        return report
    }

    /// Writes one document where a save panel said. The panel already asked about replacing, and the file name becomes the title.
    /// Only the renders of this document come first: an import of other photos does not hold the save.
    public func save(_ documentID: UUID, to url: URL, searchableText: Bool = true) async -> ExportError? {
        guard let name = documents.first(where: { $0.id == documentID })?.name else { return .cannotWrite(documentName: "") }
        repeat { await wait(for: documentID) } while !isIdle(for: documentID)
        guard let document = documents.first(where: { $0.id == documentID }) else { return .cannotWrite(documentName: name) }
        let job = job(for: document, fileName: url.deletingPathExtension().lastPathComponent, searchableText: searchableText)
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        let written = await Task.detached { () -> Bool in
            guard let data = try? PDFWriter.data(pages: job.pages, title: job.fileName) else { return false }
            return Self.replaceFile(at: url, with: data)
        }.value
        guard written else { return .cannotWrite(documentName: document.name) }
        markExported(job)
        return nil
    }

    /// A save panel grants the chosen file, not its folder: write beside it through the item-replacement directory.
    nonisolated static func replaceFile(at url: URL, with data: Data) -> Bool {
        let files = FileManager.default
        guard let folder = try? files.url(for: .itemReplacementDirectory, in: .userDomainMask, appropriateFor: url, create: true) else {
            return false
        }
        defer { try? files.removeItem(at: folder) }
        let temporary = folder.appending(path: url.lastPathComponent)
        do {
            try data.write(to: temporary)
            if files.fileExists(atPath: url.path) {
                _ = try files.replaceItemAt(url, withItemAt: temporary)
            } else {
                try files.moveItem(at: temporary, to: url)
            }
            return true
        } catch {
            return false
        }
    }

    func markExported(_ job: Job) {
        guard isUnchanged(since: job), !job.pageIDs.contains(where: hasFailedRender),
              let index = documents.firstIndex(where: { $0.id == job.documentID }) else { return }
        documents[index].exported = true
    }

    struct Job: Sendable {
        var documentID: UUID
        /// The board name, for messages and for the unchanged check.
        var documentName: String
        var pageIDs: [UUID]
        var generations: [Int]
        var fileName: String
        var pages: [PDFPageInput]
    }

    func job(for document: ScanDocument, fileName: String, searchableText: Bool) -> Job {
        Job(documentID: document.id, documentName: document.name, pageIDs: document.pageIDs,
            generations: document.pageIDs.map { generations[$0] ?? 0 }, fileName: fileName,
            pages: document.pageIDs.compactMap { id in
                pages[id]?.status.result.map { PDFPageInput($0.processed, searchableText: searchableText) }
            })
    }

    /// Same name, same pages, and no render started since the PDF was built.
    func isUnchanged(since job: Job) -> Bool {
        guard let document = documents.first(where: { $0.id == job.documentID }) else { return false }
        return document.name == job.documentName && document.pageIDs == job.pageIDs
            && document.pageIDs.map { generations[$0] ?? 0 } == job.generations
    }

    nonisolated static func fileNames(in folder: URL) -> [String] {
        (try? FileManager.default.contentsOfDirectory(atPath: folder.path)) ?? []
    }

    /// Replacing writes the new PDF beside the old one first, so a failed write leaves the old file whole.
    nonisolated static func write(_ job: Job, in folder: URL, replace: Bool) -> Result<URL, ExportError> {
        let fileName = job.fileName + ".pdf"
        let old = replace ? fileNames(in: folder).first { $0.lowercased() == fileName.lowercased() }.map { folder.appending(path: $0) } : nil
        guard let old else {
            do {
                return .success(try PDFWriter.write(pages: job.pages, title: job.fileName, to: folder.appending(path: fileName)))
            } catch {
                return .failure(.cannotWrite(documentName: job.documentName))
            }
        }
        let temporary = folder.appending(path: ".\(UUID().uuidString).pdf")
        do {
            try PDFWriter.data(pages: job.pages, title: job.fileName).write(to: temporary)
            return .success(try FileManager.default.replaceItemAt(old, withItemAt: temporary) ?? old)
        } catch {
            try? FileManager.default.removeItem(at: temporary)
            return .failure(.cannotWrite(documentName: job.documentName))
        }
    }
}
