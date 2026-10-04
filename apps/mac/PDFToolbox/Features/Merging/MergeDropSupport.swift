import AppKit
import SwiftUI
import UniformTypeIdentifiers

enum MergeDropPosition: Equatable, Sendable {
    case before(UUID)
    case after(UUID)
    case end
}

enum MergeDropSupport {
    static func payload(for id: UUID) -> String { "holy-pdf-merge:" + id.uuidString }

    static func decodeID(_ text: String) -> UUID? {
        guard text.hasPrefix("holy-pdf-merge:") else { return nil }
        return UUID(uuidString: String(text.dropFirst("holy-pdf-merge:".count)))
    }

    static func position(rowID: UUID?, rowHeight: CGFloat, location: CGPoint) -> MergeDropPosition {
        guard let rowID else { return .end }
        return location.y < rowHeight / 2 ? .before(rowID) : .after(rowID)
    }

    nonisolated static func pdfURL(from item: NSSecureCoding?) -> URL? {
        let url: URL?
        switch item {
        case let value as URL: url = value
        case let data as Data: url = URL(dataRepresentation: data, relativeTo: nil)
        case let text as String: url = URL(string: text)
        default: url = nil
        }
        guard let url, url.isFileURL, url.pathExtension.lowercased() == "pdf" else { return nil }
        return url
    }

    @MainActor
    static func files(from providers: [NSItemProvider]) async -> [URL] {
        var files: [URL] = []
        // Provider callbacks can finish out of order; the Finder's order is the import order.
        for provider in providers where provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) {
            let url: URL? = await withCheckedContinuation { continuation in
                provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { item, _ in
                    continuation.resume(returning: pdfURL(from: item))
                }
            }
            if let url { files.append(url) }
        }
        return files
    }

}

@MainActor
struct MergeDropDelegate: DropDelegate {
    var isEnabled: () -> Bool
    var onFiles: ([URL]) -> Void
    var onTarget: (Bool) -> Void

    func validateDrop(info: DropInfo) -> Bool {
        isEnabled() && info.hasItemsConforming(to: [.fileURL])
    }

    func dropEntered(info: DropInfo) { onTarget(validateDrop(info: info)) }
    func dropExited(info: DropInfo) { onTarget(false) }

    func dropUpdated(info: DropInfo) -> DropProposal? {
        let accepts = validateDrop(info: info)
        onTarget(accepts)
        return DropProposal(operation: accepts ? .copy : .forbidden)
    }

    func performDrop(info: DropInfo) -> Bool {
        onTarget(false)
        guard validateDrop(info: info) else { return false }
        let providers = info.itemProviders(for: [.fileURL])
        Task { await receive(providers: providers) }
        return true
    }

    @discardableResult
    func receive(providers: [NSItemProvider]) async -> Bool {
        guard isEnabled() else { return false }
        let urls = await MergeDropSupport.files(from: providers)
        guard isEnabled(), !urls.isEmpty else { return false }
        onFiles(urls)
        return true
    }
}
