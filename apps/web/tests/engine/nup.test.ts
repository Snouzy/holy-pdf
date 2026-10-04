import { beforeAll, describe, expect, it } from "vitest";
import { closeDoc, openPdf } from "../../src/engine/documents";
import type { Pdfium } from "../../src/engine/pdfium";
import { transformPdf } from "../../src/engine/transform";
import { loadTestPdfium, readWithPdfjs, textPdf } from "./support";

let p: Pdfium;
beforeAll(async () => {
  p = await loadTestPdfium();
});

function sheets(labels: string[], perSheet: 2 | 4 | 6 | 9 | 16) {
  const doc = openPdf(p, textPdf(p, labels));
  try {
    return transformPdf(p, doc, { kind: "nup", perSheet });
  } finally {
    closeDoc(p, doc);
  }
}

describe("pages per sheet", () => {
  it("lays four pages on each portrait A4 sheet, in reading order", async () => {
    const pages = await readWithPdfjs(sheets(["A", "B", "C", "D", "E"], 4));
    expect(pages.map(({ width, height }) => [Math.round(width), Math.round(height)])).toEqual([[595, 842], [595, 842]]);
    expect(pages.map((page) => page.text.replace(/\s/g, ""))).toEqual(["ABCD", "E"]);
  });

  it("turns the sheet sideways for two pages", async () => {
    const pages = await readWithPdfjs(sheets(["A", "B", "C"], 2));
    expect(pages.map(({ width, height }) => [Math.round(width), Math.round(height)])).toEqual([[842, 595], [842, 595]]);
    expect(pages.map((page) => page.text.replace(/\s/g, ""))).toEqual(["AB", "C"]);
  });
});
