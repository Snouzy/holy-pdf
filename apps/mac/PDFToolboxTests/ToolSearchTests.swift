import AppKit
import Foundation
import SwiftUI
import Testing
@testable import PDFToolbox

/// The cases of the site's `apps/web/tests/unit/search.test.ts`: the two searches must answer alike.
struct ToolSearchTests {
    private let entries = [
        ToolSearch.Entry(id: "merge", ready: true, names: ["Fusionner des PDF", "Frère Agrafe"], terms: ["assembler", "combiner", "joindre"]),
        ToolSearch.Entry(id: "compress", ready: true, names: ["Compresser un PDF"], terms: ["réduire", "alléger", "trop lourd"]),
        ToolSearch.Entry(id: "jpg-to-pdf", ready: true, names: ["Convertir des JPG en PDF", "JPG en PDF"], terms: ["image", "photo"]),
        ToolSearch.Entry(id: "pdf-to-jpg", ready: true, names: ["Convertir un PDF en JPG", "PDF en JPG"], terms: ["image", "photo"]),
        ToolSearch.Entry(id: "pdf-to-word", ready: false, names: ["PDF en Word"], terms: ["docx", "éditable"]),
    ]

    private func ids(_ query: String) -> [String]? { ToolSearch.tools(for: query, in: entries) }

    @Test func findsAToolByASynonymWhateverTheAccentsAndCapitals() {
        #expect(ids("réduire") == ["compress"])
        #expect(ids("REDUIRE") == ["compress"])
        #expect(ids("agrafe") == ["merge"], "By its monk")
    }

    @Test func findsAWordStillBeingTyped() {
        #expect(ids("fusi") == ["merge"])
    }

    @Test func forgivesOneTypoFromFourLettersTwoFromSeven() {
        #expect(ids("redure") == ["compress"])
        #expect(ids("comprsser") == ["compress"])
        #expect(ids("asembelr") == ["merge"])
        #expect(ids("fsuionner") == ["merge"], "Two letters swapped")
    }

    @Test func forgivesTyposOnlyWhenNoToolMatchesExactlyOrByItsStart() {
        let close = [ToolSearch.Entry(id: "convertir", ready: true, names: ["Convertir"], terms: []),
                     ToolSearch.Entry(id: "concatener", ready: true, names: ["Concaténer"], terms: [])]
        #expect(ToolSearch.tools(for: "conv", in: close) == ["convertir"])
    }

    @Test func ignoresAWordNoToolKnowsWhenAnotherWordMatches() {
        #expect(ids("réduire excel") == ["compress"])
        #expect(ids("excel tableur") == [])
        #expect(ids("excel") == [])
    }

    @Test func asksNothingWithAnEmptyQueryOrStopWordsOnly() {
        #expect(ids("") == nil, "Nothing asked: the home keeps its categories")
        #expect(ids("  un pdf ") == nil)
    }

    @Test func waitsWhileTheLastWordIsAStopWordBeingTyped() {
        #expect(ids("pd") == nil, "« pd » on the way to « pdf » asks nothing yet")
        #expect(ids("fich") == nil)
        #expect(ids("fusionner pd") == ["merge"])
        #expect(ids("doc") == ["pdf-to-word"])
    }

    @Test func tellsTheDirectionOfAConversionByTheOrderOfTheWords() {
        #expect(ids("pdf en jpg")?.first == "pdf-to-jpg")
        #expect(ids("jpg en pdf")?.first == "jpg-to-pdf")
    }

    @Test func putsReadyToolsBeforeToolsToCome() {
        let both = [ToolSearch.Entry(id: "sleeping", ready: false, names: ["Texte"], terms: []),
                    ToolSearch.Entry(id: "ready", ready: true, names: ["Texte"], terms: [])]
        #expect(ToolSearch.tools(for: "texte", in: both) == ["ready", "sleeping"])
    }
}

/// The home's own catalog: the Mac's tools with the site's names and words.
@MainActor
struct ToolCatalogTests {
    private func found(_ query: String, _ language: String) -> [String]? {
        ToolSearch.tools(for: query, in: ToolCatalog.entries(language: language))
    }

