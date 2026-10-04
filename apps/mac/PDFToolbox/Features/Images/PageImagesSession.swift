import Foundation
import Observation
import PDFCore

/// PDF to images: one JPEG for each page, or each photo of the PDF, in a folder the user chooses.
@MainActor
@Observable
final class PageImagesSession {
    enum Mode { case pages, photos }

    // No copy of the PDF is written: a signature has nothing to fear.
    let file = PDFCopySession(describe: PageImagesText.message, allowsSigned: true)
    /// Kept from one PDF to the next.
    var quality = PDFPageImages.Quality.normal {
        didSet { if quality != oldValue { savedURLs = [] } }
    }
    /// Back to the pages when a PDF without a photo opens.
    var mode = Mode.pages {
        didSet { if mode != oldValue { savedURLs = [] } }
    }
    private(set) var savedURLs: [URL] = []
    /// How many photos « Extract images » gives for the open PDF. Nil while they are counted: a long PDF opens first.
    private(set) var photoCount: Int?

    init() {
        file.onClosed = { [weak self] in
            self?.savedURLs = []
            self?.photoCount = nil
        }
        file.onOpened = { [weak self] in
            Task { [weak self] in
                guard let count = await self?.file.read({ data, password in (try? PDFPhotos.count(data, password: password)) ?? 0 }) else { return }
                self?.photoCount = count
                if count == 0 { self?.mode = .pages }
            }
        }
    }

    func export() {
        // The mode at the click: a count that ends while the folder panel is open must not change what is saved.
        let mode = mode
        Task {
            if let folder = await file.choosing({ await chooseFolder(prompt: String(localized: "Save the images here")) }) { await save(into: folder, mode: mode) }
        }
    }

    func save(into folder: URL, mode: Mode) async {
        savedURLs = []
        let access = folder.startAccessingSecurityScopedResource()
        defer { if access { folder.stopAccessingSecurityScopedResource() } }
        let stem = URL(fileURLWithPath: file.sourceName).deletingPathExtension().lastPathComponent
        let total = file.pageSizes.count
        let written = await file.prepare(reporting: { [quality] data, password, report in
            var urls: [URL] = []
            // Never replaces a file of the folder.
            func keep(_ jpeg: Data, named name: String) throws {
                let url = unusedURL(named: name, in: folder)
                try writeNewFile(jpeg, at: url)
                urls.append(url)
            }
            do {
                switch mode {
                case .pages:
                    try PDFPageImages.export(data, password: password, quality: quality) { index, jpeg in
                        report(WorkStep(done: index + 1, total: total))
                        try keep(jpeg, named: total == 1 ? "\(stem).jpg" : "\(stem)-\(index + 1).jpg")
                    }
                case .photos:
                    try PDFPhotos.export(data, password: password, progress: { report(WorkStep(done: $0, total: $1)) }) { jpeg in
                        try keep(jpeg, named: "\(stem)-\(String(localized: "photo"))-\(urls.count + 1).jpg")
                    }
                }
            } catch {
                // Half a conversion is of no use. Each file is one this run created: removing it loses nothing.
                for url in urls { try? FileManager.default.removeItem(at: url) }
                throw error
            }
            return urls
        })
        // Nil for a cancelled run, which may end after the next one started.
        guard let written else { return }
        savedURLs = written
        if written.isEmpty { file.errorMessage = String(localized: "No photo could be taken out of this PDF: convert its pages instead.") }
    }
}

enum PageImagesText {
    static func message(_ error: Error) -> String {
        switch error as? PDFToolError {
        case .writeFailed: String(localized: "The images could not be written. Check the folder access and the free space.")
        case .renderFailed: String(localized: "A page could not be turned into an image. Your original PDF has not changed.")
        default: SigningText.message(error)
        }
    }
}
