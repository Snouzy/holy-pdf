import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { closeDoc, openPdf, savePdf } from "../../src/engine/documents";
import { encode } from "jpeg-js";
import { buildPdf } from "../../src/engine/build";
import { type EncodeJpeg, pageImages } from "../../src/engine/imageObjects";
import { loadPdfium, malloc, type Pdfium } from "../../src/engine/pdfium";

export async function loadTestPdfium(): Promise<Pdfium> {
  const wasm = readFileSync(createRequire(import.meta.url).resolve("@embedpdf/pdfium/pdfium.wasm"));
  return loadPdfium({ bytes: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) });
}

/** A PDF whose pages show their label in large letters. `rotations` sets a page's own /Rotate, in degrees. */
export function textPdf(p: Pdfium, labels: string[], rotations: Record<number, number> = {}, password?: string): Uint8Array {
  const doc = p.FPDF_CreateNewDocument();
  labels.forEach((label, index) => {
    const page = p.FPDFPage_New(doc, index, 595.28, 841.89);
    p.FPDFPage_InsertObject(page, textObject(p, doc, label, 120, 400));
    p.FPDFPage_SetRotation(page, (rotations[index] ?? 0) / 90);
    p.FPDFPage_GenerateContent(page);
    p.FPDF_ClosePage(page);
  });
  if (password) p.EPDF_SetEncryption(doc, password, `owner-${password}`, 0);
  const bytes = savePdf(p, doc);
  p.FPDF_CloseDocument(doc);
  return bytes;
}

function textObject(p: Pdfium, doc: number, label: string, size: number, y: number): number {
  const text = p.FPDFPageObj_NewTextObj(doc, "Helvetica", size);
  const bytes = (label.length + 1) * 2;
  const utf16 = malloc(p, bytes);
  p.pdfium.stringToUTF16(label, utf16, bytes);
  p.FPDFText_SetText(text, utf16);
  p.pdfium._free(utf16);
  p.FPDFPageObj_Transform(text, 1, 0, 0, 1, 80, y);
  return text;
}

