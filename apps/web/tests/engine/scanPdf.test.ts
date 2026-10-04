import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { beforeAll, describe, expect, it } from "vitest";
import type { Pdfium } from "../../src/engine/pdfium";
import { scanPdf } from "../../src/engine/scanPdf";
import { countImageStreams, gradientJpeg, loadTestPdfium, readWithPdfjs } from "./support";

let p: Pdfium;
beforeAll(async () => {
  p = await loadTestPdfium();
});

describe("scanPdf", () => {
  it("puts each picture on a page of its format, embedded as it is, with the document's title", async () => {
    const bytes = scanPdf(p, [
      { jpeg: gradientJpeg, width: 1654, height: 2339, format: "auto" },
      { jpeg: gradientJpeg, width: 2339, height: 1654, format: "a5" },
      { jpeg: gradientJpeg, width: 1000, height: 1600, format: "auto" },
    ], "2026-09-18 Încheiere");
    expect((await readWithPdfjs(bytes)).map((page) => [page.width, page.height])).toEqual([[595, 842], [595, 420], [360, 576]]);
    expect(countImageStreams(bytes)).toBe(3);
    expect(Buffer.from(bytes).includes(Buffer.from(gradientJpeg))).toBe(true);
    const task = getDocument({ data: bytes.slice(), verbosity: 0 });
    expect((await (await task.promise).getMetadata()).info).toMatchObject({ Title: "2026-09-18 Încheiere" });
    await task.destroy();
  });
});

describe("scanPdf text", () => {
  it("lays the lines read on a picture over it, invisible, where the picture shows them", async () => {
    const bytes = scanPdf(p, [{ jpeg: gradientJpeg, width: 1000, height: 1000, format: "a4", lines: [{ text: "Declaratie", x: 0.1, y: 0.1, width: 0.4, height: 0.05 }] }], "Scan");
    const task = getDocument({ data: bytes.slice(), verbosity: 0 });
    const page = await (await task.promise).getPage(1);
    const [item] = (await page.getTextContent()).items.filter((entry) => "str" in entry && entry.str.trim());
    expect(item && "str" in item ? item.str : null).toBe("Declaratie");
    const [x, baseline] = item && "transform" in item ? [item.transform[4] / 595.28, 1 - item.transform[5] / 841.89] : [0, 0];
    // The square picture fills the A4 width and is centred vertically: its top is at (841.89 − 595.28) / 2 from the top.
    expect([x, baseline]).toEqual([expect.closeTo(0.1, 1), expect.closeTo(((841.89 - 595.28) / 2 + 0.15 * 595.28) / 841.89, 2)]);
    await task.destroy();
  });
});
