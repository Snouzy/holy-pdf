import { beforeAll, describe, expect, it } from "vitest";
import { closeDoc, openImage, openPdf } from "../../src/engine/documents";
import { EngineFailure } from "../../src/engine/failure";
import type { Pdfium } from "../../src/engine/pdfium";
import { renderPage } from "../../src/engine/render";
import type { EngineError } from "../../src/engine/types";
import { gradientJpeg, loadTestPdfium, textPdf, withOrientation } from "./support";

let p: Pdfium;
beforeAll(async () => {
  p = await loadTestPdfium();
});

function failureOf(run: () => unknown): EngineError | undefined {
  try {
    run();
  } catch (error) {
    if (error instanceof EngineFailure) return error.error;
    throw error;
  }
  return undefined;
}

const rounded = (sizes: { width: number; height: number }[]) => sizes.map((s) => [Math.round(s.width), Math.round(s.height)]);

describe("openPdf", () => {
  it("reads page sizes after each page's own rotation", () => {
    const doc = openPdf(p, textPdf(p, ["A1", "A2"], { 0: 90 }));
    expect(rounded(doc.sizes)).toEqual([[842, 595], [595, 842]]);
    closeDoc(p, doc);
  });

  it("asks for a password, rejects a wrong one, opens with the right one", () => {
    const bytes = textPdf(p, ["Secret"], {}, "user-pw");
    expect(failureOf(() => openPdf(p, bytes))).toEqual({ kind: "passwordRequired" });
    expect(failureOf(() => openPdf(p, bytes, "wrong"))).toEqual({ kind: "wrongPassword" });
    const doc = openPdf(p, bytes, "user-pw");
    expect(doc.sizes).toHaveLength(1);
    closeDoc(p, doc);
  });

  it("reports a truncated file as damaged", () => {
    const bytes = textPdf(p, ["A1"]);
    expect(failureOf(() => openPdf(p, bytes.subarray(0, bytes.length >> 1)))).toEqual({ kind: "damaged" });
  });
});

describe("openImage", () => {
  it("puts a landscape JPEG on a landscape A4 page", () => {
    const image = openImage(p, { kind: "jpeg", bytes: gradientJpeg });
    expect(rounded(image.sizes)).toEqual([[842, 595]]);
    closeDoc(p, image);
  });

  it("turns the page of a phone photo with EXIF orientation 6", () => {
    const image = openImage(p, { kind: "jpeg", bytes: withOrientation(gradientJpeg, 6) });
    expect(rounded(image.sizes)).toEqual([[595, 842]]);
    closeDoc(p, image);
  });

  it("reports bytes that are not a JPEG as damaged", () => {
    const notJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0, 1, 2]);
    expect(failureOf(() => openImage(p, { kind: "jpeg", bytes: notJpeg }))).toEqual({ kind: "damaged" });
  });

  it("draws raw RGBA pixels in the right colors", () => {
    const pixels = new Uint8Array(20 * 10 * 4).map((_, i) => [255, 0, 0, 255][i % 4] ?? 0);
    const image = openImage(p, { kind: "rgba", width: 20, height: 10, pixels });
    const rendered = renderPage(p, image, 0, 300);
    const center = ((rendered.height >> 1) * rendered.width + 150) * 4;
    expect([...rendered.pixels.subarray(center, center + 4)]).toEqual([255, 0, 0, 255]);
    closeDoc(p, image);
  });
});

describe("renderPage", () => {
  it("renders at the asked width with the page's aspect ratio, on white", () => {
    const doc = openPdf(p, textPdf(p, ["A1"]));
    const rendered = renderPage(p, doc, 0, 300);
    expect([rendered.width, rendered.height]).toEqual([300, 424]);
    expect([...rendered.pixels.subarray(0, 4)]).toEqual([255, 255, 255, 255]);
    closeDoc(p, doc);
  });
});
