import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strFromU8, unzipSync } from "fflate";
import { beforeAll, describe, expect, it } from "vitest";
import { closeDoc, openPdf } from "../../src/engine/documents";
import type { Pdfium } from "../../src/engine/pdfium";
import { pixelizePdf } from "../../src/engine/pixelize";
import { transformPdf } from "../../src/engine/transform";
import { wordOf } from "../../src/engine/word";
import { encodeTestJpeg, gradientJpeg, loadTestPdfium, photoPdf, rawPdf, textPdf } from "./support";
import { docxOf } from "../../src/engine/docx";

let p: Pdfium;
beforeAll(async () => {
  p = await loadTestPdfium();
});

/** One A4 page drawing `content` with Helvetica (F1), Helvetica-Bold (F2) and Times-Italic (F3). */
function contentPdf(content: string): Uint8Array {
  return rawPdf([
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R/F2 6 0 R/F3 7 0 R>>>>>>",
    `<</Length ${content.length}>>stream\n${content}\nendstream`,
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold>>",
    "<</Type/Font/Subtype/Type1/BaseFont/Times-Italic>>",
  ]);
}

async function word(bytes: Uint8Array) {
  const doc = openPdf(p, bytes);
  try {
    return await wordOf(p, doc, encodeTestJpeg);
  } finally {
    closeDoc(p, doc);
  }
}

