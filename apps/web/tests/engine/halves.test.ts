import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { beforeAll, describe, expect, it } from "vitest";
import { closeDoc, openPdf } from "../../src/engine/documents";
import type { Pdfium } from "../../src/engine/pdfium";
import { transformPdf } from "../../src/engine/transform";
import { loadTestPdfium } from "./support";

let p: Pdfium;
beforeAll(async () => {
  p = await loadTestPdfium();
});

/** A landscape spread: « Left » on the left half, « Right » on the right half. */
function spread(): Uint8Array {
  const content = "BT /F1 24 Tf 60 300 Td (Left) Tj ET BT /F1 24 Tf 560 300 Td (Right) Tj ET";
  const bodies = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 842 595]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>",
    `<</Length ${content.length}>>stream\n${content}\nendstream`,
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
  ];
  let text = "%PDF-1.7\n";
  const offsets = [0];
  for (const [index, body] of bodies.entries()) {
    offsets.push(text.length);
    text += `${index + 1} 0 obj\n${body}\nendobj\n`;
  }
  const xref = text.length;
  text += `xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}`;
  text += `trailer\n<</Size ${offsets.length}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`;
  return Uint8Array.from(text, (char) => char.charCodeAt(0));
}

/** For each page: its size, and the words whose start lies inside it. */
async function visible(bytes: Uint8Array) {
  const task = getDocument({ data: bytes.slice(), verbosity: 0 });
  const doc = await task.promise;
  const pages = [];
  for (let number = 1; number <= doc.numPages; number++) {
    const page = await doc.getPage(number);
    const viewport = page.getViewport({ scale: 1 });
    const words = (await page.getTextContent()).items.flatMap((item) => {
      if (!("str" in item) || item.str.trim() === "") return [];
      const [x = -1, y = -1] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
      return x >= 0 && x <= viewport.width && y >= 0 && y <= viewport.height ? [item.str] : [];
    });
    pages.push({ size: [Math.round(viewport.width), Math.round(viewport.height)], words });
  }
  await task.destroy();
  return pages;
}

describe("split pages in half", () => {
  it("cuts a spread into its left and right halves, in that order", async () => {
    const doc = openPdf(p, spread());
    const halves = transformPdf(p, doc, { kind: "halves", cut: "vertical" });
    closeDoc(p, doc);
    expect(await visible(halves)).toEqual([{ size: [421, 595], words: ["Left"] }, { size: [421, 595], words: ["Right"] }]);
  });

  it("cuts across for a top and a bottom half", async () => {
    const doc = openPdf(p, spread());
    const halves = transformPdf(p, doc, { kind: "halves", cut: "horizontal" });
    closeDoc(p, doc);
    const pages = await visible(halves);
    expect(pages.map((page) => page.size)).toEqual([[842, 298], [842, 298]]);
    expect(pages.map((page) => page.words)).toEqual([["Left", "Right"], []]);
  });
});
