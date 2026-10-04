import type { OpenDoc } from "./documents";
import { docxOf, type WordBlock, type WordPage, type WordRun } from "./docx";
import { EngineFailure } from "./failure";
import { type EncodeJpeg, imageBitmap, imagesOnPage, type Pixels, readBitmap } from "./imageObjects";
import { maxImagePixels } from "./jpeg";
import { displayed } from "./pageText";
import { malloc, type Pdfium } from "./pdfium";

type Axes = ReturnType<typeof displayed>;
/** Points from the top-left corner of the page as the reader sees it. */
type Line = { runs: WordRun[]; left: number; right: number; baseline: number; size: number };
/** Where a block stands on the page, in points from the top-left corner. */
type Placed = { top: number; left: number; right: number; block: WordBlock };
type Style = Omit<WordRun, "text" | "size">;

/** Smaller pictures are rules, bullets and dots. */
const smallest = 16;
const longestSide = 2400;
const italicFlag = 64;

/**
 * A Word document with the text of each page, paragraph by paragraph, and its pictures where they stand. One column is
 * assumed: the text is read in the order PDFium finds it, and tables become lines of text.
 */
export async function wordOf(p: Pdfium, doc: OpenDoc, encode: EncodeJpeg): Promise<Uint8Array<ArrayBuffer>> {
  const pages: WordPage[] = [];
  for (let index = 0; index < doc.sizes.length; index++) {
    const page = p.FPDF_LoadPage(doc.handle, index);
    if (page === 0) throw new EngineFailure({ kind: "damaged" });
    try {
      const axes = displayed(p, page);
      const lines = linesOf(p, page, axes);
      const blocks = paragraphsOf(lines);
      for (const picture of await picturesOf(p, doc.handle, page, axes, lines.length > 0, encode)) {
        const before = blocks.findIndex((block) => block.top >= picture.top && block.left < picture.right && block.right > picture.left);
        blocks.splice(before === -1 ? blocks.length : before, 0, picture);
      }
      pages.push({ width: axes.width, height: axes.height, blocks: blocks.map(({ block }) => block) });
    } finally {
      p.FPDF_ClosePage(page);
    }
  }
  return docxOf(pages);
}

function toDisplayed(axes: Axes, x: number, y: number) {
  const [dx, dy] = [x - axes.origin.x, y - axes.origin.y];
  return { x: dx * axes.across.x + dy * axes.across.y, y: axes.height - (dx * axes.up.x + dy * axes.up.y) };
}

function linesOf(p: Pdfium, page: number, axes: Axes): Line[] {
  const text = p.FPDFText_LoadPage(page);
  if (text === 0) return [];
  const numbers = malloc(p, 64);
  const styles = new Map<number, Style>();
  const lines: Line[] = [];
  let line: Line | undefined;
  const double = (offset: number) => p.pdfium.getValue(numbers + offset, "double");
  try {
    for (let index = 0; index < p.FPDFText_CountChars(text); index++) {
      const code = p.FPDFText_GetUnicode(text, index);
      // PDFium writes a line break between the lines it finds.
      if (code === 13 || code === 10) {
        line = undefined;
        continue;
      }
      if (code < 32 && code !== 9) continue;
      const char = code === 9 ? " " : code > 0xffff ? String.fromCodePoint(code) : String.fromCharCode(code);
      const object = p.FPDFText_GetTextObject(text, index);
      const last = line?.runs.at(-1);
      // A space PDFium adds between two words belongs to no text object: it takes the style of the word before it.
      if (object === 0) {
        if (last) last.text += char;
        continue;
      }
      p.FPDFText_GetMatrix(text, index, numbers);
      const scale = Math.hypot(p.pdfium.getValue(numbers + 8, "float"), p.pdfium.getValue(numbers + 12, "float")) || 1;
      const size = Math.round(p.FPDFText_GetFontSize(text, index) * scale * 2) / 2;
      const style = styles.get(object) ?? styleOf(p, object, numbers);
      styles.set(object, style);
      p.FPDFText_GetCharBox(text, index, numbers, numbers + 8, numbers + 16, numbers + 24);
      const corners = [toDisplayed(axes, double(0), double(16)), toDisplayed(axes, double(8), double(24))];
      p.FPDFText_GetCharOrigin(text, index, numbers, numbers + 8);
      const baseline = toDisplayed(axes, double(0), double(8)).y;
      const [left, right] = [Math.min(...corners.map((corner) => corner.x)), Math.max(...corners.map((corner) => corner.x))];
      if (!line) {
        line = { runs: [], left, right, baseline, size };
        lines.push(line);
      }
      line.left = Math.min(line.left, left);
      line.right = Math.max(line.right, right);
      line.size = Math.max(line.size, size);
      append(line.runs, { text: char, size, ...style });
    }
  } finally {
    p.pdfium._free(numbers);
    p.FPDFText_ClosePage(text);
  }
  return lines;
}

