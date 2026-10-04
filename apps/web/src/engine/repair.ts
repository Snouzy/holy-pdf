import { closeDoc, type OpenDoc, openPdf, savePdf } from "./documents";
import { EngineFailure, failureOf } from "./failure";
import type { Pdfium } from "./pdfium";

const encrypt = new TextEncoder().encode("/Encrypt");

export type Rebuild = (bytes: Uint8Array<ArrayBuffer>, password: string) => Promise<Uint8Array<ArrayBuffer>>;

/**
 * qpdf rebuilds what PDFium cannot open, such as a file cut short. When qpdf finds the file damaged or does not load,
 * PDFium's own rewrite is the repair. Either way, the open document holds the repaired file.
 */
export async function openRepaired(p: Pdfium, bytes: Uint8Array<ArrayBuffer>, password: string, rebuild: Rebuild): Promise<OpenDoc> {
  let rebuilt: Uint8Array<ArrayBuffer>;
  try {
    rebuilt = await rebuild(bytes, password);
    // A file cut before its trailer loses the reference to its encryption: qpdf then copies the encrypted streams as
    // they are, and every page comes out blank.
    if (contains(bytes, encrypt) && !contains(rebuilt, encrypt)) throw new EngineFailure({ kind: "damaged" });
  } catch (error) {
    const failure = failureOf(error).error;
    // A password is the visitor's to give, and a file too big for qpdf is too big for two copies in PDFium.
    if (failure.kind !== "damaged" && failure.kind !== "engineUnavailable") throw new EngineFailure(failure);
    try {
      return withPages(p, rewritten(p, bytes, password));
    } catch (fallback) {
      throw failureOf(fallback).error.kind === "damaged" ? new EngineFailure(failure) : fallback;
    }
  }
  return withPages(p, openPdf(p, rebuilt, password));
}

function rewritten(p: Pdfium, bytes: Uint8Array<ArrayBuffer>, password: string): OpenDoc {
  const doc = openPdf(p, bytes, password);
  try {
    return openPdf(p, savePdf(p, doc.handle), password);
  } finally {
    closeDoc(p, doc);
  }
}

function withPages(p: Pdfium, doc: OpenDoc): OpenDoc {
  if (doc.sizes.length > 0) return doc;
  closeDoc(p, doc);
  throw new EngineFailure({ kind: "damaged" });
}

function contains(bytes: Uint8Array, pattern: Uint8Array): boolean {
  for (let at = bytes.indexOf(pattern[0]!); at !== -1; at = bytes.indexOf(pattern[0]!, at + 1)) {
    if (pattern.every((byte, index) => bytes[at + index] === byte)) return true;
  }
  return false;
}
