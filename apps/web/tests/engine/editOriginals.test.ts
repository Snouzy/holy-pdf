import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { beforeAll, describe, expect, it } from "vitest";
import { closeDoc, openPdf, savePdf } from "../../src/engine/documents";
import { fontCharsOf, pageFonts, pageObjects } from "../../src/engine/pageObjects";
import { malloc, type Pdfium } from "../../src/engine/pdfium";
import { renderPage } from "../../src/engine/render";
import { transformPdf } from "../../src/engine/transform";
import type { Box, OriginalEdit, PageFont, PageObjects } from "../../src/engine/types";
import { textWidth } from "../../src/engine/editMetrics";
import { loadTestPdfium, photoPdf, rawPdf, readWithPdfjs, textPdf } from "./support";

const fontsDir = createRequire(import.meta.url).resolve("pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf").replace(/LiberationSans-Regular\.ttf$/, "");
const liberation = (style: "Regular" | "Bold" | "Italic") => new Uint8Array(readFileSync(`${fontsDir}LiberationSans-${style}.ttf`));
const trueType = 2;

let p: Pdfium;
beforeAll(async () => {
  p = await loadTestPdfium();
});

/** Pages of 600 × 800 points, each with one line in an embedded TrueType font at 36 points, its origin at (100, 600). */
function embeddedPdf(labels: string[], style: "Regular" | "Bold" | "Italic" = "Regular"): Uint8Array {
  const doc = p.FPDF_CreateNewDocument();
  const bytes = liberation(style);
  const data = malloc(p, bytes.length);
  p.pdfium.HEAPU8.set(bytes, data);
  const font = p.FPDFText_LoadFont(doc, data, bytes.length, trueType, true);
  p.pdfium._free(data);
  labels.forEach((label, index) => {
    const page = p.FPDFPage_New(doc, index, 600, 800);
    const object = p.FPDFPageObj_CreateTextObj(doc, font, 36);
    const utf16 = malloc(p, (label.length + 1) * 2);
    p.pdfium.stringToUTF16(label, utf16, (label.length + 1) * 2);
    p.FPDFText_SetText(object, utf16);
    p.pdfium._free(utf16);
    p.FPDFPageObj_Transform(object, 1, 0, 0, 1, 100, 600);
    p.FPDFPage_InsertObject(page, object);
    p.FPDFPage_GenerateContent(page);
    p.FPDF_ClosePage(page);
  });
  p.FPDFFont_Close(font);
  const saved = savePdf(p, doc);
  p.FPDF_CloseDocument(doc);
  return saved;
}

function listed(bytes: Uint8Array, index = 0, edits: OriginalEdit[] = []): PageObjects {
  const doc = openPdf(p, bytes);
  try {
    return pageObjects(p, doc, index, edits, edits.some((edit) => edit.text !== undefined) ? fontCharsOf(p, doc.handle) : new Map());
  } finally {
    closeDoc(p, doc);
  }
}

function fontsOf(bytes: Uint8Array): Record<string, PageFont> {
  const doc = openPdf(p, bytes);
  try {
    return pageFonts(fontCharsOf(p, doc.handle));
  } finally {
    closeDoc(p, doc);
  }
}

const twoTexts = () => rawPdf([
  "<</Type/Catalog/Pages 2 0 R>>",
  "<</Type/Pages/Kids[3 0 R]/Count 1>>",
  "<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>",
  "<</Length 78>>stream\nBT /F1 24 Tf 50 700 Td (First) Tj ET BT /F1 24 Tf 50 600 Td (Second) Tj ET\nendstream",
  "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
]);

function applied(bytes: Uint8Array, edits: OriginalEdit[]): Uint8Array {
  const doc = openPdf(p, bytes);
  try {
    return transformPdf(p, doc, { kind: "edit", items: [], images: {}, edits });
  } finally {
    closeDoc(p, doc);
  }
}

/** The box of the dark pixels of the page as the reader sees it, at one pixel per point. */
function inked(bytes: Uint8Array, index = 0): Box | null {
  const doc = openPdf(p, bytes);
  try {
    const { pixels, width, height } = renderPage(p, doc, index, Math.round(doc.sizes[index]!.width));
    let [left, top, right, bottom] = [width, height, -1, -1];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (pixels[(y * width + x) * 4]! < 128) [left, top, right, bottom] = [Math.min(left, x), Math.min(top, y), Math.max(right, x), Math.max(bottom, y)];
      }
    }
    return right < 0 ? null : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
  } finally {
    closeDoc(p, doc);
  }
}