    @Test func everyToolHasACategoryAndTheSitesWordsInBothLanguages() {
        #expect(Set(Tool.allCases.map(\.category)) == Set(ToolCategory.allCases))
        for language in ["fr", "en"] {
            let entries = ToolCatalog.entries(language: language)
            #expect(entries.count == Tool.allCases.count + UpcomingTool.all.count)
            #expect(entries.allSatisfy { !$0.terms.isEmpty && $0.names.count >= 2 }, "\(language): \(entries.filter { $0.terms.isEmpty || $0.names.count < 2 }.map(\.id))")
        }
    }

    @Test func findsTheMacsToolsByTheSitesWords() {
        #expect(found("alléger", "fr") == ["compress"])
        #expect(found("mot de passe", "fr").map(Set.init) == ["protect", "unlock"])
        #expect(found("caviarder", "fr") == ["redact"])
        #expect(found("supprimer une page", "fr")?.first == "organize", "Organize deletes pages on the Mac")
        #expect(found("tourner", "fr") == ["organize"])
        #expect(found("frère pressoir", "fr") == ["compress"])
        #expect(found("shrink", "en") == ["compress"])
        #expect(found("livre scanné", "fr")?.first == "halves")
        #expect(found("n-up", "en") == ["sheets"])
        #expect(found("frère vitrail", "fr") == ["pixelize"])
        #expect(found("sommaire", "fr") == ["bookmarks"], "A tool the site does not have brings its own words")
        #expect(found("outline", "en") == ["bookmarks"])
        #expect(found("papier à en-tête", "fr")?.first == "overlay")
        #expect(found("letterhead", "en") == ["overlay"])
        #expect(found("word", "fr") == ["pdfToWord"])
        #expect(found("page web", "fr") == ["upcoming:web-to-pdf"], "A tool to come is found too")
        #expect(found("tableur", "fr") == [])
    }

    /// The site's cases on its built index (`apps/web/tests/unit/search.test.ts`), with the Mac's tool for each of the site's.
    @Test(arguments: [
        ("fr", "compresser pdf gratuit", "compress"), ("fr", "compresser un pdf gratuitement", "compress"), ("fr", "comment compresser un pdf", "compress"),
        ("fr", "fusionner deux pdf", "merge"), ("fr", "signer un pdf", "sign"), ("fr", "tourner les pages", "organize"),
        ("fr", "convertir un pdf en jpg gratuit", "pdfToImages"), ("fr", "pdf en jpg en ligne", "pdfToImages"), ("fr", "transformer pdf en jpg", "pdfToImages"),
        ("fr", "convertir pdf en jpg", "pdfToImages"), ("fr", "convertir pdf en photos", "pdfToImages"), ("fr", "jpg en pdf", "imagesToPDF"),
        ("en", "compress pdf free", "compress"), ("en", "sign a pdf", "sign"), ("en", "compress pdf online", "compress"), ("en", "combine two pdfs", "merge"),
        ("en", "rotate pages", "organize"), ("en", "make pdf smaller", "compress"), ("en", "pdf to jpg online", "pdfToImages"),
        ("en", "convert pdf to image", "pdfToImages"), ("en", "convert pdf to photos", "pdfToImages"), ("en", "jpg to pdf", "imagesToPDF"),
        ("en", "add page numbers", "pageNumbers"), ("fr", "numéroter les pages", "pageNumbers"),
    ])
    func answersLikeTheSite(language: String, query: String, first: String) {
        #expect(found(query, language)?.first == first)
    }

    @Test func aWordOfTheSitesNamesFindsItsTools() {
        #expect(found("convert", "en").map(Set.init)?.isSuperset(of: ["imagesToPDF", "pdfToImages"]) == true)
        #expect(found("convertir", "fr").map(Set.init)?.isSuperset(of: ["imagesToPDF", "pdfToImages"]) == true)
    }
}

@MainActor
struct HomeSearchFieldTests {
    @Test func theWindowOffersTheSearchFieldInItsToolbar() async throws {
        let root = RootView(split: PagePickingSession(mode: .split), extract: PagePickingSession(mode: .extract),
                            protect: ProtectionSession(mode: .protect), unlock: ProtectionSession(mode: .unlock))
        let window = NSWindow(contentRect: CGRect(x: 0, y: 0, width: 960, height: 640), styleMask: [.titled, .resizable], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        window.contentViewController = NSHostingController(rootView: root)
        window.orderFront(nil)
        defer { window.orderOut(nil); window.close() }
        try await waitUntil { window.toolbar?.items.contains { $0 is NSSearchToolbarItem } == true }
    }
}
