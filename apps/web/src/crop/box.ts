import type { Box, Point } from "../engine/types";

/** The narrowest zone, as a share of the page, in each direction. The engine refuses a narrower one. */
export const smallestCrop = 0.02;
export const startBox: Box = { x: 0.05, y: 0.05, width: 0.9, height: 0.9 };
export type CropHandle = "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";
/** `page`: crop the page shown only, not every page. */
export type CropDraft = { docId: string; pageIndex: number; box: Box; page: boolean };

const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, value));

/** Null for a click, or a zone too thin to keep. */
export function drawn(from: Point, to: Point): Box | null {
  const [left, right] = [clamp(Math.min(from.x, to.x)), clamp(Math.max(from.x, to.x))];
  const [top, bottom] = [clamp(Math.min(from.y, to.y)), clamp(Math.max(from.y, to.y))];
  return right - left < smallestCrop || bottom - top < smallestCrop ? null : { x: left, y: top, width: right - left, height: bottom - top };
}

export function shifted(box: Box, dx: number, dy: number): Box {
  return { ...box, x: clamp(box.x + dx, 0, 1 - box.width), y: clamp(box.y + dy, 0, 1 - box.height) };
}

export function stretched(box: Box, handle: CropHandle, point: Point): Box {
  let [left, top, right, bottom] = [box.x, box.y, box.x + box.width, box.y + box.height];
  if (handle.includes("w")) left = clamp(point.x, 0, right - smallestCrop);
  if (handle.includes("e")) right = clamp(point.x, left + smallestCrop, 1);
  if (handle.includes("n")) top = clamp(point.y, 0, bottom - smallestCrop);
  if (handle.includes("s")) bottom = clamp(point.y, top + smallestCrop, 1);
  return { x: left, y: top, width: right - left, height: bottom - top };
}
