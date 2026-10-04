import CoreGraphics
import Foundation
import ImageIO
import Testing
import UniformTypeIdentifiers

/// Red on the left half and blue on the right, or red on top and blue below. The bottom half is see-through with `clearBottom`.
func halves(width: Int, height: Int, vertical: Bool = false, clearBottom: Bool = false) throws -> CGImage {
    let context = try #require(CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
                                         space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
    let whole = CGRect(x: 0, y: 0, width: width, height: height)
    // Core Graphics counts from the bottom: the top half is at the high end of y.
    let (first, second) = vertical ? whole.divided(atDistance: CGFloat(height) / 2, from: .maxYEdge)
        : whole.divided(atDistance: CGFloat(width) / 2, from: .minXEdge)
    context.setFillColor(CGColor(red: 1, green: 0, blue: 0, alpha: 1))
    context.fill(first)
    context.setFillColor(CGColor(red: 0, green: 0, blue: 1, alpha: 1))
    context.fill(second)
    if clearBottom { context.clear(whole.divided(atDistance: CGFloat(height) / 2, from: .minYEdge).slice) }
    return try #require(context.makeImage())
}

/// Noise that no encoder shrinks much: large enough to tell one stored copy from two.
func noise(width: Int, height: Int) throws -> CGImage {
    var bytes = [UInt8](repeating: 255, count: width * height * 4)
    var state: UInt32 = 2_463_534_242
    for index in bytes.indices where index % 4 != 3 {
        state ^= state << 13
        state ^= state >> 17
        state ^= state << 5
        bytes[index] = UInt8(truncatingIfNeeded: state)
    }
    let provider = try #require(CGDataProvider(data: Data(bytes) as CFData))
    return try #require(CGImage(width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: width * 4,
                                space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipLast.rawValue),
                                provider: provider, decode: nil, shouldInterpolate: true, intent: .defaultIntent))
}

func encoded(_ image: CGImage, as type: UTType, properties: [CFString: Any] = [:]) throws -> Data {
    let data = NSMutableData()
    let destination = try #require(CGImageDestinationCreateWithData(data, type.identifier as CFString, 1, nil))
    CGImageDestinationAddImage(destination, image, properties as CFDictionary)
    try #require(CGImageDestinationFinalize(destination))
    return data as Data
}

/// The JPEG pictures a PDF holds, decoded.
func jpegs(in pdf: Data) -> [CGImage] {
    let start = Data([0xFF, 0xD8, 0xFF]), end = Data("endstream".utf8)
    var images: [CGImage] = []
    var cursor = pdf.startIndex
    while let found = pdf.range(of: start, in: cursor..<pdf.endIndex) {
        let stop = pdf.range(of: end, in: found.lowerBound..<pdf.endIndex)?.lowerBound ?? pdf.endIndex
        if let source = CGImageSourceCreateWithData(Data(pdf[found.lowerBound..<stop]) as CFData, nil),
           let image = CGImageSourceCreateImageAtIndex(source, 0, nil) { images.append(image) }
        cursor = stop
    }
    return images
}

func occurrences(of text: String, in data: Data) -> Int {
    String(decoding: data, as: UTF8.self).components(separatedBy: text).count - 1
}
