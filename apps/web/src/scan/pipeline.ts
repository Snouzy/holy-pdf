import { type CV, type Mat, using } from "./cv";
import { type Detection, detect } from "./detect";
import { enhance, type RenderMode } from "./enhance";
import { erase, type EraseMark } from "./erase";
import type { Quad } from "./geometry";
import { rectify, turnedClockwise } from "./rectify";

/** What the visitor changed on a page. Undefined means automatic. */
export type PageEdits = { quad?: Quad | undefined; quarterTurns?: number | undefined; mode?: RenderMode | undefined; keepWatermark?: boolean | undefined; erase: EraseMark[] };
export type ScannedPage = { detection: Detection; quad: Quad; quarterTurns: number; mode: RenderMode; keepWatermark: boolean; image: Mat };

/** Enough for a 200 dpi A4 page after perspective correction, and it bounds memory. */
export const maxPhotoSide = 4096;

export function fitted(cv: CV, photo: Mat): Mat {
  const factor = Math.min(1, maxPhotoSide / Math.max(photo.cols, photo.rows));
  const out = new cv.Mat();
  if (factor === 1) photo.copyTo(out);
  else cv.resize(photo, out, new cv.Size(Math.round(photo.cols * factor), Math.round(photo.rows * factor)), 0, 0, cv.INTER_AREA);
  return out;
}

/**
 * Detect → rectify → turn upright → enhance → erase. A known `detection` is kept: a page drawn again after an edit
 * keeps its first one. `null` when the corners enclose no page.
 */
export function scanPage(cv: CV, photo: Mat, edits: PageEdits, known?: Detection): ScannedPage | null {
  const detection = known ?? detect(cv, photo);
  const quad = edits.quad ?? detection.quad;
  const flat = rectify(cv, photo, quad);
  if (!flat) return null;
  const quarterTurns = (((edits.quarterTurns ?? 0) % 4) + 4) % 4;
  const upright = turnedClockwise(cv, flat, quarterTurns);
  const mode = edits.mode ?? "document";
  const { image, keepWatermark } = using([flat, upright], () => enhance(cv, upright, { mode, keepWatermark: edits.keepWatermark }));
  erase(cv, image, edits.erase);
  return { detection, quad, quarterTurns, mode, keepWatermark, image };
}
