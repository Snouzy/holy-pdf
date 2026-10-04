import { closeDoc, type OpenDoc, reopenPdf, savePdf } from "./documents";
import { EngineFailure } from "./failure";
import { displayed } from "./pageText";
import type { Pdfium } from "./pdfium";
import type { PageSize } from "./types";

type Axes = ReturnType<typeof displayed>;

/**
 * The pages of `layer` laid on those of `doc`, page for page; the last page of `layer` goes on every page left. Under
 * the page, a layer shows only where the page paints nothing: a page does not paint its paper.
 */
export function overlaid(p: Pdfium, doc: OpenDoc, layer: OpenDoc, under: boolean): Uint8Array<ArrayBuffer> {
  // Any rewrite voids a digital signature; the layer is only read, so a signed layer is fine.
  if (p.FPDF_GetSignatureCount(doc.handle) > 0) throw new EngineFailure({ kind: "alreadySigned" });
  const copy = reopenPdf(p, doc);
  // One XObject per page of the layer, drawn as often as needed: a repeated letterhead is stored once.
  const xobjects = new Map<number, number>();
  try {
    for (let index = 0; index < copy.sizes.length; index++) {
      const from = Math.min(index, layer.sizes.length - 1);
      let xobject = xobjects.get(from);
      if (xobject === undefined) {
        xobject = p.FPDF_NewXObjectFromPage(copy.handle, layer.handle, from);
        if (xobject === 0) throw new EngineFailure({ kind: "damaged" });
        xobjects.set(from, xobject);
      }
      lay(p, copy.handle, index, xobject, layer.sizes[from]!, under);
    }
    return savePdf(p, copy.handle);
  } finally {
    for (const xobject of xobjects.values()) p.FPDF_CloseXObject(xobject);
    closeDoc(p, copy);
  }
}

function lay(p: Pdfium, handle: number, index: number, xobject: number, layer: PageSize, under: boolean): void {
  const page = p.FPDF_LoadPage(handle, index);
  if (page === 0) throw new EngineFailure({ kind: "damaged" });
  try {
    const object = p.FPDF_NewFormObjectFromXObject(xobject);
    if (object === 0) throw new EngineFailure({ kind: "damaged" });
    p.FPDFPageObj_Transform(object, ...fitted(displayed(p, page), layer));
    const inserted = under ? p.FPDFPage_InsertObjectAtIndex(page, object, 0) : (p.FPDFPage_InsertObject(page, object), true);
    if (!inserted || !p.FPDFPage_GenerateContent(page)) throw new EngineFailure({ kind: "damaged" });
  } finally {
    p.FPDF_ClosePage(page);
  }
}

/**
 * PDFium's XObject already shows the layer's page as the reader sees it, its crop box at the origin and its rotation in
 * its /Matrix (probe of 3 October). Scaled to fit the page as the reader sees it and centred, then taken into the
 * page's own space.
 */
function fitted(page: Axes, layer: PageSize): [number, number, number, number, number, number] {
  const scale = Math.min(page.width / layer.width, page.height / layer.height);
  const across = (page.width - layer.width * scale) / 2;
  const up = (page.height - layer.height * scale) / 2;
  return [
    scale * page.across.x, scale * page.across.y, scale * page.up.x, scale * page.up.y,
    page.origin.x + page.across.x * across + page.up.x * up, page.origin.y + page.across.y * across + page.up.y * up,
  ];
}
