import { beforeAll, describe, expect, it } from "vitest";
import { buildPdf } from "../../src/engine/build";
import { closeDoc, type OpenDoc, openImage, openPdf } from "../../src/engine/documents";
import type { Pdfium } from "../../src/engine/pdfium";
import { gradientJpeg, loadTestPdfium, readWithPdfjs, textPdf, withOrientation } from "./support";

let p: Pdfium;
beforeAll(async () => {
  p = await loadTestPdfium();
});

const containsBytes = (haystack: Uint8Array, needle: Uint8Array) => Buffer.from(haystack).indexOf(Buffer.from(needle)) !== -1;

describe("buildPdf", () => {
  it("merges pages in plan order and adds the rotations to the pages' own", async () => {
    const docs = new Map<string, OpenDoc>([
      ["a", openPdf(p, textPdf(p, ["A1", "A2", "A3"], { 0: 90 }))],
      ["b", openPdf(p, textPdf(p, ["B1", "B2"]))],
    ]);
    const bytes = buildPdf(
      p,
      [
        { docId: "b", index: 1, rotation: 0 },
        { docId: "a", index: 0, rotation: 90 },
        { docId: "a", index: 2, rotation: 270 },
      ],
      docs,
    );
    const pages = await readWithPdfjs(bytes);
    expect(pages.map((page) => [page.text, page.rotation])).toEqual([["B2", 0], ["A1", 180], ["A3", 270]]);
    for (const doc of docs.values()) closeDoc(p, doc);
  });

  it("writes an unprotected file from a protected source", async () => {
    const source = openPdf(p, textPdf(p, ["Secret"], {}, "user-pw"), "user-pw");
    const bytes = buildPdf(p, [{ docId: "s", index: 0, rotation: 0 }], new Map([["s", source]]));
    expect((await readWithPdfjs(bytes)).map((page) => page.text)).toEqual(["Secret"]);
    closeDoc(p, source);
  });

  it("embeds a JPEG without re-encoding it", async () => {
    const image = openImage(p, { kind: "jpeg", bytes: gradientJpeg });
    const bytes = buildPdf(p, [{ docId: "i", index: 0, rotation: 0 }], new Map([["i", image]]));
    expect(containsBytes(bytes, gradientJpeg.subarray(2))).toBe(true);
    expect((await readWithPdfjs(bytes))[0]?.rotation).toBe(0);
    closeDoc(p, image);
  });

  it("keeps the rotation of a phone photo in the written file", async () => {
    const image = openImage(p, { kind: "jpeg", bytes: withOrientation(gradientJpeg, 6) });
    const bytes = buildPdf(p, [{ docId: "i", index: 0, rotation: 0 }], new Map([["i", image]]));
    expect((await readWithPdfjs(bytes))[0]?.rotation).toBe(90);
    closeDoc(p, image);
  });
});
