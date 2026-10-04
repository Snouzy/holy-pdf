import { closeDoc, reopenPdf, savePdf, setRgba, type OpenDoc } from "./documents";
import { EngineFailure } from "./failure";
import { malloc, type Pdfium } from "./pdfium";
import type { Progress } from "./protocol";
import { signatureMatrix, validSignaturePlacement, validSignaturePageRotations, type PageFrame } from "./signatureGeometry";
import { signatureImages } from "./signatureImages";
import type { SignatureImage, SignaturePlacement } from "./types";

/** Add a visual signature to a fresh handle on the original PDF, leaving previews and subsequent exports intact. */
export function signPdf(p: Pdfium, source: OpenDoc, image: SignatureImage, placements: SignaturePlacement[], report?: (progress: Progress) => void, pageRotations: Record<number, number> = {}, images: Record<string, SignatureImage> = {}): Uint8Array<ArrayBuffer> {
  const referenced = signatureImages(image, placements, images);
  if (!referenced || !validSignaturePageRotations(pageRotations, source.sizes.length) || !placements.every((place) => validSignaturePlacement(place, source.sizes))) {
    throw new EngineFailure({ kind: "invalidSignature" });
  }
  if (p.FPDF_GetSignatureCount(source.handle) > 0) throw new EngineFailure({ kind: "alreadySigned" });
  const doc = reopenPdf(p, source);
  const assets = new Map<SignatureImage, { document: number; xobject: number }>();
  try {
    for (const selected of referenced.values()) {
      if (!assets.has(selected)) assets.set(selected, signatureAsset(p, doc.handle, selected));
    }
    // Matches the existing password warning: exported PDFs are no longer encrypted.
    p.EPDF_RemoveEncryption(doc.handle);
    const byPage = new Map<number, SignaturePlacement[]>();
    for (const placement of placements) {
      const list = byPage.get(placement.pageIndex) ?? [];
      list.push(placement);
      byPage.set(placement.pageIndex, list);
    }
    let done = 0;
    for (const [pageIndex, list] of byPage) {
      const page = p.FPDF_LoadPage(doc.handle, pageIndex);
      if (page === 0) throw new EngineFailure({ kind: "damaged" });
      try {
        const frame = pageFrame(p, page);
        for (const placement of list) {
          const asset = assets.get(referenced.get(placement.imageId)!)!;
          const object = p.FPDF_NewFormObjectFromXObject(asset.xobject);
          if (object === 0) throw new EngineFailure({ kind: "outOfMemory" });
          let inserted = false;
          try {
            p.FPDFPageObj_Transform(object, ...signatureMatrix(frame, placement));
            p.FPDFPage_InsertObject(page, object);
            inserted = true;
          } finally {
            if (!inserted) p.FPDFPageObj_Destroy(object);
          }
        }
        if (!p.FPDFPage_GenerateContent(page)) throw new EngineFailure({ kind: "damaged" });
        done += list.length;
        report?.({ done, total: placements.length });
      } finally {
        p.FPDF_ClosePage(page);
      }
    }
    for (const [index, angle] of Object.entries(pageRotations)) {
      if (!angle) continue;
      const page = p.FPDF_LoadPage(doc.handle, Number(index));
      if (page === 0) throw new EngineFailure({ kind: "damaged" });
      try { p.FPDFPage_SetRotation(page, (p.FPDFPage_GetRotation(page) + angle / 90) % 4); }
      finally { p.FPDF_ClosePage(page); }
    }
    return savePdf(p, doc.handle);
  } finally {
    for (const asset of assets.values()) {
      p.FPDF_CloseXObject(asset.xobject);
      p.FPDF_CloseDocument(asset.document);
    }
    closeDoc(p, doc);
  }
}

/** A one-unit scratch page contains only the new image. Import it once as a shared Form XObject,
 * so ten placements share one image and alpha mask. The user's pages are never copied.
 */
function signatureAsset(p: Pdfium, target: number, image: SignatureImage): { document: number; xobject: number } {
  const document = p.FPDF_CreateNewDocument();
  if (document === 0) throw new EngineFailure({ kind: "outOfMemory" });
  try {
    const page = p.FPDFPage_New(document, 0, 1, 1);
    if (page === 0) throw new EngineFailure({ kind: "outOfMemory" });
    try {
      const object = p.FPDFPageObj_NewImageObj(document);
      if (object === 0) throw new EngineFailure({ kind: "outOfMemory" });
      let inserted = false;
      try {
        if (!setRgba(p, object, { kind: "rgba", ...image }) || !p.FPDFImageObj_SetMatrix(object, 1, 0, 0, 1, 0, 0)) throw new EngineFailure({ kind: "damaged" });
        p.FPDFPage_InsertObject(page, object);
        inserted = true;
        if (!p.FPDFPage_GenerateContent(page)) throw new EngineFailure({ kind: "damaged" });
      } finally {
        if (!inserted) p.FPDFPageObj_Destroy(object);
      }
    } finally {
      p.FPDF_ClosePage(page);
    }
    const xobject = p.FPDF_NewXObjectFromPage(target, document, 0);
    if (xobject === 0) throw new EngineFailure({ kind: "damaged" });
    return { document, xobject };
  } catch (error) {
    p.FPDF_CloseDocument(document);
    throw error;
  }
}

/** PDFium applies the same crop and intrinsic rotation here as in renderPage (extra rotation = 0).
 * Only the three device corners are integers; interpolation retains subpixel placement precision.
 * https://pdfium.googlesource.com/pdfium/+/refs/heads/main/public/fpdfview.h
 */
export function pageFrame(p: Pdfium, page: number): PageFrame {
  const point = malloc(p, 16);
  try {
    const convert = (x: number, y: number) => {
      if (!p.FPDF_DeviceToPage(page, 0, 0, 1024, 1024, 0, x, y, point, point + 8)) throw new EngineFailure({ kind: "damaged" });
      return { x: p.pdfium.getValue(point, "double"), y: p.pdfium.getValue(point + 8, "double") };
    };
    return { topLeft: convert(0, 0), topRight: convert(1024, 0), bottomLeft: convert(0, 1024) };
  } finally {
    p.pdfium._free(point);
  }
}
