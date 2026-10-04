import { describe, expect, it } from "vitest";
import { dates, group, latestDate, marker, type PageText, repeatedHeaderLines, slug, suggest, type TextLine, title } from "../../src/scan/suggest";

let next = 0;
const line = (text: string, y: number, { x = 0.1, width = 0.5, height = 0.015, confidence = 1 } = {}): TextLine => ({ text, box: { x, y, width, height }, confidence });
const page = (lines: TextLine[], captureDay?: string): PageText => ({ id: `p${++next}`, lines, captureDay });
const centered = (number: string) => line(number, 0.95, { x: 0.49, width: 0.02 });

/** Translated from DocumentSuggesterTests.swift and NameFormattingTests.swift, case by case. */
describe("document suggestions", () => {
  it("reads page markers", () => {
    expect(marker(page([line("Raport generat în data de 15.06.2026   Pagina 2 din 3", 0.95)]))).toEqual({ index: 2, total: 3, text: "Pagina 2 din 3" });
    expect(marker(page([line("Page 1 of 2", 0.03)]))?.total).toBe(2);
    expect(marker(page([line("Page 3 sur 4", 0.95)]))?.index).toBe(3);
    expect(marker(page([line("1 / 2", 0.95)]))).toEqual({ index: 1, total: 2, text: "1 / 2" });
    expect(marker(page([centered("3")]))).toEqual({ index: 3, total: null, text: "3" });
  });

  it("reads the markers as Tesseract writes them: a missing space, or words before them on the line", () => {
    expect(marker(page([line("Raport generat în data de 15.06.2026 Pagina 2 din3", 0.95)]))).toEqual({ index: 2, total: 3, text: "Pagina 2 din3" });
    expect(marker(page([line("Motiv: Semnare document 2/2", 0.89)]))).toEqual({ index: 2, total: 2, text: "2/2" });
    expect(marker(page([line("Ordin 377/2024", 0.95)]))).toBeNull();
  });

  it("ignores what is not a marker", () => {
    expect(marker(page([line("3", 0.95, { x: 0.05, width: 0.02 })]))).toBeNull();
    expect(marker(page([line("08/07/2026", 0.95)]))).toBeNull();
    expect(marker(page([line("Pagina 1 din 3", 0.5)]))).toBeNull();
    expect(marker(page([line("3 / 2", 0.95)]))).toBeNull();
  });

  it("groups pages whose markers follow, and a new first page starts a new document", () => {
    const pages = [
      page([line("1 / 2", 0.95)]), page([line("2 / 2", 0.95)]), page([line("Factura", 0.1)]),
      page([line("Pagina 1 din 3", 0.96)]), page([line("Pagina 2 din 3", 0.96)]), page([line("Pagina 3 din 3", 0.96)]),
      page([centered("1")]), page([centered("2")]),
    ];
    expect(group(pages).map((each) => each.length)).toEqual([2, 1, 3, 2]);
    expect(group([page([line("1 / 1", 0.95)]), page([line("1 / 2", 0.95)]), page([line("2 / 2", 0.95)])]).map((each) => each.length)).toEqual([1, 2]);
  });

  it("picks the latest date not after the photo, and skips validity and expiry dates", () => {
    const issued = [page([line("emis la data de 05.02.2019", 0.3), line("valabil până la data de 30.11.2030", 0.32), line("Termen: 01.10.2026", 0.34), line("azi 14.07.2026", 0.8)])];
    expect(latestDate(issued, "2026-09-26")?.text).toBe("14.07.2026");
    expect(latestDate([page([line("Data emiterii: 03.08.2026", 0.6), line("Oferta este valabilă până la data 11.09.2026", 0.62)])], "2026-09-26")?.text).toBe("03.08.2026");
    expect(latestDate([page([line("Issued 02/09/2026", 0.3), line("Valid until 20/09/2026", 0.32)])], "2026-09-26")?.text).toBe("02/09/2026");
    expect(latestDate([page([line("Issued 02/09/2026", 0.3), line("Document validat la 05/09/2026", 0.32)])], "2026-09-26")?.text).toBe("05/09/2026");
  });

  it("reads the three date formats, and rejects impossible and old dates", () => {
    expect(dates("DIN 08/07/2026-09:45:00").map((found) => found.text)).toEqual(["08/07/2026"]);
    expect(dates("Nr.: 1234567/03.08.2026").map((found) => found.text)).toEqual(["03.08.2026"]);
    expect(dates("exported 2026-09-21").map((found) => found.text)).toEqual(["2026-09-21"]);
    expect(dates("31.02.2026")).toEqual([]);
    expect(latestDate([page([line("12.05.1985", 0.5)])], "2026-09-26")).toBeNull();
  });

  it("takes for title the tallest header line that is not repeated across documents", () => {
    const header = line("MINISTERUL JUSTITIEI", 0.05, { height: 0.03 });
    const groups = [[page([header, line("RAPORT ANUAL", 0.2, { height: 0.025 })])], [page([header, line("ADEVERINTA", 0.25, { height: 0.02 })])]];
    const repeated = repeatedHeaderLines(groups);
    expect([title(groups[0]![0]!, repeated), title(groups[1]![0]!, repeated)]).toEqual(["RAPORT ANUAL", "ADEVERINTA"]);
    const logo = line("IQNET", 0.1, { x: 0.8, width: 0.1, height: 0.04, confidence: 0.3 });
    const body = line("declar pe propria raspundere in conformitate cu prevederile legii", 0.3, { width: 0.8, height: 0.03 });
    expect(title(page([logo, body, line("RAPORT ANUAL", 0.25, { height: 0.02 })]), new Set())).toBe("RAPORT ANUAL");
    const invoice = page([line("12345 / 2026", 0.1, { height: 0.05 }), line("Factura", 0.2, { height: 0.02 }), line("TOTAL DE PLATA", 0.7, { height: 0.04 })]);
    expect(title(invoice, new Set())).toBe("Factura");
  });

  it("keeps a title shared by two documents of a big batch", () => {
    const header = line("MINISTERUL JUSTITIEI", 0.05, { height: 0.03 });
    const groups = Array.from({ length: 9 }, (_, index) => [page([header, line(index < 2 ? "FACTURA" : `ADEVERINTA ${index}`, 0.2, { height: 0.02 })])]);
    const repeated = repeatedHeaderLines(groups);
    expect([title(groups[0]![0]!, repeated), title(groups[1]![0]!, repeated)]).toEqual(["FACTURA", "FACTURA"]);
  });

  it("names documents with their date and title, or a numbered fallback", () => {
    const [named] = suggest([page([line("RAPORT ANUAL", 0.2, { height: 0.025 }), line("Eliberat la data: 16.06.2026", 0.6)], "2026-09-26")], "2026-09-29");
    expect(named).toMatchObject({ name: "2026-06-16_Raport-anual", evidence: [{ kind: "date", text: "16.06.2026" }, { kind: "title", text: "RAPORT ANUAL" }] });
    expect(suggest([page([], "2026-09-26"), page([])], "2026-09-29").map((each) => each.name)).toEqual(["2026-09-26_Document-1", "2026-09-29_Document-2"]);
    const pages = [page([line("Pagina 1 din 2", 0.96)]), page([line("Pagina 2 din 2", 0.96)])];
    const [kept] = suggest(pages, "2026-09-29");
    expect([kept?.pageIds, kept?.evidence[0]]).toEqual([pages.map((each) => each.id), { kind: "pageMarker", text: "Pagina 1 din 2" }]);
    expect(suggest([page([line("ПРИВЕТ МИР", 0.2, { height: 0.03 })], "2026-09-26")], "2026-09-29")[0]).toMatchObject({ name: "2026-09-26_Document-1", evidence: [] });
  });

  it("makes a slug of ASCII words, only the first capitalized", () => {
    expect(slug("INFORMAȚII PUNCTUALE")).toBe("Informatii-punctuale");
    expect(slug("a/b c d e f g h")).toBe("A-b-c-d-e-f");
    expect(slug("ПРИВЕТ")).toBe("");
  });
});
