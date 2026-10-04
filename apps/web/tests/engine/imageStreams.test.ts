import { beforeAll, describe, expect, it } from "vitest";
import { closeDoc, openPdf } from "../../src/engine/documents";
import { fingerprint, pageImages, rawData } from "../../src/engine/imageObjects";
import { replaceImageStreams, topLevelKeys } from "../../src/engine/imageStreams";
import type { Pdfium } from "../../src/engine/pdfium";
import { gradientJpeg, imagePixelSizes, loadTestPdfium, photoPdf, readWithPdfjs, xrefErrors } from "./support";

let p: Pdfium;
beforeAll(async () => {
  p = await loadTestPdfium();
});

const text = (bytes: Uint8Array) => Buffer.from(bytes).toString("latin1");
const latin1 = (s: string) => new Uint8Array(Buffer.from(s, "latin1"));

function firstImageRaw(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const doc = openPdf(p, bytes);
  const page = p.FPDF_LoadPage(doc.handle, 0);
  const raw = rawData(p, pageImages(p, page)[0] ?? 0);
  p.FPDF_ClosePage(page);
  closeDoc(p, doc);
  return raw;
}

/** The same objects, listed by an xref stream (PDF 1.5) instead of a classic table. */
function withXrefStream(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const all = text(bytes);
  const at = Number(/startxref\s+(\d+)\s+%%EOF\s*$/.exec(all)?.[1]);
  const offsets = [...all.slice(at, all.indexOf("trailer", at)).matchAll(/^(\d{10}) \d{5} n/gm)].map((m) => Number(m[1]));
  const rows = [0, 0, 0, 0, 0, 0, ...[...offsets, at].flatMap((offset) => [1, offset >>> 24, (offset >>> 16) & 255, (offset >>> 8) & 255, offset & 255, 0])];
  const size = offsets.length + 2;
  const head = `${size - 1} 0 obj\r\n<</Type/XRef/Size ${size}/W[1 4 1]/Root ${/\/Root (\d+ \d+ R)/.exec(all)?.[1]}/Length ${rows.length}>>stream\r\n`;
  return new Uint8Array(Buffer.concat([bytes.subarray(0, at), latin1(head), Uint8Array.from(rows), latin1(`\r\nendstream\r\nendobj\r\nstartxref\r\n${at}\r\n%%EOF\r\n`)]));
}

