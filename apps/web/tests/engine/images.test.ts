import { decode } from "jpeg-js";
import { beforeAll, describe, expect, it } from "vitest";
import { closeDoc, openPdf } from "../../src/engine/documents";
import { extractImages, imageName, pagesToJpeg, renderWidth } from "../../src/engine/images";
import { renderPage } from "../../src/engine/render";
import type { Pdfium } from "../../src/engine/pdfium";
import { clipPage, encodeTestJpeg, loadTestPdfium, photoInFormPdf, photoPdf, sharedPhotoPdf, textPdf } from "./support";

let p: Pdfium;
beforeAll(async () => {
  p = await loadTestPdfium();
});

const sizeOf = (bytes: Uint8Array) => {
  const { width, height } = decode(bytes, { useTArray: true });
  return [width, height];
};

describe("renderWidth", () => {
  it("renders an A4 page 1240 px wide at 150 ppi", () => {
    expect(renderWidth({ width: 595.28, height: 841.89 }, 150)).toBe(1240);
  });

  it("keeps a huge page under 16 million pixels", () => {
    const width = renderWidth({ width: 2384, height: 3370 }, 300);
    expect(width * Math.round((width * 3370) / 2384)).toBeLessThanOrEqual(16_000_000);
    expect(width).toBeGreaterThan(3000);
  });
});

describe("imageName", () => {
  it("numbers pages and extracted images apart", () => {
    expect(imageName("course", "pages", 2)).toBe("course-2.jpg");
    expect(imageName("course", "extract", 2)).toBe("course-image-2.jpg");
  });
});

describe("pagesToJpeg", { timeout: 30_000 }, () => {
  it("makes one JPEG per page, at the quality's resolution", async () => {
    const doc = openPdf(p, textPdf(p, ["P1", "P2"]));
    const files = await pagesToJpeg(p, doc, "course", "normal", encodeTestJpeg, () => {});
    closeDoc(p, doc);
    expect(files.map((file) => file.name)).toEqual(["course-1.jpg", "course-2.jpg"]);
    expect(files.map((file) => sizeOf(file.bytes))).toEqual([[1240, 1754], [1240, 1754]]);
  });

  it("renders twice as wide at the high quality", async () => {
    const doc = openPdf(p, textPdf(p, ["P1"]));
    const [file] = await pagesToJpeg(p, doc, "course", "high", encodeTestJpeg, () => {});
    closeDoc(p, doc);
    expect(file && sizeOf(file.bytes)).toEqual([2480, 3507]);
  });
});

