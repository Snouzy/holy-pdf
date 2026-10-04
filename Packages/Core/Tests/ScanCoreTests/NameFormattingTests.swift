import Testing
@testable import ScanCore

struct NameFormattingTests {
    @Test func slugFoldsAccentsAndCase() {
        #expect(NameFormatting.slug("INFORMAȚII PUNCTUALE") == "Informatii-punctuale")
        #expect(NameFormatting.slug("Încheiere nr. 123456") == "Incheiere-nr-123456")
    }

    @Test func slugDropsPathSeparators() {
        #expect(NameFormatting.slug("Factura 12/2026: copie") == "Factura-12-2026-copie")
    }

    @Test func slugKeepsSixWords() {
        #expect(NameFormatting.slug("a b c d e f g h") == "A-b-c-d-e-f")
    }

    @Test func slugOfPunctuationIsEmpty() {
        #expect(NameFormatting.slug("— / :") == "")
    }

    @Test func findsDuplicates() {
        #expect(NameFormatting.duplicates(["a", "b", "a"]) == ["a"])
    }

    @Test func uniquedAvoidsExistingNames() {
        #expect(NameFormatting.uniqued(["x", "x", "y"], avoiding: ["y", "x-2"]) == ["x", "x-3", "y-2"])
    }

    @Test func uniquedIgnoresCase() {
        #expect(NameFormatting.uniqued(["Scan", "scan"], avoiding: ["SCAN-2"]) == ["Scan", "scan-3"])
    }

    @Test func duplicatesIgnoreCase() {
        #expect(NameFormatting.duplicates(["Scan", "scan", "b"]) == ["scan"])
    }

    @Test func typedNamesBecomeSafeFileNames() {
        #expect(NameFormatting.fileSafe("  Facture 03/2026: EDF  ") == "Facture 03-2026- EDF")
        #expect(NameFormatting.fileSafe("..cache") == "cache")
        #expect(NameFormatting.fileSafe("Devis.PDF") == "Devis")
        #expect(NameFormatting.fileSafe("   ") == "")
    }

    @Test func aLongNameIsCutToFitAFileName() {
        let name = NameFormatting.fileSafe(String(repeating: "é", count: 300))
        #expect(name.utf8.count <= 200)
        #expect(!name.isEmpty && name.allSatisfy { $0 == "é" })
    }
}
