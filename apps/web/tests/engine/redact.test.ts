import { inflateSync } from "node:zlib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { beforeAll, describe, expect, it } from "vitest";
import { closeDoc, openPdf } from "../../src/engine/documents";
import type { Pdfium } from "../../src/engine/pdfium";
import { redactPdf } from "../../src/engine/redact";
import { renderPage } from "../../src/engine/render";
import type { RedactZone } from "../../src/engine/types";
import { countImageStreams, encodeTestJpeg, imagePixelSizes, loadTestPdfium, rawPdf, readWithPdfjs, textPdf } from "./support";

let p: Pdfium;
beforeAll(async () => {
  p = await loadTestPdfium();
});

const secrets = ["SECRET-TEXT", "SECRET-FORM", "SECRET-NOTE", "SECRET-LINK", "SECRET-FIELD", "SECRET-SHARED"];

/**
 * Page 1 holds each secret in another place: its text, a form XObject, a note whose bubble and reply sit on page 2,
 * a link reached from the tag tree, a field, and a field whose other widget sits on page 2.
 * Page 2 links back to page 1, and so does a bookmark.
 */
function secretsPdf(): Uint8Array {
  const text = "BT /F1 12 Tf 20 300 Td (SECRET-TEXT) Tj ET q 1 0 0 1 20 200 cm /X1 Do Q";
  const form = "BT /F1 12 Tf 0 0 Td (SECRET-FORM) Tj ET";
  const keep = "BT /F1 12 Tf 20 300 Td (Keep) Tj ET";
  const shared = "BT /F1 12 Tf 2 5 Td (SECRET-SHARED) Tj ET";
  return rawPdf([
    "<</Type/Catalog/Pages 2 0 R/Outlines 11 0 R/AcroForm<</Fields[14 0 R 18 0 R]>>/StructTreeRoot 21 0 R/MarkInfo<</Marked true>>>>",
    "<</Type/Pages/Kids[3 0 R 6 0 R]/Count 2>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 400]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>/XObject<</X1 8 0 R>>>>/Annots[9 0 R 10 0 R 14 0 R 16 0 R]>>",
    `<</Length ${text.length}>>stream\n${text}\nendstream`,
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 400]/Contents 7 0 R/Resources<</Font<</F1 5 0 R>>>>/Annots[13 0 R 15 0 R 17 0 R 19 0 R]>>",
    `<</Length ${keep.length}>>stream\n${keep}\nendstream`,
    `<</Type/XObject/Subtype/Form/BBox[0 0 200 50]/Resources<</Font<</F1 5 0 R>>>>/Length ${form.length}>>stream\n${form}\nendstream`,
    "<</Type/Annot/Subtype/Text/Rect[10 10 30 30]/Contents(SECRET-NOTE)/P 3 0 R/Popup 15 0 R>>",
    "<</Type/Annot/Subtype/Link/Rect[40 10 90 30]/A<</S/URI/URI(http://SECRET-LINK.example)>>/P 3 0 R/StructParent 0>>",
    "<</Type/Outlines/First 12 0 R/Last 12 0 R/Count 1>>",
    "<</Title(To page one)/Parent 11 0 R/Dest[3 0 R/XYZ 0 400 0]>>",
    "<</Type/Annot/Subtype/Link/Rect[10 10 60 30]/Dest[3 0 R/XYZ 0 400 0]/P 6 0 R>>",
    "<</Type/Annot/Subtype/Widget/FT/Tx/T(Name)/V(SECRET-FIELD)/DV(SECRET-FIELD)/Rect[40 100 140 120]/P 3 0 R>>",
    "<</Type/Annot/Subtype/Popup/Rect[100 100 200 200]/Parent 9 0 R/P 6 0 R>>",
    "<</Type/Annot/Subtype/Widget/Rect[40 60 140 80]/P 3 0 R/Parent 18 0 R/AP<</N 20 0 R>>>>",
    "<</Type/Annot/Subtype/Widget/Rect[40 60 140 80]/P 6 0 R/Parent 18 0 R/AP<</N 20 0 R>>>>",
    "<</FT/Tx/T(Shared)/V(SECRET-SHARED)/Kids[16 0 R 17 0 R]>>",
    "<</Type/Annot/Subtype/Text/Rect[10 50 30 70]/Contents(Reply)/IRT 9 0 R/P 6 0 R>>",
    `<</Type/XObject/Subtype/Form/BBox[0 0 100 20]/Resources<</Font<</F1 5 0 R>>>>/Length ${shared.length}>>stream\n${shared}\nendstream`,
    "<</Type/StructTreeRoot/K 22 0 R/ParentTree<</Nums[0 22 0 R]>>/ParentTreeNextKey 1>>",
    "<</Type/StructElem/S/Link/P 21 0 R/Pg 3 0 R/K<</Type/OBJR/Obj 10 0 R>>>>",
  ]);
}

function leaks(bytes: Uint8Array): string[] {
  const raw = Buffer.from(bytes).toString("latin1");
  let all = raw;
  for (const match of raw.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
    try {
      all += inflateSync(Buffer.from(match[1]!, "latin1")).toString("latin1");
    } catch {
      // Not a Flate stream: the raw bytes above already hold it.
    }
  }
  return secrets.filter((secret) => all.includes(secret));
}

