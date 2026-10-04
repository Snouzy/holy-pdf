import Foundation
import ScanCore
import ScanSession

/// The sentences for what the engine reports as data.
enum ScannerText {
    static func reason(_ evidence: [Evidence]) -> String {
        evidence.map { item in
            switch item {
            case .pageMarker(let marker): String(localized: "“\(marker)”")
            case .title(let title): String(localized: "Title “\(title)”")
            case .date(let date): date
            }
        }
        .joined(separator: " · ")
    }

    static func message(for error: ScanError) -> String {
        switch error {
        case .unreadableFile: String(localized: "Unreadable: the file does not open.")
        case .unsupportedFormat: String(localized: "Unreadable: only HEIC, JPEG and PNG photos are supported.")
        case .renderFailed: String(localized: "The page could not be rendered.")
        case .ocrUnavailable: String(localized: "Text recognition is not available.")
        }
    }

    static func message(for error: ExportError) -> String {
        switch error {
        case .duplicateNames: String(localized: "Two documents have the same name. Rename one to export.")
        case .cannotWrite(let name): String(localized: "“\(name)” could not be written. Check the folder access and the free space.")
        }
    }

    static func message(for reason: ReviewReason) -> String {
        switch reason {
        case .noPageFound: String(localized: "No page found: the corners are at the edges of the photo.")
        case .unusualRatio: String(localized: "The page has an unusual shape.")
        case .weakEdge: String(localized: "An edge of the page is hard to see.")
        case .cornerMoved: String(localized: "A hidden corner was rebuilt: check it.")
        }
    }

    static func reviewSummary(for page: ScanPage) -> String {
        guard let processed = page.status.result?.processed else { return "" }
        var lines = processed.detection.reviewReasons.map(message(for:))
        if processed.textUnread { lines.append(textUnread) }
        return lines.joined(separator: "\n")
    }

    static var textUnread: String { String(localized: "The text could not be read: this page has no text layer.") }

    static func title(of action: EditAction) -> String {
        switch action {
        case .moveCorners: String(localized: "Move Corners")
        case .autoDetection: String(localized: "Restore Automatic Detection")
        case .rotate: String(localized: "Rotate")
        case .rendering: String(localized: "Change Rendering")
        case .watermark: String(localized: "Watermark")
        case .format: String(localized: "Page Format")
        case .erase: String(localized: "Erase")
        case .deletePage: String(localized: "Delete Page")
        case .deleteDocument: String(localized: "Delete Document")
        case .movePage: String(localized: "Move Page")
        case .newDocument: String(localized: "New Document")
        case .rename: String(localized: "Rename")
        }
    }
}
