import { jpegRotation } from "./exif";
import { placeOnA4 } from "./imagePage";
import { EngineFailure } from "./failure";
import { closeForm } from "./forms";
import { copyIn, malloc, type Pdfium } from "./pdfium";
import type { PageSize } from "./types";

/**
 * `buffer` holds the file bytes, which PDFium reads lazily until the document closes. It is 0 for a built document,
 * and for a second handle opened by `reopenPdf`, which does not own the bytes.
 */
export type OpenDoc = { handle: number; buffer: number; size: number; password: string; sizes: PageSize[] };

export type ImageInput =
  | { kind: "jpeg"; bytes: Uint8Array }
  | { kind: "rgba"; width: number; height: number; pixels: Uint8Array | Uint8ClampedArray };

const passwordError = 4;

export function openPdf(p: Pdfium, bytes: Uint8Array, password = ""): OpenDoc {
  const buffer = copyIn(p, bytes);
  const handle = p.FPDF_LoadMemDocument64(buffer, bytes.length, password);
  if (handle === 0) {
    const code = p.FPDF_GetLastError();
    p.pdfium._free(buffer);
    if (code === passwordError) throw new EngineFailure({ kind: password === "" ? "passwordRequired" : "wrongPassword" });
    throw new EngineFailure({ kind: "damaged" });
  }
  return { handle, buffer, size: bytes.length, password, sizes: pageSizes(p, handle) };
}

/** A one-page A4 document. A JPEG is embedded as is, and its EXIF orientation becomes the page rotation. */
export function openImage(p: Pdfium, image: ImageInput): OpenDoc {
  const handle = p.FPDF_CreateNewDocument();
  const object = p.FPDFPageObj_NewImageObj(handle);
  const loaded = image.kind === "jpeg" ? setJpeg(p, object, image.bytes) : setRgba(p, object, image);
  const pixelSize = loaded ? imagePixelSize(p, object) : null;
  if (!pixelSize) {
    p.FPDFPageObj_Destroy(object);
    p.FPDF_CloseDocument(handle);
    throw new EngineFailure({ kind: "damaged" });
  }
  const place = placeOnA4(...pixelSize);
  const page = p.FPDFPage_New(handle, 0, place.pageWidth, place.pageHeight);
  p.FPDFImageObj_SetMatrix(object, place.width, 0, 0, place.height, place.x, place.y);
  p.FPDFPage_InsertObject(page, object);
  p.FPDFPage_GenerateContent(page);
  if (image.kind === "jpeg") p.FPDFPage_SetRotation(page, jpegRotation(image.bytes) / 90);
  p.FPDF_ClosePage(page);
  return { handle, buffer: 0, size: 0, password: "", sizes: pageSizes(p, handle) };
}

/** A second handle on an open PDF's bytes: what changes through it leaves the open file as it was. */
export function reopenPdf(p: Pdfium, doc: OpenDoc): OpenDoc {
  if (doc.buffer === 0) throw new EngineFailure({ kind: "unsupportedFormat" });
  const handle = p.FPDF_LoadMemDocument64(doc.buffer, doc.size, doc.password);
  if (handle === 0) throw new EngineFailure({ kind: "damaged" });
  return { ...doc, handle, buffer: 0 };
}

/** Streams the file out through a JS callback, so the whole PDF is never held twice in WASM memory. */
export function savePdf(p: Pdfium, handle: number): Uint8Array<ArrayBuffer> {
  const chunks: Uint8Array[] = [];
  const writeBlock = p.pdfium.addFunction((_self: number, data: number, size: number) => {
    chunks.push(p.pdfium.HEAPU8.slice(data, data + size));
    return 1;
  }, "iiii");
  const fileWrite = malloc(p, 8);
  p.pdfium.setValue(fileWrite, 1, "i32");
  p.pdfium.setValue(fileWrite + 4, writeBlock, "i32");
  try {
    if (!p.FPDF_SaveAsCopy(handle, fileWrite, 0)) throw new EngineFailure({ kind: "damaged" });
  } finally {
    p.pdfium._free(fileWrite);
    p.pdfium.removeFunction(writeBlock);
  }
  const bytes = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

export function closeDoc(p: Pdfium, doc: OpenDoc): void {
  closeForm(p, doc.handle);
  p.FPDF_CloseDocument(doc.handle);
  if (doc.buffer !== 0) p.pdfium._free(doc.buffer);
}

function pageSizes(p: Pdfium, handle: number): PageSize[] {
  const size = malloc(p, 8);
  try {
    return Array.from({ length: p.FPDF_GetPageCount(handle) }, (_, index) => {
      p.FPDF_GetPageSizeByIndexF(handle, index, size);
      return { width: p.pdfium.getValue(size, "float"), height: p.pdfium.getValue(size + 4, "float") };
    });
  } finally {
    p.pdfium._free(size);
  }
}

export function setJpeg(p: Pdfium, object: number, jpeg: Uint8Array): boolean {
  const pointer = copyIn(p, jpeg);
  try {
    return p.EPDFImageObj_SetJpeg(0, 0, object, pointer, jpeg.length);
  } finally {
    p.pdfium._free(pointer);
  }
}

/** PDFium bitmaps have no RGBA format: swap red and blue into BGRA. */
export function setRgba(p: Pdfium, object: number, image: Extract<ImageInput, { kind: "rgba" }>): boolean {
  const bitmap = p.FPDFBitmap_Create(image.width, image.height, 1);
  if (bitmap === 0) throw new EngineFailure({ kind: "outOfMemory" });
  try {
    const buffer = p.FPDFBitmap_GetBuffer(bitmap);
    const stride = p.FPDFBitmap_GetStride(bitmap);
    const heap = p.pdfium.HEAPU8;
    for (let y = 0; y < image.height; y++) {
      for (let x = 0; x < image.width; x++) {
        const from = (y * image.width + x) * 4;
        const to = buffer + y * stride + x * 4;
        heap[to] = image.pixels[from + 2] ?? 0;
        heap[to + 1] = image.pixels[from + 1] ?? 0;
        heap[to + 2] = image.pixels[from] ?? 0;
        heap[to + 3] = image.pixels[from + 3] ?? 255;
      }
    }
    return p.FPDFImageObj_SetBitmap(0, 0, object, bitmap);
  } finally {
    p.FPDFBitmap_Destroy(bitmap);
  }
}

/** Null when the image data cannot be decoded: PDFium copies JPEG bytes without checking them. */
export function imagePixelSize(p: Pdfium, object: number): [number, number] | null {
  const size = malloc(p, 8);
  try {
    if (!p.FPDFImageObj_GetImagePixelSize(object, size, size + 4)) return null;
    const width = p.pdfium.getValue(size, "i32");
    const height = p.pdfium.getValue(size + 4, "i32");
    return width > 0 && height > 0 ? [width, height] : null;
  } finally {
    p.pdfium._free(size);
  }
}
