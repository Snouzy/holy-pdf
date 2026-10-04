import { closeDoc, type OpenDoc, reopenPdf, savePdf, setJpeg } from "./documents";
import { EngineFailure } from "./failure";
import { formOf } from "./forms";
import type { EncodeJpeg, Pixels } from "./imageObjects";
import { displayed } from "./pageText";
import { malloc, type Pdfium } from "./pdfium";
import { renderPage } from "./render";
import type { PageSize, RedactZone } from "./types";

const ppi = 200;
/** A poster at 200 ppi would take gigabytes. */
const longestSide = 6000;
const jpegQuality = 0.8;
const widget = 20;

type Removed = { annots: Set<number>; fields: Set<number> };

/**
 * A copy where each page that carries a zone becomes a picture of itself, the zones in black. PDFium writes only the
 * objects the file still reaches, so the page's old content leaves the file; the page itself stays, and so do the
 * bookmarks and links that lead to it.
 */
export async function redactPdf(p: Pdfium, doc: OpenDoc, zones: RedactZone[], encode: EncodeJpeg): Promise<Uint8Array<ArrayBuffer>> {
  if (p.FPDF_GetSignatureCount(doc.handle) > 0) throw new EngineFailure({ kind: "alreadySigned" });
  // An XFA form keeps its values in an XML stream that no page reaches, and that PDFium cannot edit.
  if (p.FPDF_GetFormType(doc.handle) >= 2) throw new EngineFailure({ kind: "xfaForm" });
  const pages = zonesByPage(zones, doc.sizes);
  const copy = reopenPdf(p, doc);
  let empty = 0;
  try {
    const form = formOf(p, copy.handle);
    if (form === 0) throw new EngineFailure({ kind: "damaged" });
    empty = malloc(p, 2);
    p.pdfium.setValue(empty, 0, "i16");
    const removed: Removed = { annots: new Set(), fields: new Set() };
    for (const [index, onPage] of pages) {
      const picture = renderPage(p, doc, index, pictureWidth(doc.sizes[index]!));
      for (const zone of onPage) blacken(picture, zone);
      replacePage(p, copy.handle, form, index, await encode(picture, picture.width, picture.height, jpegQuality), removed, empty);
    }
    if (removed.annots.size > 0) dropLinked(p, copy.handle, form, removed, empty);
    return savePdf(p, copy.handle);
  } finally {
    p.pdfium._free(empty);
    closeDoc(p, copy);
  }
}

function zonesByPage(zones: RedactZone[], sizes: PageSize[]): Map<number, RedactZone[]> {
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  const pages = new Map<number, RedactZone[]>();
  for (const zone of zones) {
    const [x, y] = [clamp(zone.x), clamp(zone.y)];
    const [width, height] = [clamp(zone.x + zone.width) - x, clamp(zone.y + zone.height) - y];
    if (!sizes[zone.pageIndex] || !(width > 0 && height > 0)) continue;
    pages.set(zone.pageIndex, [...(pages.get(zone.pageIndex) ?? []), { ...zone, x, y, width, height }]);
  }
  return pages;
}

function pictureWidth(size: PageSize): number {
  return Math.max(1, Math.round(size.width * Math.min(ppi / 72, longestSide / Math.max(size.width, size.height))));
}

/** Whole pixels, with no smoothing at the edges: a half-grey pixel of a letter would stay readable. */
function blacken({ pixels, width, height }: Pixels, zone: RedactZone): void {
  const [left, right] = [Math.floor(zone.x * width), Math.ceil((zone.x + zone.width) * width)];
  const [top, bottom] = [Math.floor(zone.y * height), Math.ceil((zone.y + zone.height) * height)];
  const row = new Uint8ClampedArray((right - left) * 4).map((_, index) => (index % 4 === 3 ? 255 : 0));
  for (let y = top; y < bottom; y++) pixels.set(row, (y * width + left) * 4);
}