const zone = (change: Partial<RedactZone> = {}): RedactZone => ({ pageIndex: 0, x: 0, y: 0, width: 0.25, height: 0.25, ...change });

async function redacted(bytes: Uint8Array, zones: RedactZone[]) {
  const doc = openPdf(p, bytes);
  try {
    return await redactPdf(p, doc, zones, encodeTestJpeg);
  } finally {
    closeDoc(p, doc);
  }
}

function blackAt(bytes: Uint8Array, pageIndex: number, x: number, y: number): boolean {
  const doc = openPdf(p, bytes);
  const { pixels, width, height } = renderPage(p, doc, pageIndex, 300);
  closeDoc(p, doc);
  const at = (Math.floor(y * height) * width + Math.floor(x * width)) * 4;
  return [0, 1, 2].every((channel) => (pixels[at + channel] ?? 255) < 40);
}

describe("redact", { timeout: 30_000 }, () => {
  it("leaves nothing of what the covered page held, wherever the file kept it", async () => {
    expect(leaks(secretsPdf())).toEqual(secrets);
    expect(leaks(await redacted(secretsPdf(), [zone()]))).toEqual([]);
  });

  it("keeps the other pages, and the bookmark and the link that lead to the covered page", async () => {
    const bytes = await redacted(secretsPdf(), [zone()]);
    expect((await readWithPdfjs(bytes)).map((page) => page.text)).toEqual(["", "Keep"]);
    const task = getDocument({ data: bytes.slice(), verbosity: 0 });
    const doc = await task.promise;
    const [bookmark] = await doc.getOutline();
    const link = (await (await doc.getPage(2)).getAnnotations()).find((annotation) => annotation.subtype === "Link");
    const pageOf = async (dest: unknown) => doc.getPageIndex((dest as [{ num: number; gen: number }])[0]);
    expect([await pageOf(bookmark?.dest), await pageOf(link?.dest)]).toEqual([0, 0]);
    await task.destroy();
  });

  it("turns the covered page into one picture at 200 ppi, the zone in black", async () => {
    const bytes = await redacted(secretsPdf(), [zone({ x: 0.5, y: 0.5, width: 0.5, height: 0.5 })]);
    expect(countImageStreams(bytes)).toBe(1);
    expect(imagePixelSizes(p, bytes)[0]).toEqual([833, 1111]);
    expect([blackAt(bytes, 0, 0.75, 0.75), blackAt(bytes, 0, 0.25, 0.25)]).toEqual([true, false]);
  });

  it("covers the zone where the reader sees it, and keeps the page's size, whatever its rotation", async () => {
    for (const rotation of [0, 90, 180, 270]) {
      const bytes = await redacted(textPdf(p, ["Text"], { 0: rotation }), [zone()]);
      const [page] = await readWithPdfjs(bytes);
      const shown = page!.rotation % 180 ? [page!.height, page!.width] : [page!.width, page!.height];
      expect(shown, `rotation ${rotation}`).toEqual(rotation % 180 ? [842, 595] : [595, 842]);
      expect([blackAt(bytes, 0, 0.1, 0.1), blackAt(bytes, 0, 0.9, 0.9)], `rotation ${rotation}`).toEqual([true, false]);
    }
  });

  it("keeps the picture's longest side to 6000 pixels", async () => {
    const big = rawPdf(["<</Type/Catalog/Pages 2 0 R>>", "<</Type/Pages/Kids[3 0 R]/Count 1>>", "<</Type/Page/Parent 2 0 R/MediaBox[0 0 2200 100]>>"]);
    expect(imagePixelSizes(p, await redacted(big, [zone()]))[0]).toEqual([6000, 273]);
  });

  it("leaves a page alone when its zones are empty or off the page", async () => {
    const bytes = await redacted(textPdf(p, ["One", "Two"]), [zone({ width: 0 }), zone({ x: 1.2 }), zone({ pageIndex: 5 }), zone({ pageIndex: 1 })]);
    expect((await readWithPdfjs(bytes)).map((page) => page.text)).toEqual(["One", ""]);
  });

  it("refuses a signed PDF, and an XFA form, whose data it cannot erase", async () => {
    const signed = rawPdf([
      "<</Type/Catalog/Pages 2 0 R/AcroForm<</Fields[4 0 R]/SigFlags 3>>>>",
      "<</Type/Pages/Count 1/Kids[3 0 R]>>",
      "<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 400]/Annots[4 0 R]>>",
      "<</Type/Annot/Subtype/Widget/FT/Sig/T(Signature)/Rect[0 0 1 1]/P 3 0 R/V 5 0 R>>",
      "<</Type/Sig/Filter/Adobe.PPKLite/SubFilter/adbe.pkcs7.detached/ByteRange[0 1 2 3]/Contents<00>>>",
    ]);
    const xfa = rawPdf([
      "<</Type/Catalog/Pages 2 0 R/AcroForm<</Fields[]/XFA 4 0 R>>>>",
      "<</Type/Pages/Count 1/Kids[3 0 R]>>",
      "<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 400]>>",
      "<</Length 14>>stream\n<xdp:xdp/>    \nendstream",
    ]);
    await expect(redacted(signed, [zone()])).rejects.toMatchObject({ error: { kind: "alreadySigned" } });
    await expect(redacted(xfa, [zone()])).rejects.toMatchObject({ error: { kind: "xfaForm" } });
  });
});
