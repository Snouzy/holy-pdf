import { EngineFailure } from "./failure";
import type { Pdfium } from "./pdfium";

/** Draw annotations and form fields as they are shown on screen, not as printed. */
const normalDisplay = 0;
const failed = 0;

export function flattenPages(p: Pdfium, handle: number): void {
  for (let index = 0; index < p.FPDF_GetPageCount(handle); index++) {
    const page = p.FPDF_LoadPage(handle, index);
    if (page === 0) throw new EngineFailure({ kind: "damaged" });
    try {
      if (p.FPDFPage_Flatten(page, normalDisplay) === failed) throw new EngineFailure({ kind: "damaged" });
    } finally {
      p.FPDF_ClosePage(page);
    }
  }
}