function replacePage(p: Pdfium, handle: number, form: number, index: number, jpeg: Uint8Array, removed: Removed, empty: number): void {
  const page = p.FPDF_LoadPage(handle, index);
  if (page === 0) throw new EngineFailure({ kind: "damaged" });
  try {
    const count = p.FPDFPage_GetAnnotCount(page);
    for (let i = 0; i < count; i++) withAnnot(p, page, i, (annot) => forget(p, form, annot, removed, empty));
    for (let i = count - 1; i >= 0; i--) if (!p.FPDFPage_RemoveAnnot(page, i)) throw new EngineFailure({ kind: "damaged" });
    for (let i = p.FPDFPage_CountObjects(page) - 1; i >= 0; i--) {
      const object = p.FPDFPage_GetObject(page, i);
      if (!p.FPDFPage_RemoveObject(page, object)) throw new EngineFailure({ kind: "damaged" });
      p.FPDFPageObj_Destroy(object);
    }
    const picture = p.FPDFPageObj_NewImageObj(handle);
    if (picture === 0 || !setJpeg(p, picture, jpeg)) throw new EngineFailure({ kind: "damaged" });
    const { origin, across, up, width, height } = displayed(p, page);
    p.FPDFImageObj_SetMatrix(picture, across.x * width, across.y * width, up.x * height, up.y * height, origin.x, origin.y);
    p.FPDFPage_InsertObject(page, picture);
    if (!p.FPDFPage_GenerateContent(page)) throw new EngineFailure({ kind: "damaged" });
  } finally {
    p.FPDF_ClosePage(page);
  }
}

/** Takes off every page what still points to a removed annotation or field: a note's bubble, a reply, a widget of the field. */
function dropLinked(p: Pdfium, handle: number, form: number, removed: Removed, empty: number): void {
  for (let found = true; found;) {
    found = false;
    for (let index = 0; index < p.FPDF_GetPageCount(handle); index++) {
      const page = p.FPDF_LoadPage(handle, index);
      if (page === 0) throw new EngineFailure({ kind: "damaged" });
      try {
        const linked: number[] = [];
        for (let i = 0; i < p.FPDFPage_GetAnnotCount(page); i++) {
          withAnnot(p, page, i, (annot) => {
            if (!pointsToRemoved(p, form, annot, removed)) return;
            forget(p, form, annot, removed, empty);
            linked.push(i);
          });
        }
        for (const i of linked.reverse()) if (!p.FPDFPage_RemoveAnnot(page, i)) throw new EngineFailure({ kind: "damaged" });
        found ||= linked.length > 0;
      } finally {
        p.FPDF_ClosePage(page);
      }
    }
  }
}

function pointsToRemoved(p: Pdfium, form: number, annot: number, removed: Removed): boolean {
  if (p.FPDFAnnot_GetSubtype(annot) === widget && removed.fields.has(p.EPDFAnnot_GetFormFieldObjectNumber(form, annot))) return true;
  return ["Parent", "IRT"].some((key) => {
    const other = p.FPDFAnnot_GetLinkedAnnot(annot, key);
    if (other === 0) return false;
    const number = p.EPDFAnnot_GetObjectNumber(other);
    p.FPDFPage_CloseAnnot(other);
    return removed.annots.has(number);
  });
}

/**
 * Empties an annotation before it leaves its page: the tag tree, a field or another annotation can still reach it.
 * The form API clears the value where the field keeps it, which may be a parent that no annotation call reaches.
 */
function forget(p: Pdfium, form: number, annot: number, removed: Removed, empty: number): void {
  const number = p.EPDFAnnot_GetObjectNumber(annot);
  if (number > 0) removed.annots.add(number);
  if (p.FPDFAnnot_GetSubtype(annot) === widget) {
    const field = p.EPDFAnnot_GetFormFieldObjectNumber(form, annot);
    if (field > 0) removed.fields.add(field);
    p.EPDFAnnot_SetFormFieldValue(form, annot, empty);
  }
  for (const key of ["V", "DV", "Contents", "RC"]) if (p.FPDFAnnot_HasKey(annot, key)) p.FPDFAnnot_SetStringValue(annot, key, empty);
  p.FPDFAnnot_SetURI(annot, empty);
  for (const mode of [0, 1, 2]) p.FPDFAnnot_SetAP(annot, mode, 0);
}

function withAnnot(p: Pdfium, page: number, index: number, use: (annot: number) => void): void {
  const annot = p.FPDFPage_GetAnnot(page, index);
  if (annot === 0) throw new EngineFailure({ kind: "damaged" });
  try {
    use(annot);
  } finally {
    p.FPDFPage_CloseAnnot(annot);
  }
}
