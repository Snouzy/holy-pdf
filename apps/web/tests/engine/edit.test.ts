import { beforeAll, describe, expect, it } from "vitest";
import { closeDoc, openPdf } from "../../src/engine/documents";
import type { Pdfium } from "../../src/engine/pdfium";
import { renderPage } from "../../src/engine/render";
import { transformPdf } from "../../src/engine/transform";
import type { EditImage, EditItem, Rgb } from "../../src/engine/types";
import { gradientJpeg, loadTestPdfium, rawPdf, readWithPdfjs, textPdf } from "./support";
import { stampLayout, textWidth, wrapped } from "../../src/engine/editMetrics";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

/** The text items of the first page in order: one per text object. */
async function linesOf(bytes: Uint8Array): Promise<string[]> {
  const task = getDocument({ data: bytes.slice(), verbosity: 0 });
  const pdf = await task.promise;
  try {
    const content = await (await pdf.getPage(1)).getTextContent();
    return content.items.flatMap((each) => ("str" in each && each.str !== "" ? [each.str] : []));
  } finally {
    await task.destroy();
  }
}

let p: Pdfium;
beforeAll(async () => {
  p = await loadTestPdfium();
});

const blank = (rotate = 0) => rawPdf([
  "<</Type/Catalog/Pages 2 0 R>>",
  "<</Type/Pages/Kids[3 0 R]/Count 1>>",
  `<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Rotate ${rotate}>>`,
]);

const black: Rgb = [0, 0, 0], red: Rgb = [255, 0, 0], blue: Rgb = [0, 0, 255], green: Rgb = [0, 160, 0], yellow: Rgb = [255, 220, 0];
type Fields = EditItem extends infer Each ? (Each extends EditItem ? Omit<Each, "id" | "pageIndex"> & { pageIndex?: number } : never) : never;
let next = 0;
const item = (fields: Fields): EditItem => ({ id: String(next++), pageIndex: 0, ...fields }) as EditItem;

function edited(bytes: Uint8Array, items: EditItem[], images: Record<string, EditImage> = {}, password?: string): Uint8Array {
  const doc = openPdf(p, bytes, password);
  try {
    return transformPdf(p, doc, { kind: "edit", items, images, edits: [] });
  } finally {
    closeDoc(p, doc);
  }
}

/** The colour at a point of the page as the reader sees it, rendered at one pixel per point. */
function colour(bytes: Uint8Array, x: number, y: number): Rgb {
  const doc = openPdf(p, bytes);
  try {
    const { pixels, width } = renderPage(p, doc, 0, Math.round(doc.sizes[0]!.width));
    const at = (Math.round(y) * width + Math.round(x)) * 4;
    return [pixels[at]!, pixels[at + 1]!, pixels[at + 2]!];
  } finally {
    closeDoc(p, doc);
  }
}

const near = (actual: Rgb, expected: Rgb) => actual.every((value, index) => Math.abs(value - expected[index]!) < 40);

