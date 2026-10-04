import Foundation
import Testing
@testable import ScanCore

struct DocumentSuggesterTests {
    let calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Europe/Paris") ?? .gmt
        return calendar
    }()

    func day(_ year: Int, _ month: Int, _ day: Int) -> Date {
        calendar.date(from: DateComponents(year: year, month: month, day: day, hour: 12)) ?? .distantPast
    }

    func line(_ text: String, y: Double, x: Double = 0.1, width: Double = 0.5, height: Double = 0.015) -> TextLine {
        TextLine(text: text, box: NormalizedRect(x: x, y: y, width: width, height: height), confidence: 1)
    }

    func page(_ lines: TextLine..., captured: Date? = nil) -> PageText {
        PageText(id: UUID(), lines: lines, captureDate: captured)
    }

    func centered(_ number: String) -> TextLine {
        line(number, y: 0.95, x: 0.49, width: 0.02)
    }

    @Test func readsPageMarkers() {
        #expect(DocumentSuggester.marker(in: page(line("Raport generat în data de 15.06.2026   Pagina 2 din 3", y: 0.95)))
                == PageMarker(index: 2, total: 3, text: "Pagina 2 din 3"))
        #expect(DocumentSuggester.marker(in: page(line("Page 1 of 2", y: 0.03)))?.total == 2)
        #expect(DocumentSuggester.marker(in: page(line("Page 3 sur 4", y: 0.95)))?.index == 3)
        #expect(DocumentSuggester.marker(in: page(line("1 / 2", y: 0.95))) == PageMarker(index: 1, total: 2, text: "1 / 2"))
        #expect(DocumentSuggester.marker(in: page(centered("3"))) == PageMarker(index: 3, total: nil, text: "3"))
    }

    @Test func ignoresWhatIsNotAMarker() {
        #expect(DocumentSuggester.marker(in: page(line("3", y: 0.95, x: 0.05, width: 0.02))) == nil)
        #expect(DocumentSuggester.marker(in: page(line("08/07/2026", y: 0.95))) == nil)
        #expect(DocumentSuggester.marker(in: page(line("Pagina 1 din 3", y: 0.5))) == nil)
        #expect(DocumentSuggester.marker(in: page(line("3 / 2", y: 0.95))) == nil)
    }

    @Test func groupsPagesWhoseMarkersFollow() {
        let pages = [
            page(line("1 / 2", y: 0.95)), page(line("2 / 2", y: 0.95)),
            page(line("Factura", y: 0.1)),
            page(line("Pagina 1 din 3", y: 0.96)), page(line("Pagina 2 din 3", y: 0.96)), page(line("Pagina 3 din 3", y: 0.96)),
            page(centered("1")), page(centered("2")),
        ]
        #expect(DocumentSuggester.group(pages).map(\.count) == [2, 1, 3, 2])
    }

    @Test func aNewFirstPageStartsANewDocument() {
        let pages = [page(line("1 / 1", y: 0.95)), page(line("1 / 2", y: 0.95)), page(line("2 / 2", y: 0.95))]
        #expect(DocumentSuggester.group(pages).map(\.count) == [1, 2])
    }

    @Test func picksTheLatestDateNotAfterThePhoto() {
        let group = [page(line("emis la data de 05.02.2019", y: 0.3),
                          line("valabil până la data de 30.11.2030", y: 0.32),
                          line("Termen: 01.10.2026", y: 0.34),
                          line("azi 14.07.2026", y: 0.8))]
        #expect(DocumentSuggester.latestDate(in: group, notAfter: day(2026, 9, 26), calendar: calendar)?.text == "14.07.2026")
    }

    @Test func skipsValidityAndExpiryDates() {
        let proof = [page(line("Data emiterii: 03.08.2026", y: 0.6),
                          line("Oferta este valabilă până la data 11.09.2026", y: 0.62))]
        #expect(DocumentSuggester.latestDate(in: proof, notAfter: day(2026, 9, 26), calendar: calendar)?.text == "03.08.2026")
        let receipt = [page(line("Issued 02/09/2026", y: 0.3), line("Valid until 20/09/2026", y: 0.32))]
        #expect(DocumentSuggester.latestDate(in: receipt, notAfter: day(2026, 9, 26), calendar: calendar)?.text == "02/09/2026")
        let validated = [page(line("Issued 02/09/2026", y: 0.3), line("Document validat la 05/09/2026", y: 0.32))]
        #expect(DocumentSuggester.latestDate(in: validated, notAfter: day(2026, 9, 26), calendar: calendar)?.text == "05/09/2026")
    }

    @Test func readsTheThreeDateFormats() {
        #expect(DocumentSuggester.dates(in: "DIN 08/07/2026-09:45:00", calendar: calendar).map(\.text) == ["08/07/2026"])
        #expect(DocumentSuggester.dates(in: "Nr.: 1234567/03.08.2026", calendar: calendar).map(\.text) == ["03.08.2026"])
        #expect(DocumentSuggester.dates(in: "exported 2026-09-21", calendar: calendar).map(\.text) == ["2026-09-21"])
    }

    @Test func rejectsImpossibleAndOldDates() {
        #expect(DocumentSuggester.dates(in: "31.02.2026", calendar: calendar).isEmpty)
        let group = [page(line("12.05.1985", y: 0.5))]
        #expect(DocumentSuggester.latestDate(in: group, notAfter: day(2026, 9, 26), calendar: calendar) == nil)
    }

    @Test func titleSkipsHeadersRepeatedAcrossDocuments() {
        let header = line("MINISTERUL JUSTITIEI", y: 0.05, height: 0.03)
        let groups = [[page(header, line("RAPORT ANUAL", y: 0.2, height: 0.025))],
                      [page(header, line("ADEVERINTA", y: 0.25, height: 0.02))]]
        let repeated = DocumentSuggester.repeatedHeaderLines(groups)
        #expect(DocumentSuggester.title(of: groups[0][0], excluding: repeated) == "RAPORT ANUAL")
        #expect(DocumentSuggester.title(of: groups[1][0], excluding: repeated) == "ADEVERINTA")
    }

    @Test func titleSkipsDoubtfulAndLongLines() {
        let logo = TextLine(text: "IQNET", box: NormalizedRect(x: 0.8, y: 0.1, width: 0.1, height: 0.04), confidence: 0.3)
        let body = line("declar pe propria raspundere in conformitate cu prevederile legii", y: 0.3, width: 0.8, height: 0.03)
        let title = line("RAPORT ANUAL", y: 0.25, height: 0.02)
        #expect(DocumentSuggester.title(of: page(logo, body, title), excluding: []) == "RAPORT ANUAL")
    }

    @Test func aTitleSharedByTwoDocumentsOfABigBatchIsKept() {
        let header = line("MINISTERUL JUSTITIEI", y: 0.05, height: 0.03)
        let groups = (0..<9).map { index in
            [page(header, line(index < 2 ? "FACTURA" : "ADEVERINTA \(index)", y: 0.2, height: 0.02))]
        }
        let repeated = DocumentSuggester.repeatedHeaderLines(groups)
        #expect(DocumentSuggester.title(of: groups[0][0], excluding: repeated) == "FACTURA")
        #expect(DocumentSuggester.title(of: groups[1][0], excluding: repeated) == "FACTURA")
    }

    @Test func titleIgnoresTheLowerPageAndBareNumbers() {
        let invoice = page(line("12345 / 2026", y: 0.1, height: 0.05), line("Factura", y: 0.2, height: 0.02),
                           line("TOTAL DE PLATA", y: 0.7, height: 0.04))
        #expect(DocumentSuggester.title(of: invoice, excluding: []) == "Factura")
    }

    @Test func suggestsNamesWithDateAndTitle() throws {
        let pages = [page(line("RAPORT ANUAL", y: 0.2, height: 0.025), line("Eliberat la data: 16.06.2026", y: 0.6),
                          captured: day(2026, 9, 26))]
        let suggestion = try #require(DocumentSuggester.suggest(pages, today: day(2026, 9, 29), calendar: calendar).first)
        #expect(suggestion.name == "2026-06-16_Raport-anual")
        #expect(suggestion.evidence == [.date("16.06.2026"), .title("RAPORT ANUAL")])
    }

    @Test(arguments: [Calendar.Identifier.japanese, .buddhist])
    func defaultCalendarIsGregorian(system: Calendar.Identifier) {
        let pages = [page(line("Eliberat la data: 16.06.2026", y: 0.6), captured: day(2026, 9, 26)), page(captured: day(2026, 9, 26))]
        let byDefault = DocumentSuggester.suggest(pages, today: day(2026, 9, 29)).map(\.name)
        #expect(byDefault == ["2026-06-16_Document-1", "2026-09-26_Document-2"])
        #expect(DocumentSuggester.suggest(pages, today: day(2026, 9, 29), calendar: Calendar(identifier: system)).map(\.name) != byDefault)
    }

    @Test func pageWithoutTextGetsFallbackName() {
        let suggestions = DocumentSuggester.suggest([page(captured: day(2026, 9, 26)), page()], today: day(2026, 9, 29), calendar: calendar)
        #expect(suggestions.map(\.name) == ["2026-09-26_Document-1", "2026-09-29_Document-2"])
    }

    @Test func multiPageDocumentsKeepTheirMarker() {
        let pages = [page(line("Pagina 1 din 2", y: 0.96)), page(line("Pagina 2 din 2", y: 0.96))]
        let suggestion = DocumentSuggester.suggest(pages, today: day(2026, 9, 29), calendar: calendar)[0]
        #expect(suggestion.pageIDs == pages.map(\.id))
        #expect(suggestion.evidence.first == .pageMarker("Pagina 1 din 2"))
    }

    @Test func titleThatYieldsNoSlugIsNotClaimed() {
        let pages = [page(line("ПРИВЕТ МИР", y: 0.2, height: 0.03), captured: day(2026, 9, 26))]
        let suggestion = DocumentSuggester.suggest(pages, today: day(2026, 9, 29), calendar: calendar)[0]
        #expect(suggestion.name == "2026-09-26_Document-1")
        #expect(!suggestion.evidence.contains { if case .title = $0 { true } else { false } })
    }
}
