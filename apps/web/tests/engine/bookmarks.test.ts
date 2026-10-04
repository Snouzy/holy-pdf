import { beforeAll, describe, expect, it } from "vitest";
import { listBookmarks } from "../../src/engine/bookmarks";
import { closeDoc, openPdf } from "../../src/engine/documents";
import type { Pdfium } from "../../src/engine/pdfium";
import { transformPdf } from "../../src/engine/transform";
import type { Bookmark } from "../../src/engine/types";
import { loadTestPdfium, rawPdf, readOutline, textPdf, xrefErrors } from "./support";

let p: Pdfium;
beforeAll(async () => {
  p = await loadTestPdfium();
});

const page = "<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>";

/** Three pages. « Lien web » opens an address and the last-but-one has no title: both are left out. */
const outlined = rawPdf([
  "<</Type/Catalog/Pages 2 0 R/Outlines 6 0 R/Dests<</chap[5 0 R/Fit]>>>>",
  "<</Type/Pages/Kids[3 0 R 4 0 R 5 0 R]/Count 3>>",
  page, page, page,
  "<</Type/Outlines/First 7 0 R/Last 13 0 R>>",
  "<</Title(Intro)/Parent 6 0 R/Next 11 0 R/First 8 0 R/Last 8 0 R/Dest[3 0 R/XYZ 0 800 null]>>",
  "<</Title(D\\351tail)/Parent 7 0 R/First 9 0 R/Last 9 0 R/Dest[4 0 R/FitH 500]>>",
  "<</Title(Lien web)/Parent 8 0 R/First 10 0 R/Last 10 0 R/A<</S/URI/URI(https://example.com)>>>>",
  "<</Title(Sous-lien)/Parent 9 0 R/Dest[5 0 R/XYZ null null 2]>>",
  "<</Title(  Fin  )/Parent 6 0 R/Prev 7 0 R/Next 12 0 R/A<</S/GoTo/D[5 0 R/XYZ 10 20 null]>>>>",
  "<</Title()/Parent 6 0 R/Prev 11 0 R/Next 13 0 R/Dest[3 0 R/Fit]>>",
  "<</Title(Nomm\\351)/Parent 6 0 R/Prev 12 0 R/Dest/chap>>",
]);

const listed: Bookmark[] = [
  { title: "Intro", pageIndex: 0, level: 0, view: { fit: "XYZ", params: [0, 800, null] } },
  { title: "Détail", pageIndex: 1, level: 1, view: { fit: "FitH", params: [500] } },
  { title: "Sous-lien", pageIndex: 2, level: 2, view: { fit: "XYZ", params: [null, null, 2] } },
  { title: "  Fin  ", pageIndex: 2, level: 0, view: { fit: "XYZ", params: [10, 20, null] } },
  { title: "Nommé", pageIndex: 2, level: 0, view: { fit: "Fit", params: [] } },
];

function list(bytes: Uint8Array) {
  const doc = openPdf(p, bytes);
  try {
    return listBookmarks(p, doc.handle);
  } finally {
    closeDoc(p, doc);
  }
}

function written(bytes: Uint8Array, bookmarks: Bookmark[], password?: string): Uint8Array {
  const doc = openPdf(p, bytes, password);
  try {
    return transformPdf(p, doc, { kind: "bookmarks", bookmarks });
  } finally {
    closeDoc(p, doc);
  }
}