/** A PDF written by hand: `bodies[0]` is object 1 and must be the catalog. */
export function rawPdf(bodies: string[]): Uint8Array {
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

const photos = new Map<string, Uint8ClampedArray<ArrayBuffer>>();

/** A smooth gradient with noise, in RGBA: Flate keeps it big, JPEG makes it small, like a photo. */
export function photoPixels(width: number, height: number, seed = 1): Uint8ClampedArray<ArrayBuffer> {
  const key = `${width}x${height}:${seed}`;
  const known = photos.get(key);
  if (known) return known;
  const pixels = new Uint8ClampedArray(width * height * 4);
  let random = seed;
  for (let i = 0; i < width * height; i++) {
    random = (random * 1103515245 + 12345) & 0x7fffffff;
    const noise = random % 24;
    const x = i % width;
    const y = Math.floor(i / width);
    pixels[i * 4] = (x * 230) / width + noise;
    pixels[i * 4 + 1] = (y * 230) / height + noise;
    pixels[i * 4 + 2] = 120 + noise + seed * 7;
    pixels[i * 4 + 3] = 255;
  }
  photos.set(key, pixels);
  return pixels;
}

/**
 * `alpha` "half" leaves the left half opaque and the right half clear. Pages share a `seed`, and so equal image bytes,
 * only when it is given.
 */
export type Photo = { width: number; height: number; alpha?: number | "half"; seed?: number };

/** One A4 page per label: a photo across the top of the page, and the label as text under it. */
export function photoPdf(p: Pdfium, labels: string[], photo: Photo, password?: string): Uint8Array<ArrayBuffer> {
  const doc = p.FPDF_CreateNewDocument();
  labels.forEach((label, index) => {
    const page = p.FPDFPage_New(doc, index, 595.28, 841.89);
    const image = p.FPDFPageObj_NewImageObj(doc);
    fillImage(p, image, photoPixels(photo.width, photo.height, photo.seed ?? index + 1), photo, photo.alpha ?? 255);
    const height = (595.28 * photo.height) / photo.width;
    p.FPDFImageObj_SetMatrix(image, 595.28, 0, 0, height, 0, 841.89 - height);
    p.FPDFPage_InsertObject(page, image);
    p.FPDFPage_InsertObject(page, textObject(p, doc, label, 40, 60));
    p.FPDFPage_GenerateContent(page);
    p.FPDF_ClosePage(page);
  });
  if (password) p.EPDF_SetEncryption(doc, password, `owner-${password}`, 0);
  const bytes = savePdf(p, doc);
  p.FPDF_CloseDocument(doc);
  return bytes;
}

/** Two pages that draw one image: pages imported in one call share their resources. */
export function sharedPhotoPdf(p: Pdfium, photo: Photo): Uint8Array<ArrayBuffer> {
  const source = openPdf(p, photoPdf(p, ["Shared"], photo));
  const page = { docId: "s", index: 0, rotation: 0 } as const;
  const bytes = buildPdf(p, [page, page], new Map([["s", source]]));
  closeDoc(p, source);
  return bytes;
}

/** One page that draws a photo, and the same photo again, a quarter as large, inside a form XObject. */
export function photoInFormPdf(p: Pdfium, photo: Photo): Uint8Array<ArrayBuffer> {
  const bytes = photoPdf(p, ["Form"], photo);
  const [doc, source] = [openPdf(p, bytes), openPdf(p, bytes)];
  const xobject = p.FPDF_NewXObjectFromPage(doc.handle, source.handle, 0);
  const form = p.FPDF_NewFormObjectFromXObject(xobject);
  p.FPDFPageObj_Transform(form, 0.25, 0, 0, 0.25, 0, 0);
  const page = p.FPDF_LoadPage(doc.handle, 0);
  p.FPDFPage_InsertObject(page, form);
  p.FPDFPage_GenerateContent(page);
  p.FPDF_ClosePage(page);
  p.FPDF_CloseXObject(xobject);
  const withForm = savePdf(p, doc.handle);
  closeDoc(p, doc);
  closeDoc(p, source);
  return withForm;
}

/**
 * Page `index` clipped to its top-left corner, with its first image drawn `scale` times as large from that corner.
 * PDFium draws a clipped image with transparent pixels where the clip cuts it, as if it had a soft mask.
 */
export function clipPage(p: Pdfium, bytes: Uint8Array, index: number, scale = 1): Uint8Array<ArrayBuffer> {
  const doc = openPdf(p, bytes);
  const page = p.FPDF_LoadPage(doc.handle, index);
  const [width, height] = [p.FPDF_GetPageWidthF(page), p.FPDF_GetPageHeightF(page)];
  p.FPDFPageObj_Transform(pageImages(p, page)[0] ?? 0, scale, 0, 0, scale, 0, height * (1 - scale));
  p.FPDFPage_GenerateContent(page);
  const clip = p.FPDF_CreateClipPath(0, height / 2, width / 4, height);
  p.FPDFPage_InsertClipPath(page, clip);
  p.FPDF_DestroyClipPath(clip);
  p.FPDF_ClosePage(page);
  const clipped = savePdf(p, doc.handle);
  closeDoc(p, doc);
  return clipped;
}

/** BGRA into a PDFium bitmap; with an alpha below 255, PDFium writes a soft mask. */
function fillImage(p: Pdfium, image: number, pixels: Uint8ClampedArray, size: { width: number; height: number }, alpha: number | "half"): void {
  const bitmap = p.FPDFBitmap_Create(size.width, size.height, alpha === 255 ? 0 : 1);
  const buffer = p.FPDFBitmap_GetBuffer(bitmap);
  const stride = p.FPDFBitmap_GetStride(bitmap);
  const heap = p.pdfium.HEAPU8;
  for (let y = 0; y < size.height; y++) {
    for (let x = 0; x < size.width; x++) {
      const from = (y * size.width + x) * 4;
      const to = buffer + y * stride + x * 4;
      heap[to] = pixels[from + 2] ?? 0;
      heap[to + 1] = pixels[from + 1] ?? 0;
      heap[to + 2] = pixels[from] ?? 0;
      heap[to + 3] = alpha !== "half" ? alpha : x < size.width / 2 ? 255 : 0;
    }
  }
  p.FPDFImageObj_SetBitmap(0, 0, image, bitmap);
  p.FPDFBitmap_Destroy(bitmap);
}

/** jpeg-js stands in for OffscreenCanvas, which Node lacks. Nearest-neighbour scaling: tests check sizes, not looks. */
export const encodeTestJpeg: EncodeJpeg = async ({ pixels, width, height }, outWidth, outHeight, quality) => {
  const scaled = new Uint8Array(outWidth * outHeight * 4);
  for (let y = 0; y < outHeight; y++) {
    const fromY = Math.floor((y * height) / outHeight);
    for (let x = 0; x < outWidth; x++) {
      const from = (fromY * width + Math.floor((x * width) / outWidth)) * 4;
      scaled.set(pixels.subarray(from, from + 4), (y * outWidth + x) * 4);
    }
  }
  return new Uint8Array(encode({ data: scaled, width: outWidth, height: outHeight }, Math.round(quality * 100)).data);
};

/** Each `in use` xref entry must point at `N G obj`, and startxref at the table. */
export function xrefErrors(bytes: Uint8Array): string[] {
  const all = Buffer.from(bytes).toString("latin1");
  const at = Number(/startxref\s+(\d+)\s+%%EOF\s*$/.exec(all)?.[1] ?? -1);
  const errors = all.startsWith("xref", at) ? [] : ["startxref"];
  let num = 0;
  for (const line of all.slice(at, all.indexOf("trailer", at)).split(/\r?\n/)) {
    const section = /^(\d+) \d+$/.exec(line);
    const entry = /^(\d{10}) (\d{5}) ([nf])/.exec(line);
    if (section) num = Number(section[1]);
    else if (entry) {
      if (entry[3] === "n" && !all.startsWith(`${num} ${Number(entry[2])} obj`, Number(entry[1]))) errors.push(`object ${num}`);
      num++;
    }
  }
  return errors;
}

/** PDFium writes no object streams: each image is one `/Subtype /Image` in the file. */
export function countImageStreams(bytes: Uint8Array): number {
  return (Buffer.from(bytes).toString("latin1").match(/\/Subtype\s*\/Image\b/g) ?? []).length;
}

/** The pixel size of the first image drawn on each page. */
export function imagePixelSizes(p: Pdfium, bytes: Uint8Array): [number, number][] {
  const doc = openPdf(p, bytes);
  const size = malloc(p, 8);
  try {
    return doc.sizes.map((_, index) => {
      const page = p.FPDF_LoadPage(doc.handle, index);
      p.FPDFImageObj_GetImagePixelSize(pageImages(p, page)[0] ?? 0, size, size + 4);
      p.FPDF_ClosePage(page);
      return [p.pdfium.getValue(size, "i32"), p.pdfium.getValue(size + 4, "i32")];
    });
  } finally {
    p.pdfium._free(size);
    closeDoc(p, doc);
  }
}

export type ReadPage = { text: string; rotation: number; width: number; height: number };

/** Reads a PDF with pdf.js, so the engine is never checked with itself. */
export async function readWithPdfjs(bytes: Uint8Array, password?: string): Promise<ReadPage[]> {
  const task = getDocument({ data: bytes.slice(), verbosity: 0, ...(password ? { password } : {}) });
  const doc = await task.promise;
  const pages: ReadPage[] = [];
  for (let number = 1; number <= doc.numPages; number++) {
    const page = await doc.getPage(number);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ("str" in item ? item.str : "")).join("").trim();
    const [left = 0, bottom = 0, right = 0, top = 0] = page.view;
    pages.push({ text, rotation: page.rotate, width: Math.round(right - left), height: Math.round(top - bottom) });
  }
  await task.destroy();
  return pages;
}