describe("edit", () => {
  it("writes a text as text where the preview shows it, on the four rotations", async () => {
    for (const rotate of [0, 90, 180, 270]) {
      const bytes = edited(blank(rotate), [item({ kind: "text", at: { x: 100, y: 100 }, text: "Hello\nWorld", font: "Helvetica", bold: true, size: 40, color: black })]);
      expect((await readWithPdfjs(bytes))[0]?.text.replace(/\s/g, "")).toBe("HelloWorld");
      // The left stem of « H », under the top of the first line, and of « W » one line down.
      expect(colour(bytes, 105, 115)).toEqual(black);
      expect(colour(bytes, 103, 151)).toEqual(black);
      expect(colour(bytes, 105, 230)).toEqual([255, 255, 255]);
    }
  });

  it("wraps a text box's lines at its width, as the screen does", async () => {
    const text = "The quick brown fox jumps over the lazy dog, again and again.";
    const lines = wrapped(text, "Helvetica", false, 20, 200);
    expect(lines.length).toBeGreaterThan(2);
    const bytes = edited(blank(), [item({ kind: "text", at: { x: 50, y: 50 }, text, font: "Helvetica", bold: false, size: 20, color: black, width: 200 })]);
    const items = await linesOf(bytes);
    expect(items).toEqual(lines);
    for (const line of lines) expect(textWidth(line, "Helvetica", false, 20)).toBeLessThanOrEqual(200);
  });

  it("stamps a framed word, with its date under it, as text in the page", async () => {
    const box = { x: 100, y: 100, width: 200, height: 60 };
    const bytes = edited(blank(90), [item({ kind: "stamp", box, text: "APPROUVÉ", date: "4 oct. 2026", color: red })]);
    const read = (await readWithPdfjs(bytes))[0]?.text ?? "";
    expect([read.includes("APPROUVÉ"), read.includes("4 oct. 2026")]).toEqual([true, true]);
    // The frame's left edge is red; the middle of the word is red too; the frame holds nothing white outside it.
    expect(near(colour(bytes, 100, 130), red)).toBe(true);
    expect(colour(bytes, 90, 130)).toEqual([255, 255, 255]);
    const layout = stampLayout(box, "APPROUVÉ", "4 oct. 2026");
    expect(near(colour(bytes, Math.round(layout.title.x + 3), Math.round(layout.title.y - 2)), red)).toBe(true);
    expect(layout.title.size).toBeLessThan(layout.date!.size * 4);
    expect(() => edited(blank(), [item({ kind: "stamp", box, text: "Iași", date: null, color: red })])).toThrow("damaged");
  });

  it("draws shapes, a line, an arrow and a pen stroke where the preview shows them", () => {
    const bytes = edited(blank(90), [
      item({ kind: "rectangle", box: { x: 50, y: 50, width: 100, height: 60 }, stroke: black, fill: null, lineWidth: 4 }),
      item({ kind: "ellipse", box: { x: 250, y: 50, width: 100, height: 60 }, stroke: null, fill: red, lineWidth: 2 }),
      item({ kind: "line", from: { x: 50, y: 200 }, to: { x: 250, y: 200 }, color: blue, lineWidth: 4 }),
      item({ kind: "arrow", from: { x: 50, y: 300 }, to: { x: 250, y: 300 }, color: black, lineWidth: 4 }),
      item({ kind: "ink", points: [{ x: 50, y: 400 }, { x: 100, y: 450 }, { x: 150, y: 400 }], color: green, lineWidth: 6 }),
    ]);
    expect([colour(bytes, 50, 80), colour(bytes, 100, 80)]).toEqual([black, [255, 255, 255]]);
    expect(near(colour(bytes, 300, 80), red)).toBe(true);
    expect(colour(bytes, 253, 53)).toEqual([255, 255, 255]);
    expect(near(colour(bytes, 150, 200), blue)).toBe(true);
    // The head is wider than the shaft.
    expect([near(colour(bytes, 234, 307), black), colour(bytes, 150, 307)]).toEqual([true, [255, 255, 255]]);
    expect(near(colour(bytes, 100, 449), green)).toBe(true);
  });

  it("lets the text show through a highlight, and stacks the additions in their order", () => {
    const highlighted = edited(blank(), [
      item({ kind: "rectangle", box: { x: 300, y: 380, width: 50, height: 40 }, stroke: null, fill: black, lineWidth: 1 }),
      item({ kind: "highlight", box: { x: 300, y: 380, width: 200, height: 40 }, color: yellow }),
    ]);
    expect([colour(highlighted, 320, 400), near(colour(highlighted, 400, 400), yellow)]).toEqual([black, true]);
    const box = { x: 100, y: 100, width: 100, height: 100 };
    const square = (fill: Rgb) => item({ kind: "rectangle", box, stroke: null, fill, lineWidth: 1 });
    expect(near(colour(edited(blank(), [square(red), square(blue)]), 150, 150), blue)).toBe(true);
    expect(near(colour(edited(blank(), [square(blue), square(red)]), 150, 150), red)).toBe(true);
  });

  it("places a JPEG and an image with transparency in their boxes", () => {
    const pixels = new Uint8ClampedArray([255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255]);
    const images: Record<string, EditImage> = { photo: { kind: "jpeg", bytes: new Uint8Array(gradientJpeg), width: 48, height: 32 }, red: { kind: "rgba", width: 2, height: 2, pixels } };
    const bytes = edited(blank(180), [
      item({ kind: "image", box: { x: 100, y: 100, width: 200, height: 100 }, imageId: "red" }),
      item({ kind: "image", box: { x: 100, y: 300, width: 150, height: 100 }, imageId: "photo" }),
    ], images);
    expect([colour(bytes, 200, 150), colour(bytes, 90, 150)]).toEqual([[255, 0, 0], [255, 255, 255]]);
    expect(colour(bytes, 175, 350)).not.toEqual([255, 255, 255]);
    expect(colour(bytes, 175, 420)).toEqual([255, 255, 255]);
  });

  it("writes every letter of WinAnsi, beyond Latin-1", async () => {
    const bytes = edited(blank(), [item({ kind: "text", at: { x: 50, y: 50 }, text: "cœur 20 € l’été « oui » — Œuvre…", font: "Times", bold: false, size: 14, color: black })]);
    expect((await readWithPdfjs(bytes))[0]?.text).toBe("cœur 20 € l’été « oui » — Œuvre…");
  });

  it("refuses a letter the standard fonts cannot write, a page or an image it does not have", () => {
    const text = (fields: Partial<{ text: string; pageIndex: number }>) => item({ kind: "text", at: { x: 10, y: 10 }, text: "a", font: "Times", bold: false, size: 12, color: black, ...fields });
    expect(() => edited(blank(), [text({ text: "Iași" })])).toThrow("damaged");
    expect(() => edited(blank(), [text({ pageIndex: 1 })])).toThrow("damaged");
    expect(() => edited(blank(), [item({ kind: "image", box: { x: 0, y: 0, width: 10, height: 10 }, imageId: "missing" })])).toThrow("damaged");
  });

  it("refuses a signed PDF, and keeps a protected one protected", async () => {
    const signed = rawPdf([
      "<</Type/Catalog/Pages 2 0 R/AcroForm<</Fields[4 0 R]/SigFlags 3>>>>",
      "<</Type/Pages/Count 1/Kids[3 0 R]>>",
      "<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Annots[4 0 R]>>",
      "<</Type/Annot/Subtype/Widget/FT/Sig/T(Signature)/Rect[0 0 1 1]/P 3 0 R/V 5 0 R>>",
      "<</Type/Sig/Filter/Adobe.PPKLite/SubFilter/adbe.pkcs7.detached/ByteRange[0 1 2 3]/Contents<00>>>",
    ]);
    const note = item({ kind: "text", at: { x: 10, y: 10 }, text: "Note", font: "Courier", bold: false, size: 12, color: black });
    expect(() => edited(signed, [note])).toThrow("alreadySigned");
    const locked = edited(textPdf(p, ["A"], {}, "1234"), [note], {}, "1234");
    expect(() => openPdf(p, locked)).toThrow("passwordRequired");
    expect((await readWithPdfjs(locked, "1234"))[0]?.text).toContain("Note");
  });
});
