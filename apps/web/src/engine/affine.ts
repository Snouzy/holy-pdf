import type { Point } from "./types";

/** PDF's row-vector convention, as `FPDFPageObj_Transform` takes it: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Affine = [a: number, b: number, c: number, d: number, e: number, f: number];
export type Axes = { origin: Point; across: Point; up: Point; width: number; height: number };

export const identity: Affine = [1, 0, 0, 1, 0, 0];

/** `first`, then `second`. */
export function compose(first: Affine, second: Affine): Affine {
  const [a, b, c, d, e, f] = first;
  const [a2, b2, c2, d2, e2, f2] = second;
  return [a * a2 + b * c2, a * b2 + b * d2, c * a2 + d * c2, c * b2 + d * d2, e * a2 + f * c2 + e2, e * b2 + f * d2 + f2];
}

export function invert([a, b, c, d, e, f]: Affine): Affine {
  const det = a * d - b * c;
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}

export function apply([a, b, c, d, e, f]: Affine, point: Point): Point {
  return { x: a * point.x + c * point.y + e, y: b * point.x + d * point.y + f };
}

export const translation = (x: number, y: number): Affine => [1, 0, 0, 1, x, y];
/** Clockwise as the reader sees it, in a space whose y runs down. */
export function rotation(degrees: number): Affine {
  const angle = (degrees * Math.PI) / 180;
  return [Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0];
}
export const scaling = (x: number, y: number): Affine => [x, 0, 0, y, 0, 0];

/** From the page as the reader sees it (points from the top-left corner, y down) to the page's own space. */
export function fromDisplayed({ origin, across, up, height }: Axes): Affine {
  return [across.x, across.y, -up.x, -up.y, origin.x + up.x * height, origin.y + up.y * height];
}

export const toDisplayed = (axes: Axes): Affine => invert(fromDisplayed(axes));
