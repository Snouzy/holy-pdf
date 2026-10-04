import { beforeAll, describe, expect, it, vi } from "vitest";
import { closeDoc, openPdf, savePdf } from "../../src/engine/documents";
import { renderPage } from "../../src/engine/render";
import { signPdf } from "../../src/engine/sign";
import type { Pdfium } from "../../src/engine/pdfium";
import type { SignatureImage, SignaturePlacement } from "../../src/engine/types";
import { countImageStreams, loadTestPdfium, readWithPdfjs, textPdf } from "./support";
import { structuredPdf, structure } from "./sign-fixture";

let p: Pdfium;
beforeAll(async () => { p = await loadTestPdfium(); });
const placement: SignaturePlacement = { id: "one", pageIndex: 0, x: 0.15, y: 0.2, width: 0.5, height: 0.25 };

/** Asymmetric RGBA pattern: red top-left, blue bottom-left, transparent right. */
function signature(): SignatureImage {
  const pixels = new Uint8ClampedArray(40 * 20 * 4);
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
    pixels.set(y < 10 ? [255, 0, 0, 255] : [0, 0, 255, 255], (y * 40 + x) * 4);
  }
  return { width: 40, height: 20, pixels };
}

function sample(page: ReturnType<typeof renderPage>, x: number, y: number) {
  const offset = (Math.floor(y * page.height) * page.width + Math.floor(x * page.width)) * 4;
  return [...page.pixels.subarray(offset, offset + 3)];
}

