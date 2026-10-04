import type { Pixels } from "../engine/imageObjects";

export type CV = typeof import("@techstark/opencv-js");
export type Mat = InstanceType<CV["Mat"]>;

/** RGBA, top row first. */
export type Rgba = Pixels;

export function matOf(cv: CV, image: Rgba): Mat {
  return cv.matFromImageData({ data: image.pixels, width: image.width, height: image.height } as ImageData);
}

/** Deletes each Mat after `use`, even when it throws: OpenCV's memory is not garbage-collected. */
export function using<T>(mats: Mat[], use: () => T): T {
  try {
    return use();
  } finally {
    for (const mat of mats) mat.delete();
  }
}