function parts(docx: Uint8Array) {
  const files = unzipSync(docx);
  const xml = strFromU8(files["word/document.xml"]!);
  const paragraphs = [...xml.matchAll(/<w:p>([\s\S]*?)<\/w:p>/g)].map(([, body = ""]) => ({
    text: [...body.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(([, text]) => text).join(""),
    body,
  }));
  return { files, xml, paragraphs };
}

describe("PDF to Word", () => {
  it("keeps each run's font, size, weight and slant", async () => {
    const { paragraphs } = parts(await word(contentPdf(
      "BT /F1 1 Tf 12 0 0 12 72 700 Tm (Plain text) Tj ET BT /F2 18 Tf 72 640 Td (Bold title) Tj ET BT /F3 11 Tf 72 580 Td (Italic words) Tj ET",
    )));
    expect(paragraphs.map((paragraph) => paragraph.text)).toEqual(["Plain text", "Bold title", "Italic words"]);
    const [plain, bold, italic] = paragraphs.map((paragraph) => paragraph.body);
    expect(plain).toMatch(/w:ascii="Arial".*<w:sz w:val="24"\/>/);
    expect(plain).not.toMatch(/<w:b\/>|<w:i\/>/);
    expect(bold).toMatch(/<w:b\/>.*<w:sz w:val="36"\/>/);
    expect(italic).toMatch(/w:ascii="Times New Roman".*<w:i\/>.*<w:sz w:val="22"\/>/);
  });

  it("joins the lines of a paragraph, and starts another after a sentence on a short line, a gap or a bullet", async () => {
    const lines = [
      [700, "The first paragraph starts on this line and runs to the margin"],
      [686, "and ends on this shorter line."],
      [672, "A second one follows at once."],
      [620, "A third one comes after a gap, and its text is ragged: this"],
      [606, "line stops short"],
      [592, "without ending a sentence."],
      [578, "\xb7 A point"],
      [564, "\xb7 Another point"],
    ] as const;
    const { paragraphs } = parts(await word(contentPdf(lines.map(([y, text]) => `BT /F1 12 Tf 72 ${y} Td (${text}) Tj ET`).join(" "))));
    expect(paragraphs.map((paragraph) => paragraph.text)).toEqual([
      "The first paragraph starts on this line and runs to the margin and ends on this shorter line.",
      "A second one follows at once.",
      "A third one comes after a gap, and its text is ragged: this line stops short without ending a sentence.",
      "• A point",
      "• Another point",
    ]);
  });

  it("reads two columns one after the other, each in its own paragraph", async () => {
    const column = (x: number, words: string[]) => words.map((text, index) => `BT /F1 10 Tf ${x} ${700 - index * 12} Td (${text}) Tj ET`).join(" ");
    const { paragraphs } = parts(await word(contentPdf(`${column(72, ["Left column starts here", "and keeps going to its", "last line."])} ${column(320, ["Right column starts", "here and ends on its", "last line."])}`)));
    expect(paragraphs.map((paragraph) => paragraph.text)).toEqual([
      "Left column starts here and keeps going to its last line.",
      "Right column starts here and ends on its last line.",
    ]);
  });

  it("puts each page on a page of its own, at the size of the first", async () => {
    const { xml, paragraphs } = parts(await word(textPdf(p, ["One", "Two"])));
    expect(paragraphs.filter((paragraph) => paragraph.text).map((paragraph) => paragraph.text)).toEqual(["One", "Two"]);
    expect(xml.match(/w:type="page"/g)).toHaveLength(1);
    expect(xml).toContain('<w:pgSz w:w="11906" w:h="16838"/>');
  });

  it("places a picture where it stands on the page, as wide as the text at most", async () => {
    const { files, paragraphs } = parts(await word(photoPdf(p, ["Label"], { width: 400, height: 200 })));
    expect(Object.keys(files).filter((name) => name.startsWith("word/media/"))).toEqual(["word/media/image1.jpeg"]);
    expect(paragraphs.map((paragraph) => (paragraph.body.includes("<w:drawing>") ? "picture" : paragraph.text))).toEqual(["picture", "Label"]);
    const [, width] = /<wp:extent cx="(\d+)"/.exec(paragraphs[0]!.body) ?? [];
    expect(Number(width) / 12700).toBeCloseTo(595.28 - 144, 0);
  });

  it("narrows its margins on a small page, so a picture keeps a width", () => {
    const { xml, paragraphs } = parts(docxOf([{ width: 100, height: 80, blocks: [{ kind: "picture", jpeg: gradientJpeg, width: 48, height: 32 }] }]));
    expect(xml).toContain('<w:pgMar w:top="400" w:right="400" w:bottom="400" w:left="400"');
    const [, width] = /<wp:extent cx="(\d+)"/.exec(paragraphs[0]!.body) ?? [];
    expect(Number(width) / 12700).toBeGreaterThan(0);
    expect(Number(width) / 12700).toBeLessThanOrEqual(60);
  });

  it("keeps a scan's picture when it is all the page holds, and leaves it out behind the text read in it", async () => {
    const scanned = openPdf(p, textPdf(p, ["Hello"]));
    const scan = await pixelizePdf(p, scanned, 72, encodeTestJpeg);
    closeDoc(p, scanned);
    const read = openPdf(p, scan);
    const withText = transformPdf(p, read, { kind: "ocr", pages: [{ pageIndex: 0, lines: [{ text: "Hello", x: 0.1, y: 0.4, width: 0.5, height: 0.1 }] }] });
    closeDoc(p, read);
    const kinds = (bytes: Uint8Array) => parts(bytes).paragraphs.map((paragraph) => (paragraph.body.includes("<w:drawing>") ? "picture" : paragraph.text));
    expect(kinds(await word(scan))).toEqual(["picture"]);
    expect(kinds(await word(withText))).toEqual(["Hello"]);
  });

  it.skipIf(!existsSync("/usr/bin/textutil"))("makes a file that a Word reader opens", async () => {
    const file = join(mkdtempSync(join(tmpdir(), "word-")), "out.docx");
    writeFileSync(file, await word(contentPdf("BT /F2 18 Tf 72 640 Td (Bold title) Tj ET BT /F1 12 Tf 72 600 Td (R&D <costs> \"quoted\") Tj ET")));
    expect(execFileSync("/usr/bin/textutil", ["-convert", "txt", "-stdout", file]).toString()).toMatch(/Bold title\s+R&D <costs> "quoted"/);
  });
});
