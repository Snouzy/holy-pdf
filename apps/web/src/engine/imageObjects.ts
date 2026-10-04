import { EngineFailure } from "./failure";
import { malloc, type Pdfium } from "./pdfium";

/** RGBA, 4 bytes per pixel, rows without padding. */
export type Pixels = { pixels: Uint8ClampedArray<ArrayBuffer>; width: number; height: number };

/** `width` and `height` are the size of the JPEG; `quality` goes from 0 to 1. */
export type EncodeJpeg = (image: Pixels, width: number, height: number, quality: number) => Promise<Uint8Array<ArrayBuffer>>;

const imageObject = 3;

/** The image objects drawn directly on the page, not those inside form XObjects. */
export function pageImages(p: Pdfium, page: number): number[] {
  return Array.from({ length: p.FPDFPage_CountObjects(page) }, (_, index) => p.FPDFPage_GetObject(page, index)).filter(
    (object) => p.FPDFPageObj_GetType(object) === imageObject,
  );
}

/** Under this many pixels on a side, an image is a bullet, a line or an icon, not a photo. */
export const smallestSide = 64;

const gray = 1;
const bgr = 2;
const bgra = 4;

/** PDFium bitmaps are gray, BGR, BGRx or BGRA; the encoder wants RGBA. Null for a format PDFium does not name. */
export function readBitmap(p: Pdfium, bitmap: number): Pixels | null {
  const format = p.FPDFBitmap_GetFormat(bitmap);
  if (format < gray) return null;
  const width = p.FPDFBitmap_GetWidth(bitmap);
  const height = p.FPDFBitmap_GetHeight(bitmap);
  const stride = p.FPDFBitmap_GetStride(bitmap);
  const start = p.FPDFBitmap_GetBuffer(bitmap);
  const step = format === gray ? 1 : format === bgr ? 3 : 4;
  const heap = p.pdfium.HEAPU8;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const from = start + y * stride + x * step;
      const to = (y * width + x) * 4;
      const blue = heap[from] ?? 0;
      pixels[to] = step === 1 ? blue : (heap[from + 2] ?? 0);
      pixels[to + 1] = step === 1 ? blue : (heap[from + 1] ?? 0);
      pixels[to + 2] = blue;
      pixels[to + 3] = format >= bgra ? (heap[from + 3] ?? 255) : 255;
    }
  }
  return { pixels, width, height };
}

/** The image's stream as the file stores it, still encoded. */
export function rawData(p: Pdfium, image: number): Uint8Array<ArrayBuffer> {
  return imageData(p, image, false);
}

/** Stream bytes after lossless filters, stable when saving adds Flate compression. */
export function decodedData(p: Pdfium, image: number): Uint8Array<ArrayBuffer> {
  return imageData(p, image, true);
}

function imageData(p: Pdfium, image: number, decoded: boolean): Uint8Array<ArrayBuffer> {
  const read = decoded ? p.FPDFImageObj_GetImageDataDecoded : p.FPDFImageObj_GetImageDataRaw;
  const length = read(image, 0, 0);
  if (decoded && length <= 0) throw new EngineFailure({ kind: "damaged" });
  if (decoded && length > 64_000_000) throw new EngineFailure({ kind: "outOfMemory" });
  const buffer = malloc(p, Math.max(1, length));
  try {
    read(image, buffer, length);
    return p.pdfium.HEAPU8.slice(buffer, buffer + length);
  } finally {
    p.pdfium._free(buffer);
  }
}

export async function fingerprint(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const formObject = 5;

/** Every image object the page draws, those inside form XObjects included. */
export function imagesOnPage(p: Pdfium, page: number): number[] {
  return Array.from({ length: p.FPDFPage_CountObjects(page) }, (_, index) => p.FPDFPage_GetObject(page, index)).flatMap((object) => imagesIn(p, object));
}

function imagesIn(p: Pdfium, object: number): number[] {
  const type = p.FPDFPageObj_GetType(object);
  if (type === imageObject) return [object];
  if (type !== formObject) return [];
  return Array.from({ length: p.FPDFFormObj_CountObjects(object) }, (_, index) => p.FPDFFormObj_GetObject(object, index)).flatMap((inner) => imagesIn(p, inner));
}

/** The image's own pixels at its native size, without the clip or placement of its draw. */
export function imageBitmap(p: Pdfium, image: number): Pixels | null {
  const bitmap = p.FPDFImageObj_GetBitmap(image);
  if (bitmap === 0) return null;
  try {
    return readBitmap(p, bitmap);
  } finally {
    p.FPDFBitmap_Destroy(bitmap);
  }
}
