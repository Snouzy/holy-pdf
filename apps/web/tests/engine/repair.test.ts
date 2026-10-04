import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import createQpdfCore, { type QpdfCoreOptions } from "@wasm-zoo/qpdf/qpdf-core.js";
import { beforeAll, describe, expect, it } from "vitest";
import { closeDoc, openPdf } from "../../src/engine/documents";
import { EngineFailure } from "../../src/engine/failure";
import type { Pdfium } from "../../src/engine/pdfium";
import { runQpdf } from "../../src/engine/qpdf";
import { openRepaired, type Rebuild } from "../../src/engine/repair";
import { transformPdf } from "../../src/engine/transform";
import { loadTestPdfium, rawPdf, readWithPdfjs, textPdf, xrefErrors } from "./support";

const wasmBinary = readFileSync(createRequire(import.meta.url).resolve("@wasm-zoo/qpdf/qpdf-core.wasm"));
const load = (options: QpdfCoreOptions) => createQpdfCore({ ...options, wasmBinary });
const rebuild: Rebuild = async (bytes, password) => (await runQpdf(bytes, { objectStreams: false, password, repair: true }, load)).bytes;

let p: Pdfium;
beforeAll(async () => {
  p = await loadTestPdfium();
});

const latin = (bytes: Uint8Array) => Buffer.from(bytes).toString("latin1");
const bytesOf = (text: string) => new Uint8Array(Buffer.from(text, "latin1"));
const cut = (bytes: Uint8Array, share: number) => bytes.slice(0, Math.floor(bytes.length * share));

async function repaired(bytes: Uint8Array, password = "", using = rebuild): Promise<Uint8Array> {
  const doc = await openRepaired(p, new Uint8Array(bytes), password, using);
  try {
    return transformPdf(p, doc, { kind: "repair" });
  } finally {
    closeDoc(p, doc);
  }
}

const texts = async (bytes: Uint8Array, password?: string) => (await readWithPdfjs(bytes, password)).map((page) => page.text);

describe("repair", () => {
  it("rebuilds a PDF cut short, which PDFium cannot open, keeping every page it can read", async () => {
    const whole = textPdf(p, ["Alpha", "Beta", "Gamma"]);
    expect(() => openPdf(p, cut(whole, 0.8))).toThrow("damaged");
    expect(await texts(await repaired(cut(whole, 0.8)))).toEqual(["Alpha", "Beta", "Gamma"]);
    expect(await texts(await repaired(cut(whole, 0.6)))).toEqual(["Alpha", "Beta"]);
  });

  it("rebuilds a lost cross-reference table, and gives a sound PDF back rewritten", async () => {
    const whole = textPdf(p, ["Alpha", "Beta"]);
    const text = latin(whole);
    const lost = bytesOf(text.slice(0, text.lastIndexOf("\nxref") + 1));
    for (const bytes of [lost, whole]) {
      const out = await repaired(bytes);
      expect(await texts(out)).toEqual(["Alpha", "Beta"]);
      expect(xrefErrors(out)).toEqual([]);
    }
  });

  it("falls back on PDFium's own rewrite when qpdf cannot read the file", async () => {
    const offset = bytesOf(latin(textPdf(p, ["Alpha"])).replace(/startxref\s+\d+/, "startxref\n0"));
    const out = await repaired(offset, "", async () => { throw new Error("qpdf failed"); });
    expect(await texts(out)).toEqual(["Alpha"]);
    expect(xrefErrors(out)).toEqual([]);
  });

  it("refuses what nothing can read", async () => {
    await expect(openRepaired(p, bytesOf("%PDF-1.7\nnot a PDF\n"), "", rebuild)).rejects.toThrow("damaged");
  });

  it("asks for the password of a protected PDF, and keeps it in the copy", async () => {
    const locked = textPdf(p, ["Secret"], {}, "1234");
    await expect(openRepaired(p, new Uint8Array(locked), "", rebuild)).rejects.toThrow("passwordRequired");
    await expect(openRepaired(p, new Uint8Array(locked), "0000", rebuild)).rejects.toThrow("wrongPassword");
    const out = await repaired(locked, "1234");
    expect(() => openPdf(p, out)).toThrow("passwordRequired");
    expect(await texts(out, "1234")).toEqual(["Secret"]);
  });

  it("refuses a protected PDF cut before its trailer, rather than give back blank pages", async () => {
    const cutLocked = cut(textPdf(p, ["Alpha", "Beta", "Gamma"], {}, "1234"), 0.8);
    for (const password of ["", "1234"]) await expect(openRepaired(p, new Uint8Array(cutLocked), password, rebuild)).rejects.toThrow("damaged");
  });

  it("says qpdf did not load, so the visitor can retry, when PDFium cannot read the file either", async () => {
    const unavailable: Rebuild = async () => { throw new EngineFailure({ kind: "engineUnavailable" }); };
    const cutShort = cut(textPdf(p, ["Alpha"]), 0.8);
    await expect(openRepaired(p, new Uint8Array(cutShort), "", unavailable)).rejects.toThrow("engineUnavailable");
  });

  it("does not hand a file too big for qpdf to PDFium", async () => {
    const tooBig: Rebuild = async () => { throw new EngineFailure({ kind: "outOfMemory" }); };
    await expect(openRepaired(p, new Uint8Array(textPdf(p, ["Alpha"])), "", tooBig)).rejects.toThrow("outOfMemory");
  });

  it("refuses a copy with no page", async () => {
    const empty = rawPdf(["<</Type/Catalog/Pages 2 0 R>>", "<</Type/Pages/Kids[]/Count 0>>"]);
    await expect(openRepaired(p, new Uint8Array(empty), "", rebuild)).rejects.toThrow("damaged");
  });

  it("refuses a signed PDF", async () => {
    const signed = rawPdf([
      "<</Type/Catalog/Pages 2 0 R/AcroForm<</Fields[4 0 R]/SigFlags 3>>>>",
      "<</Type/Pages/Count 1/Kids[3 0 R]>>",
      "<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Annots[4 0 R]>>",
      "<</Type/Annot/Subtype/Widget/FT/Sig/T(Signature)/Rect[0 0 1 1]/P 3 0 R/V 5 0 R>>",
      "<</Type/Sig/Filter/Adobe.PPKLite/SubFilter/adbe.pkcs7.detached/ByteRange[0 1 2 3]/Contents<00>>>",
    ]);
    await expect(repaired(signed)).rejects.toThrow("alreadySigned");
  });
});
