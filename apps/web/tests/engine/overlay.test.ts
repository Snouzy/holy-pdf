import { beforeAll, describe, expect, it } from "vitest";
import { closeDoc, openPdf } from "../../src/engine/documents";
import { overlaid } from "../../src/engine/overlay";
import type { Pdfium } from "../../src/engine/pdfium";
import { renderPage } from "../../src/engine/render";
import { loadTestPdfium, rawPdf, readWithPdfjs, textPdf } from "./support";

let p: Pdfium;
beforeAll(async () => {
  p = await loadTestPdfium();
});

function drawn(pages: { content: string; width?: number; height?: number; rotate?: number }[]): Uint8Array {
  const kids = pages.map((_, index) => `${3 + index * 2} 0 R`).join(" ");
  const font = 3 + pages.length * 2;
  return rawPdf([
    "<</Type/Catalog/Pages 2 0 R>>",
    `<</Type/Pages/Kids[${kids}]/Count ${pages.length}>>`,
    ...pages.flatMap(({ content, width = 595, height = 842, rotate = 0 }, index) => [
      `<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${width} ${height}]/Rotate ${rotate}/Contents ${4 + index * 2} 0 R/Resources<</Font<</F1 ${font} 0 R>>>>>>`,
      `<</Length ${content.length}>>stream\n${content}\nendstream`,
    ]),
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
  ]);
}

function overlay(base: Uint8Array, layer: Uint8Array, under: boolean): Uint8Array {
  const [doc, top] = [openPdf(p, base), openPdf(p, layer)];
  try {
    return overlaid(p, doc, top, under);
  } finally {
    closeDoc(p, doc);
    closeDoc(p, top);
  }
}

/** The grey level at a fraction of the page as the reader sees it, from 0 (black) to 255 (white). */
function grey(bytes: Uint8Array, x: number, y: number, index = 0): number {
  const doc = openPdf(p, bytes);
  const { pixels, width, height } = renderPage(p, doc, index, 200);
  closeDoc(p, doc);
  return pixels[(Math.floor(y * height) * width + Math.floor(x * width)) * 4]!;
}

const black = (width: number, height: number) => `0 g 0 0 ${width} ${height} re f`;

describe("overlay", () => {
  it("lays page for page, then the last page of the layer on every page left, keeping both texts", async () => {
    const pages = await readWithPdfjs(overlay(textPdf(p, ["A", "B", "C"]), textPdf(p, ["X", "Y"]), false));
    expect(pages.map((page) => [...page.text].sort().join(""))).toEqual(["AX", "BY", "CY"]);
  });

  it("covers the page when laid over it, and shows only where the page paints nothing when laid under it", () => {
    // The page paints its left half white; the layer is black all over.
    const base = drawn([{ content: "1 g 0 0 297 842 re f" }]);
    const layer = drawn([{ content: black(595, 842) }]);
    expect([grey(overlay(base, layer, false), 0.25, 0.5), grey(overlay(base, layer, false), 0.75, 0.5)]).toEqual([0, 0]);
    expect([grey(overlay(base, layer, true), 0.25, 0.5), grey(overlay(base, layer, true), 0.75, 0.5)]).toEqual([255, 0]);
  });

  it("fits the layer in the page and centres it, as the reader sees both, rotation included", () => {
    // A 300 × 400 layer on an A4 page: 595 wide and 793 high, 24.5 pt of white above and below.
    const base = drawn([{ content: "" }]);
    for (const layer of [drawn([{ content: black(300, 400), width: 300, height: 400 }]), drawn([{ content: black(400, 300), width: 400, height: 300, rotate: 90 }])]) {
      const bytes = overlay(base, layer, false);
      expect([grey(bytes, 0.5, 0.01), grey(bytes, 0.5, 0.05), grey(bytes, 0.5, 0.95), grey(bytes, 0.5, 0.99)]).toEqual([255, 0, 0, 255]);
    }
    const sideways = overlay(drawn([{ content: "", rotate: 90 }]), drawn([{ content: black(300, 400), width: 300, height: 400 }]), false);
    // The page is seen landscape (842 × 595): the portrait layer is 446 wide, centred, with white on the left and right.
    expect([grey(sideways, 0.1, 0.5), grey(sideways, 0.5, 0.5), grey(sideways, 0.9, 0.5)]).toEqual([255, 0, 255]);
  });

  it("refuses a signed page to lay on, and reads a signed layer", () => {
    const signed = rawPdf([
      "<</Type/Catalog/Pages 2 0 R/AcroForm<</Fields[4 0 R]/SigFlags 3>>>>",
      "<</Type/Pages/Count 1/Kids[3 0 R]>>",
      "<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Annots[4 0 R]>>",
      "<</Type/Annot/Subtype/Widget/FT/Sig/T(Signature)/Rect[0 0 1 1]/P 3 0 R/V 5 0 R>>",
      "<</Type/Sig/Filter/Adobe.PPKLite/SubFilter/adbe.pkcs7.detached/ByteRange[0 1 2 3]/Contents<00>>>",
    ]);
    expect(() => overlay(signed, textPdf(p, ["X"]), false)).toThrow("alreadySigned");
    expect(() => overlay(textPdf(p, ["A"]), signed, false)).not.toThrow();
  });
});
