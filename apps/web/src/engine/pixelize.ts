import { type OpenDoc, savePdf, setJpeg } from "./documents";
import { EngineFailure } from "./failure";
import type { EncodeJpeg } from "./imageObjects";
import type { Pdfium } from "./pdfium";
import { renderPage } from "./render";

const jpegQuality = 0.85;

/** A new document whose pages are pictures of the old ones, at the size the reader sees: no text, no vector left to copy. */
export async function pixelizePdf(p: Pdfium, doc: OpenDoc, ppi: number, encode: EncodeJpeg): Promise<Uint8Array<ArrayBuffer>> {
  const target = p.FPDF_CreateNewDocument();
  if (target === 0) throw new EngineFailure({ kind: "outOfMemory" });
  try {
    for (const [index, size] of doc.sizes.entries()) {
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