describe("replaceImageStreams", () => {
  const original = () => photoPdf(p, ["Page 1"], { width: 400, height: 300, alpha: 128 });
  const jpegsFor = async (bytes: Uint8Array) => new Map([[await fingerprint(firstImageRaw(bytes)), { jpeg: gradientJpeg, width: 48, height: 32 }]]);

  it("puts the JPEG in place of the colour stream and keeps the /SMask reference", async () => {
    const bytes = original();
    const out = await replaceImageStreams(bytes, await jpegsFor(bytes));
    expect(/\/DCTDecode\/Height 32\/Length 960\/SMask \d+ 0 R\/Subtype\/Image\/Type\/XObject\/Width 48>>/.test(text(out))).toBe(true);
    expect(xrefErrors(out)).toEqual([]);
    expect((await readWithPdfjs(out)).map((page) => page.text)).toEqual(["Page 1"]);
  });

  it("gives back the same bytes when no stream matches", async () => {
    const bytes = original();
    expect(await replaceImageStreams(bytes, new Map([["no-such-stream", { jpeg: gradientJpeg, width: 48, height: 32 }]]))).toBe(bytes);
  });

  it("leaves an image whose dictionary has a key it does not know, such as /OC or /Mask", async () => {
    const bytes = original();
    const jpegs = await jpegsFor(bytes);
    // Same length as what it replaces, so the xref offsets stay right.
    const withKey = (key: string) => latin1(text(bytes).replace("R /Subtype/Image/Type/XObject", `R /Subtype/Image${key}`.padEnd(29)));
    expect(text(await replaceImageStreams(withKey("/Name/Im1"), jpegs)).includes("DCTDecode")).toBe(true);
    expect(text(await replaceImageStreams(withKey("/OC 1 0 R"), jpegs)).includes("DCTDecode")).toBe(false);
    expect(text(await replaceImageStreams(withKey("/Mask[0 1]"), jpegs)).includes("DCTDecode")).toBe(false);
  });

  it("retains the image rendering intent and resource name", async () => {
    const bytes = original();
    const jpegs = await jpegsFor(bytes);
    const withIntent = latin1(text(bytes).replaceAll("/Type/XObject", "/Intent/Test".padEnd(13)));
    const withName = latin1(text(bytes).replaceAll("/Type/XObject", "/Name/Photo".padEnd(13)));
    const intent = text(await replaceImageStreams(withIntent, jpegs));
    const name = text(await replaceImageStreams(withName, jpegs));
    expect(/\/DCTDecode[^>]*\/Intent\/Test/.test(intent)).toBe(true);
    expect(/\/DCTDecode[^>]*\/Name\/Photo/.test(name)).toBe(true);
  });

  it("leaves an image whose soft mask has /Matte", async () => {
    const bytes = original();
    const jpegs = await jpegsFor(bytes);
    // In the mask's dictionary, and as long as the /Type/XObject it replaces.
    const withMatte = latin1(text(bytes).replace(/(\/DeviceGray[^>]*)\/Type\/XObject/, "$1/Matte[0 0 0]"));
    expect(text(withMatte)).toContain("/Matte[0 0 0]");
    expect(await replaceImageStreams(withMatte, jpegs)).toBe(withMatte);
  });

  it("gives back the same bytes when the xref is a stream", async () => {
    const bytes = withXrefStream(original());
    expect(imagePixelSizes(p, bytes)).toEqual([[400, 300]]);
    expect(await replaceImageStreams(bytes, await jpegsFor(bytes))).toBe(bytes);
  });

  it("gives back the same bytes when an xref offset is wrong, even one far from the image", async () => {
    const bytes = original();
    const jpegs = await jpegsFor(bytes);
    const broken = latin1(text(bytes).replace(/^\d{10}(?= 00000 n)/m, (offset) => String(Number(offset) + 1).padStart(10, "0")));
    expect(broken).not.toEqual(bytes);
    expect(await replaceImageStreams(broken, jpegs)).toBe(broken);
  });

  it("rewrites every object that holds the same image", async () => {
    const bytes = photoPdf(p, ["A", "B"], { width: 400, height: 300, alpha: 128, seed: 1 });
    const out = await replaceImageStreams(bytes, await jpegsFor(bytes));
    expect(text(out).match(/\/DCTDecode/g)).toHaveLength(2);
    expect(xrefErrors(out)).toEqual([]);
  });

  it("leaves equal image bytes alone when their dictionaries differ, such as one with /Decode", async () => {
    const twins = text(photoPdf(p, ["A", "B"], { width: 400, height: 300, alpha: 128, seed: 1 }));
    const at = twins.lastIndexOf("/SMask");
    // The second image loses its mask for a /Decode that inverts its colours, padded to keep the offsets.
    const inverted = latin1(
      twins.slice(0, at) + twins.slice(at).replace(/\/SMask \d+ 0 R \/Subtype\/Image\/Type\/XObject/, (found) => "/Subtype/Image/Decode[1 0 1 0 1 0]".padEnd(found.length)),
    );
    expect(text(inverted)).toContain("/Decode[1 0 1 0 1 0]");
    expect(await replaceImageStreams(inverted, await jpegsFor(inverted))).toBe(inverted);
  });

  it("lists top-level keys past nested dictionaries, arrays and strings", () => {
    expect(topLevelKeys("<</ColorSpace[/Indexed/DeviceRGB 1 (a[b<c\\)d)]/DecodeParms<</Predictor 15>>/Decode[1 0]/Metadata 4 0 R/Name/Im1/Width 3>>")).toEqual(["ColorSpace", "DecodeParms", "Decode", "Metadata", "Name", "Width"]);
  });
});
