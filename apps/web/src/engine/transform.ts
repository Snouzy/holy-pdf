import { writeBookmarks } from "./bookmarks";
import { cropPages } from "./crop";
import { closeDoc, type OpenDoc, openPdf, reopenPdf, savePdf } from "./documents";
import { editPages } from "./edit";
import { finishFields, isField } from "./formFields";
import { EngineFailure } from "./failure";
import { numberPages, watermarkPages, writeTextLayer } from "./pageText";
import { flattenPages } from "./flatten";
import { halvesOf, sheetsOf } from "./sheets";
import type { Pdfium } from "./pdfium";
import type { TransformOp } from "./types";

/** Every permission granted: the password guards the opening, not printing or copying. */
const allPermissions = -4;

/**
 * A copy of the whole document with one change; the open document stays as it was, for previews and the next run.
 * Pixelize, redact and Word are not here: they encode JPEGs, which is asynchronous. Nor is overlay, which reads a second
 * document. The worker runs them on their own.
 */
export function transformPdf(p: Pdfium, doc: OpenDoc, op: Exclude<TransformOp, { kind: "pixelize" | "redact" | "word" | "overlay" }>): Uint8Array<ArrayBuffer> {
  // A new document that carries no signature field: the source's signature is neither voided nor claimed.
  if (op.kind === "nup") return sheetsOf(p, doc.handle, op.perSheet);
  if (op.kind === "halves") return halvesOf(p, doc.handle, op.cut);
  // Any rewrite voids a digital signature, even when its field stays visible.
  if (p.FPDF_GetSignatureCount(doc.handle) > 0) throw new EngineFailure({ kind: "alreadySigned" });
  // The document was opened repaired: its bytes are the copy.
  if (op.kind === "repair") return p.pdfium.HEAPU8.slice(doc.buffer, doc.buffer + doc.size);
  const copy = reopenPdf(p, doc);
  const added = op.kind === "edit" ? op.items.filter(isField) : [];
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    if (op.kind === "numbers") numberPages(p, copy.handle, op);
    else if (op.kind === "watermark") watermarkPages(p, copy.handle, op);
    else if (op.kind === "flatten") flattenPages(p, copy.handle);
    else if (op.kind === "ocr") writeTextLayer(p, copy.handle, op.pages);
    else if (op.kind === "bookmarks") writeBookmarks(p, copy.handle, op.bookmarks);
    else if (op.kind === "edit") editPages(p, copy.handle, op.items, op.images, op.edits, op.fields);
    else if (op.kind === "crop") cropPages(p, copy.handle, op.box, op.page);
    else if (!(op.kind === "protect" ? p.EPDF_SetEncryption(copy.handle, op.password, op.password, allPermissions) : p.EPDF_RemoveEncryption(copy.handle))) {
      throw new EngineFailure({ kind: "damaged" });
    }
    bytes = savePdf(p, copy.handle);
  } finally {
    closeDoc(p, copy);
  }
  return added.length > 0 ? finished(p, bytes, added, doc.password) : bytes;
}

/** PDFium knows a field by the name it was created with: the fields just added get their flags, look and options on the saved document reopened. */
function finished(p: Pdfium, bytes: Uint8Array<ArrayBuffer>, added: Parameters<typeof finishFields>[2], password: string): Uint8Array<ArrayBuffer> {
  const again = openPdf(p, bytes, password);
  try {
    finishFields(p, again.handle, added);
    return savePdf(p, again.handle);
  } finally {
    closeDoc(p, again);
  }
}
