import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { beforeAll, describe, expect, it } from "vitest";
import { stretched } from "../../src/crop/box";
import { closeDoc, openPdf } from "../../src/engine/documents";
import type { Pdfium } from "../../src/engine/pdfium";
import { renderPage } from "../../src/engine/render";
import { transformPdf } from "../../src/engine/transform";
import type { Box } from "../../src/engine/types";
import { loadTestPdfium, rawPdf, readWithPdfjs, textPdf } from "./support";

let p: Pdfium;
beforeAll(async () => {
  p = await loadTestPdfium();
});

const square = "0 g 100 600 50 50 re f";
const pages = (...boxes: string[]) => rawPdf([
  "<</Type/Catalog/Pages 2 0 R>>",
  `<</Type/Pages/Kids[${boxes.map((_, index) => `${3 + index * 2} 0 R`).join(" ")}]/Count ${boxes.length}>>`,
  ...boxes.flatMap((box, index) => [`<</Type/Page/Parent 2 0 R${box}/Contents ${4 + index * 2} 0 R>>`, `<</Length ${square.length}>>stream\n${square}\nendstream`]),
]);
const half: Box = { x: 0.1, y: 0.1, width: 0.5, height: 0.5 };

function cropped(bytes: Uint8Array, box: Box, page: number | null = null, password?: string): Uint8Array {
  const doc = openPdf(p, bytes, password);
  try {
    return transformPdf(p, doc, { kind: "crop", box, page });
  } finally {
    closeDoc(p, doc);
  }
}

async function views(bytes: Uint8Array): Promise<number[][]> {
  const task = getDocument({ data: bytes.slice(), verbosity: 0 });
  const doc = await task.promise;
  const read: number[][] = [];
  for (let number = 1; number <= doc.numPages; number++) read.push((await doc.getPage(number)).view.map(Math.round));
  await task.destroy();
  return read;
}

describe("crop", () => {
  it("keeps the zone drawn on every page, as the reader sees each page, rotation and an earlier crop included", async () => {
    const bytes = cropped(pages("/MediaBox[0 0 600 800]", "/MediaBox[0 0 600 800]/Rotate 90", "/MediaBox[0 0 600 800]/Rotate 270", "/MediaBox[0 0 600 800]/CropBox[100 100 500 700]"), half);
    expect(await views(bytes)).toEqual([[60, 320, 360, 720], [60, 80, 360, 480], [240, 320, 540, 720], [140, 340, 340, 640]]);
  });

  it("crops the page shown only, when asked", async () => {
    const bytes = cropped(pages("/MediaBox[0 0 600 800]", "/MediaBox[0 0 600 800]"), half, 1);
    expect(await views(bytes)).toEqual([[0, 0, 600, 800], [60, 320, 360, 720]]);
  });

  it("keeps what lies in the zone at the same place in it", () => {
    const doc = openPdf(p, cropped(pages("/MediaBox[0 0 600 800]"), half));
    try {
      // The square, 100 to 150 across and 150 to 200 down the page, lies 40 to 90 across and 70 to 120 down the zone.
      const { pixels, width } = renderPage(p, doc, 0, 300);
      const grey = (x: number, y: number) => pixels[(y * width + x) * 4];
      expect([grey(45, 72), grey(85, 115), grey(20, 20), grey(120, 95)]).toEqual([0, 0, 255, 255]);
    } finally {
      closeDoc(p, doc);
    }
  });

  it("accepts a zone a handle pushed down to the smallest size", async () => {
    const smallest = stretched({ x: 0.1, y: 0.1, width: 0.15, height: 0.5 }, "w", { x: 1, y: 0.5 });
    expect((await views(cropped(pages("/MediaBox[0 0 600 800]"), smallest)))[0]?.[2]).toBe(150);
  });

  it("refuses a zone outside the page or too small, and a page the PDF does not have", () => {
    const bytes = pages("/MediaBox[0 0 600 800]");
    for (const box of [{ ...half, x: 0.6 }, { ...half, width: 0.001 }, { ...half, y: -0.1 }]) expect(() => cropped(bytes, box)).toThrow("damaged");
    expect(() => cropped(bytes, half, 1)).toThrow("damaged");
  });

  it("refuses a signed PDF, and keeps a protected one protected", async () => {
    const signed = rawPdf([
      "<</Type/Catalog/Pages 2 0 R/AcroForm<</Fields[4 0 R]/SigFlags 3>>>>",
      "<</Type/Pages/Count 1/Kids[3 0 R]>>",
      "<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Annots[4 0 R]>>",
      "<</Type/Annot/Subtype/Widget/FT/Sig/T(Signature)/Rect[0 0 1 1]/P 3 0 R/V 5 0 R>>",
      "<</Type/Sig/Filter/Adobe.PPKLite/SubFilter/adbe.pkcs7.detached/ByteRange[0 1 2 3]/Contents<00>>>",
    ]);
    expect(() => cropped(signed, half)).toThrow("alreadySigned");
    const locked = cropped(textPdf(p, ["A"], {}, "1234"), half, null, "1234");
    expect(() => openPdf(p, locked)).toThrow("passwordRequired");
    expect((await readWithPdfjs(locked, "1234"))[0]?.width).toBe(298);
  });
});
