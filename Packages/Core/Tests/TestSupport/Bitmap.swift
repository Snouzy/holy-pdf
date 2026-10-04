import CoreGraphics
import ScanCore

/// The pixels of an image, read once, with a top-left origin.
public struct Bitmap {
    public let width: Int
    public let height: Int
    let bytes: [UInt8]

    public init(_ image: CGImage) {
        let w = image.width
        let h = image.height
        var bytes = [UInt8](repeating: 0, count: w * h * 4)
        bytes.withUnsafeMutableBytes { buffer in
            let context = CGContext(data: buffer.baseAddress, width: w, height: h, bitsPerComponent: 8,
                                    bytesPerRow: w * 4, space: TestImages.sRGB,
                                    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
            context?.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
        }
        width = w
        height = h
        self.bytes = bytes
    }

    public func rgb(x: Int, y: Int) -> (red: Double, green: Double, blue: Double) {
        let index = (y * width + x) * 4
        return (Double(bytes[index]), Double(bytes[index + 1]), Double(bytes[index + 2]))
    }

    /// Mean gray level, 0 to 255, of the square of `radius` pixels around (x, y).
    public func gray(x: Int, y: Int, radius: Int = 2) -> Double {
        var total = 0.0
        var count = 0.0
        for row in max(0, y - radius)...min(height - 1, y + radius) {
            for column in max(0, x - radius)...min(width - 1, x + radius) {
                let color = rgb(x: column, y: row)
                total += (color.red + color.green + color.blue) / 3
                count += 1
            }
        }
        return total / count
    }

    public func gray(at point: NormalizedPoint, radius: Int = 2) -> Double {
        gray(x: min(width - 1, Int(point.x * Double(width))), y: min(height - 1, Int(point.y * Double(height))), radius: radius)
    }
}
