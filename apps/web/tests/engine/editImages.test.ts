import { beforeAll, describe, expect, it } from "vitest";
import { closeDoc, openImage, openPdf, savePdf } from "../../src/engine/documents";
import { fontCharsOf, pageObjects } from "../../src/engine/pageObjects";
import type { Pdfium } from "../../src/engine/pdfium";
import { renderPage } from "../../src/engine/render";
import { transformPdf } from "../../src/engine/transform";
import { type Box, type EditImage, type EditItem, type OriginalEdit, type Picture, plainPicture } from "../../src/engine/types";
import { countImageStreams, gradientJpeg, loadTestPdfium, photoPdf, rawPdf, sharedPhotoPdf, textPdf } from "./support";

let p: Pdfium;
beforeAll(async () => {
  p = await loadTestPdfium();
});

const [red, green, blue, white] = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 255]];
/** Two by two: red, green over blue, white. */
const quarters: EditImage = { kind: "rgba", width: 2, height: 2, pixels: new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]) };
const box: Box = { x: 100, y: 100, width: 200, height: 200 };
const blank = (rotate = 0) => rawPdf(["<</Type/Catalog/Pages 2 0 R>>", "<</Type/Pages/Kids[3 0 R]/Count 1>>", `<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Rotate ${rotate}>>`]);

function placed(bytes: Uint8Array, pictures: { box: Box; picture?: Picture }[], image = quarters): Uint8Array {
  const items: EditItem[] = pictures.map((each, index) => ({ id: String(index), pageIndex: 0, kind: "image", imageId: "pic", box: each.box, ...(each.picture ? { picture: each.picture } : {}) }));
  const doc = openPdf(p, bytes);
  try {
    return transformPdf(p, doc, { kind: "edit", items, images: { pic: image }, edits: [] });
  } finally {
    closeDoc(p, doc);
  }
}

function retouched(bytes: Uint8Array, edits: OriginalEdit[]): Uint8Array {
  const doc = openPdf(p, bytes);
  try {
    return transformPdf(p, doc, { kind: "edit", items: [], images: {}, edits });
  } finally {
    closeDoc(p, doc);
  }
}

const colour = (bytes: Uint8Array, x: number, y: number) => colourOn(bytes, 0, x, y);

function colourOn(bytes: Uint8Array, index: number, x: number, y: number): number[] {
  const doc = openPdf(p, bytes);
  try {
    const { pixels, width } = renderPage(p, doc, index, Math.round(doc.sizes[index]!.width));
    const at = (y * width + x) * 4;
    return [pixels[at]!, pixels[at + 1]!, pixels[at + 2]!];
  } finally {
    closeDoc(p, doc);
  }
}

const quartersOf = (bytes: Uint8Array) => [colour(bytes, 150, 150), colour(bytes, 250, 150), colour(bytes, 150, 250), colour(bytes, 250, 250)];

const listed = (bytes: Uint8Array, edits: OriginalEdit[] = []) => listedOn(bytes, 0, edits);

function listedOn(bytes: Uint8Array, index: number, edits: OriginalEdit[] = []) {
  const doc = openPdf(p, bytes);
  try {
    return pageObjects(p, doc, index, edits, fontCharsOf(p, doc.handle)).objects;
  } finally {
    closeDoc(p, doc);
  }
}

