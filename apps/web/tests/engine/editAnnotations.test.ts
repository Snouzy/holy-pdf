import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { beforeAll, describe, expect, it } from "vitest";
import { closeDoc, openPdf } from "../../src/engine/documents";
import { malloc, type Pdfium } from "../../src/engine/pdfium";
import { renderPage } from "../../src/engine/render";
import { transformPdf } from "../../src/engine/transform";
import type { EditItem, Rgb } from "../../src/engine/types";
import { loadTestPdfium, textPdf } from "./support";

let p: Pdfium;
beforeAll(async () => {
  p = await loadTestPdfium();
});

const yellow: Rgb = [250, 204, 21], red: Rgb = [220, 38, 38];
type Fields = EditItem extends infer Each ? (Each extends EditItem ? Omit<Each, "id" | "pageIndex"> & { pageIndex?: number } : never) : never;
let next = 0;
const item = (fields: Fields): EditItem => ({ id: String(next++), pageIndex: 0, ...fields }) as EditItem;

function annotated(bytes: Uint8Array, items: EditItem[]): Uint8Array {
  const doc = openPdf(p, bytes);
  try {
    return transformPdf(p, doc, { kind: "edit", items, images: {}, edits: [] });
  } finally {
    closeDoc(p, doc);
  }
}

type Read = { subtype: string; rect: number[]; contents?: string; title?: string; color?: number[]; quads?: number[]; url?: string; page?: number };

async function readAnnotations(bytes: Uint8Array, pageNumber = 1): Promise<Read[]> {
  const task = getDocument({ data: bytes.slice(), verbosity: 0 });
  const pdf = await task.promise;
  try {
    const read: Read[] = [];
    for (const raw of await (await pdf.getPage(pageNumber)).getAnnotations()) {
      const annotation = raw as Record<string, unknown>;
      const dest = annotation.dest as unknown[] | undefined;
      read.push({
        subtype: String(annotation.subtype), rect: (annotation.rect as number[]).map(Math.round),
        ...((annotation.contentsObj as { str: string } | undefined)?.str ? { contents: (annotation.contentsObj as { str: string }).str } : {}),
        ...((annotation.titleObj as { str: string } | undefined)?.str ? { title: (annotation.titleObj as { str: string }).str } : {}),
        ...(annotation.color ? { color: Array.from(annotation.color as ArrayLike<number>) } : {}),
        ...(annotation.quadPoints ? { quads: Array.from(annotation.quadPoints as ArrayLike<number>).map(Math.round) } : {}),
        ...(typeof annotation.url === "string" ? { url: annotation.url } : {}),
        ...(dest ? { page: await pdf.getPageIndex(dest[0] as Parameters<typeof pdf.getPageIndex>[0]) } : {}),
      });
    }
    return read;
  } finally {
    await task.destroy();
  }
}

function flagsOf(bytes: Uint8Array): number {
  const doc = openPdf(p, bytes);
  const page = p.FPDF_LoadPage(doc.handle, 0);
  const annot = p.FPDFPage_GetAnnot(page, 0);
  try {
    return p.FPDFAnnot_GetFlags(annot);
  } finally {
    p.FPDFPage_CloseAnnot(annot);
    p.FPDF_ClosePage(page);
    closeDoc(p, doc);
  }
}

/** The first annotation's rect in the file: left, bottom, right, top. */
function rectOf(bytes: Uint8Array): number[] {
  const doc = openPdf(p, bytes);
  const page = p.FPDF_LoadPage(doc.handle, 0);
  const annot = p.FPDFPage_GetAnnot(page, 0);
  const numbers = malloc(p, 16);
  try {
    p.FPDFAnnot_GetRect(annot, numbers);
    const [left, top, right, bottom] = [0, 4, 8, 12].map((offset) => Math.round(p.pdfium.getValue(numbers + offset, "float")));
    return [left!, bottom!, right!, top!];
  } finally {
    p.pdfium._free(numbers);
    p.FPDFPage_CloseAnnot(annot);
    p.FPDF_ClosePage(page);
    closeDoc(p, doc);
  }
}

function inkedRows(bytes: Uint8Array, x: number, from: number, to: number): { y: number; color: number[] }[] {
  const doc = openPdf(p, bytes);
  try {
    const { pixels, width } = renderPage(p, doc, 0, Math.round(doc.sizes[0]!.width));
    const rows: { y: number; color: number[] }[] = [];
    for (let y = from; y <= to; y++) {
      const at = (y * width + x) * 4;
      const color = [pixels[at]!, pixels[at + 1]!, pixels[at + 2]!];
      if (color.some((value) => value !== 255)) rows.push({ y, color });
    }
    return rows;
  } finally {
    closeDoc(p, doc);
  }
}

