import type { OpenDoc } from "./documents";
import { EngineFailure } from "./failure";
import { formOf } from "./forms";
import type { Pdfium } from "./pdfium";

export type RenderedPage = { width: number; height: number; pixels: Uint8ClampedArray<ArrayBuffer> };

const annotations = 0x01;
/** Without it PDFium writes BGRA. */
const reverseByteOrder = 0x10;
const white = 0xffffffff;

/** The page's own rotation is applied; `width` is in pixels. */
export function renderPage(p: Pdfium, doc: OpenDoc, index: number, width: number): RenderedPage {
  const page = p.FPDF_LoadPage(doc.handle, index);
  if (page === 0) throw new EngineFailure({ kind: "damaged" });
  try {
    return renderLoaded(p, page, width, formOf(p, doc.handle));
  } finally {
    p.FPDF_ClosePage(page);
  }
}

/** Renders the page's objects as they are in memory: a retouched object shows without the content being regenerated. */
/** `form`: the document's form-fill environment; without it the page's form fields stay blank. */
export function renderLoaded(p: Pdfium, page: number, width: number, form = 0): RenderedPage {
  {
    const height = Math.max(1, Math.round((width * p.FPDF_GetPageHeightF(page)) / p.FPDF_GetPageWidthF(page)));
    const bitmap = p.FPDFBitmap_Create(width, height, 1);
    if (bitmap === 0) throw new EngineFailure({ kind: "outOfMemory" });
    try {
      p.FPDFBitmap_FillRect(bitmap, 0, 0, width, height, white);
      p.FPDF_RenderPageBitmap(bitmap, page, 0, 0, width, height, 0, annotations | reverseByteOrder);
      if (form !== 0) {
        p.FORM_OnAfterLoadPage(page, form);
        try {
          p.FPDF_FFLDraw(form, bitmap, page, 0, 0, width, height, 0, annotations | reverseByteOrder);
        } finally {
          p.FORM_OnBeforeClosePage(page, form);
        }
      }
      const buffer = p.FPDFBitmap_GetBuffer(bitmap);
      const stride = p.FPDFBitmap_GetStride(bitmap);
      const pixels = new Uint8ClampedArray(width * height * 4);
      for (let y = 0; y < height; y++) {
        pixels.set(p.pdfium.HEAPU8.subarray(buffer + y * stride, buffer + y * stride + width * 4), y * width * 4);
      }
      return { width, height, pixels };
    } finally {
      p.FPDFBitmap_Destroy(bitmap);
    }
  }
}
