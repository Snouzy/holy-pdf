import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { beforeAll, describe, expect, it } from "vitest";
import { closeDoc, openImage, openPdf } from "../../src/engine/documents";
import type { Pdfium } from "../../src/engine/pdfium";
import { burnMark } from "../../src/engine/pixelize";
import { renderPage } from "../../src/engine/render";
import { transformPdf } from "../../src/engine/transform";
import type { TransformOp } from "../../src/engine/types";
import { encodeTestJpeg, loadTestPdfium, readWithPdfjs, textPdf } from "./support";

let p: Pdfium;
beforeAll(async () => {
  p = await loadTestPdfium();
});

type Watermark = Extract<TransformOp, { kind: "watermark" }>;
const watermark = (change: object = {}) =>
  ({ kind: "watermark", text: "DRAFT", color: [200, 50, 27], opacity: 0.3, angle: 45, tiled: false, width: 0.6, from: 1, to: 999, burn: false, ...change }) as Watermark;
const tiled = { tiled: true, size: 0.04, spacing: "medium" };

/** The share of a 4 × 4 grid over the page whose cells hold some of the mark's red. */
function covered(bytes: Uint8Array): number {
  const doc = openPdf(p, bytes);
  const { pixels, width, height } = renderPage(p, doc, 0, 300);
  closeDoc(p, doc);
  const cells = new Set<number>();
  for (let at = 0; at < width * height; at++) {
    const [red, green] = [pixels[at * 4]!, pixels[at * 4 + 1]!];
    if (red - green > 30) cells.add(Math.floor((at % width) / width * 4) + 4 * Math.floor(Math.floor(at / width) / height * 4));
  }
  return cells.size / 16;
}

function marked(bytes: Uint8Array, op: Watermark) {
  const doc = openPdf(p, bytes);
  try {
    return transformPdf(p, doc, op);
  } finally {
    closeDoc(p, doc);
  }
}

describe("watermark", () => {
  it("writes the text on the pages of the range only", async () => {
    const pages = await readWithPdfjs(marked(textPdf(p, ["One", "Two", "Three"]), watermark({ from: 2, to: 3 })));
    expect(pages.map((page) => page.text.includes("DRAFT"))).toEqual([false, true, true]);
  });

  it("turns the text by the angle, and lets the page show through by the opacity", async () => {
    const bytes = marked(textPdf(p, ["Page"]), watermark({ text: "WWWWWWWW", angle: 30, opacity: 0.3, width: 0.9 }));
    const task = getDocument({ data: bytes.slice(), verbosity: 0 });
    const page = await (await task.promise).getPage(1);
    const item = (await page.getTextContent()).items.find((entry) => "str" in entry && entry.str.includes("WWW"));
    const [a = 0, b = 0] = item && "transform" in item ? item.transform : [];
    expect(Math.atan2(b, a) * 180 / Math.PI).toBeCloseTo(30, 0);
    await task.destroy();
    const doc = openPdf(p, bytes);
    const { pixels, width, height } = renderPage(p, doc, 0, 400);
    closeDoc(p, doc);
    const near = (target: number[]) => Array.from({ length: width * height }, (_, index) => index * 4)
      .filter((at) => target.every((value, channel) => Math.abs((pixels[at + channel] ?? 0) - value) <= 4)).length;
    // The stamp red at 30 % over white paper; at full opacity it would stay (200, 50, 27).
    expect(near([238, 194, 187])).toBeGreaterThan(1000);
    expect(near([200, 50, 27])).toBe(0);
  });

  it("tiles the text in rows over the whole page", async () => {
    const bytes = marked(textPdf(p, ["Page"]), watermark({ text: "SECRET", angle: 30, ...tiled }));
    const items = (await readWithPdfjs(bytes))[0]?.text.match(/SECRET/g) ?? [];
    expect(items.length).toBeGreaterThan(20);
    expect(covered(bytes)).toBe(1);
    expect(covered(marked(textPdf(p, ["Page"]), watermark({ text: "SECRET", angle: 30 })))).toBeLessThan(1);
  });

  it("burns the marked pages into pictures, and copies the others as they are", async () => {
    const op = watermark({ text: "SECRET", from: 2, to: 2, burn: true, ...tiled });
    const bytes = await burnMark(p, marked(textPdf(p, ["One", "Two", "Three"]), op), op, "", encodeTestJpeg);
    expect((await readWithPdfjs(bytes)).map((page) => page.text)).toEqual(["One", "", "Three"]);
  });

  it("marks a photo made into a page, which has no bytes of its own", async () => {
    const doc = openImage(p, { kind: "rgba", width: 60, height: 40, pixels: new Uint8ClampedArray(60 * 40 * 4).fill(255) });
    try {
      expect((await readWithPdfjs(transformPdf(p, doc, watermark())))[0]?.text).toContain("DRAFT");
    } finally {
      closeDoc(p, doc);
    }
  });

  it("spans the chosen share of the page's width", async () => {
    const bytes = marked(textPdf(p, ["Page"]), watermark({ text: "WIDE", angle: 0, width: 0.5 }));
    const task = getDocument({ data: bytes.slice(), verbosity: 0 });
    const page = await (await task.promise).getPage(1);
    const item = (await page.getTextContent()).items.find((entry) => "str" in entry && entry.str === "WIDE");
    expect(item && "width" in item ? item.width / page.view[2]! : 0).toBeCloseTo(0.5, 1);
    await task.destroy();
  });
});
