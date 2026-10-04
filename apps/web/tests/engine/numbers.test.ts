import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { beforeAll, describe, expect, it } from "vitest";
import { closeDoc, openPdf } from "../../src/engine/documents";
import type { Pdfium } from "../../src/engine/pdfium";
import { transformPdf } from "../../src/engine/transform";
import type { TransformOp } from "../../src/engine/types";
import { loadTestPdfium, readWithPdfjs, textPdf } from "./support";

let p: Pdfium;
beforeAll(async () => {
  p = await loadTestPdfium();
});

type Numbers = Extract<TransformOp, { kind: "numbers" }>;
const numbers = (change: Partial<Numbers> = {}): Numbers =>
  ({ kind: "numbers", format: "number", position: "bottom-center", first: 1, size: 12, from: 1, to: 999, ...change });

function numbered(bytes: Uint8Array, op: Numbers) {
  const doc = openPdf(p, bytes);
  try {
    return transformPdf(p, doc, op);
  } finally {
    closeDoc(p, doc);
  }
}

/** Where pdf.js finds `text` on each page, in fractions of the page as the reader sees it. */
async function spots(bytes: Uint8Array, text: RegExp) {
  const task = getDocument({ data: bytes.slice(), verbosity: 0 });
  const doc = await task.promise;
  const found: ({ x: number; y: number } | null)[] = [];
  for (let number = 1; number <= doc.numPages; number++) {
    const page = await doc.getPage(number);
    const viewport = page.getViewport({ scale: 1 });
    const item = (await page.getTextContent()).items.find((entry) => "str" in entry && text.test(entry.str));
    if (!item || !("transform" in item)) {
      found.push(null);
      continue;
    }
    const [x = 0, y = 0] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
    found.push({ x: x / viewport.width, y: y / viewport.height });
  }
  await task.destroy();
  return found;
}

describe("page numbers", () => {
  it("writes each format on the pages of the range, from the first number", async () => {
    const source = textPdf(p, ["A", "B", "C"]);
    const text = async (op: Numbers) => (await readWithPdfjs(numbered(source, op))).map((page) => page.text);
    expect(await text(numbers())).toEqual(["A1", "B2", "C3"].map((s) => expect.stringMatching(new RegExp(`^${s[0]}.*${s[1]}$`))));
    expect(await text(numbers({ format: "of", from: 2, to: 3 }))).toEqual(["A", expect.stringMatching(/1 \/ 2$/), expect.stringMatching(/2 \/ 2$/)]);
    expect(await text(numbers({ format: "page", first: 5 }))).toEqual([expect.stringMatching(/Page 5$/), expect.stringMatching(/Page 6$/), expect.stringMatching(/Page 7$/)]);
  });

  it("puts the number where the reader sees it, whatever the page's rotation", async () => {
    for (const rotation of [0, 90, 180, 270]) {
      const source = textPdf(p, ["Text"], { 0: rotation });
      const [bottom] = await spots(numbered(source, numbers({ position: "bottom-right", first: 7 })), /^7$/);
      expect(bottom, `rotation ${rotation}`).not.toBeNull();
      expect(bottom!.x, `rotation ${rotation}`).toBeGreaterThan(0.8);
      expect(bottom!.y, `rotation ${rotation}`).toBeGreaterThan(0.9);
      const [top] = await spots(numbered(source, numbers({ position: "top-left", first: 7 })), /^7$/);
      expect(top!.x, `rotation ${rotation}`).toBeLessThan(0.15);
      expect(top!.y, `rotation ${rotation}`).toBeLessThan(0.1);
    }
  });

  it("stops the range at the last page", async () => {
    const pages = await readWithPdfjs(numbered(textPdf(p, ["A", "B"]), numbers({ format: "of", from: 2, to: 9 })));
    expect(pages.map((page) => page.text)).toEqual(["A", expect.stringMatching(/1 \/ 1$/)]);
  });
});
