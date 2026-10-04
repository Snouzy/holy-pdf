import { beforeAll, describe, expect, it } from "vitest";
import type { CV, Mat } from "../../src/scan/cv";
import { enhance } from "../../src/scan/enhance";
import { rectify, turnedClockwise } from "../../src/scan/rectify";
import { loadCv, pagePhoto } from "./support";

let cv: CV;
beforeAll(async () => {
  cv = await loadCv();
});

/** A page in a shadow that darkens it from left to right, with a black stroke in the middle. */
function shadedPage(width = 827, height = 1170): Mat {
  const page = new cv.Mat(height, width, cv.CV_8UC4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const light = Math.round(230 - 110 * x / width);
      page.data.set([light, light, light - 5, 255], (y * width + x) * 4);
    }
  }
  cv.rectangle(page, new cv.Point(200, 580), new cv.Point(600, 590), new cv.Scalar(20, 20, 20, 255), -1);
  return page;
}

const at = (image: Mat, x: number, y: number) => image.data[(y * image.cols + x) * 4]!;

describe("enhance", () => {
  it("makes the paper white across a shadow, keeps the ink black, and draws a white border", () => {
    const page = shadedPage();
    const { image, keepWatermark } = enhance(cv, page, { mode: "document" });
    page.delete();
    expect([at(image, 100, 300), at(image, 700, 300)]).toEqual([255, 255]);
    expect(at(image, 400, 585)).toBeLessThan(40);
    expect(at(image, 5, 5)).toBe(255);
    expect(keepWatermark).toBe(false);
    image.delete();
  });

  it("stretches each channel in Color mode", () => {
    const page = new cv.Mat(100, 100, cv.CV_8UC4, new cv.Scalar(100, 120, 140, 255));
    cv.rectangle(page, new cv.Point(0, 0), new cv.Point(49, 99), new cv.Scalar(60, 70, 80, 255), -1);
    const { image } = enhance(cv, page, { mode: "color" });
    page.delete();
    expect([...image.data.slice(0, 3)]).toEqual([0, 0, 0]);
    expect([...image.data.slice(99 * 4, 99 * 4 + 3)]).toEqual([255, 255, 255]);
    image.delete();
  });

  it("flattens a page to A4 at 200 dpi and turns it clockwise", () => {
    const quad = { topLeft: { x: 0.18, y: 0.12 }, topRight: { x: 0.84, y: 0.15 }, bottomRight: { x: 0.88, y: 0.86 }, bottomLeft: { x: 0.12, y: 0.83 } };
    const photo = pagePhoto(cv, quad);
    const page = rectify(cv, photo, quad)!;
    const turned = turnedClockwise(cv, page, 1);
    expect([page.cols, page.rows, turned.cols, turned.rows]).toEqual([1654, 2339, 2339, 1654]);
    for (const mat of [photo, page, turned]) mat.delete();
  });
});
