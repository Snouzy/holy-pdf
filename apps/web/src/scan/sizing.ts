import type { Size } from "./geometry";

export type PageFormat = "auto" | "a4" | "a5" | "letter";

const isoRatio = Math.SQRT2;
const letterRatio = 11 / 8.5;
const ratioTolerance = 0.06;
const isoLongSide = 2339;
const shortSide = 1654;
const dpi = 200;
/** About 89 cm at 200 dpi. A quad dragged into a sliver would otherwise ask for millions of pixels. */
const maxLongSide = 7016;

const isNear = (ratio: number, target: number) => Math.abs(ratio / target - 1) < ratioTolerance;
const ratioOf = ({ width, height }: Size) => Math.max(width, height) / Math.max(Math.min(width, height), 1);

export const isKnownRatio = (ratio: number) => isNear(ratio, isoRatio) || isNear(ratio, letterRatio);

export function renderSize(measured: Size): Size | null {
  const { width, height } = measured;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  const ratio = ratioOf(measured);
  let short = shortSide;
  let long = isNear(ratio, isoRatio) ? isoLongSide : Math.round(shortSide * ratio);
  if (long > maxLongSide) {
    short = Math.max(1, Math.round(maxLongSide / ratio));
    long = maxLongSide;
  }
  return height >= width ? { width: short, height: long } : { width: long, height: short };
}

/** In points. A photo does not tell the paper's size: the visitor picks A5 for a receipt book. */
export function pdfPageSize(format: PageFormat, pixels: Size): Size {
  const oriented = (short: number, long: number) => (pixels.width > pixels.height ? { width: long, height: short } : { width: short, height: long });
  if (format === "a4") return oriented(595.28, 841.89);
  if (format === "a5") return oriented(419.53, 595.28);
  if (format === "letter") return oriented(612, 792);
  if (Math.abs(ratioOf(pixels) / isoRatio - 1) < 0.01) return oriented(595.28, 841.89);
  return { width: pixels.width / dpi * 72, height: pixels.height / dpi * 72 };
}