describe("extractImages", { timeout: 30_000 }, () => {
  const extract = async (bytes: Uint8Array) => {
    const doc = openPdf(p, bytes);
    try {
      return await extractImages(p, doc, "deck", "normal", encodeTestJpeg, new Set(), () => {});
    } finally {
      closeDoc(p, doc);
    }
  };

  it("takes each photo once, at its own size", async () => {
    const files = await extract(sharedPhotoPdf(p, { width: 800, height: 600 }));
    expect(files.map((file) => file.name)).toEqual(["deck-image-1.jpg"]);
    expect(files[0] && sizeOf(files[0].bytes)).toEqual([800, 600]);
  });

  it("skips images too small to be photos", async () => {
    expect(await extract(photoPdf(p, ["Icon"], { width: 40, height: 40 }))).toEqual([]);
  });

  it("finds nothing in a PDF of text", async () => {
    expect(await extract(textPdf(p, ["P1"]))).toEqual([]);
  });

  it("lays a transparent photo on white", async () => {
    const [file] = await extract(photoPdf(p, ["Glass"], { width: 200, height: 150, alpha: 0 }));
    expect(file && sizeOf(file.bytes)).toEqual([200, 150]);
    const data = file ? decode(file.bytes, { useTArray: true }).data : new Uint8Array([0, 0, 0]);
    expect(Math.min(data[0] ?? 0, data[1] ?? 0, data[2] ?? 0)).toBeGreaterThan(245);
  });

  it("extracts the complete opaque photo even when the page clips most of it", async () => {
    const source = photoPdf(p, ["Clipped"], { width: 800, height: 600 });
    const [original] = await extract(source);
    const [clipped] = await extract(clipPage(p, source, 0, 0.5));
    expect(clipped && sizeOf(clipped.bytes)).toEqual([800, 600]);
    expect(clipped?.bytes).toEqual(original?.bytes);
  });

  it("retains a soft mask at native size without applying the page clip", async () => {
    const source = photoPdf(p, ["Masked"], { width: 800, height: 600, alpha: "half" });
    const [original] = await extract(source);
    const [clipped] = await extract(clipPage(p, source, 0, 0.5));
    expect(clipped && sizeOf(clipped.bytes)).toEqual([800, 600]);
    expect(clipped?.bytes).toEqual(original?.bytes);
    if (!clipped) throw new Error("Missing extracted photo");
    const data = decode(clipped.bytes, { useTArray: true }).data;
    expect(data[(300 * 800 + 700) * 4]).toBeGreaterThan(245);
    expect(data[(300 * 800 + 100) * 4]).toBeLessThan(100);
  });

  it("extracts a photo inside a form once at native size", async () => {
    const files = await extract(photoInFormPdf(p, { width: 800, height: 600, alpha: "half" }));
    expect(files).toHaveLength(1);
    expect(files[0] && sizeOf(files[0].bytes)).toEqual([800, 600]);
  });

  it("does not confuse identical image streams with different soft masks across files", async () => {
    const seen = new Set<string>();
    const files = [];
    for (const alpha of [255, "half", "half"] as const) {
      const doc = openPdf(p, photoPdf(p, ["Same pixels"], { width: 200, height: 150, seed: 1, alpha }));
      try {
        files.push(...await extractImages(p, doc, "deck", "normal", encodeTestJpeg, seen, () => {}));
      } finally {
        closeDoc(p, doc);
      }
    }
    expect(files).toHaveLength(2);
  });

  it("extracts an inline image (BI…EI) instead of failing the whole file", async () => {
    const files = await extract(inlineImagePdf());
    expect(files.map((file) => sizeOf(file.bytes))).toEqual([[80, 64]]);
  });

  it("extracts a password-protected PDF without altering its page", async () => {
    const source = photoPdf(p, ["Protected"], { width: 200, height: 150, alpha: "half" }, "secret");
    const doc = openPdf(p, source, "secret");
    try {
      const before = renderPage(p, doc, 0, 300);
      const files = await extractImages(p, doc, "deck", "normal", encodeTestJpeg, new Set(), () => {});
      expect(files[0] && sizeOf(files[0].bytes)).toEqual([200, 150]);
      expect(renderPage(p, doc, 0, 300)).toEqual(before);
    } finally {
      closeDoc(p, doc);
    }
  });

  it("keeps binary Indexed palettes in named page colour resources", async () => {
    const source = openPdf(p, indexedPhotoPdf());
    try {
      expect(renderPage(p, source, 0, 80).pixels[0]).toBeCloseTo(17, -1);
    } finally {
      closeDoc(p, source);
    }
    const [file] = await extract(indexedPhotoPdf());
    if (!file) throw new Error("Missing indexed photo");
    const image = decode(file.bytes, { useTArray: true });
    expect([image.width, image.height]).toEqual([80, 64]);
    expect(image.data[0]).toBeCloseTo(17, -1);
    expect(image.data[1]).toBeCloseTo(201, -1);
    expect(image.data[2]).toBeCloseTo(85, -1);
  });

});

function indexedPhotoPdf(): Uint8Array {
  const pixels = "\x01".repeat(80 * 64);
  const bodies = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 40 32] /Resources << /ColorSpace << /PhotoColour [/Indexed /DeviceRGB 1 (\x00\x00\x00\x11\xc9\x55)] >> /XObject << /Image 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${"q 40 0 0 32 0 0 cm /Image Do Q".length} >>\nstream\nq 40 0 0 32 0 0 cm /Image Do Q\nendstream`,
    `<< /Type /XObject /Subtype /Image /Width 80 /Height 64 /ColorSpace /PhotoColour /BitsPerComponent 8 /Length ${pixels.length} >>\nstream\n${pixels}\nendstream`,
  ];
  return rawPdf(bodies);
}

function inlineImagePdf(): Uint8Array {
  const pixels = Array.from({ length: 80 * 64 }, (_, index) => String.fromCharCode(index % 80 * 3, 90, 200)).join("");
  const content = `q 40 0 0 32 0 0 cm BI /W 80 /H 64 /CS /RGB /BPC 8 ID ${pixels} EI Q`;
  return rawPdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 40 32] /Resources << >> /Contents 4 0 R >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ]);
}

function rawPdf(bodies: string[]): Uint8Array {
  let text = "%PDF-1.7\n";
  const offsets = [0];
  for (const [index, body] of bodies.entries()) {
    offsets.push(text.length);
    text += `${index + 1} 0 obj\n${body}\nendobj\n`;
  }
  const xref = text.length;
  text += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  text += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  text += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Uint8Array.from(text, (char) => char.charCodeAt(0));
}
