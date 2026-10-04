import CoreGraphics
import CoreImage
import CoreText
import Foundation
import ImageIO
import UniformTypeIdentifiers

public enum TestImages {
    /// Every temporary file of a test run lives here and is removed when the process exits.
    public static let temporaryFolder: URL = {
        let url = FileManager.default.temporaryDirectory.appending(path: "pdf-toolbox-tests-\(ProcessInfo.processInfo.processIdentifier)")
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        atexit { try? FileManager.default.removeItem(at: TestImages.temporaryFolder) }
        return url
    }()

    /// A fresh path inside `temporaryFolder`; nothing exists there yet.
    public static func temporaryURL(_ name: String) -> URL {
        temporaryFolder.appending(path: "\(UUID().uuidString)-\(name)")
    }

    public static func emptyFolder() throws -> URL {
        let url = temporaryURL("folder")
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    static var sRGB: CGColorSpace { CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB() }

    /// Runs `body` on an RGBA context whose origin is the top-left corner.
    public static func draw(width: Int, height: Int, _ body: (CGContext) -> Void) -> CGImage {
        guard let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
                                      space: sRGB, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
            fatalError("Cannot create a \(width)×\(height) bitmap context")
        }
        context.translateBy(x: 0, y: CGFloat(height))
        context.scaleBy(x: 1, y: -1)
        body(context)
        guard let image = context.makeImage() else { fatalError("Cannot read the bitmap context back") }
        return image
    }

    /// A white image with a red square in its top-left corner, to follow orientation changes.
    public static func marked(width: Int, height: Int) -> CGImage {
        draw(width: width, height: height) { context in
            context.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
            context.fill(CGRect(x: 0, y: 0, width: width, height: height))
            context.setFillColor(CGColor(red: 1, green: 0, blue: 0, alpha: 1))
            let side = min(width, height) / 5
            context.fill(CGRect(x: 0, y: 0, width: side, height: side))
        }
    }

    /// Writes `image` to a new temporary file.
    public static func write(_ image: CGImage, type: UTType, orientation: CGImagePropertyOrientation = .up,
                             captureDate: String? = nil) -> URL {
        let url = temporaryURL("image.\(type.preferredFilenameExtension ?? "img")")
        guard let destination = CGImageDestinationCreateWithURL(url as CFURL, type.identifier as CFString, 1, nil) else {
            fatalError("No encoder for \(type.identifier)")
        }
        var properties: [CFString: Any] = [kCGImagePropertyOrientation: orientation.rawValue]
        if let captureDate {
            properties[kCGImagePropertyExifDictionary] = [kCGImagePropertyExifDateTimeOriginal: captureDate]
        }
        CGImageDestinationAddImage(destination, image, properties as CFDictionary)
        guard CGImageDestinationFinalize(destination) else { fatalError("Cannot write \(url.path)") }
        return url
    }

    public static func render(_ image: CIImage, context: CIContext) -> CGImage {
        guard let output = context.createCGImage(image, from: image.extent, format: .RGBA8, colorSpace: sRGB) else {
            fatalError("Cannot render \(image.extent)")
        }
        return output
    }
}

extension TestImages {
    public struct Line {
        public var text: String
        /// Baseline start, normalized, top-left origin.
        public var x: Double
        public var y: Double
        /// Font size in pixels.
        public var size: Double

        public init(_ text: String, x: Double, y: Double, size: Double) {
            self.text = text
            self.x = x
            self.y = y
            self.size = size
        }
    }

    /// A white page with black Helvetica text.
    public static func textPage(width: Int = 1654, height: Int = 2339, lines: [Line]) -> CGImage {
        draw(width: width, height: height) { context in
            context.setFillColor(CGColor(gray: 1, alpha: 1))
            context.fill(CGRect(x: 0, y: 0, width: width, height: height))
            context.setFillColor(CGColor(gray: 0, alpha: 1))
            for line in lines {
                let font = CTFontCreateWithName("Helvetica" as CFString, line.size, nil)
                let attributes: [NSAttributedString.Key: Any] = [
                    NSAttributedString.Key(kCTFontAttributeName as String): font,
                    NSAttributedString.Key(kCTForegroundColorFromContextAttributeName as String): true,
                ]
                let ctLine = CTLineCreateWithAttributedString(NSAttributedString(string: line.text, attributes: attributes))
                context.saveGState()
                // Core Text draws upward; this context is flipped to a top-left origin.
                context.translateBy(x: line.x * Double(width), y: line.y * Double(height))
                context.scaleBy(x: 1, y: -1)
                context.textPosition = .zero
                CTLineDraw(ctLine, context)
                context.restoreGState()
            }
        }
    }
}