function styleOf(p: Pdfium, object: number, buffer: number): Style {
  const font = p.FPDFTextObj_GetFont(object);
  // PDFium leaves the buffer as it was when the name does not fit.
  const length = font === 0 ? 0 : p.FPDFFont_GetBaseFontName(font, buffer, 64);
  const name = length > 0 && length <= 64 ? p.pdfium.UTF8ToString(buffer) : "";
  return {
    font: family(name),
    bold: /bold|black|heavy|semibold|demi/i.test(name) || (font !== 0 && p.FPDFFont_GetWeight(font) >= 600),
    italic: /italic|oblique/i.test(name) || (font !== 0 && (p.FPDFFont_GetFlags(font) & italicFlag) !== 0),
  };
}

/** « ABCDEF+TimesNewRomanPSMT-Bold » is Times New Roman: Word looks fonts up by family, not by PostScript name. */
function family(name: string): string {
  const base = (name.replace(/^[A-Z]{6}\+/, "").split(/[-,]/)[0] ?? "").replace(/(PSMT|PS|MT)$/, "");
  const known: Record<string, string> = { Helvetica: "Arial", Arial: "Arial", Times: "Times New Roman", TimesNewRoman: "Times New Roman", Courier: "Courier New", CourierNew: "Courier New" };
  return known[base] ?? (base.replace(/([a-z])([A-Z])/g, "$1 $2") || "Arial");
}

function append(runs: WordRun[], run: WordRun): void {
  const last = runs.at(-1);
  if (last && last.font === run.font && last.size === run.size && last.bold === run.bold && last.italic === run.italic) last.text += run.text;
  else runs.push({ ...run });
}

