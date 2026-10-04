import Testing
import TestSupport
@testable import ScanCore

struct TextReaderTests {
    @Test func readsLinesWithTopLeftBoxes() async throws {
        let image = TestImages.textPage(lines: [
            .init("RAPORT ANUAL", x: 0.25, y: 0.10, size: 60),
            .init("Data emiterii: 03.08.2026", x: 0.1, y: 0.5, size: 36),
            .init("Pagina 1 din 3", x: 0.7, y: 0.95, size: 32),
        ])
        let lines = try await offPool { try TextReader.read(image) }
        #expect(lines.first?.text == "RAPORT ANUAL")
        #expect(lines.contains { $0.text.contains("03.08.2026") })
        let marker = try #require(lines.first { $0.text.contains("Pagina") })
        #expect(marker.box.y > 0.9)
        #expect(marker.box.x > 0.65)
    }

    // Latin letters read the same in every language: only another script tells the languages apart.
    @Test func readsInTheLanguagesItIsGiven() async throws {
        #expect(TextReader.supported.contains("fr-FR") && TextReader.supported.contains("ja-JP"))
        let image = TestImages.textPage(lines: [.init("請求書 2026年", x: 0.25, y: 0.10, size: 60)])
        let japanese = try await offPool { try TextReader.read(image, languages: ["ja-JP"]) }
        #expect(japanese.first?.text.contains("請求書") == true)
        let usual = try await offPool { try TextReader.read(image) }
        #expect(!usual.contains { $0.text.contains("請求書") })
    }

    @Test func blankPageHasNoText() async throws {
        let blank = TestImages.textPage(lines: [])
        #expect(try await offPool { try TextReader.read(blank) }.isEmpty)
    }
}
