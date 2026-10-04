import AppKit
import Testing
@testable import PDFToolbox

@MainActor
struct MonkAssetTests {
    @Test(arguments: ["monk-sign", "monk-merge", "monk-organize", "monk-watermark", "monk-split", "monk-extract", "monk-page-numbers", "monk-protect", "monk-unlock", "monk-compress", "monk-ocr", "monk-redact", "monk-images-to-pdf", "monk-pdf-to-images", "monk-flatten", "monk-pages-per-sheet", "monk-split-in-half", "monk-pixelize", "monk-bookmarks", "monk-overlay", "monk-pdf-to-word", "monk-edit"], [NSAppearance.Name.aqua, .darkAqua])
    func monkLoadsInBothAppearances(image name: String, appearance: NSAppearance.Name) throws {
        let theme = try #require(NSAppearance(named: appearance))
        theme.performAsCurrentDrawingAppearance {
            let image = NSImage(named: name)
            #expect(image != nil)
            #expect(image?.size == NSSize(width: 200, height: 220))
        }
    }

    @Test(arguments: [("Signing/monk-sign", "quill"), ("Merging/monk-merge", "stapler"), ("Organizing/monk-organize", "sheet"), ("Watermarking/monk-watermark", "stamp"),
                     ("Splitting/monk-split", "scissors"), ("Extracting/monk-extract", "loupe"),
                     ("PageNumbers/monk-page-numbers", "sheet"), ("Protection/monk-protect", "lock"), ("Protection/monk-unlock", "lock"), ("Compressing/monk-compress", "book"), ("Reading/monk-ocr", "loupe"), ("Redacting/monk-redact", "eraser"), ("Images/monk-images-to-pdf", "frame"), ("Images/monk-pdf-to-images", "frame"), ("Flattening/monk-flatten", "book"),
                     ("Sheets/monk-pages-per-sheet", "sheet"), ("Halving/monk-split-in-half", "scissors"), ("Pixelizing/monk-pixelize", "frame"), ("Bookmarks/monk-bookmarks", "book"), ("Overlaying/monk-overlay", "stamp"), ("Word/monk-pdf-to-word", "quill"), ("Editing/monk-edit", "quill")])
    func monkAssetsPreserveVectorsAndBothAppearances(imageSet: String, accessory: String) throws {
        let folder = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent()
            .appendingPathComponent("PDFToolbox/Assets.xcassets/\(imageSet).imageset")
        let data = try Data(contentsOf: folder.appendingPathComponent("Contents.json"))
        let catalog = try JSONDecoder().decode(ImageSet.self, from: data)
        #expect(catalog.properties.preservesVectors)
        try #require(catalog.images.count == 2)
        #expect(catalog.images.map(\.filename) == ["light.svg", "dark.svg"])
        #expect(catalog.images[0].appearances == nil)
        #expect(catalog.images[1].appearances == [.init(appearance: "luminosity", value: "dark")])

        var variants: [String] = []
        for image in catalog.images {
            let svg = try String(contentsOf: folder.appendingPathComponent(image.filename), encoding: .utf8)
            #expect(svg.contains("xmlns=\"http://www.w3.org/2000/svg\""))
            #expect(svg.contains("viewBox=\"0 0 200 220\""))
            #expect(svg.contains("accessory-\(accessory)"))
            #expect(!svg.contains("var("))
            #expect(!svg.contains("<text"))
            #expect(svg.components(separatedBy: "<svg").count == 2)
            variants.append(svg)
        }
        #expect(variants[0] != variants[1])
    }
}

private struct ImageSet: Decodable {
    struct Image: Decodable {
        struct Appearance: Decodable, Equatable {
            let appearance: String
            let value: String
        }
        let filename: String
        let appearances: [Appearance]?
    }
    struct Properties: Decodable {
        let preservesVectors: Bool
        enum CodingKeys: String, CodingKey {
            case preservesVectors = "preserves-vector-representation"
        }
    }
    let images: [Image]
    let properties: Properties
}
