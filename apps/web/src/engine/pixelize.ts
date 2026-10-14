import { closeDoc, type OpenDoc, openPdf, savePdf, setJpeg } from "./documents";
import { EngineFailure } from "./failure";
import type { EncodeJpeg } from "./imageObjects";
import { malloc, type Pdfium } from "./pdfium";
import { renderPage } from "./render";
import type { Watermark } from "./types";

const jpegQuality = 0.85;
/** An identity card on an A4 page keeps its small print readable; 300 ppi would double the file for nothing seen. */
const burnPpi = 200;

/**
 * A new document whose pages are pictures of the old ones, at the size the reader sees: no text, no vector left to copy.
 * A page `pictured` refuses is copied as it is.
 */
export async function pixelizePdf(p: Pdfium, doc: OpenDoc, ppi: number, encode: EncodeJpeg, pictured: (index: number) => boolean = () => true): Promise<Uint8Array<ArrayBuffer>> {
  const target = p.FPDF_CreateNewDocument();
  if (target === 0) throw new EngineFailure({ kind: "outOfMemory" });
  try {
    for (const [index, size] of doc.sizes.entries()) {
      if (!pictured(index)) {
        copyPage(p, target, doc.handle, index);
        continue;
      }
      const pixels = renderPage(p, doc, index, Math.max(1, Math.round(size.width / 72 * ppi)));
      const jpeg = await encode(pixels, pixels.width, pixels.height, jpegQuality);
      const page = p.FPDFPage_New(target, index, size.width, size.height);
      const object = p.FPDFPageObj_NewImageObj(target);
      if (page === 0 || object === 0 || !setJpeg(p, object, jpeg)) throw new EngineFailure({ kind: "damaged" });
      p.FPDFImageObj_SetMatrix(object, size.width, 0, 0, size.height, 0, 0);
      p.FPDFPage_InsertObject(page, object);
      const generated = p.FPDFPage_GenerateContent(page);
      p.FPDF_ClosePage(page);
      if (!generated) throw new EngineFailure({ kind: "damaged" });
    }
    return savePdf(p, target);
  } finally {
    p.FPDF_CloseDocument(target);
  }
}

/** The marked pages of a watermarked copy become pictures: the mark can no longer be lifted off them as an object. */
export async function burnMark(p: Pdfium, bytes: Uint8Array, op: Watermark, password: string, encode: EncodeJpeg): Promise<Uint8Array<ArrayBuffer>> {
  const marked = openPdf(p, bytes, password);
  try {
    return await pixelizePdf(p, marked, burnPpi, encode, (index) => index + 1 >= op.from && index + 1 <= op.to);
  } finally {
    closeDoc(p, marked);
  }
}

function copyPage(p: Pdfium, target: number, source: number, index: number): void {
  const indexes = malloc(p, 4);
  p.pdfium.HEAP32[indexes >> 2] = index;
  const copied = p.FPDF_ImportPagesByIndex(target, source, indexes, 1, index);
  p.pdfium._free(indexes);
  if (!copied) throw new EngineFailure({ kind: "damaged" });
}
