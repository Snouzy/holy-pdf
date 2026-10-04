import { beforeAll, describe, expect, it } from "vitest";
import { closeDoc, openPdf } from "../../src/engine/documents";
import type { Pdfium } from "../../src/engine/pdfium";
import { pixelizePdf } from "../../src/engine/pixelize";
import { countImageStreams, encodeTestJpeg, loadTestPdfium, readWithPdfjs, textPdf } from "./support";

let p: Pdfium;
beforeAll(async () => {
  p = await loadTestPdfium();
});

describe("pixelize", () => {
  it("turns each page into one picture of it, at the size the reader sees, with no text left", async () => {
    const doc = openPdf(p, textPdf(p, ["Secret", "Turned"], { 1: 90 }));
    const bytes = await pixelizePdf(p, doc, 150, encodeTestJpeg);
    closeDoc(p, doc);
    const pages = await readWithPdfjs(bytes);
    expect(pages.map((page) => page.text)).toEqual(["", ""]);
    expect(pages.map(({ width, height, rotation }) => [width, height, rotation])).toEqual([[595, 842, 0], [842, 595, 0]]);
    expect(countImageStreams(bytes)).toBe(2);
  });
});
