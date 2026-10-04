import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

public enum JPEGEncoder {
    /// ImageIO's scale is not libjpeg's: 0.8 writes the tables of libjpeg quality 94, 0.53 those of 80,
    /// the quality the prototype and `algorithm.md` mean.
    public static let quality = 0.53

    /// No metadata is passed to the encoder, so no location or date from the photo can leak.
    public static func encode(_ image: CGImage, quality: Double = JPEGEncoder.quality) throws(ScanError) -> Data {
        let data = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(data, UTType.jpeg.identifier as CFString, 1, nil) else {
            throw .renderFailed
        }
        CGImageDestinationAddImage(destination, image, [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary)
        guard CGImageDestinationFinalize(destination) else { throw .renderFailed }
        return data as Data
    }
}
