import AppKit
import Testing
@testable import PDFToolbox

@MainActor
struct BrandTests {
    @Test func theTitleFontLoads() {
        Brand.registerFonts()
        #expect(NSFont(name: Brand.titleFont, size: 20) != nil)
    }

    @Test func theTitleFontIsTrueType() throws {
        let url = try #require(Bundle.main.url(forResource: "BricolageGrotesque-ExtraBold", withExtension: "ttf"))
        #expect(try Data(contentsOf: url).prefix(4) == Data([0, 1, 0, 0]))
    }

    @Test(arguments: ["AccentColor", "Highlight", "OnHighlight", "Stamp"])
    func theBrandColorsAreInTheCatalog(name: String) {
        #expect(NSColor(named: name) != nil)
    }

    @Test(arguments: [Brand.scannerMonk, Brand.scannerScene] + MonkMood.allCases.map(\.image))
    func brotherSnapIsInTheCatalog(name: String) {
        #expect(NSImage(named: name) != nil)
    }

    @Test(arguments: UpcomingTool.all.map(\.image))
    func everyUpcomingToolHasItsSleepingMonk(name: String) {
        #expect(NSImage(named: name) != nil)
    }

    @Test func theHomeDoesNotAnnounceWhatTheAppAlreadyDoes() {
        #expect(Set(UpcomingTool.all.map(\.id)).isDisjoint(with: ["delete-pages", "rotate", "split", "extract-pages", "page-numbers", "protect", "unlock", "compress", "ocr", "redact", "jpg-to-pdf", "pdf-to-jpg", "pdf-to-images", "flatten", "pages-per-sheet", "split-in-half", "pixelize", "pdf-to-word"]))
    }
}
