import { beforeAll, describe, expect, it } from "vitest";
import { closeDoc, openPdf } from "../../src/engine/documents";
import type { Pdfium } from "../../src/engine/pdfium";
import { transformPdf } from "../../src/engine/transform";
import { loadTestPdfium, rawPdf, readWithPdfjs, textPdf } from "./support";

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
    const bytes = transformed(textPdf(p, ["One", "Two"]), { kind: "protect", password: "s3cret é" });
    expect(() => openPdf(p, bytes)).toThrow("passwordRequired");
    expect(() => openPdf(p, bytes, "wrong")).toThrow("wrongPassword");
    const doc = openPdf(p, bytes, "s3cret é");
    expect(doc.sizes).toHaveLength(2);
    closeDoc(p, doc);
    expect((await readWithPdfjs(bytes, "s3cret é")).map((page) => page.text)).toEqual(["One", "Two"]);
  });

  it("unlocks a PDF opened with its password: the copy opens without one", async () => {
    const bytes = transformed(textPdf(p, ["Locked"], {}, "open sesame"), { kind: "unlock" }, "open sesame");
    const doc = openPdf(p, bytes);
    expect(doc.sizes).toHaveLength(1);
    closeDoc(p, doc);
    expect((await readWithPdfjs(bytes)).map((page) => page.text)).toEqual(["Locked"]);
  });

  it("refuses a digitally signed PDF: rewriting it would void the signature", () => {
    for (const op of [{ kind: "protect", password: "x" }, { kind: "unlock" }] as const) {
      expect(() => transformed(signedPdf(), op)).toThrow("alreadySigned");
    }
  });
});

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
