import { beforeAll, describe, expect, it } from "vitest";
import type { CV } from "../../src/scan/cv";
import { detect } from "../../src/scan/detect";
import { cornersOf, fullImage, maxCornerShift, type Quad } from "../../src/scan/geometry";
import { loadCv, pagePhoto } from "./support";

let cv: CV;
beforeAll(async () => {
  cv = await loadCv();
});

const page: Quad = { topLeft: { x: 0.18, y: 0.12 }, topRight: { x: 0.84, y: 0.15 }, bottomRight: { x: 0.88, y: 0.86 }, bottomLeft: { x: 0.12, y: 0.83 } };

describe("page detection", () => {
  it("finds the corners of a page on a desk, to within half a percent of the diagonal", () => {
    const photo = pagePhoto(cv, page);
    const found = detect(cv, photo);
    photo.delete();
    expect(maxCornerShift(page, found.quad, { width: 1200, height: 1600 })).toBeLessThan(0.005);
    expect(found.inlierRatios.every((ratio) => ratio > 0.9)).toBe(true);
    expect(found.reasons).not.toContain("noPageFound");
  });

  it("takes the whole photo and asks for a check when there is no page", () => {
    const photo = new cv.Mat(800, 600, cv.CV_8UC4, new cv.Scalar(120, 120, 120, 255));
    const found = detect(cv, photo);
    photo.delete();
    expect(found).toEqual({ quad: fullImage, inlierRatios: [], reasons: ["noPageFound"] });
  });

  it("orders the corners clockwise from the top left", () => {
    const photo = pagePhoto(cv, page);
    const { quad } = detect(cv, photo);
    photo.delete();
    const [topLeft, topRight, bottomRight, bottomLeft] = cornersOf(quad);
    expect(topLeft!.x < topRight!.x && topRight!.y < bottomRight!.y && bottomRight!.x > bottomLeft!.x && bottomLeft!.y > topLeft!.y).toBe(true);
  });
});
