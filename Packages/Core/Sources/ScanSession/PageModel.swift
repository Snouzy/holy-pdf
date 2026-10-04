import CoreGraphics
import Foundation
import ImageIO
import ScanCore

/// Turns one photo into a page. The app passes `ScanPipeline`; tests pass a fake.
public typealias PageProcessor = @Sendable (URL, PageEdits, Detection?) async throws(ScanError) -> ProcessedPage

public struct PageResult: Sendable {
    public var processed: ProcessedPage
    public var thumbnail: CGImage?

    public init(_ processed: ProcessedPage) {
        self.processed = processed
        thumbnail = Thumbnail.make(from: processed.jpeg)
    }
}

public enum PageStatus: Sendable {
    case queued
    /// `previous` stays on screen while the new render runs.
    case processing(previous: PageResult?)
    case ready(PageResult)
    case failed(ScanError, previous: PageResult?)

    /// The render to show and to export: the latest one that succeeded.
    public var result: PageResult? {
        switch self {
        case .queued: nil
        case .processing(let previous): previous
        case .ready(let result): result
        case .failed(_, let previous): previous
        }
    }

    public var isSettled: Bool {
        switch self {
        case .queued, .processing: false
        case .ready, .failed: true
        }
    }
}

public struct ScanPage: Identifiable, Sendable {
    public let id = UUID()
    public let url: URL
    public var status: PageStatus
    /// What the user changed. A nil field is still automatic; the first edit pins turn, mode and watermark to what the page showed.
    public var edits = PageEdits()
    /// The user has looked at the page in the correction view.
    public var checked = false

    public init(url: URL, status: PageStatus = .queued) {
        self.url = url
        self.status = status
    }

    public var needsReview: Bool {
        guard !checked, let processed = status.result?.processed else { return false }
        return processed.detection.needsReview || processed.textUnread
    }
}

public struct ScanDocument: Identifiable, Sendable {
    public let id = UUID()
    public var name: String
    public var pageIDs: [UUID]
    public var evidence: [Evidence]
    /// Written to disk, and unchanged since.
    public var exported = false

    public init(name: String, pageIDs: [UUID], evidence: [Evidence] = []) {
        self.name = name
        self.pageIDs = pageIDs
        self.evidence = evidence
    }
}

public enum Thumbnail {
    /// Twice the 130 pt long side of a board thumbnail, for Retina screens.
    public static let maxPixelSize = 260

    public static func make(from jpeg: Data) -> CGImage? {
        guard let source = CGImageSourceCreateWithData(jpeg as CFData, nil) else { return nil }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixelSize,
        ]
        return CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
    }
}