const near = (actual: Box, expected: Box, slack = 3) => Object.entries(expected).every(([key, value]) => Math.abs(actual[key as keyof Box] - value) <= slack);
const latin = (bytes: Uint8Array) => Buffer.from(bytes).toString("latin1");

async function firstItem(bytes: Uint8Array): Promise<{ text: string; x: number; y: number }> {
  const task = getDocument({ data: bytes.slice(), verbosity: 0 });
  const doc = await task.promise;
  const content = await (await doc.getPage(1)).getTextContent();
  await task.destroy();
  const item = content.items.find((each) => "str" in each && each.str.trim() !== "");
  if (!item || !("transform" in item)) throw new Error("no text");
  return { text: item.str, x: item.transform[4]!, y: item.transform[5]! };
}

describe("the objects of a page", () => {
  it("lists a text with its words, font and box as the reader sees the page, rotated or not", () => {
    for (const rotation of [0, 90]) {
      const bytes = textPdf(p, ["Hello"], { 0: rotation });
      const { objects, words } = listed(bytes);
      expect(objects).toHaveLength(1);
      expect(objects[0]).toMatchObject({ index: 0, kind: "text", text: "Hello", font: "Helvetica", family: "Helvetica", bold: false, italic: false, size: 120, color: [0, 0, 0] });
      expect(near(objects[0]!.box, inked(bytes)!)).toBe(true);
      expect(words.map((word) => word.text)).toEqual(["Hello"]);
      expect(near(words[0]!.box, objects[0]!.box, 4)).toBe(true);
      expect(fontsOf(bytes).Helvetica).toEqual({ embedded: false, chars: "Helo", usable: true });
    }
  });

  it("lists the objects as retouched, each under its original rank, and keeps a shading out", () => {
    const bytes = twoTexts();
    expect(listed(bytes).objects.map((object) => [object.index, object.text])).toEqual([[0, "First"], [1, "Second"]]);
    const box = listed(bytes).objects[1]!.box;
    const after = listed(bytes, 0, [{ pageIndex: 0, index: 0, deleted: true }, { pageIndex: 0, index: 1, text: "Second one", move: { x: 100, y: 0 } }]);
    expect(after.objects.map((object) => [object.index, object.text, Math.round(object.box.x - box.x)])).toEqual([[1, "Second one", 100]]);
    const shaded = rawPdf([
      "<</Type/Catalog/Pages 2 0 R>>",
      "<</Type/Pages/Kids[3 0 R]/Count 1>>",
      "<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Resources<</Shading<</Sh0<</ShadingType 2/ColorSpace/DeviceRGB/Coords[0 0 600 0]/Function<</FunctionType 2/Domain[0 1]/C0[1 0 0]/C1[0 0 1]/N 1>>/Extend[true true]>>>>>>/Contents 4 0 R>>",
      "<</Length 28>>stream\nq 0 0 600 400 re W n /Sh0 sh Q\nendstream",
    ]);
    expect(listed(shaded).objects).toEqual([]);
  });

  it("tells the fonts a correction must not keep: unnamed, symbolic, or shared by embedded and not", () => {
    expect(pageFonts(new Map([
      ["", { embedded: true, symbolic: false, mixed: false, chars: new Set("ab") }],
      ["Symbol", { embedded: false, symbolic: true, mixed: false, chars: new Set("ab") }],
      ["Arial", { embedded: true, symbolic: false, mixed: true, chars: new Set("ab") }],
      ["Wingdings", { embedded: true, symbolic: true, mixed: false, chars: new Set("ab") }],
    ]))).toEqual({
      "": { embedded: true, chars: "ab", usable: false },
      Symbol: { embedded: false, chars: "ab", usable: false },
      Arial: { embedded: true, chars: "ab", usable: false },
      Wingdings: { embedded: true, chars: "ab", usable: true },
    });
  });

  it("leaves out invisible text, and tells words and lines apart", () => {
    const content = "BT /F1 24 Tf 3 Tr 50 700 Td (Hidden) Tj ET BT /F1 24 Tf 0 Tr 50 600 Td (Hello big world) Tj 0 -40 Td (Second line) Tj ET";
    const bytes = rawPdf([
      "<</Type/Catalog/Pages 2 0 R>>",
      "<</Type/Pages/Kids[3 0 R]/Count 1>>",
      "<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>",
      `<</Length ${content.length}>>stream\n${content}\nendstream`,
      "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    ]);
    const { objects, words } = listed(bytes);
    expect(objects.map((object) => object.text)).toEqual(["Hello big world", "Second line"]);
    // The words keep the invisible text: on a scan, they are what a highlight can snap to.
    expect(words.map((word) => [word.text, word.line])).toEqual([["Hidden", 0], ["Hello", 1], ["big", 1], ["world", 1], ["Second", 2], ["line", 2]]);
    expect(words[2]!.box.x).toBeGreaterThan(words[1]!.box.x + words[1]!.box.width);
    expect(words[4]!.box.y).toBeGreaterThan(words[1]!.box.y + 30);
  });

  it("lists an image with the corners of its pixels", () => {
    const { objects } = listed(photoPdf(p, ["A"], { width: 40, height: 30 }));
    const image = objects.find((object) => object.kind === "image")!;
    expect(image.box).toMatchObject({ x: expect.closeTo(0, 1), y: expect.closeTo(0, 1), width: expect.closeTo(595.28, 1), height: expect.closeTo(446.46, 1) });
    expect(image.corners).toMatchObject({ topLeft: { x: expect.closeTo(0, 1), y: expect.closeTo(0, 1) }, topRight: { x: expect.closeTo(595.28, 1), y: expect.closeTo(0, 1) }, bottomLeft: { x: expect.closeTo(0, 1), y: expect.closeTo(446.46, 1) } });
  });

  it("gathers the letters the whole document writes with each embedded font", () => {
    const doc = openPdf(p, embeddedPdf(["abc", "xyz"]));
    try {
      const entries = [...fontCharsOf(p, doc.handle)];
      expect(entries).toHaveLength(1);
      const [name, font] = entries[0]!;
      expect(name).toContain("LiberationSans");
      expect({ embedded: font.embedded, chars: [...font.chars].sort().join("") }).toEqual({ embedded: true, chars: "abcxyz" });
    } finally {
      closeDoc(p, doc);
    }
  });
});

/** A page written glyph by glyph, as browsers print: each letter its own text object, words set apart by position only. */
function glyphPdf(lines: { text: string; x: number; y: number; size?: number; font?: string }[]): Uint8Array {
  const ops: string[] = [];
  for (const line of lines) {
    const size = line.size ?? 12;
    const bold = line.font === "F2";
    let x = line.x;
    for (const char of line.text) {
      // Each glyph advances by its own width, as a real generator lays them; a word gap is a space's width, with no space glyph set.
      if (char !== " ") ops.push(`BT /${line.font ?? "F1"} ${size} Tf ${x.toFixed(2)} ${line.y} Td (${char}) Tj ET`);
      x += textWidth(char, "Helvetica", bold, size);
    }
  }
  const content = ops.join("\n");
  return rawPdf([
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Resources<</Font<</F1 5 0 R/F2 6 0 R>>>>/Contents 4 0 R>>",
    `<</Length ${content.length}>>stream\n${content}\nendstream`,
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold>>",
  ]);
}

describe("a page written glyph by glyph", () => {
  it("lists a line of glyphs as one text, with the spaces its gaps mean, and keeps apart what differs", () => {
    const bytes = glyphPdf([
      { text: "Hello big world", x: 50, y: 700 },
      { text: "Total", x: 400, y: 700 },
      { text: "Bold", x: 50, y: 650, font: "F2" },
      { text: "Big", x: 100, y: 650, size: 18 },
    ]);
    const { objects } = listed(bytes);
    expect(objects.map((object) => [object.text, object.index, object.members?.length])).toEqual([["Hello big world", 0, 13], ["Total", 13, 5], ["Bold", 18, 4], ["Big", 22, 3]]);
    const line = objects[0]!;
    expect(line.box.x).toBeCloseTo(listed(bytes).objects[0]!.box.x, 5);
    expect(line.box.width).toBeGreaterThan(70);
  });

  it("keeps a page set word by word apart, and takes its lines from the original page, not from the retouched copy", () => {
    const words = (text: string, x: number, y: number) => {
      const ops: string[] = [];
      let at = x;
      for (const word of text.split(" ")) {
        ops.push(`BT /F1 12 Tf ${at.toFixed(2)} ${y} Td (${word}) Tj ET`);
        at += textWidth(`${word} `, "Helvetica", false, 12);
      }
      return ops.join("\n");
    };
    const content = `${words("Hello big world", 50, 700)}\n${words("Second line here", 50, 680)}`;
    const byWord = rawPdf([
      "<</Type/Catalog/Pages 2 0 R>>",
      "<</Type/Pages/Kids[3 0 R]/Count 1>>",
      "<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>",
      `<</Length ${content.length}>>stream\n${content}\nendstream`,
      "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    ]);
    expect(listed(byWord).objects.map((object) => object.text)).toEqual(["Hello", "big", "world", "Second", "line", "here"]);
    const twoLines = glyphPdf([{ text: "AB", x: 50, y: 700 }, { text: "CD", x: 300, y: 700 }]);
    const first = listed(twoLines).objects;
    expect(first.map((object) => object.text)).toEqual(["AB", "CD"]);
    // Carried right up to the second line, the first still is its own line.
    const carried = [{ pageIndex: 0, index: 0, move: { x: 300 - 50 - first[0]!.box.width - 1, y: 0 } }];
    expect(listed(twoLines, 0, carried).objects.map((object) => object.text)).toEqual(["AB", "CD"]);
  });

  it("moves, corrects and deletes a line of glyphs as one", async () => {
    const bytes = glyphPdf([{ text: "Hello world", x: 50, y: 700 }, { text: "Keep me", x: 50, y: 600 }]);
    const before = inked(bytes)!;
    const moved = applied(bytes, [{ pageIndex: 0, index: 0, move: { x: 100, y: 0 } }]);
    const lines = listed(moved).objects;
    expect(lines.map((object) => object.text)).toEqual(["Hello world", "Keep me"]);
    expect(lines[0]!.box.x - before.x).toBeCloseTo(100 + (listed(bytes).objects[0]!.box.x - before.x), 0);
    const corrected = applied(bytes, [{ pageIndex: 0, index: 0, text: "Goodbye" }]);
    expect(listed(corrected).objects.map((object) => [object.text, object.members?.length ?? 1])).toEqual([["Goodbye", 1], ["Keep me", 6]]);
    const read = (await readWithPdfjs(corrected))[0]?.text ?? "";
    expect([read.includes("Goodbye"), read.includes("Keep me"), read.includes("Hello")]).toEqual([true, true, false]);
    const deleted = applied(bytes, [{ pageIndex: 0, index: 0, deleted: true }]);
    expect(listed(deleted).objects.map((object) => object.text)).toEqual(["Keep me"]);
  });
});

describe("retouching the objects of a page", () => {
  it("moves a text where the reader sees it go, on a rotated page, and deletes another", async () => {
    const bytes = textPdf(p, ["Hello", "World"], { 0: 90 });
    const { objects } = listed(bytes);
    const box = objects[0]!.box;
    const moved = applied(bytes, [{ pageIndex: 0, index: 0, move: { x: 50, y: -40 } }, { pageIndex: 1, index: 0, deleted: true }]);
    expect(near(listed(moved).objects[0]!.box, { ...box, x: box.x + 50, y: box.y - 40 }, 0.5)).toBe(true);
    expect(near(inked(moved)!, { ...box, x: box.x + 50, y: box.y - 40 })).toBe(true);
    expect(inked(moved, 1)).toBeNull();
    expect((await readWithPdfjs(moved)).map((page) => page.text)).toEqual(["Hello", ""]);
  });

  it("scales an image from its box, and refuses an object the page does not have", () => {
    const bytes = photoPdf(p, ["A"], { width: 40, height: 30 });
    const image = listed(bytes).objects.find((object) => object.kind === "image")!;
    const smaller = { x: 100, y: 100, width: 200, height: 150 };
    const edited = applied(bytes, [{ pageIndex: 0, index: image.index, box: smaller }]);
    expect(near(listed(edited).objects.find((object) => object.kind === "image")!.box, smaller, 0.5)).toBe(true);
    expect(() => applied(bytes, [{ pageIndex: 0, index: 9, deleted: true }])).toThrow("damaged");
    expect(() => applied(bytes, [{ pageIndex: 3, index: 0, deleted: true }])).toThrow("damaged");
  });

  it("corrects a text in its own embedded font when the document already writes those letters, keeping its baseline", async () => {
    const bytes = embeddedPdf(["Hello World", "Page two"]);
    const before = await firstItem(bytes);
    const edited = applied(bytes, [{ pageIndex: 0, index: 0, text: "World Hello two" }]);
    expect(latin(edited)).not.toContain("/Helvetica");
    const after = await firstItem(edited);
    expect(after).toEqual({ text: "World Hello two", x: before.x, y: before.y });
  });

  it("switches to the closest standard font for a letter the embedded font may not have, bold and italic followed", async () => {
    for (const [style, standard] of [["Regular", "/Helvetica"], ["Bold", "/Helvetica-Bold"], ["Italic", "/Helvetica-Oblique"]] as const) {
      const bytes = embeddedPdf(["Hello World"], style);
      const before = await firstItem(bytes);
      const edited = applied(bytes, [{ pageIndex: 0, index: 0, text: "Hello 2026" }]);
      expect(latin(edited)).toContain(`/BaseFont${standard}`);
      const after = await firstItem(edited);
      expect(after.text).toBe("Hello 2026");
      expect([after.x, after.y]).toEqual([before.x, before.y]);
    }
  });

  it("writes any WinAnsi letter with a font that is not embedded, and deletes a text emptied out", async () => {
    const bytes = textPdf(p, ["Hello"]);
    // Short enough to stay on the page at 120 points: pdf.js reads nothing past the edge.
    const edited = applied(bytes, [{ pageIndex: 0, index: 0, text: "Été 20 €" }]);
    expect((await readWithPdfjs(edited))[0]?.text).toBe("Été 20 €");
    expect(inked(applied(bytes, [{ pageIndex: 0, index: 0, text: "  " }]))).toBeNull();
    expect(() => applied(bytes, [{ pageIndex: 0, index: 0, text: "Iași" }])).toThrow("damaged");
  });

  it("carries an object's clip along when it moves", () => {
    const content = "q 40 580 400 80 re W n BT /F1 36 Tf 60 600 Td (Clipped) Tj ET Q";
    const bytes = rawPdf([
      "<</Type/Catalog/Pages 2 0 R>>",
      "<</Type/Pages/Kids[3 0 R]/Count 1>>",
      "<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>",
      `<</Length ${content.length}>>stream\n${content}\nendstream`,
      "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    ]);
    const box = listed(bytes).objects[0]!.box;
    const moved = applied(bytes, [{ pageIndex: 0, index: 0, move: { x: 0, y: 300 } }]);
    expect(near(inked(moved)!, { ...box, y: box.y + 300 })).toBe(true);
  });

  it("keeps the embedded font for a letter outside WinAnsi that the document writes, and refuses it in a standard font", async () => {
    const bytes = embeddedPdf(["Iași"]);
    expect((await readWithPdfjs(applied(bytes, [{ pageIndex: 0, index: 0, text: "Iaș" }])))[0]?.text).toBe("Iaș");
    expect(() => applied(bytes, [{ pageIndex: 0, index: 0, text: "Iaș!" }])).toThrow("damaged");
  });

  it("writes a corrected text on one line", async () => {
    const edited = applied(textPdf(p, ["Hello"]), [{ pageIndex: 0, index: 0, text: "Hi\nyou" }]);
    expect((await readWithPdfjs(edited))[0]?.text).toBe("Hi you");
  });

  it("carries a corrected text by the offset given, whatever its glyphs' height, and names its original font", () => {
    const bytes = embeddedPdf(["ace"]);
    const first = listed(bytes).objects[0]!;
    const edits: OriginalEdit[] = [{ pageIndex: 0, index: 0, text: "Ace 2026", move: { x: 20, y: 30 } }];
    const after = listed(applied(bytes, edits)).objects[0]!;
    expect([after.text, after.baseline!.x - first.baseline!.x, after.baseline!.y - first.baseline!.y]).toEqual(["Ace 2026", 20, 30]);
    expect(latin(applied(bytes, edits))).toContain("/BaseFont/Helvetica");
    expect(listed(bytes, 0, edits).objects[0]!.font).toContain("LiberationSans");
  });
});
