import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { beforeAll, describe, expect, it } from "vitest";
import { closeDoc, openPdf } from "../../src/engine/documents";
import { textCounts } from "../../src/engine/pageText";
import type { Pdfium } from "../../src/engine/pdfium";
import { renderPage } from "../../src/engine/render";
import { transformPdf } from "../../src/engine/transform";
import type { OcrLine } from "../../src/engine/types";
import { loadTestPdfium, rawPdf } from "./support";

let p: Pdfium;
beforeAll(async () => {
  p = await loadTestPdfium();
});

const blankPdf = (rotation = 0) => rawPdf([
  "<</Type/Catalog/Pages 2 0 R>>",
  "<</Type/Pages/Kids[3 0 R]/Count 1>>",
  `<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 400]/Rotate ${rotation}>>`,
]);

const line = (change: Partial<OcrLine> = {}): OcrLine => ({ text: "Hello world", x: 0.1, y: 0.2, width: 0.5, height: 0.05, ...change });

function withText(bytes: Uint8Array, lines: OcrLine[]) {
  const doc = openPdf(p, bytes);
  try {
    return transformPdf(p, doc, { kind: "ocr", pages: [{ pageIndex: 0, lines }] });
  } finally {
    closeDoc(p, doc);
  }
}

/** Each text item of page 1 with its box, in fractions of the page as the reader sees it. */
async function items(bytes: Uint8Array) {
  const task = getDocument({ data: bytes.slice(), verbosity: 0 });
  const page = await (await task.promise).getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const found = (await page.getTextContent()).items.flatMap((item) => {
    if (!("str" in item) || !item.str.trim()) return [];
    const [a = 0, b = 0, , , e = 0, f = 0] = item.transform;
    const [x0, y0] = viewport.convertToViewportPoint(e, f);
    const [x1, y1] = viewport.convertToViewportPoint(e + a * item.width / Math.hypot(a, b), f + b * item.width / Math.hypot(a, b));
    return [{ text: item.str, x: Math.min(x0!, x1!) / viewport.width, bottom: Math.max(y0!, y1!) / viewport.height, length: Math.hypot(x1! - x0!, y1! - y0!) / viewport.width }];
  });
  await task.destroy();
  return found;
}

describe("ocr text layer", () => {
  it("writes each line where the reader sees it, as wide as the line, whatever the page's rotation", async () => {
    for (const rotation of [0, 90, 180, 270]) {
      const [item] = await items(withText(blankPdf(rotation), [line()]));
      expect(item?.text, `rotation ${rotation}`).toBe("Hello world");
      expect(item!.x, `rotation ${rotation}`).toBeCloseTo(0.1, 1);
      expect(item!.bottom, `rotation ${rotation}`).toBeGreaterThan(0.2);
      expect(item!.bottom, `rotation ${rotation}`).toBeLessThan(0.26);
      expect(item!.length, `rotation ${rotation}`).toBeCloseTo(0.5, 1);
    }
  });

  it("leaves the page looking the same: the text is invisible", () => {
    const doc = openPdf(p, withText(blankPdf(), [line({ height: 0.2 })]));
    const { pixels } = renderPage(p, doc, 0, 150);
    closeDoc(p, doc);
    expect(pixels.every((value) => value > 250)).toBe(true);
  });

  it("keeps the accents and signs its font can write, and the letters under the others", async () => {
    const lines = [line({ text: "Élève’s œuvre – 10 €" }), line({ text: "București", y: 0.5 }), line({ text: "   ", y: 0.7 })];
    expect((await items(withText(blankPdf(), lines))).map((item) => item.text)).toEqual(["Élève’s œuvre – 10 €", "Bucuresti"]);
  });

  it("counts the characters each page already holds", () => {
    const text = "BT /F1 12 Tf 20 300 Td (Text) Tj ET";
    const doc = openPdf(p, rawPdf([
      "<</Type/Catalog/Pages 2 0 R>>",
      "<</Type/Pages/Kids[3 0 R 5 0 R]/Count 2>>",
      "<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 400]/Contents 4 0 R/Resources<</Font<</F1 6 0 R>>>>>>",
      `<</Length ${text.length}>>stream\n${text}\nendstream`,
      "<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 400]>>",
      "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    ]));
    expect(textCounts(p, doc.handle)).toEqual([4, 0]);
    closeDoc(p, doc);
  });
});
