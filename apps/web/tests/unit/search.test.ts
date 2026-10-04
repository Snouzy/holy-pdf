import { describe, expect, it } from "vitest";
import { searchTools, type SearchEntry } from "../../src/home/search";
import { dictionaries, searchTexts } from "../../src/i18n";
import { upcomingIds } from "../../src/cast";
import { type Lang, languages, toolIds } from "../../src/tools";

const entries: SearchEntry[] = [
  { id: "merge", ready: true, names: ["Fusionner des PDF", "Frère Agrafe"], terms: ["assembler", "combiner", "joindre"] },
  { id: "compress", ready: true, names: ["Compresser un PDF"], terms: ["réduire", "alléger", "trop lourd"] },
  { id: "jpg-to-pdf", ready: true, names: ["Convertir des JPG en PDF", "JPG en PDF"], terms: ["image", "photo"] },
  { id: "pdf-to-jpg", ready: true, names: ["Convertir un PDF en JPG", "PDF en JPG"], terms: ["image", "photo"] },
  { id: "pdf-to-word", ready: false, names: ["PDF en Word"], terms: ["docx", "éditable"] },
];
const ids = (query: string) => searchTools(query, entries).map((match) => match.id);

describe("searchTools", () => {
  it("finds a tool by a synonym, and says which", () => {
    expect(searchTools("réduire", entries)[0]).toMatchObject({ id: "compress", via: "réduire" });
  });

  it("ignores accents and capitals", () => {
    expect(ids("REDUIRE")).toEqual(["compress"]);
  });

  it("finds a word still being typed", () => {
    expect(ids("fusi")).toEqual(["merge"]);
  });

  it("forgives one typo from four letters, two from seven", () => {
    expect(ids("redure")).toEqual(["compress"]);
    expect(ids("comprsser")).toEqual(["compress"]);
    expect(ids("asembelr")).toEqual(["merge"]);
  });

  it("forgives typos only when no tool matches every word exactly or by its start", () => {
    const close: SearchEntry[] = [
      { id: "convertir", ready: true, names: ["Convertir"], terms: [] },
      { id: "concatener", ready: true, names: ["Concaténer"], terms: [] },
    ];
    expect(searchTools("conv", close).map((match) => match.id)).toEqual(["convertir"]);
  });

  it("forgives two letters swapped", () => {
    expect(ids("fsuionner")).toEqual(["merge"]);
  });

  it("ignores a word no tool knows, when another word matches", () => {
    expect(ids("réduire excel")).toEqual(["compress"]);
  });

  it("finds nothing when no word of the query matches", () => {
    expect(ids("excel tableur")).toEqual([]);
  });

  it("returns every tool, in order, for an empty query or stop words only", () => {
    expect(ids("")).toEqual(entries.map((entry) => entry.id));
    expect(ids("  un pdf ")).toEqual(entries.map((entry) => entry.id));
  });

  it("waits while the last word is a stop word being typed, unless it already finds something", () => {
    expect(ids("pd")).toEqual(entries.map((entry) => entry.id));
    expect(ids("fusionner pd")).toEqual(["merge"]);
    expect(ids("doc")).toEqual(["pdf-to-word"]);
  });

  it("finds nothing for a tool that does not exist", () => {
    expect(ids("excel")).toEqual([]);
  });

  it("tells the direction of a conversion by the order of the words", () => {
    expect(ids("pdf en jpg")[0]).toBe("pdf-to-jpg");
    expect(ids("jpg en pdf")[0]).toBe("jpg-to-pdf");
  });

  it("finds a tool by its monk", () => {
    expect(ids("agrafe")).toEqual(["merge"]);
  });

  it("puts ready tools before tools to come for the same words", () => {
    const both: SearchEntry[] = [
      { id: "sleeping", ready: false, names: ["Texte"], terms: [] },
      { id: "ready", ready: true, names: ["Texte"], terms: [] },
    ];
    expect(searchTools("texte", both).map((match) => match.id)).toEqual(["ready", "sleeping"]);
  });
});

/** The index as `src/pages/[lang]/search.json.ts` builds it. */
function builtIndex(lang: Lang): SearchEntry[] {
  const t = dictionaries[lang];
  const search = searchTexts[lang];
  return [
    ...toolIds.map((id) => ({ id, ready: true, names: [t.toolNames[id], t.toolShort[id], t.monks[id].name], terms: search.terms[id] })),
    ...upcomingIds.map((id) => ({ id, ready: false, names: [t.upcoming[id]], terms: search.terms[id] })),
  ];
}

describe("searchTools on the built index", () => {
  it.each([
    ["fr", "compresser pdf gratuit", "compress"],
    ["fr", "compresser un pdf gratuitement", "compress"],
    ["fr", "comment compresser un pdf", "compress"],
    ["fr", "fusionner deux pdf", "merge"],
    ["fr", "signer un pdf", "sign"],
    ["fr", "tourner les pages", "rotate"],
    ["fr", "convertir un pdf en jpg gratuit", "pdf-to-jpg"],
    ["fr", "pdf en jpg en ligne", "pdf-to-jpg"],
    ["fr", "transformer pdf en jpg", "pdf-to-jpg"],
    ["fr", "convertir pdf en jpg", "pdf-to-jpg"],
    ["fr", "convertir pdf en photos", "pdf-to-jpg"],
    ["fr", "jpg en pdf", "jpg-to-pdf"],
    ["en", "compress pdf free", "compress"],
    ["en", "sign a pdf", "sign"],
    ["en", "compress pdf online", "compress"],
    ["en", "combine two pdfs", "merge"],
    ["en", "rotate pages", "rotate"],
    ["en", "make pdf smaller", "compress"],
    ["en", "pdf to jpg online", "pdf-to-jpg"],
    ["en", "convert pdf to image", "pdf-to-jpg"],
    ["en", "convert pdf to photos", "pdf-to-jpg"],
    ["en", "jpg to pdf", "jpg-to-pdf"],
  ] as const)("%s: « %s » puts %s first", (lang, query, id) => {
    expect(searchTools(query, builtIndex(lang))[0]?.id).toBe(id);
  });
});

describe("the word lists", () => {
  it.each(languages)("give every tool, ready or to come, at least five words in %s", (lang) => {
    for (const id of [...toolIds, ...upcomingIds]) expect(searchTexts[lang].terms[id].length).toBeGreaterThanOrEqual(5);
  });
});