describe("visual signatures", () => {
  it.each([0, 90, 180, 270] as const)("positions an upright transparent image on a page rotated %s with a displaced crop", async (rotation) => {
    const source = openPdf(p, textPdf(p, ["Original"], { 0: rotation }));
    const page = p.FPDF_LoadPage(source.handle, 0);
    p.FPDFPage_SetMediaBox(page, -20, -30, 600, 860);
    p.FPDFPage_SetCropBox(page, 50, 100, 550, 800);
    p.FPDF_ClosePage(page);
    const cropped = openPdf(p, savePdf(p, source.handle));
    closeDoc(p, source);
    try {
      const before = renderPage(p, cropped, 0, 600);
      const signed = signPdf(p, cropped, signature(), [placement]);
      const out = openPdf(p, signed);
      try {
        const rendered = renderPage(p, out, 0, 600);
        expect(sample(rendered, 0.20, 0.24)).toEqual([255, 0, 0]);
        expect(sample(rendered, 0.20, 0.39)).toEqual([0, 0, 255]);
        // Transparent pixels and every pixel outside the placement retain the original content.
        for (let y = 0; y < rendered.height; y++) for (let x = 0; x < rendered.width; x++) {
          if (x / rendered.width > 0.67 || x / rendered.width < 0.13 || y / rendered.height < 0.18 || y / rendered.height > 0.47 || (x / rendered.width > 0.43 && x / rendered.width < 0.63)) {
            const at = (y * rendered.width + x) * 4;
            if (rendered.pixels[at] !== before.pixels[at] || rendered.pixels[at + 1] !== before.pixels[at + 1] || rendered.pixels[at + 2] !== before.pixels[at + 2]) throw new Error(`Unexpected changed pixel ${x},${y}`);
          }
        }
        const independent = await readWithPdfjs(signed);
        expect(independent[0]?.rotation).toBe(rotation);
        expect(independent[0]?.text).toContain("Original");
      } finally { closeDoc(p, out); }
    } finally { closeDoc(p, cropped); }
  });

  it.each([37, 90, 223])("rotates the signature clockwise by %s degrees around its physical center", async (angle) => {
    const initial = openPdf(p, textPdf(p, ["Original"], { 0: 90 }));
    const page = p.FPDF_LoadPage(initial.handle, 0);
    p.FPDFPage_SetCropBox(page, 50, 100, 550, 800);
    p.FPDF_ClosePage(page);
    const source = openPdf(p, savePdf(p, initial.handle));
    closeDoc(p, initial);
    const place = { ...placement, x: 0.3, y: 0.3, width: 0.3, height: 0.2, rotation: angle };
    const out = openPdf(p, signPdf(p, source, signature(), [place]));
    try {
      const before = renderPage(p, source, 0, 900);
      const rendered = renderPage(p, out, 0, 900);
      const size = source.sizes[0]!;
      const point = (u: number, v: number) => {
        const x = (u - 0.5) * place.width * size.width;
        const y = (v - 0.5) * place.height * size.height;
        const radians = angle * Math.PI / 180;
        return [place.x + place.width / 2 + (x * Math.cos(radians) - y * Math.sin(radians)) / size.width,
          place.y + place.height / 2 + (x * Math.sin(radians) + y * Math.cos(radians)) / size.height] as const;
      };
      // PDFium interpolates rotated image pixels, even within a solid region.
      for (const [v, color] of [[0.25, [255, 0, 0]], [0.75, [0, 0, 255]]] as const) {
        const actual = sample(rendered, ...point(0.2, v));
        color.forEach((channel, index) => expect(Math.abs(actual[index]! - channel)).toBeLessThanOrEqual(3));
      }
      expect(sample(rendered, ...point(0.8, 0.5))).toEqual(sample(before, ...point(0.8, 0.5)));
    } finally { closeDoc(p, source); closeDoc(p, out); }
  });

  it("rotates full pages after placing signatures, including unsigned pages, without accumulating on repeated exports", async () => {
    const source = openPdf(p, textPdf(p, ["One", "Two", "Three"], { 0: 90, 1: 180 }));
    try {
      const before = renderPage(p, source, 0, 500);
      const placements = [placement, { ...placement, id: "third", pageIndex: 2 }];
      const rotations = { 0: 90, 1: 90, 2: 180 };
      const first = signPdf(p, source, signature(), placements, undefined, rotations);
      const second = signPdf(p, source, signature(), placements, undefined, rotations);
      expect(countImageStreams(first)).toBe(2);
      expect(countImageStreams(second)).toBe(2);
      expect((await readWithPdfjs(first)).map(({ rotation, text }) => ({ rotation, text }))).toEqual([
        { rotation: 180, text: "One" }, { rotation: 270, text: "Two" }, { rotation: 180, text: "Three" },
      ]);
      expect(await readWithPdfjs(second)).toEqual(await readWithPdfjs(first));
      expect(Buffer.compare(Buffer.from(renderPage(p, source, 0, 500).pixels), Buffer.from(before.pixels))).toBe(0);
      const out = openPdf(p, first);
      const again = openPdf(p, second);
      try {
        // The red sample originally at (0.20, 0.24) follows the whole page's quarter turn.
        expect(sample(renderPage(p, out, 0, 600), 0.76, 0.20)).toEqual([255, 0, 0]);
        expect(sample(renderPage(p, out, 2, 600), 0.80, 0.76)).toEqual([255, 0, 0]);
        expect(Buffer.compare(Buffer.from(renderPage(p, again, 0, 600).pixels), Buffer.from(renderPage(p, out, 0, 600).pixels))).toBe(0);
      } finally { closeDoc(p, out); closeDoc(p, again); }
    } finally { closeDoc(p, source); }
  });

  it.each([0, 90])("exports edge-aligned rotated signatures with negative unrotated coordinates on a cropped page rotated %s", (nativeRotation) => {
    const initial = openPdf(p, textPdf(p, ["Original"], { 0: nativeRotation }));
    const page = p.FPDF_LoadPage(initial.handle, 0);
    p.FPDFPage_SetCropBox(page, 50, 100, 550, 800);
    p.FPDF_ClosePage(page);
    const source = openPdf(p, savePdf(p, initial.handle));
    closeDoc(p, initial);
    const image = signature();
    for (let y = 0; y < image.height; y++) for (let x = 20; x < image.width; x++) {
      image.pixels.set(y < 10 ? [0, 255, 0, 255] : [255, 255, 0, 255], (y * image.width + x) * 4);
    }
    try {
      const size = source.sizes[0]!;
      for (const rotation of [37, 90, 270]) for (const edge of ["left", "right", "top", "bottom"]) {
        const width = edge === "top" || edge === "bottom" ? 0.08 : 0.4;
        const height = edge === "top" || edge === "bottom" ? 0.4 : 0.08;
        const radians = rotation * Math.PI / 180;
        const halfWidth = (Math.abs(Math.cos(radians)) * width + Math.abs(Math.sin(radians)) * height * size.height / size.width) / 2;
        const halfHeight = (Math.abs(Math.sin(radians)) * width * size.width / size.height + Math.abs(Math.cos(radians)) * height) / 2;
        const centerX = edge === "left" ? halfWidth : edge === "right" ? 1 - halfWidth : 0.5;
        const centerY = edge === "top" ? halfHeight : edge === "bottom" ? 1 - halfHeight : 0.5;
        const place = { id: edge, pageIndex: 0, x: centerX - width / 2, y: centerY - height / 2, width, height, rotation };
        if (rotation === 90 && edge === "left") expect(place.x).toBeLessThan(0);
        if (rotation === 90 && edge === "top") expect(place.y).toBeLessThan(0);
        const out = openPdf(p, signPdf(p, source, image, [place]));
        try {
          const rendered = renderPage(p, out, 0, 600);
          for (const [u, v, color] of [[0.15, 0.15, [255, 0, 0]], [0.85, 0.15, [0, 255, 0]], [0.15, 0.85, [0, 0, 255]], [0.85, 0.85, [255, 255, 0]]] as const) {
            const localX = (u - 0.5) * width * size.width;
            const localY = (v - 0.5) * height * size.height;
            const x = centerX + (localX * Math.cos(radians) - localY * Math.sin(radians)) / size.width;
            const y = centerY + (localX * Math.sin(radians) + localY * Math.cos(radians)) / size.height;
            const actual = sample(rendered, x, y);
            color.forEach((channel, index) => expect(Math.abs(actual[index]! - channel)).toBeLessThanOrEqual(3));
          }
        } finally { closeDoc(p, out); }
        const shift = edge === "left" ? { x: place.x - 0.01 } : edge === "right" ? { x: place.x + 0.01 } : edge === "top" ? { y: place.y - 0.01 } : { y: place.y + 0.01 };
        expect(() => signPdf(p, source, image, [{ ...place, ...shift }])).toThrow(expect.objectContaining({ error: { kind: "invalidSignature" } }));
      }
    } finally { closeDoc(p, source); }
  });

  it("keeps catalog structures, selectable text and source previews intact across repeated exports", async () => {
    const original = structuredPdf();
    const doc = openPdf(p, original);
    try {
      const preview = renderPage(p, doc, 0, 240);
      const image = signature();
      const pixels = image.pixels.slice();
      const first = signPdf(p, doc, image, [placement, { ...placement, id: "two", y: 0.6 }]);
      const second = signPdf(p, doc, image, [placement]);
      expect(countImageStreams(first)).toBe(2); // both placements share one image and its alpha mask
      expect(countImageStreams(second)).toBe(2);
      expect(image.pixels).toEqual(pixels);
      expect(renderPage(p, doc, 0, 240).pixels).toEqual(preview.pixels);
      expect(p.pdfium.HEAPU8.slice(doc.buffer, doc.buffer + doc.size)).toEqual(original);
      const expected = await structure(original);
      expect(await structure(first)).toEqual(expected);
      expect(await structure(second)).toEqual(expected);
    } finally { closeDoc(p, doc); }
  });

  it("exports an unlocked PDF without changing its encrypted original", async () => {
    const original = textPdf(p, ["Encrypted"], {}, "secret");
    const doc = openPdf(p, original, "secret");
    try {
      expect((await readWithPdfjs(signPdf(p, doc, signature(), [placement])))[0]?.text).toContain("Encrypted");
      expect(() => openPdf(p, original)).toThrow();
    } finally { closeDoc(p, doc); }
  });

  it("places the same image on different pages and reports all placements", async () => {
    const doc = openPdf(p, textPdf(p, ["One", "Two", "Three"]));
    try {
      const steps: { done: number; total: number }[] = [];
      const bytes = signPdf(p, doc, signature(), [placement, { ...placement, id: "last", pageIndex: 2 }], (progress) => steps.push(progress));
      expect(steps).toEqual([{ done: 1, total: 2 }, { done: 2, total: 2 }]);
      expect((await readWithPdfjs(bytes)).map(({ text }) => text)).toEqual(["One", "Two", "Three"]);
      const out = openPdf(p, bytes);
      try {
        expect(renderPage(p, out, 1, 200).pixels).toEqual(renderPage(p, doc, 1, 200).pixels);
        for (const pageIndex of [0, 2]) expect(sample(renderPage(p, out, pageIndex, 400), 0.20, 0.24)).toEqual([255, 0, 0]);
      } finally { closeDoc(p, out); }
    } finally { closeDoc(p, doc); }
  });

  it("embeds the image and transparency mask only once across ten pages", async () => {
    const labels = Array.from({ length: 10 }, (_, index) => `Page ${index + 1}`);
    const doc = openPdf(p, textPdf(p, labels));
    try {
      const places = labels.map((_, pageIndex) => ({ ...placement, id: `${pageIndex}`, pageIndex }));
      const bytes = signPdf(p, doc, signature(), places);
      expect(countImageStreams(bytes)).toBe(2);
      expect((await readWithPdfjs(bytes)).map(({ text }) => text)).toEqual(labels);
      const out = openPdf(p, bytes);
      try {
        for (let index = 0; index < labels.length; index++) expect(sample(renderPage(p, out, index, 200), 0.20, 0.24)).toEqual([255, 0, 0]);
      } finally { closeDoc(p, out); }
    } finally { closeDoc(p, doc); }
  });

  it("mixes transparent assets in placement order and shares repeated references across pages", async () => {
    const doc = openPdf(p, textPdf(p, ["One", "Two"]));
    const first = signature();
    const second = signature();
    for (let index = 0; index < second.pixels.length; index += 4) {
      if (second.pixels[index + 3]) second.pixels.set([0, 255, 0, 255], index);
    }
    const places = [
      placement,
      { ...placement, id: "text", imageId: "text", x: 0.25 },
      { ...placement, id: "draw-second-page", imageId: "draw", pageIndex: 1 },
      { ...placement, id: "text-second-page", imageId: "alias", pageIndex: 1, x: 0.25 },
    ];
    try {
      const bytes = signPdf(p, doc, first, places, undefined, {}, { draw: first, text: second, alias: second, unused: { ...first, width: 0 } });
      expect(countImageStreams(bytes)).toBe(4); // Two images and their two masks, irrespective of aliases or placements.
      expect((await readWithPdfjs(bytes)).map(({ text }) => text)).toEqual(["One", "Two"]);
      const out = openPdf(p, bytes);
      try {
        for (const pageIndex of [0, 1]) {
          const rendered = renderPage(p, out, pageIndex, 600);
          expect(sample(rendered, 0.2, 0.24)).toEqual([255, 0, 0]);
          expect(sample(rendered, 0.3, 0.24)).toEqual([0, 255, 0]);
          expect(sample(rendered, 0.6, 0.24)).toEqual(sample(renderPage(p, doc, pageIndex, 600), 0.6, 0.24));
        }
      } finally { closeDoc(p, out); }
      const reverse = openPdf(p, signPdf(p, doc, first, [places[1]!, placement], undefined, {}, { text: second }));
      try { expect(sample(renderPage(p, reverse, 0, 600), 0.3, 0.24)).toEqual([255, 0, 0]); }
      finally { closeDoc(p, reverse); }
    } finally { closeDoc(p, doc); }
  });

  it("rejects missing, inherited and invalid references while ignoring unused entries", () => {
    const doc = openPdf(p, textPdf(p, ["Intact"]));
    const image = signature();
    try {
      for (const images of [{}, Object.create({ text: image }), { text: { ...image, width: 0 } }]) {
        expect(() => signPdf(p, doc, image, [{ ...placement, imageId: "text" }], undefined, {}, images)).toThrow(expect.objectContaining({ error: { kind: "invalidSignature" } }));
      }
      expect(() => signPdf(p, doc, image, [placement], undefined, {}, { unused: { ...image, width: 0 } })).not.toThrow();
    } finally { closeDoc(p, doc); }
  });

  it("releases already-created assets and the reopened document when a later asset fails", () => {
    const doc = openPdf(p, textPdf(p, ["Intact"]));
    const closeDocument = vi.fn(p.FPDF_CloseDocument);
    const closeXObject = vi.fn(p.FPDF_CloseXObject);
    const createXObject = vi.fn(p.FPDF_NewXObjectFromPage).mockImplementationOnce(p.FPDF_NewXObjectFromPage).mockReturnValueOnce(0);
    const failing = { ...p, FPDF_CloseDocument: closeDocument, FPDF_CloseXObject: closeXObject, FPDF_NewXObjectFromPage: createXObject };
    try {
      expect(() => signPdf(failing, doc, signature(), [placement, { ...placement, id: "two", imageId: "text" }], undefined, {}, { text: signature() })).toThrow(expect.objectContaining({ error: { kind: "damaged" } }));
      expect(closeXObject).toHaveBeenCalledTimes(1);
      expect(closeDocument).toHaveBeenCalledTimes(3); // Two scratch documents and the reopened source.
      expect(closeDocument).not.toHaveBeenCalledWith(doc.handle);
      expect(() => signPdf(p, doc, signature(), [placement])).not.toThrow();
    } finally { closeDoc(p, doc); }
  });

  it("bounds all referenced assets to 16 megapixels before reopening the document", () => {
    const doc = openPdf(p, textPdf(p, ["Intact"]));
    const image = { width: 1000, height: 1000, pixels: new Uint8ClampedArray(4_000_000) };
    const images = Object.fromEntries(Array.from({ length: 17 }, (_, index) => [String(index), { ...image }]));
    const places = Object.keys(images).map((imageId) => ({ ...placement, id: imageId, imageId }));
    try {
      expect(() => signPdf(p, doc, image, places, undefined, {}, images)).toThrow(expect.objectContaining({ error: { kind: "invalidSignature" } }));
    } finally { closeDoc(p, doc); }
  });

  it("rejects a document containing an existing digital signature", () => {
    const source = new TextDecoder().decode(structuredPdf());
    // The form's value is a signature dictionary; PDFium repairs the changed xref in this fixture.
    const signed = source.replace("/FT/Tx/T(Name)/V(Ada)", "/FT/Sig/T(Signature)/V<</Type/Sig/Filter/Adobe.PPKLite/SubFilter/adbe.pkcs7.detached/ByteRange[0 1 2 3]/Contents<0000>>");
    const doc = openPdf(p, new TextEncoder().encode(signed));
    try {
      expect(p.FPDF_GetSignatureCount(doc.handle)).toBe(1);
      expect(() => signPdf(p, doc, signature(), [placement])).toThrow(expect.objectContaining({ error: { kind: "alreadySigned" } }));
    } finally { closeDoc(p, doc); }
  });

  it("rejects invalid or unbounded images and placements before modifying any document", () => {
    const doc = openPdf(p, textPdf(p, ["Intact"]));
    try {
      const fail = (image: SignatureImage, places: SignaturePlacement[]) => expect(() => signPdf(p, doc, image, places)).toThrow(expect.objectContaining({ error: { kind: "invalidSignature" } }));
      fail({ ...signature(), width: 1601 }, [placement]);
      fail({ width: 1001, height: 1000, pixels: new Uint8ClampedArray(4_004_000) }, [placement]);
      fail({ ...signature(), pixels: new Uint8ClampedArray(4) }, [placement]);
      fail(signature(), []);
      for (const rotations of [{ 0: 45 }, { 0: -90 }, { 0: 360 }, { 1: 90 }, { "1.5": 90 }, { "01": 90 }, { 0: NaN }]) {
        expect(() => signPdf(p, doc, signature(), [placement], undefined, rotations)).toThrow(expect.objectContaining({ error: { kind: "invalidSignature" } }));
      }
      for (const change of [{ pageIndex: 1 }, { pageIndex: -1 }, { x: NaN }, { y: -0.1 }, { width: 0 }, { height: Infinity }, { x: 0.9 }, { rotation: NaN }, { rotation: Infinity }, { rotation: 361 }]) fail(signature(), [{ ...placement, ...change }]);
    } finally { closeDoc(p, doc); }
  });
});
