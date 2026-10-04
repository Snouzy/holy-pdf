import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { CV, Mat, Rgba } from "../../src/scan/cv";
import { cornersOf, pixel, type Quad } from "../../src/scan/geometry";

const require = createRequire(import.meta.url);
let opencv: Promise<CV> | undefined;

export function loadCv(): Promise<CV> {
  opencv ??= (async () => {
    const module = require("@techstark/opencv-js");
    if (module instanceof Promise) return module;
    if (module.Mat) return module;
    await new Promise<void>((resolve) => {
      module.onRuntimeInitialized = () => resolve();
    });
    return module;
  })();
  return opencv;
}

/** A light page with dark lines of « text », drawn at `quad` on a dark desk. */
export function pagePhoto(cv: CV, quad: Quad, width = 1200, height = 1600): Mat {
  const photo = new cv.Mat(height, width, cv.CV_8UC4, new cv.Scalar(45, 40, 38, 255));
  const corners = cornersOf(quad).map((corner) => pixel(corner, { width, height }));
  const outline = cv.matFromArray(4, 1, cv.CV_32SC2, corners.flatMap((corner) => [Math.round(corner.x), Math.round(corner.y)]));
  const outlines = new cv.MatVector();
  outlines.push_back(outline);
  cv.fillPoly(photo, outlines, new cv.Scalar(236, 234, 228, 255));
  const [topLeft, topRight, , bottomLeft] = corners;
  for (let line = 1; line < 12; line++) {
    const t = line / 13;
    const start = { x: topLeft!.x + (bottomLeft!.x - topLeft!.x) * t, y: topLeft!.y + (bottomLeft!.y - topLeft!.y) * t };
    const across = { x: (topRight!.x - topLeft!.x) * 0.7, y: (topRight!.y - topLeft!.y) * 0.7 };
    cv.line(photo, new cv.Point(start.x + across.x * 0.15, start.y + across.y * 0.15), new cv.Point(start.x + across.x, start.y + across.y), new cv.Scalar(30, 30, 30, 255), 6);
  }
  outlines.delete();
  outline.delete();
  return photo;
}

/** A white page of large text, drawn at `quad` on a dark desk, then the whole photo turned a quarter clockwise. */
export function sidewaysTextPhoto(cv: CV, quad: Quad, lines: string[], width = 1200, height = 1600): Mat {
  const photo = new cv.Mat(height, width, cv.CV_8UC4, new cv.Scalar(45, 40, 38, 255));
  const corners = cornersOf(quad).map((corner) => pixel(corner, { width, height }));
  const outline = cv.matFromArray(4, 1, cv.CV_32SC2, corners.flatMap((corner) => [Math.round(corner.x), Math.round(corner.y)]));
  const outlines = new cv.MatVector();
  outlines.push_back(outline);
  cv.fillPoly(photo, outlines, new cv.Scalar(245, 245, 240, 255));
  lines.forEach((text, index) => {
    cv.putText(photo, text, new cv.Point(corners[0]!.x + 40, corners[0]!.y + 120 + index * 110), cv.FONT_HERSHEY_DUPLEX, index === 0 ? 2.2 : 1.4, new cv.Scalar(20, 20, 20, 255), index === 0 ? 5 : 3);
  });
  const turned = new cv.Mat();
  cv.rotate(photo, turned, cv.ROTATE_90_CLOCKWISE);
  for (const mat of [outlines, outline, photo]) mat.delete();
  return turned;
}

export const privatePhotos = new URL("../../../../fixtures-private/photos/", import.meta.url).pathname;

/** A HEIC photo as RGBA, through the same libheif build the site serves. */
export async function heicPhoto(path: string): Promise<Rgba> {
  const factory = require("libheif-js/libheif-wasm/libheif.js");
  const libheif = await factory({ wasmBinary: readFileSync(require.resolve("libheif-js/libheif-wasm/libheif.wasm")) });
  const [image] = new libheif.HeifDecoder().decode(readFileSync(path));
  const [width, height] = [image.get_width(), image.get_height()];
  const shown = await new Promise<{ data: Uint8ClampedArray }>((resolve, reject) => {
    image.display({ data: new Uint8ClampedArray(width * height * 4), width, height }, (data: { data: Uint8ClampedArray } | null) => (data ? resolve(data) : reject(new Error("HEIC"))));
  });
  return { pixels: shown.data as Uint8ClampedArray<ArrayBuffer>, width, height };
}
