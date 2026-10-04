import CoreGraphics

/// A small grayscale copy of an image for the edge search: 0 to 255, top row first.
struct GrayImage {
    let width: Int
    let height: Int
    var pixels: [Float]

    init(width: Int, height: Int, pixels: [Float]) {
        self.width = width
        self.height = height
        self.pixels = pixels
    }

    /// `image` scaled by `scale`, then blurred with a 1-4-6-4-1 binomial kernel.
    init?(_ image: CGImage, scale: Double) {
        let w = max(1, Int((Double(image.width) * scale).rounded()))
        let h = max(1, Int((Double(image.height) * scale).rounded()))
        var bytes = [UInt8](repeating: 0, count: w * h)
        let drawn = bytes.withUnsafeMutableBytes { buffer -> Bool in
            guard let context = CGContext(data: buffer.baseAddress, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w,
                                          space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue) else {
                return false
            }
            context.interpolationQuality = .high
            context.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
            return true
        }
        guard drawn else { return nil }
        self.init(width: w, height: h, pixels: bytes.map(Float.init))
        pixels = convolve(convolve(pixels, horizontal: true), horizontal: false)
    }

    /// Bilinear sample. Points outside the image read as 0, so a page that fills the frame
    /// still shows an edge at the border.
    func sample(_ point: SIMD2<Double>) -> Float {
        guard point.x >= 0, point.y >= 0, point.x <= Double(width - 1), point.y <= Double(height - 1) else { return 0 }
        let x0 = Int(point.x), y0 = Int(point.y)
        let x1 = min(x0 + 1, width - 1), y1 = min(y0 + 1, height - 1)
        let fx = Float(point.x - Double(x0)), fy = Float(point.y - Double(y0))
        let top = pixels[y0 * width + x0] * (1 - fx) + pixels[y0 * width + x1] * fx
        let bottom = pixels[y1 * width + x0] * (1 - fx) + pixels[y1 * width + x1] * fx
        return top * (1 - fy) + bottom * fy
    }

    func convolve(_ input: [Float], horizontal: Bool) -> [Float] {
        let kernel: [Float] = [1, 4, 6, 4, 1].map { $0 / 16 }
        var output = input
        for y in 0..<height {
            for x in 0..<width {
                var sum: Float = 0
                for (index, weight) in kernel.enumerated() {
                    let offset = index - 2
                    let sx = horizontal ? min(max(x + offset, 0), width - 1) : x
                    let sy = horizontal ? y : min(max(y + offset, 0), height - 1)
                    sum += input[sy * width + sx] * weight
                }
                output[y * width + x] = sum
            }
        }
        return output
    }
}
