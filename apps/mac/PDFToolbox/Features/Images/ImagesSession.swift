import CoreGraphics
import Foundation
import ImageIO
import Observation
import PDFCore

/// Images to PDF: a list of pictures, in the order of the pages.
@MainActor
@Observable
final class ImagesSession {
    struct Item: Identifiable, Sendable {
        let id = UUID()
        let name: String
        let data: Data
        /// Which picture of the file: a scanned TIFF holds several.
        let frame: Int
        let thumbnail: CGImage
        /// As the picture is shown: after its EXIF orientation.
        let pixels: CGSize
    }

    nonisolated static let maxImages = 200
    nonisolated static let maxBytes = 512 * 1024 * 1024

    private(set) var items: [Item] = []
    private(set) var isBusy = false
    private(set) var lastSavedURL: URL?
    private(set) var hasUnsavedChanges = false
    var errorMessage: String?

    var canSave: Bool { !items.isEmpty && !isBusy }

    func add(_ urls: [URL]) async {
        guard !isBusy, !urls.isEmpty else { return }
        isBusy = true
        errorMessage = nil
        defer { isBusy = false }
        var problems: [String] = []
        var refused: [String] = []
        var bytes = items.reduce(0) { $0 + $1.data.count }
        files: for url in urls {
            let access = url.startAccessingSecurityScopedResource()
            defer { if access { url.stopAccessingSecurityScopedResource() } }
            let found = await Task.detached(priority: .userInitiated) { Self.items(at: url) }.value
            if found.isEmpty { refused.append(url.lastPathComponent) }
            for item in found {
                guard items.count < Self.maxImages else {
                    problems.append(String(localized: "A PDF takes up to 200 images."))
                    break files
                }
                // One file counts once, whatever the number of its pages.
                if item.frame == 0 { bytes += item.data.count }
                guard bytes <= Self.maxBytes else {
                    problems.append(String(localized: "These images weigh more than 512 MB together. Make several PDFs."))
                    break files
                }
                items.append(item)
                changed()
            }
        }
        if !refused.isEmpty { problems.append(String(localized: "Could not be read as an image: \(refused.formatted(.list(type: .and))).")) }
        if !problems.isEmpty { errorMessage = problems.joined(separator: " ") }
    }

    /// One item for each picture of the file: several for a scanned TIFF, none for a file that is not an image.
    nonisolated private static func items(at url: URL) -> [Item] {
        // A film dropped by mistake is not read into memory.
        guard let size = try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize, size <= maxBytes,
              let data = try? Data(contentsOf: url), let source = CGImageSourceCreateWithData(data as CFData, nil) else { return [] }
        let count = PDFImagePages.pictures(in: data)
        return (0..<count).compactMap { frame in
            guard let thumbnail = CGImageSourceCreateThumbnailAtIndex(source, frame, [
                      kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceCreateThumbnailWithTransform: true,
                      kCGImageSourceThumbnailMaxPixelSize: 240,
                  ] as CFDictionary),
                  let properties = CGImageSourceCopyPropertiesAtIndex(source, frame, nil) as? [CFString: Any],
                  let width = properties[kCGImagePropertyPixelWidth] as? Int, let height = properties[kCGImagePropertyPixelHeight] as? Int else { return nil }
            // Orientations 5 to 8 lay the picture on its side.
            let sideways = (properties[kCGImagePropertyOrientation] as? Int ?? 1) > 4
            return Item(name: count > 1 ? "\(url.lastPathComponent) (\(frame + 1))" : url.lastPathComponent, data: data, frame: frame, thumbnail: thumbnail,
                        pixels: sideways ? CGSize(width: height, height: width) : CGSize(width: width, height: height))
        }
    }

    func remove(_ id: Item.ID) {
        guard !isBusy, let index = items.firstIndex(where: { $0.id == id }) else { return }
        items.remove(at: index)
        changed()
    }

    func move(from source: IndexSet, to destination: Int) {
        guard !isBusy else { return }
        items.move(fromOffsets: source, toOffset: destination)
        changed()
    }

    /// One row up (-1) or down (+1): for who does not drag.
    func move(_ id: Item.ID, by step: Int) {
        guard !isBusy, let index = items.firstIndex(where: { $0.id == id }), items.indices.contains(index + step) else { return }
        items.swapAt(index, index + step)
        changed()
    }

    func removeAll() {
        guard !isBusy else { return }
        items = []
        changed()
    }

    private func changed() {
        lastSavedURL = nil
        hasUnsavedChanges = !items.isEmpty
    }

    func export() {
        guard canSave, let first = items.first else { return }
        let name = URL(fileURLWithPath: first.name).deletingPathExtension().lastPathComponent + ".pdf"
        // Busy while the panel is open: the PDF holds the list that was on screen.
        isBusy = true
        Task {
            let url = await choosePDFDestination(name: name)
            isBusy = false
            if let url { await save(to: url) }
        }
    }

    func save(to url: URL) async {
        guard canSave else { return }
        isBusy = true
        errorMessage = nil
        defer { isBusy = false }
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        do {
            try await Task.detached(priority: .userInitiated) { [images = items.map { PDFImagePages.Picture(data: $0.data, frame: $0.frame) }] in
                let title = url.deletingPathExtension().lastPathComponent
                try PDFImagePages.document(of: images, title: title).write(to: url, options: .atomic)
            }.value
            lastSavedURL = url
            hasUnsavedChanges = false
        } catch {
            errorMessage = ImagesText.message(error)
        }
    }
}

enum ImagesText {
    static func message(_ error: Error) -> String {
        switch error as? PDFToolError {
        case .invalidImage: String(localized: "An image could not be read. Remove it and try again.")
        default: String(localized: "The PDF could not be saved. Check the folder access and the free space. Your images have not changed.")
        }
    }
}