export type ReadBookmark = { title: string; level: number; page: number; dest: unknown[] };

export async function readOutline(bytes: Uint8Array, password?: string): Promise<ReadBookmark[]> {
  const task = getDocument({ data: bytes.slice(), verbosity: 0, ...(password ? { password } : {}) });
  const doc = await task.promise;
  const read: ReadBookmark[] = [];
  type Item = Awaited<ReturnType<typeof doc.getOutline>>[number];
  const walk = async (items: Item[], level: number) => {
    for (const item of items) {
      const [target, ...dest] = Array.isArray(item.dest) ? item.dest : [];
      const name = (dest[0] as { name?: string } | undefined)?.name;
      read.push({ title: item.title, level, page: target ? await doc.getPageIndex(target as never) : -1, dest: [name, ...dest.slice(1)] });
      await walk(item.items, level + 1);
    }
  };
  await walk((await doc.getOutline()) ?? [], 0);
  await task.destroy();
  return read;
}

/** 48 × 32 px gradient, made with sips, 960 bytes. */
export const gradientJpeg = Uint8Array.from(atob("/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAMKADAAQAAAABAAAAIAAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAIAAwAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMABAQEBAQEBgQEBgkGBgYJDAkJCQkMDwwMDAwMDxIPDw8PDw8SEhISEhISEhUVFRUVFRkZGRkZHBwcHBwcHBwcHP/bAEMBBAUFBwcHDAcHDB0UEBQdHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHf/dAAQAA//aAAwDAQACEQMRAD8A+SINK9q2INK9q7ODSv8AZrYg0r2r9MrZn5nz2W5xtqcXBpX+zWxBpX+zXaQaV7VrwaV7V4lbM/M/UMtzjbU4yDSv9mtiDSv9muzg0r/ZrYg0r/ZrxK2Z+Z+oZbnG2p//0Oeg0r/ZrYg0r/Zrs4NK/wBmtiDSv9muatmfmfznlucbanGQaV/s1sQaV7V2cGlf7NbEGlf7NeJWzPzP1DLc421OMg0r2rXg0r2rtINK/wBmtiDSvavErZn5n6hlucban//Z"), (char) => char.charCodeAt(0));

