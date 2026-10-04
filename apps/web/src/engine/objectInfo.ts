import { type Affine, apply } from "./affine";
import { EngineFailure } from "./failure";
import { malloc, type Pdfium } from "./pdfium";
import type { Box, EditFont } from "./types";

const [fixedPitch, symbolicFlag, italicFlag] = [1, 4, 64];
const sans = /sans|arial|helvetica|verdana|calibri|segoe|roboto|tahoma|futura|gill|franklin|avenir|lato|open ?sans|dejavusans/i;
const serif = /times|georgia|garamond|cambria|book|palatino|century|minion|baskerville|caslon|didot|bodoni|charter|serif/i;
const mono = /courier|mono|consolas|menlo|monaco/i;

export function boundsOf(p: Pdfium, object: number, shown: Affine, numbers: number): Box | null {
  if (!p.FPDFPageObj_GetBounds(object, numbers, numbers + 4, numbers + 8, numbers + 12)) return null;
  const read = (offset: number): number => p.pdfium.getValue(numbers + offset, "float");
  const [left, bottom, right, top] = [read(0), read(4), read(8), read(12)];
  const corners = [{ x: left, y: bottom }, { x: right, y: bottom }, { x: left, y: top }, { x: right, y: top }].map((corner) => apply(shown, corner));
  const xs = corners.map((corner) => corner.x), ys = corners.map((corner) => corner.y);
  const box = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  return Object.values(box).every(Number.isFinite) && box.width > 0 && box.height > 0 ? box : null;
}

export function matrixOf(p: Pdfium, object: number, numbers: number): Affine {
  if (!p.FPDFPageObj_GetMatrix(object, numbers)) throw new EngineFailure({ kind: "damaged" });
  const read = (offset: number): number => p.pdfium.getValue(numbers + offset, "float");
  return [read(0), read(4), read(8), read(12), read(16), read(20)];
}

export function fillColor(p: Pdfium, object: number, numbers: number): [number, number, number] {
  if (!p.FPDFPageObj_GetFillColor(object, numbers, numbers + 4, numbers + 8, numbers + 12)) return [0, 0, 0];
  const read = (offset: number): number => p.pdfium.getValue(numbers + offset, "i32") & 255;
  return [read(0), read(4), read(8)];
}

/** PDFium leaves the buffer as it was when the name does not fit. */
export function fontName(p: Pdfium, font: number, buffer: number): string {
  if (font === 0) return "";
  for (const read of [p.FPDFFont_GetBaseFontName, p.FPDFFont_GetFamilyName]) {
    const length = read(font, buffer, 64);
    if (length > 0 && length <= 64) return p.pdfium.UTF8ToString(buffer);
  }
  return "";
}

export const isSymbolic = (p: Pdfium, font: number) => font !== 0 && (p.FPDFFont_GetFlags(font) & symbolicFlag) !== 0;

export function fontStyle(p: Pdfium, font: number, name: string): { family: EditFont; bold: boolean; italic: boolean } {
  const flags = font === 0 ? 0 : p.FPDFFont_GetFlags(font);
  const weight = font === 0 ? 400 : p.FPDFFont_GetWeight(font);
  const family: EditFont = mono.test(name) || (flags & fixedPitch) !== 0 ? "Courier" : sans.test(name) ? "Helvetica" : serif.test(name) ? "Times" : "Helvetica";
  return {
    family,
    bold: /bold|black|heavy|semibold|demi/i.test(name) || weight >= 600,
    italic: /italic|oblique/i.test(name) || (flags & italicFlag) !== 0,
  };
}

export function textOf(p: Pdfium, object: number, text: number): string {
  if (text === 0) return "";
  const length = p.FPDFTextObj_GetText(object, text, 0, 0);
  if (length <= 2) return "";
  const buffer = malloc(p, length);
  try {
    p.FPDFTextObj_GetText(object, text, buffer, length);
    return p.pdfium.UTF16ToString(buffer);
  } finally {
    p.pdfium._free(buffer);
  }
}
