import { deflateSync } from "node:zlib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { beforeAll, describe, expect, it } from "vitest";
import { compressPdf, targetSize } from "../../src/engine/compress";
import { closeDoc, openImage, openPdf, savePdf } from "../../src/engine/documents";
import { type EncodeJpeg } from "../../src/engine/imageObjects";
import type { Pdfium } from "../../src/engine/pdfium";
import type { CompressLevel } from "../../src/engine/types";
import {
  clipPage,
  countImageStreams,
  encodeTestJpeg,
  imagePixelSizes,
  loadTestPdfium,
  photoInFormPdf,
  photoPdf,
  photoPixels,
  readWithPdfjs,
  sharedPhotoPdf,
  xrefErrors,
} from "./support";

let p: Pdfium;
beforeAll(async () => {
  p = await loadTestPdfium();
});

const text = (bytes: Uint8Array) => Buffer.from(bytes).toString("latin1");

/** One photograph plus every catalog-level structure that copying only pages used to discard. */
function structuredPhotoPdf({ annotationAppearance = false, hardMask = false, unfiltered = false } = {}): Uint8Array<ArrayBuffer> {
  const rgba = photoPixels(400, 300);
  const rgb = Buffer.alloc(400 * 300 * 3);
  for (let i = 0; i < 400 * 300; i++) rgb.set(rgba.subarray(i * 4, i * 4 + 3), i * 3);
  const stream = (dict: string, bytes: Uint8Array | string) => {
    const data = typeof bytes === "string" ? Buffer.from(bytes) : bytes;
    return Buffer.concat([Buffer.from(`<<${dict}/Length ${data.length}>>\nstream\n`), data, Buffer.from("\nendstream")]);
  };
  const objects = [
    "<</Type/Catalog/Pages 2 0 R/Outlines 6 0 R/Names<</Dests<</Names[(chapter) [3 0 R /XYZ 0 800 null]]>>/EmbeddedFiles<</Names[(notes.txt) 16 0 R]>>>>/AcroForm<</Fields[11 0 R]/DA(/Helv 10 Tf 0 g)/DR<</Font<</Helv 18 0 R>>>>>>/MarkInfo<</Marked true>>/StructTreeRoot 12 0 R/Metadata 10 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    `<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${hardMask ? "95 134" : "595 842"}]/Resources<</XObject<</Photo 5 0 R>>>>/Contents 4 0 R/Annots[8 0 R 11 0 R]/StructParents 0>>`,
    stream("", `/Figure <</MCID 0>> BDC q ${hardMask ? "95 0 0 71 0 63" : "595 0 0 446 0 396"} cm /Photo Do Q EMC`),
    stream(`/Type/XObject/Subtype/Image/Width 400/Height 300/ColorSpace/DeviceRGB/BitsPerComponent 8${unfiltered ? "" : "/Filter/FlateDecode"}${hardMask ? "/Mask 19 0 R" : ""}`, unfiltered ? rgb : deflateSync(rgb)),
    "<</Type/Outlines/First 7 0 R/Last 7 0 R/Count 1>>",
    "<</Title(Chapter one)/Parent 6 0 R/Dest(chapter)>>",
    "<</Type/Annot/Subtype/Link/Rect[0 0 100 20]/Dest(chapter)>>",
    "<</Title(Structure stays)/Author(Test author)>>",
    stream("/Type/Metadata/Subtype/XML", '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:description><rdf:Alt><rdf:li xml:lang="x-default">Retained XMP</rdf:li></rdf:Alt></dc:description></rdf:Description></rdf:RDF></x:xmpmeta>'),
    `<</Type/Annot/Subtype/Widget/FT/Tx/T(Full name)/V(Ada Lovelace)/Rect[0 30 160 50]/P 3 0 R/F 4${annotationAppearance ? "/AP<</N<</Off 17 0 R>>/R 19 0 R>>" : ""}>>`,
    "<</Type/StructTreeRoot/K[13 0 R]/ParentTree 14 0 R/ParentTreeNextKey 1>>",
    "<</Type/StructElem/S/Figure/P 12 0 R/Pg 3 0 R/K 0/Alt(A gradient photograph)>>",
    "<</Nums[0 [13 0 R]]>>",
    stream("/Type/EmbeddedFile", "Attachment content stays."),
    "<</Type/Filespec/F(notes.txt)/UF(notes.txt)/EF<</F 15 0 R>>>>",
    "null",
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
  ];
  if (annotationAppearance) objects.push(stream("/Type/XObject/Subtype/Form/BBox[0 0 160 20]/Resources<</XObject<</Photo 5 0 R>>>>", "q 160 0 0 20 0 0 cm /Photo Do Q"));
  if (hardMask) {
    const mask = Buffer.alloc(50 * 300, 255);
    for (let row = 0; row < 300; row++) mask.fill(0, row * 50, row * 50 + 25);
    objects.push(stream("/Type/XObject/Subtype/Image/Width 400/Height 300/ImageMask true/BitsPerComponent 1/Filter/FlateDecode", deflateSync(mask)));
  }
  const chunks = [Buffer.from("%PDF-1.7\n")];
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(chunks.reduce((size, part) => size + part.length, 0));
    chunks.push(Buffer.from(`${index + 1} 0 obj\n`), typeof object === "string" ? Buffer.from(object) : object, Buffer.from("\nendobj\n"));
  }
  const at = chunks.reduce((size, part) => size + part.length, 0);
  chunks.push(Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<</Size ${objects.length + 1}/Root 1 0 R/Info 9 0 R>>\nstartxref\n${at}\n%%EOF\n`));
  return new Uint8Array(Buffer.concat(chunks));
}

async function readStructure(bytes: Uint8Array) {
  const task = getDocument({ data: bytes.slice(), verbosity: 0 });
  try {
    const doc = await task.promise;
    const metadata = await doc.getMetadata();
    const page = await doc.getPage(1);
    const annotations = await page.getAnnotations();
    return {
      title: "Title" in metadata.info ? metadata.info.Title : undefined,
      xmp: metadata.metadata?.getRaw(),
      outlines: (await doc.getOutline())?.map(({ title, dest }) => ({ title, dest })),
      destination: await doc.getPageIndex((await doc.getDestination("chapter"))?.[0]),
      links: annotations.filter((annotation) => annotation.subtype === "Link").map((annotation) => annotation.dest),
      fields: annotations.filter((annotation) => annotation.subtype === "Widget").map(({ fieldName, fieldValue }) => ({ fieldName, fieldValue })),
      attachments: await Promise.all([...(await doc.getAttachments() ?? new Map())].map(async ([key, { filename }]) => ({ filename, content: new TextDecoder().decode((await doc.getAttachmentContent(key)) ?? undefined) }))),
      tags: await page.getStructTree(),
    };
  } finally {
    await task.destroy();
  }
}

describe("targetSize", () => {
  const photo = { width: 1600, height: 2200, ppi: 300, bitsPerPixel: 24 };

  it("halves a 300 ppi photo for 150 ppi", () => {
    expect(targetSize(photo, 150)).toEqual({ width: 800, height: 1100 });
  });

  it("keeps the size of a photo already under the limit", () => {
    expect(targetSize({ ...photo, ppi: 120 }, 150)).toEqual({ width: 1600, height: 2200 });
  });

  it("leaves one-bit and small images alone", () => {
    expect(targetSize({ ...photo, bitsPerPixel: 1 }, 150)).toBeNull();
    expect(targetSize({ ...photo, width: 63 }, 150)).toBeNull();
  });
});

/** The mean green of the left and right halves of the top of page 1, rendered on magenta, which has no green. */
function greenByHalf(bytes: Uint8Array): [number, number] {
  const doc = openPdf(p, bytes);
  const page = p.FPDF_LoadPage(doc.handle, 0);
  const [width, height] = [120, 170];
  const bitmap = p.FPDFBitmap_Create(width, height, 0);
  p.FPDFBitmap_FillRect(bitmap, 0, 0, width, height, 0xffff00ff);
  p.FPDF_RenderPageBitmap(bitmap, page, 0, 0, width, height, 0, 0);
  const buffer = p.FPDFBitmap_GetBuffer(bitmap);
  const stride = p.FPDFBitmap_GetStride(bitmap);
  let [left, right] = [0, 0];
  for (let y = 0; y < height / 2; y++) {
    for (let x = 0; x < width; x++) {
      const green = p.pdfium.HEAPU8[buffer + y * stride + x * 4 + 1] ?? 0;
      if (x < width / 2) left += green;
      else right += green;
    }
  }
  p.FPDFBitmap_Destroy(bitmap);
  p.FPDF_ClosePage(page);
  closeDoc(p, doc);
  const pixels = (width / 2) * (height / 2);
  return [left / pixels, right / pixels];
}

const keepsMask = /\/DCTDecode[^>]*\/SMask \d+ \d+ R/g;

describe("compressPdf", { timeout: 30_000 }, () => {
  const big = { width: 1600, height: 2200 };

  async function compress(bytes: Uint8Array, level: CompressLevel = "recommended", password?: string) {
    const doc = openPdf(p, bytes, password);
    try {
      return await compressPdf(p, doc, level, encodeTestJpeg, () => {});
    } finally {
      closeDoc(p, doc);
    }
  }

  // 1600 px across 595.28 pt is 193.5 ppi: at 150 ppi, 77.5 % of each side is left.
  const expectAbout = (size: [number, number] | undefined) => {
    const [width, height] = size ?? [0, 0];
    expect(Math.abs(width - 1240)).toBeLessThanOrEqual(1);
    expect(Math.abs(height - 1705)).toBeLessThanOrEqual(1);
  };

  it("preserves bookmarks, internal links, metadata, fields, tags and attachments while compressing the photo", async () => {
    const original = structuredPhotoPdf();
    const before = await readStructure(original);
    expect(before).toMatchObject({
      title: "Structure stays", outlines: [{ title: "Chapter one", dest: "chapter" }], destination: 0,
      links: ["chapter"], fields: [{ fieldName: "Full name", fieldValue: "Ada Lovelace" }],
      attachments: [{ filename: "notes.txt", content: "Attachment content stays." }],
    });
    expect(before.xmp).toContain("Retained XMP");
    expect(JSON.stringify(before.tags)).toContain("A gradient photograph");
    const bytes = await compress(original);
    expect(bytes.length).toBeLessThan(original.length / 2);
    expect(await readStructure(bytes)).toEqual(before);
    expect(xrefErrors(bytes)).toEqual([]);
  });

  it("compresses an initially unfiltered photo after PDFium changes its stream encoding during save", async () => {
    const original = structuredPhotoPdf({ unfiltered: true });
    const bytes = await compress(original);
    expect(bytes.length).toBeLessThan(original.length / 2);
    expect(text(bytes).includes("/DCTDecode")).toBe(true);
    expect(imagePixelSizes(p, bytes)).toEqual([[400, 300]]);
    expect(await readStructure(bytes)).toEqual(await readStructure(original));
    expect(xrefErrors(bytes)).toEqual([]);
  });

  it("keeps an explicit one-bit image mask while resizing and recompressing its colour photo", async () => {
    const original = structuredPhotoPdf({ hardMask: true });
    const bytes = await compress(original);
    expect(imagePixelSizes(p, bytes)).toEqual([[198, 148]]);
    expect(/\/DCTDecode[^>]*\/Mask \d+ 0 R/.test(text(bytes))).toBe(true);
    expect(/\/BitsPerComponent 1[^>]*\/Height 300[^>]*\/ImageMask true[^>]*\/Width 400/.test(text(bytes))).toBe(true);
    const [left, right] = greenByHalf(original);
    const [newLeft, newRight] = greenByHalf(bytes);
    expect(left).toBeGreaterThan(30);
    expect(right).toBeLessThan(2);
    expect(Math.abs(newLeft - left)).toBeLessThan(3);
    expect(newRight).toBeLessThan(2);
    expect(xrefErrors(bytes)).toEqual([]);
  });

  it("leaves images shared with annotation appearances untouched because their display sizes are unmeasured", async () => {
    const bytes = await compress(structuredPhotoPdf({ annotationAppearance: true }));
    expect(text(bytes)).not.toContain("/DCTDecode");
    expect(imagePixelSizes(p, bytes)).toEqual([[400, 300]]);
    expect(xrefErrors(bytes)).toEqual([]);
  });

  it("sizes a shared photo for a larger draw inside a form", async () => {
    const doc = openPdf(p, photoInFormPdf(p, big));
    const page = p.FPDF_LoadPage(doc.handle, 0);
    for (let i = 0; i < p.FPDFPage_CountObjects(page); i++) {
      const object = p.FPDFPage_GetObject(page, i);
      if (p.FPDFPageObj_GetType(object) === 5) p.FPDFPageObj_Transform(object, 10, 0, 0, 10, 0, 0);
    }
    p.FPDFPage_GenerateContent(page);
    p.FPDF_ClosePage(page);
    const original = savePdf(p, doc.handle);
    closeDoc(p, doc);
    const bytes = await compress(original);
    expect(imagePixelSizes(p, bytes)).toEqual([[1600, 2200]]);
    expect(text(bytes).match(/\/DCTDecode/g)).toHaveLength(2);
    expect(bytes.length).toBeLessThan(original.length / 2);
  });

  it("makes a PDF with a large photo much smaller and keeps its text", async () => {
    const original = photoPdf(p, ["Page 1"], big);
    const bytes = await compress(original);
    expect(bytes.length).toBeLessThan(original.length / 2);
    expect((await readWithPdfjs(bytes)).map((page) => page.text)).toEqual(["Page 1"]);
  });

  it("brings the photo down to the level's resolution", async () => {
    expectAbout(imagePixelSizes(p, await compress(photoPdf(p, ["Page 1"], big)))[0]);
  });

  it("re-encodes a transparent photo as a JPEG and keeps its soft mask", async () => {
    const original = photoPdf(p, ["Page 1"], { ...big, alpha: "half" });
    const bytes = await compress(original);
    expect(bytes.length).toBeLessThan(original.length / 2);
    expectAbout(imagePixelSizes(p, bytes)[0]);
    expect(text(bytes).match(keepsMask)).toHaveLength(1);
    // The photo on the left, the background on the right: a lost or mirrored mask would change both halves.
    const [left, right] = greenByHalf(original);
    expect(left).toBeGreaterThan(30);
    expect(right).toBeLessThan(2);
    const [newLeft, newRight] = greenByHalf(bytes);
    expect(Math.abs(newLeft - left)).toBeLessThan(3);
    expect(newRight).toBeLessThan(2);
  });

  it("rewrites three transparent photos in one file, and every offset follows", async () => {
    const bytes = await compress(photoPdf(p, ["A", "B", "C"], { ...big, alpha: 128 }));
    expect(text(bytes).match(keepsMask)).toHaveLength(3);
    expect(xrefErrors(bytes)).toEqual([]);
    expect((await readWithPdfjs(bytes)).map((page) => page.text)).toEqual(["A", "B", "C"]);
  });

  it("keeps the soft mask of a transparent image two pages draw, and writes it once", async () => {
    const bytes = await compress(sharedPhotoPdf(p, { ...big, alpha: 128 }));
    expect(countImageStreams(bytes)).toBe(2);
    expect(text(bytes).match(keepsMask)).toHaveLength(1);
    const [first, second] = imagePixelSizes(p, bytes);
    expectAbout(first);
    expect(second).toEqual(first);
  });

  it("compresses a protected PDF with a transparent photo", async () => {
    const original = photoPdf(p, ["Secret"], { ...big, alpha: 128 }, "sesame");
    const bytes = await compress(original, "recommended", "sesame");
    expectAbout(imagePixelSizes(p, bytes)[0]);
    expect((await readWithPdfjs(bytes)).map((page) => page.text)).toEqual(["Secret"]);
  });

  it("sizes the JPEG of a stream for its largest draw, even when only a smaller one reads as transparent", async () => {
    const bytes = await compress(clipPage(p, sharedPhotoPdf(p, big), 0, 0.5));
    expect(countImageStreams(bytes)).toBe(1);
    const [small, large] = imagePixelSizes(p, bytes);
    expectAbout(large);
    expect(small).toEqual(large);
  });

  it("compresses a transparent photo also drawn in a form, retaining both masks", async () => {
    const original = photoInFormPdf(p, { ...big, alpha: 128 });
    const bytes = await compress(original);
    expectAbout(imagePixelSizes(p, bytes)[0]);
    expect(bytes.length).toBeLessThan(original.length / 2);
    expect(text(bytes).match(keepsMask)).toHaveLength(2);
  });

  it("re-encodes both clipped and unclipped JPEG photos at their own size", async () => {
    const jpeg = await encodeTestJpeg({ pixels: photoPixels(400, 300), width: 400, height: 300 }, 400, 300, 0.9);
    const image = openImage(p, { kind: "jpeg", bytes: jpeg });
    const unclipped = savePdf(p, image.handle);
    closeDoc(p, image);
    const encodes = async (bytes: Uint8Array) => {
      let calls = 0;
      const counting: EncodeJpeg = (...args) => {
        calls++;
        return encodeTestJpeg(...args);
      };
      const doc = openPdf(p, bytes);
      await compressPdf(p, doc, "recommended", counting, () => {});
      closeDoc(p, doc);
      return calls;
    };
    expect(await encodes(unclipped)).toBe(1);
    expect(await encodes(clipPage(p, unclipped, 0))).toBe(1);
  });

  it("compresses an image shared by two pages once for every draw", async () => {
    const bytes = await compress(sharedPhotoPdf(p, big));
    expect(countImageStreams(bytes)).toBe(1);
    const [first, second] = imagePixelSizes(p, bytes);
    expectAbout(first);
    expect(second).toEqual(first);
  });

  it("leaves the open file as it was", async () => {
    const doc = openPdf(p, photoPdf(p, ["Page 1"], big));
    const first = await compressPdf(p, doc, "recommended", encodeTestJpeg, () => {});
    const second = await compressPdf(p, doc, "recommended", encodeTestJpeg, () => {});
    closeDoc(p, doc);
    expect(second.length).toBe(first.length);
  });

  it("compresses a protected PDF", async () => {
    const bytes = await compress(photoPdf(p, ["Secret"], big, "sesame"), "recommended", "sesame");
    expect((await readWithPdfjs(bytes)).map((page) => page.text)).toEqual(["Secret"]);
  });

  it("squeezes harder at each level", async () => {
    const original = photoPdf(p, ["Page 1"], big);
    const extreme = await compress(original, "extreme");
    const recommended = await compress(original, "recommended");
    const low = await compress(original, "low");
    expect(extreme.length).toBeLessThan(recommended.length);
    expect(recommended.length).toBeLessThan(low.length);
  });

  it("reports every page", async () => {
    let pages = 0;
    const doc = openPdf(p, photoPdf(p, ["1", "2", "3"], { width: 200, height: 150 }));
    await compressPdf(p, doc, "recommended", encodeTestJpeg, () => pages++);
    closeDoc(p, doc);
    expect(pages).toBe(3);
  });
});