describe("bookmarks", () => {
  it("lists the bookmarks in reading order with their levels, and counts those without a page or a title, their children in their place", () => {
    expect(list(outlined)).toEqual({ bookmarks: listed, skipped: 2 });
    expect(list(textPdf(p, ["A"]))).toEqual({ bookmarks: [], skipped: 0 });
  });

  it("reads a short XYZ with what it gives, and sends a FitH without its top to the top of the page", async () => {
    const odd = rawPdf([
      "<</Type/Catalog/Pages 2 0 R/Outlines 4 0 R>>",
      "<</Type/Pages/Kids[3 0 R]/Count 1>>",
      page,
      "<</Type/Outlines/First 5 0 R/Last 6 0 R>>",
      "<</Title(Court)/Parent 4 0 R/Next 6 0 R/Dest[3 0 R/XYZ 10 800]>>",
      "<</Title(Largeur)/Parent 4 0 R/Prev 5 0 R/Dest[3 0 R/FitH null]>>",
    ]);
    const { bookmarks } = list(odd);
    expect(bookmarks).toEqual([
      { title: "Court", pageIndex: 0, level: 0, view: { fit: "XYZ", params: [10, 800] } },
      { title: "Largeur", pageIndex: 0, level: 0 },
    ]);
    expect((await readOutline(written(odd, bookmarks))).map((item) => item.dest)).toEqual([["XYZ", 10, 800, null], ["XYZ", 0, expect.closeTo(842, 2), null]]);
  });

  it("stops at an outline that loops back on itself", () => {
    const looped = rawPdf([
      "<</Type/Catalog/Pages 2 0 R/Outlines 4 0 R>>",
      "<</Type/Pages/Kids[3 0 R]/Count 1>>",
      page,
      "<</Type/Outlines/First 5 0 R/Last 5 0 R>>",
      "<</Title(Boucle)/Parent 4 0 R/Next 5 0 R/First 5 0 R/Dest[3 0 R/Fit]>>",
    ]);
    expect(list(looped).bookmarks.map((bookmark) => bookmark.title)).toEqual(["Boucle"]);
  });

  it("keeps where each bookmark of the PDF lands, its title as it is, when written again", async () => {
    const bytes = written(outlined, listed);
    expect(await readOutline(bytes)).toEqual([
      { title: "Intro", level: 0, page: 0, dest: ["XYZ", 0, 800, null] },
      { title: "Détail", level: 1, page: 1, dest: ["FitH", 500] },
      { title: "Sous-lien", level: 2, page: 2, dest: ["XYZ", null, null, 2] },
      { title: "  Fin  ", level: 0, page: 2, dest: ["XYZ", 10, 20, null] },
      { title: "Nommé", level: 0, page: 2, dest: ["Fit"] },
    ]);
    expect(list(bytes)).toEqual({ bookmarks: listed, skipped: 0 });
    expect(xrefErrors(bytes)).toEqual([]);
  });

  it("writes new bookmarks on three levels, in any script, read back as they were given", async () => {
    const bookmarks = [
      { title: "Partie I", pageIndex: 0, level: 0 },
      { title: "Chapitre Ș", pageIndex: 1, level: 1 },
      { title: "日本語", pageIndex: 1, level: 2 },
      { title: "Annexe", pageIndex: 2, level: 0 },
    ];
    const read = await readOutline(written(textPdf(p, ["A", "B", "C"]), bookmarks));
    expect(read.map(({ title, level, page: at }) => ({ title, level, pageIndex: at }))).toEqual(bookmarks);
  });

  it("replaces the bookmarks the PDF had, and removes them all", async () => {
    const replaced = written(outlined, [{ title: "Seul", pageIndex: 1, level: 0 }]);
    expect((await readOutline(replaced)).map((item) => item.title)).toEqual(["Seul"]);
    expect(Buffer.from(replaced).toString("latin1").match(/\/Title/g)).toHaveLength(1);
    expect(await readOutline(written(outlined, []))).toEqual([]);
  });

  it("points a new bookmark at the top-left of its page as the reader sees it, for the four rotations, on a crop box away from zero", async () => {
    const corners = { 0: [50, 700], 90: [50, 100], 180: [550, 100], 270: [550, 700] };
    for (const [rotate, [x, y]] of Object.entries(corners)) {
      const cropped = rawPdf([
        "<</Type/Catalog/Pages 2 0 R>>",
        "<</Type/Pages/Kids[3 0 R]/Count 1>>",
        `<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/CropBox[50 100 550 700]/Rotate ${rotate}>>`,
      ]);
      const [read] = await readOutline(written(cropped, [{ title: "Haut", pageIndex: 0, level: 0 }]));
      expect(read?.dest).toEqual(["XYZ", expect.closeTo(x!, 2), expect.closeTo(y!, 2), null]);
    }
  });

  it("brings a level more than one deeper than the bookmark before it back to one deeper", async () => {
    const read = await readOutline(written(textPdf(p, ["A"]), [{ title: "Un", pageIndex: 0, level: 1 }, { title: "Deux", pageIndex: 0, level: 3 }]));
    expect(read.map((item) => item.level)).toEqual([0, 1]);
  });

  it("refuses a page the PDF does not have and a blank title", () => {
    expect(() => written(textPdf(p, ["A"]), [{ title: "Loin", pageIndex: 1, level: 0 }])).toThrow("damaged");
    expect(() => written(textPdf(p, ["A"]), [{ title: "  ", pageIndex: 0, level: 0 }])).toThrow("damaged");
  });

  it("refuses a signed PDF, and writes the bookmarks of a protected one, which stays protected", async () => {
    const signed = rawPdf([
      "<</Type/Catalog/Pages 2 0 R/AcroForm<</Fields[4 0 R]/SigFlags 3>>>>",
      "<</Type/Pages/Count 1/Kids[3 0 R]>>",
      "<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Annots[4 0 R]>>",
      "<</Type/Annot/Subtype/Widget/FT/Sig/T(Signature)/Rect[0 0 1 1]/P 3 0 R/V 5 0 R>>",
      "<</Type/Sig/Filter/Adobe.PPKLite/SubFilter/adbe.pkcs7.detached/ByteRange[0 1 2 3]/Contents<00>>>",
    ]);
    expect(() => written(signed, [{ title: "Non", pageIndex: 0, level: 0 }])).toThrow("alreadySigned");
    const locked = written(textPdf(p, ["A"], {}, "secret"), [{ title: "Oui", pageIndex: 0, level: 0 }], "secret");
    expect((await readOutline(locked, "secret")).map((item) => item.title)).toEqual(["Oui"]);
    expect(() => openPdf(p, locked)).toThrow("passwordRequired");
  });
});
