import { savePdf, setJpeg } from "./documents";
import { EngineFailure } from "./failure";
import { writeTextLayer } from "./pageText";
import { malloc, type Pdfium } from "./pdfium";
import type { OcrLine } from "./types";
import { type PageFormat, pdfPageSize } from "../scan/sizing";

/** `width` and `height` are the picture's pixels; the page size comes from `format`. `lines` are in the picture's fractions. */
export type ScanPdfPage = { jpeg: Uint8Array; width: number; height: number; format: PageFormat; lines?: OcrLine[] | undefined };

/** One page per picture, its JPEG embedded as it is, centred and whole on a page of the chosen format. */
export function scanPdf(p: Pdfium, pages: ScanPdfPage[], title: string): Uint8Array<ArrayBuffer> {
  if (pages.length === 0) throw new EngineFailure({ kind: "damaged" });
  const doc = p.FPDF_CreateNewDocument();
  if (doc === 0) throw new EngineFailure({ kind: "outOfMemory" });
  try {
    const text: { pageIndex: number; lines: OcrLine[] }[] = [];
    for (const [index, { jpeg, width, height, format, lines }] of pages.entries()) {
      const size = pdfPageSize(format, { width, height });
      const page = p.FPDFPage_New(doc, index, size.width, size.height);
      const picture = p.FPDFPageObj_NewImageObj(doc);
      if (page === 0 || picture === 0 || !setJpeg(p, picture, jpeg)) throw new EngineFailure({ kind: "damaged" });
      const scale = Math.min(size.width / width, size.height / height);
      const [drawnWidth, drawnHeight] = [width * scale, height * scale];
      p.FPDFImageObj_SetMatrix(picture, drawnWidth, 0, 0, drawnHeight, (size.width - drawnWidth) / 2, (size.height - drawnHeight) / 2);
      p.FPDFPage_InsertObject(page, picture);
      const generated = p.FPDFPage_GenerateContent(page);
      p.FPDF_ClosePage(page);
      if (!generated) throw new EngineFailure({ kind: "damaged" });
      const [left, top] = [(size.width - drawnWidth) / 2, (size.height - drawnHeight) / 2];
      if (lines?.length) {
        text.push({ pageIndex: index, lines: lines.map((line) => ({
          text: line.text, x: (left + line.x * drawnWidth) / size.width, y: (top + line.y * drawnHeight) / size.height,
          width: line.width * drawnWidth / size.width, height: line.height * drawnHeight / size.height,
        })) });
      }
    }
    writeTextLayer(p, doc, text);
    const value = malloc(p, (title.length + 1) * 2);
    try {
      p.pdfium.stringToUTF16(title, value, (title.length + 1) * 2);
      p.EPDF_SetMetaText(doc, "Title", value);
    } finally {
      p.pdfium._free(value);
    }
    return savePdf(p, doc);
  } finally {
    p.FPDF_CloseDocument(doc);
  }
}
