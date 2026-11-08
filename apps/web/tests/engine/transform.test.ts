import { beforeAll, describe, expect, it } from "vitest";
import { closeDoc, openPdf, savePdf } from "../../src/engine/documents";
import type { Pdfium } from "../../src/engine/pdfium";
import { transformPdf } from "../../src/engine/transform";
import { loadTestPdfium, permissionsWithPdfjs, rawPdf, readWithPdfjs, textPdf } from "./support";

let p: Pdfium;
beforeAll(async () => {
  p = await loadTestPdfium();
});

function transformed(bytes: Uint8Array, op: Parameters<typeof transformPdf>[2], password = "") {
  const doc = openPdf(p, bytes, password);
  try {
    return transformPdf(p, doc, op);
  } finally {
    closeDoc(p, doc);
  }
}

describe("transformPdf", () => {
  it("protects a PDF: it then opens with its password only, in PDFium and in pdf.js", async () => {
    // A space, an accent and a symbol: the password keeps every character typed.
    const bytes = transformed(textPdf(p, ["One", "Two"]), { kind: "protect", password: "s3cret é#" });
    expect(() => openPdf(p, bytes)).toThrow("passwordRequired");
    expect(() => openPdf(p, bytes, "wrong")).toThrow("wrongPassword");
    const doc = openPdf(p, bytes, "s3cret é#");
    expect(doc.sizes).toHaveLength(2);
    closeDoc(p, doc);
    await expect(readWithPdfjs(bytes)).rejects.toThrow();
    await expect(readWithPdfjs(bytes, "wrong")).rejects.toThrow();
    expect((await readWithPdfjs(bytes, "s3cret é#")).map((page) => page.text)).toEqual(["One", "Two"]);
  });

  it("unlocks a PDF opened with its password: the copy opens without one", async () => {
    const bytes = transformed(textPdf(p, ["Locked"], {}, "open sesame"), { kind: "unlock" }, "open sesame");
    const doc = openPdf(p, bytes);
    expect(doc.sizes).toHaveLength(1);
    closeDoc(p, doc);
    expect((await readWithPdfjs(bytes)).map((page) => page.text)).toEqual(["Locked"]);
  });

  it("unlocks a PDF that opens without a password but forbids printing and copying: the copy has no restriction", async () => {
    const restricted = restrictedPdf(["Restricted"]);
    const doc = openPdf(p, restricted);
    expect(p.FPDF_GetDocPermissions(doc.handle) & (print | copy)).toBe(0);
    const before = await permissionsWithPdfjs(restricted);
    expect(before).not.toBeNull();
    expect(before).not.toContain(print);
    expect(before).not.toContain(copy);
    const bytes = transformPdf(p, doc, { kind: "unlock" });
    closeDoc(p, doc);
    const copyDoc = openPdf(p, bytes);
    expect(p.FPDF_GetDocPermissions(copyDoc.handle) >>> 0).toBe(0xffffffff);
    closeDoc(p, copyDoc);
    // pdf.js, not the engine that wrote the copy, confirms that no encryption is left.
    expect(await permissionsWithPdfjs(bytes)).toBeNull();
    expect((await readWithPdfjs(bytes)).map((page) => page.text)).toEqual(["Restricted"]);
  });

  it("refuses a digitally signed PDF: rewriting it would void the signature", () => {
    for (const op of [{ kind: "protect", password: "x" }, { kind: "unlock" }] as const) {
      expect(() => transformed(signedPdf(), op)).toThrow("alreadySigned");
    }
  });
});

/** Permission bits of the PDF standard security handler, the same values in pdf.js: bit 3 prints, bit 5 copies. */
const [print, copy] = [1 << 2, 1 << 4];

/** An owner password only: the file opens with no password, and its permissions deny everything. */
function restrictedPdf(labels: string[]): Uint8Array {
  const doc = openPdf(p, textPdf(p, labels));
  try {
    p.EPDF_SetEncryption(doc.handle, "", "owner-only", 0);
    return savePdf(p, doc.handle);
  } finally {
    closeDoc(p, doc);
  }
}

function signedPdf(): Uint8Array {
  const bodies = [
    "<</Type/Catalog/Pages 2 0 R/AcroForm<</Fields[5 0 R]/SigFlags 3>>>>",
    "<</Type/Pages/Count 1/Kids[3 0 R]>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<<>>/Contents 4 0 R/Annots[5 0 R]>>",
    "<</Length 0>>stream\n\nendstream",
    "<</Type/Annot/Subtype/Widget/FT/Sig/T(Signature)/Rect[0 0 1 1]/P 3 0 R/V 6 0 R>>",
    "<</Type/Sig/Filter/Adobe.PPKLite/SubFilter/adbe.pkcs7.detached/ByteRange[0 1 2 3]/Contents<00>>>",
  ];
  return rawPdf(bodies);
}