const bullet = /^\s*([•▪◦●○■□–—*-]|\d+[.)])\s/;
const sentenceEnd = /[.!?:;»”"')\]]\s*$/;

/**
 * In the order PDFium reads the page, which follows the columns. A short line ends its paragraph only after a sentence:
 * ragged text has short lines everywhere. Short means short of the lines that start where it starts, not of the page,
 * or every line of a left column would be short.
 */
function paragraphsOf(lines: Line[]): Placed[] {
  const edge = (line: Line) => Math.max(...lines.filter((other) => Math.abs(other.left - line.left) < 3 * line.size).map((other) => other.right));
  const textOf = (line: Line) => line.runs.map((run) => run.text).join("");
  const placed: Placed[] = [];
  let previous: Line | undefined;
  let current: Placed | undefined;
  let runs: WordRun[] = [];
  for (const line of lines) {
    const gap = previous ? line.baseline - previous.baseline : 0;
    const ended = previous && previous.right < edge(previous) - 4 * previous.size && sentenceEnd.test(textOf(previous));
    if (!previous || !current || gap <= 0 || gap > 1.6 * previous.size || Math.abs(line.size - previous.size) > 0.5 || ended || bullet.test(textOf(line))) {
      runs = [];
      current = { top: line.baseline - line.size, left: line.left, right: line.right, block: { kind: "text", runs } };
      placed.push(current);
    } else {
      const last = runs.at(-1);
      if (last && !/[\s-]$/.test(last.text)) last.text += " ";
      current.left = Math.min(current.left, line.left);
      current.right = Math.max(current.right, line.right);
    }
    for (const run of line.runs) append(runs, run);
    previous = line;
  }
  return placed;
}

async function picturesOf(p: Pdfium, handle: number, page: number, axes: Axes, hasText: boolean, encode: EncodeJpeg): Promise<Placed[]> {
  const placed: Placed[] = [];
  const numbers = malloc(p, 24);
  const float = (offset: number) => p.pdfium.getValue(numbers + offset, "float");
  try {
    for (const image of imagesOnPage(p, page)) {
      if (!p.FPDFPageObj_GetBounds(image, numbers, numbers + 4, numbers + 8, numbers + 12)) continue;
      const corners = [toDisplayed(axes, float(0), float(4)), toDisplayed(axes, float(8), float(12))];
      const [left, top] = [Math.min(...corners.map((corner) => corner.x)), Math.min(...corners.map((corner) => corner.y))];
      const [width, height] = [Math.max(...corners.map((corner) => corner.x)) - left, Math.max(...corners.map((corner) => corner.y)) - top];
      if (width < smallest || height < smallest) continue;
      // A scan read by OCR: its text is in the document already, its picture would repeat it.
      if (hasText && width * height > 0.8 * axes.width * axes.height) continue;
      const pixels = pictureOf(p, handle, page, image, numbers);
      if (!pixels) continue;
      const scale = Math.min(1, longestSide / Math.max(pixels.width, pixels.height));
      const jpeg = await encode(pixels, Math.max(1, Math.round(pixels.width * scale)), Math.max(1, Math.round(pixels.height * scale)), 0.85);
      placed.push({ top, left, right: left + width, block: { kind: "picture", jpeg, width, height } });
    }
  } finally {
    p.pdfium._free(numbers);
  }
  return placed;
}

/**
 * The picture as the page draws it, mask included, on white. That rendering has one pixel per point: an upright picture
 * with no mask keeps its own, finer pixels.
 */
function pictureOf(p: Pdfium, handle: number, page: number, image: number, numbers: number): Pixels | null {
  const bitmap = p.FPDFImageObj_GetRenderedBitmap(handle, page, image);
  const rendered = bitmap === 0 ? null : readBitmap(p, bitmap);
  if (bitmap !== 0) p.FPDFBitmap_Destroy(bitmap);
  if (!rendered) return null;
  if (rendered.pixels.some((value, index) => index % 4 === 3 && value < 255)) return onWhite(rendered);
  p.FPDFImageObj_GetImagePixelSize(image, numbers, numbers + 4);
  const [width, height] = [p.pdfium.getValue(numbers, "i32"), p.pdfium.getValue(numbers + 4, "i32")];
  p.FPDFPageObj_GetMatrix(image, numbers);
  const [a, b, c, d] = [0, 4, 8, 12].map((offset) => p.pdfium.getValue(numbers + offset, "float"));
  const upright = Math.abs(b ?? 0) < 1e-3 && Math.abs(c ?? 0) < 1e-3 && (a ?? 0) > 0 && (d ?? 0) > 0;
  if (!upright || width <= rendered.width || width * height > maxImagePixels) return rendered;
  return imageBitmap(p, image) ?? rendered;
}

function onWhite({ pixels, width, height }: Pixels): Pixels {
  const flat = new Uint8ClampedArray(pixels.length);
  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = (pixels[index + 3] ?? 255) / 255;
    for (let channel = 0; channel < 3; channel++) flat[index + channel] = (pixels[index + channel] ?? 0) * alpha + 255 * (1 - alpha);
    flat[index + 3] = 255;
  }
  return { pixels: flat, width, height };
}
