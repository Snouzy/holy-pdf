import CoreGraphics
import Foundation

func fixture(_ label: String, rotation: Int = 0, sharedWidgets: Bool = false, checkbox: Bool = false, catalog: String = "",
             form: String = "", widgetExtra: String = "", digitalSignature: Bool = false) -> Data {
    let content = "BT /F1 12 Tf 20 200 Td (\(label)) Tj ET"
    let names = catalog.contains("/Names") ? "" : "/Names<</Dests<</Names[(last)[9 0 R /Fit]]>>>>"
    let widget = sharedWidgets ? "/Parent 14 0 R" : checkbox ? "/FT/Btn/Ff 0/T(Person)/V/Yes/AS/Yes" : "/FT/Tx/T(Person)/V(\(label))"
    let objects = [
        "<</Type/Catalog/Pages 2 0 R/AcroForm<</Fields[\(sharedWidgets ? 14 : 8) 0 R \(digitalSignature ? "15 0 R" : "")]/DR<</Font<</Helv 5 0 R>>>>\(form)>>/Outlines 10 0 R\(names)\(catalog)>>",
        "<</Type/Pages/Count 2/Kids[3 0 R 9 0 R]>>",
        "<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 400]/CropBox[10 20 280 380]/Rotate \(rotation)/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R/Annots[6 0 R 7 0 R 8 0 R 12 0 R]>>",
        "<</Length \(content.utf8.count)>>stream\n\(content)\nendstream",
        "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
        "<</Type/Annot/Subtype/Link/Rect[20 100 120 130]/A<</S/URI/URI(https://example.com/\(label))>>>>",
        "<</Type/Annot/Subtype/Link/Rect[20 140 120 170]/Dest(last)>>",
        "<</Type/Annot/Subtype/Widget\(widget)/Rect[20 240 120 270]/P 3 0 R/DA(/Helv 12 Tf 0 g)\(widgetExtra)>>",
        "<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 400]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R\(sharedWidgets ? "/Annots[13 0 R]" : "")>>",
        "<</Type/Outlines/First 11 0 R/Last 11 0 R/Count 1>>",
        "<</Title(\(label) last)/Parent 10 0 R/Dest(last)>>",
        "<</Type/Annot/Subtype/Square/Rect[150 250 220 290]/C[1 0 0]/BS<</W 2>>>>",
        "<</Type/Annot/Subtype/Widget/Parent 14 0 R/Rect[20 240 120 270]/P 9 0 R>>",
        "<</FT/Tx/T(Person)/V(\(label))/DA(/Helv 12 Tf 0 g)/Kids[8 0 R 13 0 R]>>",
        "<</FT/Sig/T(Signature)/V 16 0 R>>",
        "<</Type/Sig/Filter/Adobe.PPKLite/SubFilter/adbe.pkcs7.detached/ByteRange[0 1 2 3]/Contents<00>>>",
    ]
    return serialize(objects: objects)
}

func serialize(objects: [String], info: Int? = nil) -> Data {
    var result = "%PDF-1.7\n"
    var offsets: [Int] = []
    for (index, object) in objects.enumerated() {
        offsets.append(result.utf8.count)
        result += "\(index + 1) 0 obj\n\(object)\nendobj\n"
    }
    let at = result.utf8.count
    result += "xref\n0 \(objects.count + 1)\n0000000000 65535 f \n"
    result += offsets.map { String(format: "%010d 00000 n \n", $0) }.joined()
    result += "trailer\n<</Size \(objects.count + 1)/Root 1 0 R\(info.map { "/Info \($0) 0 R" } ?? "")>>\nstartxref\n\(at)\n%%EOF\n"
    return Data(result.utf8)
}

/// Every pixel with its place in the image, from 0 to 1, origin top-left.
func pixels(of image: CGImage) -> [(x: Double, y: Double, red: Double, green: Double, blue: Double)] {
    let width = image.width, height = image.height
    var bytes = [UInt8](repeating: 0, count: width * height * 4)
    let drawn = bytes.withUnsafeMutableBytes { buffer -> Bool in
        guard let context = CGContext(data: buffer.baseAddress, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
                                      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return false }
        context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
        return true
    }
    guard drawn else { return [] }
    return (0..<height).flatMap { row in
        (0..<width).map { column in
            let at = (row * width + column) * 4
            return ((Double(column) + 0.5) / Double(width), (Double(row) + 0.5) / Double(height),
                    Double(bytes[at]), Double(bytes[at + 1]), Double(bytes[at + 2]))
        }
    }
}
