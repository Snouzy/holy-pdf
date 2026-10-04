import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import createQpdfCore, { type QpdfCore, type QpdfCoreOptions } from "@wasm-zoo/qpdf/qpdf-core.js";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it, vi } from "vitest";
import { maxCompactBytes, runQpdf } from "../../src/engine/qpdf";

const wasmBinary = readFileSync(createRequire(import.meta.url).resolve("@wasm-zoo/qpdf/qpdf-core.wasm"));
const load = (options: QpdfCoreOptions) => createQpdfCore({ ...options, wasmBinary });

function structuredPdf(version = "1.7"): Uint8Array<ArrayBuffer> {
  const stream = (dictionary: string, contents: string) => `<<${dictionary}/Length ${Buffer.byteLength(contents)}>>\nstream\n${contents}\nendstream`;
  const objects = [
    "<</Type/Catalog/Pages 2 0 R/Outlines 7 0 R/Metadata 10 0 R/StructTreeRoot 11 0 R/MarkInfo<</Marked true>>/AcroForm<</Fields[14 0 R]/DA(/Helv 10 Tf 0 g)/DR<</Font<</Helv 5 0 R>>>>>>/Names<</Dests<</Names[(chapter)[3 0 R /Fit]]>>/EmbeddedFiles<</Names[(notes.txt)16 0 R]>>>>>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 400]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>/Annots[9 0 R 14 0 R]/StructParents 0>>",
    stream("", "/P <</MCID 0>> BDC BT /F1 12 Tf 20 200 Td (Keep this text) Tj ET EMC\n" + "q Q\n".repeat(4000)),
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    "<</Title(Keep this title)/Author(Test author)>>",
    "<</Type/Outlines/First 8 0 R/Last 8 0 R/Count 1>>",
    "<</Title(Chapter)/Parent 7 0 R/Dest(chapter)>>",
    "<</Type/Annot/Subtype/Link/Rect[0 0 100 20]/Dest(chapter)>>",
    stream("/Type/Metadata/Subtype/XML", '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:description>Keep this XMP</dc:description></rdf:Description></rdf:RDF></x:xmpmeta>'),
    "<</Type/StructTreeRoot/K[12 0 R]/ParentTree 13 0 R/ParentTreeNextKey 1>>",
    "<</Type/StructElem/S/P/P 11 0 R/Pg 3 0 R/K 0/Alt(A retained paragraph)>>",
    "<</Nums[0[12 0 R]]>>",
    "<</Type/Annot/Subtype/Widget/FT/Tx/T(Name)/V(Ada)/Rect[0 30 100 50]/P 3 0 R/F 4>>",
    stream("/Type/EmbeddedFile", "Keep this attachment."),
    "<</Type/Filespec/F(notes.txt)/UF(notes.txt)/EF<</F 15 0 R>>>>",
  ];
  let body = `%PDF-${version}\n`;
  const offsets = objects.map((object, index) => {
    const offset = Buffer.byteLength(body);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<</Size ${objects.length + 1}/Root 1 0 R/Info 6 0 R>>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(body);
}

async function structure(bytes: Uint8Array<ArrayBuffer>) {
  const task = getDocument({ data: bytes.slice(), verbosity: 0 });
  try {
    const doc = await task.promise;
    const page = await doc.getPage(1);
    const metadata = await doc.getMetadata();
    const annotations = await page.getAnnotations();
    const destination = await doc.getDestination("chapter");
    return {
      pages: doc.numPages,
      text: (await page.getTextContent()).items.map((item) => "str" in item ? item.str : "").join(""),
      title: (metadata.info as Record<string, unknown>).Title,
      xmp: metadata.metadata?.getRaw(),
      outlines: (await doc.getOutline())?.map(({ title, dest }) => ({ title, dest })),
      destination: await doc.getPageIndex(destination?.[0]),
      links: annotations.filter((item) => item.subtype === "Link").map((item) => item.dest),
      fields: annotations.filter((item) => item.subtype === "Widget").map(({ fieldName, fieldValue }) => ({ fieldName, fieldValue })),
      tags: JSON.stringify(await page.getStructTree()).replace(/p\d+R\d*_/g, "page_"),
      attachments: await Promise.all([...(await doc.getAttachments() ?? [])].map(async ([key, { filename }]) => ({ filename, content: new TextDecoder().decode((await doc.getAttachmentContent(key)) ?? undefined) }))),
    };
  } finally {
    await task.destroy();
  }
}

describe("QPDF lossless compaction", () => {
  it("creates object streams while keeping text, destinations, forms, tags, metadata and attachments", async () => {
    const original = structuredPdf();
    const before = await structure(original);
    expect(before).toMatchObject({ pages: 1, text: "Keep this text", title: "Keep this title", destination: 0, fields: [{ fieldName: "Name", fieldValue: "Ada" }], attachments: [{ filename: "notes.txt", content: "Keep this attachment." }] });
    const result = await runQpdf(original, {}, load);
    expect(result.repaired).toBe(false);
    expect(result.bytes.length).toBeLessThan(original.length / 2);
    expect(new TextDecoder().decode(result.bytes)).toContain("/ObjStm");
    expect(await structure(result.bytes)).toEqual(before);
  });

  it("preserves PDF 1.4 compatibility when object streams are disabled", async () => {
    const original = structuredPdf("1.4");
    const result = await runQpdf(original, { objectStreams: false }, load);
    expect(new TextDecoder().decode(result.bytes.subarray(0, 8))).toBe("%PDF-1.4");
    expect(new TextDecoder().decode(result.bytes)).not.toContain("/ObjStm");
    expect(await structure(result.bytes)).toEqual(await structure(original));
  });

  it("gives the rewritten file back even when it is larger, to repair", async () => {
    const compact = (await runQpdf(structuredPdf(), {}, load)).bytes;
    const result = await runQpdf(compact, { objectStreams: false, repair: true }, load);
    expect(result.bytes.length).toBeGreaterThan(compact.length);
    expect(new TextDecoder().decode(result.bytes)).not.toContain("/ObjStm");
    expect(await structure(result.bytes)).toEqual(await structure(compact));
  });

  it("accepts exit 3 only with its valid repaired output", async () => {
    const original = structuredPdf();
    const brokenXref = new TextEncoder().encode(new TextDecoder().decode(original).replace(/startxref\n\d+/, "startxref\n0"));
    const result = await runQpdf(brokenXref, {}, load);
    expect(result.repaired).toBe(true);
    expect(await structure(result.bytes)).toEqual(await structure(original));
  });

  it("rejects an unreadable PDF and removes both temporary filesystem paths", async () => {
    let used: QpdfCore | undefined;
    const factory = async (options: QpdfCoreOptions) => used = await load(options);
    await expect(runQpdf(new TextEncoder().encode("%PDF-1.7\nnot a PDF\n"), {}, factory)).rejects.toMatchObject({ error: { kind: "damaged" } });
    expect(used).toBeDefined();
    expect(() => used?.FS.stat("/input.pdf")).toThrow();
    expect(() => used?.FS.stat("/output.pdf")).toThrow();
  });

  it("reports a loader failure separately from a damaged PDF", async () => {
    await expect(runQpdf(structuredPdf(), {}, async () => { throw new Error("Network failed"); })).rejects.toMatchObject({ error: { kind: "engineUnavailable" } });
  });

  it("bounds input allocation before loading the engine", async () => {
    const factory = vi.fn(load);
    await expect(runQpdf(new Uint8Array(maxCompactBytes + 1), {}, factory)).rejects.toMatchObject({ error: { kind: "outOfMemory" } });
    expect(factory).not.toHaveBeenCalled();
  });

  it("never reads an output left behind by a fatal CLI exit", async () => {
    const readFile = vi.fn();
    const unlink = vi.fn();
    const factory = async () => ({ FS: { writeFile: vi.fn(), readFile, stat: vi.fn(), unlink }, callMain: () => 2 });
    await expect(runQpdf(structuredPdf(), {}, factory)).rejects.toMatchObject({ error: { kind: "damaged" } });
    expect(readFile).not.toHaveBeenCalled();
    expect(unlink.mock.calls).toEqual([["/input.pdf"], ["/output.pdf"]]);
  });

  it("keeps the input without copying a larger generated output", async () => {
    const original = structuredPdf();
    const readFile = vi.fn();
    const factory = async () => ({ FS: { writeFile: vi.fn(), readFile, stat: () => ({ size: original.length + 1 }), unlink: vi.fn() }, callMain: () => 0 });
    expect((await runQpdf(original, {}, factory)).bytes).toBe(original);
    expect(readFile).not.toHaveBeenCalled();
  });
});
