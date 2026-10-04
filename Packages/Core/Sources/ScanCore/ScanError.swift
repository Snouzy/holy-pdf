import Foundation

public enum ScanError: Error, Equatable, Sendable {
    case unreadableFile(URL)
    case unsupportedFormat(URL)
    case renderFailed
    case ocrUnavailable
}