describe("pictures", () => {
  it("places an added image as it is, turned, mirrored or cropped, on an upright page and a rotated one", () => {
    for (const rotate of [0, 90]) {
      const bytes = blank(rotate);
      expect(quartersOf(placed(bytes, [{ box }]))).toEqual([red, green, blue, white]);
      expect(quartersOf(placed(bytes, [{ box, picture: { ...plainPicture, rotate: 90 } }]))).toEqual([blue, red, white, green]);
      expect(quartersOf(placed(bytes, [{ box, picture: { ...plainPicture, rotate: 270 } }]))).toEqual([green, white, red, blue]);
      expect(quartersOf(placed(bytes, [{ box, picture: { ...plainPicture, flipX: true } }]))).toEqual([green, red, white, blue]);
      expect(quartersOf(placed(bytes, [{ box, picture: { ...plainPicture, flipY: true } }]))).toEqual([blue, white, red, green]);
      // Mirrored left-right, then turned to the right as the reader sees it: the model stores a left turn for that.
      expect(quartersOf(placed(bytes, [{ box, picture: { ...plainPicture, rotate: 270, flipX: true } }]))).toEqual([white, green, blue, red]);
    }
  });

  it("stores an image placed twice once; the browser cuts an added image's crop before it comes", () => {
    const once = placed(blank(), [{ box }]);
    const twice = placed(blank(), [{ box }, { box: { ...box, y: 400 } }]);
    expect(countImageStreams(twice)).toBe(countImageStreams(once));
    expect([colour(twice, 150, 150), colour(twice, 150, 450)]).toEqual([red, red]);
    expect(() => placed(blank(), [{ box, picture: { ...plainPicture, crop: { x: 0, y: 0, width: 0.5, height: 0.5 } } }])).toThrow("damaged");
  });

  it("turns and mirrors an image the page already had, and lists where its pixels went", () => {
    const bytes = photoPdf(p, ["A"], { width: 40, height: 30 });
    const image = listed(bytes).find((object) => object.kind === "image")!;
    const turned = listed(retouched(bytes, [{ pageIndex: 0, index: image.index, picture: { ...plainPicture, rotate: 90 } }])).find((object) => object.kind === "image")!;
    const across = { x: turned.corners!.topRight.x - turned.corners!.topLeft.x, y: turned.corners!.topRight.y - turned.corners!.topLeft.y };
    expect([Math.round(across.x), Math.round(across.y)]).toEqual([0, Math.round(image.box.width)]);
    expect([Math.round(turned.box.width), Math.round(turned.box.height)]).toEqual([Math.round(image.box.height), Math.round(image.box.width)]);
    const mirrored = listed(retouched(bytes, [{ pageIndex: 0, index: image.index, picture: { ...plainPicture, flipX: true } }])).find((object) => object.kind === "image")!;
    expect(mirrored.corners!.topLeft.x).toBeGreaterThan(mirrored.corners!.topRight.x);
    expect(mirrored.box).toEqual(image.box);
  });

  it("crops an image the page already had to a part of its pixels, in place", () => {
    const bytes = photoPdf(p, ["A"], { width: 40, height: 30 });
    const image = listed(bytes).find((object) => object.kind === "image")!;
    const crop = { x: 0.25, y: 0.5, width: 0.5, height: 0.5 };
    const cropped = retouched(bytes, [{ pageIndex: 0, index: image.index, picture: { ...plainPicture, crop } }]);
    const after = listed(cropped).find((object) => object.kind === "image")!;
    expect([after.index, after.croppable]).toEqual([image.index, true]);
    const expected = { x: image.box.x + crop.x * image.box.width, y: image.box.y + crop.y * image.box.height, width: crop.width * image.box.width, height: crop.height * image.box.height };
    for (const key of ["x", "y", "width", "height"] as const) expect(after.box[key]).toBeCloseTo(expected[key], 0);
    const pointInside = { x: Math.round(expected.x + expected.width / 2), y: Math.round(expected.y + expected.height / 2) };
    expect(colour(cropped, pointInside.x, pointInside.y)).toEqual(colour(bytes, pointInside.x, pointInside.y));
    expect(colour(cropped, Math.round(image.box.x + 5), Math.round(image.box.y + 5))).toEqual(white);
    const jpegDoc = openImage(p, { kind: "jpeg", bytes: gradientJpeg });
    const jpegPdf = savePdf(p, jpegDoc.handle);
    closeDoc(p, jpegDoc);
    const photo = listed(jpegPdf).find((object) => object.kind === "image")!;
    const halved = retouched(jpegPdf, [{ pageIndex: 0, index: photo.index, picture: { ...plainPicture, crop: { x: 0, y: 0, width: 0.5, height: 1 } } }]);
    expect(listed(halved).find((object) => object.kind === "image")!.box.width).toBeCloseTo(photo.box.width / 2, 0);
    expect(() => retouched(jpegPdf, [{ pageIndex: 0, index: photo.index, picture: { ...plainPicture, crop: { x: 0.5, y: 0, width: 0.8, height: 1 } } }])).toThrow("damaged");
  });

  it("crops one placement of an image drawn twice, and leaves the other as it was", () => {
    const bytes = sharedPhotoPdf(p, { width: 40, height: 30 });
    const first = listed(bytes).find((object) => object.kind === "image")!;
    const other = listedOn(bytes, 1).find((object) => object.kind === "image")!;
    const edited = retouched(bytes, [{ pageIndex: 0, index: first.index, picture: { ...plainPicture, crop: { x: 0, y: 0, width: 0.5, height: 0.5 } } }]);
    expect(listed(edited).find((object) => object.kind === "image")!.box.width).toBeCloseTo(first.box.width / 2, 0);
    expect(listedOn(edited, 1).find((object) => object.kind === "image")!.box).toEqual(other.box);
    const sample = { x: Math.round(other.box.x + other.box.width * 0.9), y: Math.round(other.box.y + other.box.height * 0.9) };
    expect(colourOn(edited, 1, sample.x, sample.y)).toEqual(colourOn(bytes, 1, sample.x, sample.y));
  });

  it("scales a cropped image from its box like any image", () => {
    const bytes = photoPdf(p, ["A"], { width: 40, height: 30 });
    const image = listed(bytes).find((object) => object.kind === "image")!;
    const smaller = { x: 50, y: 50, width: 100, height: 60 };
    const edited = retouched(bytes, [{ pageIndex: 0, index: image.index, picture: { ...plainPicture, crop: { x: 0, y: 0, width: 0.5, height: 0.5 } }, box: smaller }]);
    const after = listed(edited).find((object) => object.kind === "image")!;
    for (const key of ["x", "y", "width", "height"] as const) expect(after.box[key]).toBeCloseTo(smaller[key], 0);
    expect(textPdf(p, ["A"]).length).toBeGreaterThan(0);
  });
});