describe("annotations", () => {
  it("writes a note with its text, author and colour, where the reader sees it", async () => {
    const bytes = annotated(textPdf(p, ["Hello"]), [item({ kind: "note", at: { x: 100, y: 50 }, text: "Please check this 🙏", author: "Mathias", color: yellow })]);
    // pdf.js gives a note without an appearance a 22-point icon from its top-left corner: the file's own rect is read with PDFium.
    expect(await readAnnotations(bytes)).toEqual([{ subtype: "Text", rect: [100, 770, 122, 792], contents: "Please check this 🙏", title: "Mathias", color: yellow }]);
    expect(rectOf(bytes)).toEqual([100, 772, 120, 792]);
    expect(flagsOf(bytes)).toBe(4 | 8 | 16);
    expect(flagsOf(annotated(textPdf(p, ["Hello"], { 0: 90 }), [item({ kind: "note", at: { x: 100, y: 50 }, text: "x", author: "", color: yellow })]))).toBe(4 | 8);
  });

  it("marks words with a highlight, an underline and a strike-through, one quad per line, that readers and PDFium draw", async () => {
    const bytes = annotated(textPdf(p, ["Hello"], { 0: 90 }), [
      item({ kind: "markup", style: "highlight", quads: [{ x: 80, y: 100, width: 200, height: 40 }, { x: 80, y: 150, width: 120, height: 40 }], color: yellow }),
      item({ kind: "markup", style: "underline", quads: [{ x: 80, y: 250, width: 200, height: 40 }], color: red }),
      item({ kind: "markup", style: "strikeout", quads: [{ x: 80, y: 350, width: 200, height: 40 }], color: red }),
    ]);
    const read = await readAnnotations(bytes);
    expect(read.map((annotation) => [annotation.subtype, annotation.color, annotation.quads?.length])).toEqual([["Highlight", yellow, 16], ["Underline", red, 8], ["StrikeOut", red, 8]]);
    // pdf.js sorts a quad's corners in page order; on the page rotated by 90°, the reader's x runs along the page's y.
    expect(read[0]!.quads!.slice(0, 8)).toEqual([100, 280, 140, 280, 100, 80, 140, 80]);
    expect(inkedRows(bytes, 180, 95, 145).map((row) => row.color)).toContainEqual(yellow);
    expect(inkedRows(bytes, 180, 200, 240)).toEqual([]);
    // PDFium draws an underline along the quad's bottom in page space, which a rotated page turns on its side: readers follow the quads.
    const upright = annotated(textPdf(p, ["Hello"]), [
      item({ kind: "markup", style: "underline", quads: [{ x: 80, y: 250, width: 200, height: 40 }], color: red }),
      item({ kind: "markup", style: "strikeout", quads: [{ x: 80, y: 350, width: 200, height: 40 }], color: red }),
    ]);
    expect(inkedRows(upright, 180, 245, 295).map((row) => row.y)).toEqual(expect.arrayContaining([289]));
    expect(inkedRows(upright, 180, 345, 395).map((row) => row.y)).toEqual(expect.arrayContaining([370]));
  });

  it("links a zone to an address or to a page, with no border, and refuses a bad target", async () => {
    const two = textPdf(p, ["One", "Two"]);
    const bytes = annotated(two, [
      item({ kind: "link", box: { x: 80, y: 700, width: 200, height: 30 }, target: { url: "https://holy.pdf/" } }),
      item({ kind: "link", box: { x: 80, y: 750, width: 200, height: 30 }, target: { page: 1 } }),
    ]);
    const read = await readAnnotations(bytes);
    expect(read).toEqual([
      { subtype: "Link", rect: [80, 112, 280, 142], url: "https://holy.pdf/", color: [0, 0, 0] },
      { subtype: "Link", rect: [80, 62, 280, 92], page: 1, color: [0, 0, 0] },
    ]);
    expect(inkedRows(bytes, 180, 700, 780)).toEqual([]);
    expect(() => annotated(two, [item({ kind: "link", box: { x: 0, y: 0, width: 10, height: 10 }, target: { page: 9 } })])).toThrow("damaged");
    expect(() => annotated(two, [item({ kind: "link", box: { x: 0, y: 0, width: 10, height: 10 }, target: { url: " " } })])).toThrow("damaged");
    expect(() => annotated(two, [item({ kind: "link", box: { x: 0, y: 0, width: 10, height: 10 }, target: { url: "javascript:alert(1)" } })])).toThrow("damaged");
    // A /URI is ASCII: the host in punycode, the path percent-encoded.
    const accented = annotated(two, [item({ kind: "link", box: { x: 0, y: 0, width: 10, height: 10 }, target: { url: "https://café.fr/été" } })]);
    expect((await readAnnotations(accented))[0]?.url).toBe("https://xn--caf-dma.fr/%C3%A9t%C3%A9");
  });

  it("adds no object to the page's content for an annotation", () => {
    const bytes = annotated(textPdf(p, ["Hello"]), [item({ kind: "note", at: { x: 10, y: 10 }, text: "x", author: "", color: yellow })]);
    const doc = openPdf(p, bytes);
    try {
      const page = p.FPDF_LoadPage(doc.handle, 0);
      expect([p.FPDFPage_CountObjects(page), p.FPDFPage_GetAnnotCount(page)]).toEqual([1, 1]);
      p.FPDF_ClosePage(page);
    } finally {
      closeDoc(p, doc);
    }
  });
});