export function withOrientation(jpeg: Uint8Array, orientation: number): Uint8Array {
  const tiff = new DataView(new ArrayBuffer(26));
  tiff.setUint16(0, 0x4d4d);
  tiff.setUint16(2, 42);
  tiff.setUint32(4, 8);
  tiff.setUint16(8, 1);
  tiff.setUint16(10, 0x0112);
  tiff.setUint16(12, 3);
  tiff.setUint32(14, 1);
  tiff.setUint16(18, orientation);
  const segment = [0x45, 0x78, 0x69, 0x66, 0, 0, ...new Uint8Array(tiff.buffer)];
  const length = segment.length + 2;
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, length >> 8, length & 0xff, ...segment, ...jpeg.subarray(2)]);
}

const streamObject = (dict: string, content: string) => `<<${dict}/Length ${content.length}>>stream\n${content}\nendstream`;

/**
 * One page with an AcroForm: a text field "name" holding "Jean" on a red ground at (100, 160)–(300, 200) as the reader
 * sees it, a checked box "ok" on a blue ground at (100, 260)–(140, 300), a combo "city" with two options, a text field
 * "code" of five characters at most at (350, 160)–(450, 200), and two radio buttons "choice" (A, B checked) at y 270–300.
 */
export function formPdf(rotate = 0): Uint8Array {
  return rawPdf([
    "<</Type/Catalog/Pages 2 0 R/AcroForm<</Fields[4 0 R 5 0 R 10 0 R 11 0 R 12 0 R]/DA(/Helv 0 Tf 0 g)/DR<</Font<</Helv 6 0 R>>>>>>>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    `<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Rotate ${rotate}/Annots[4 0 R 5 0 R 10 0 R 11 0 R 13 0 R 14 0 R]>>`,
    "<</Type/Annot/Subtype/Widget/FT/Tx/T(name)/V(Jean)/Rect[100 600 300 640]/F 4/DA(/Helv 12 Tf 0 g)/MK<</BG[1 0 0]>>/AP<</N 7 0 R>>>>",
    "<</Type/Annot/Subtype/Widget/FT/Btn/T(ok)/V/Yes/AS/Yes/Rect[100 500 140 540]/F 4/MK<</BG[0 0 1]>>/AP<</N<</Yes 8 0 R/Off 9 0 R>>>>>>",
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>",
    streamObject("/Type/XObject/Subtype/Form/BBox[0 0 200 40]/Resources<</Font<</Helv 6 0 R>>>>", "1 0 0 rg 0 0 200 40 re f /Tx BMC BT /Helv 12 Tf 0 g 2 14 Td (Jean) Tj ET EMC"),
    streamObject("/Type/XObject/Subtype/Form/BBox[0 0 40 40]", "0 0 1 rg 0 0 40 40 re f"),
    streamObject("/Type/XObject/Subtype/Form/BBox[0 0 40 40]", "0 0 40 40 re S"),
    "<</Type/Annot/Subtype/Widget/FT/Ch/Ff 131072/T(city)/V(Lyon)/Opt[(Paris)(Lyon)]/Rect[100 400 300 430]/F 4/DA(/Helv 12 Tf 0 g)>>",
    "<</Type/Annot/Subtype/Widget/FT/Tx/T(code)/MaxLen 5/Rect[350 600 450 640]/F 4/DA(/Helv 12 Tf 0 g)>>",
    "<</FT/Btn/Ff 49152/T(choice)/V/B/Kids[13 0 R 14 0 R]>>",
    "<</Type/Annot/Subtype/Widget/Parent 12 0 R/Rect[350 500 380 530]/F 4/AS/Off/MK<</BG[0 1 0]>>/AP<</N<</A 15 0 R/Off 9 0 R>>>>>>",
    "<</Type/Annot/Subtype/Widget/Parent 12 0 R/Rect[400 500 430 530]/F 4/AS/B/MK<</BG[0 1 0]>>/AP<</N<</B 15 0 R/Off 9 0 R>>>>>>",
    streamObject("/Type/XObject/Subtype/Form/BBox[0 0 30 30]", "0 1 0 rg 0 0 30 30 re f"),
  ]);
}
