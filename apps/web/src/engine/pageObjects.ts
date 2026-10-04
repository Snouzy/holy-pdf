import { type Affine, apply, toDisplayed } from "./affine";
import { closeDoc, type OpenDoc, reopenPdf } from "./documents";
import { innerImage, isUpright, pictureMatrix } from "./editImages";
import { applyEdits } from "./editOriginals";
import { EngineFailure } from "./failure";
import { applyFieldEdits, fieldsOf } from "./formFields";
import { boundsOf, fillColor, fontName, fontStyle, isSymbolic, matrixOf, textOf } from "./objectInfo";
import { displayed } from "./pageText";
import { malloc, type Pdfium } from "./pdfium";
import type { Box, EditFont, FieldEdit, ObjectKind, OriginalEdit, PageFont, PageObject, PageObjects, PageWord, Point, Rotation } from "./types";

export type FontChars = Map<string, { embedded: boolean; symbolic: boolean; mixed: boolean; chars: Set<string> }>;

/** A shading's extent is its clip, which no gesture can grab: it stays out of the list. */
const kinds: Record<number, ObjectKind> = { 1: "text", 2: "path", 3: "image", 5: "form" };
/** Text render modes 3 and 7 draw nothing: the invisible text of a scan, or a clip. */
const invisible = new Set([3, 7]);

/** The letters the document writes with each font: what an embedded subset is sure to hold. */
export function fontCharsOf(p: Pdfium, handle: number): FontChars {
  const fonts: FontChars = new Map();
  const buffer = malloc(p, 64);
  try {
    for (let index = 0; index < p.FPDF_GetPageCount(handle); index++) {
      const page = p.FPDF_LoadPage(handle, index);
      if (page === 0) continue;
      const text = p.FPDFText_LoadPage(page);
      try {
        for (let rank = 0; rank < p.FPDFPage_CountObjects(page); rank++) {
          const object = p.FPDFPage_GetObject(page, rank);
          if (p.FPDFPageObj_GetType(object) !== 1) continue;
          const font = p.FPDFTextObj_GetFont(object);
          const name = fontName(p, font, buffer);
          const embedded = font !== 0 && p.FPDFFont_GetIsEmbedded(font) === 1;
          const entry = fonts.get(name) ?? { embedded, symbolic: isSymbolic(p, font), mixed: false, chars: new Set<string>() };
          if (entry.embedded !== embedded) entry.mixed = true;
          for (const char of textOf(p, object, text)) entry.chars.add(char);
          fonts.set(name, entry);
        }
      } finally {
        if (text !== 0) p.FPDFText_ClosePage(text);
        p.FPDF_ClosePage(page);
      }
    }
  } finally {
    p.pdfium._free(buffer);
  }
  return fonts;
}

export function pageFonts(fonts: FontChars): Record<string, PageFont> {
  return Object.fromEntries([...fonts].map(([name, font]) => [name, {
    embedded: font.embedded, chars: [...font.chars].join(""), usable: name !== "" && !font.mixed && (font.embedded || !font.symbolic),
  }]));
}

type Glyph = { rank: number; box: Box; baseline: Point; size: number; key: string };

/**
 * Browsers print a line one glyph at a time, each its own object. On such a page (most text objects no wider than a
 * letter), glyphs of one font, size and colour on one baseline, less than three quarters of an em apart, are one line,
 * under the rank of the leftmost. A page set word by word, as LibreOffice justifies it, keeps its objects apart.
 */
export function textGroups(p: Pdfium, ranks: Map<number, number>, shown: Affine, numbers: number): Map<number, number[]> {
  const glyphs: Glyph[] = [];
  let letters = 0;
  for (const [rank, object] of ranks) {
    if (p.FPDFPageObj_GetType(object) !== 1 || invisible.has(p.FPDFTextObj_GetTextRenderMode(object))) continue;
    const box = boundsOf(p, object, shown, numbers);
    if (!box) continue;
    const matrix = matrixOf(p, object, numbers);
    p.FPDFTextObj_GetFontSize(object, numbers);
    const size = Math.round(p.pdfium.getValue(numbers, "float") * Math.hypot(matrix[2], matrix[3]) * 2) / 2;
    const font = fontName(p, p.FPDFTextObj_GetFont(object), numbers);
    if (box.width <= 1.2 * size) letters++;
    glyphs.push({ rank, box, baseline: apply(shown, { x: matrix[4], y: matrix[5] }), size, key: `${font}|${size}|${fillColor(p, object, numbers).join()}` });
  }
  const groups = new Map<number, number[]>();
  if (glyphs.length < 2 || letters < 0.6 * glyphs.length) return groups;
  const byStyle = new Map<string, Glyph[]>();
  for (const glyph of glyphs) {
    const same = byStyle.get(glyph.key);
    if (same) same.push(glyph);
    else byStyle.set(glyph.key, [glyph]);
  }
  for (const same of byStyle.values()) {
    same.sort((a, b) => a.baseline.y - b.baseline.y || a.baseline.x - b.baseline.x);
    let line: Glyph[] = [];
    const close = () => {
      if (line.length === 0) return;
      line.sort((a, b) => a.baseline.x - b.baseline.x);
      let run: Glyph[] = [];
      const end = () => {
        if (run.length > 0) groups.set(run[0]!.rank, run.map((glyph) => glyph.rank));
        run = [];
      };
      for (const glyph of line) {
        const last = run.at(-1);
        if (last && glyph.box.x - (last.box.x + last.box.width) > 0.75 * glyph.size) end();
        run.push(glyph);
      }
      end();
      line = [];
    };
    for (const glyph of same) {
      if (line.length > 0 && Math.abs(glyph.baseline.y - line[0]!.baseline.y) > 0.5) close();
      line.push(glyph);
    }
    close();
  }
  return groups;
}

/** The page's objects and words as the reader sees them; with `edits`, as retouched, each object under its original rank. */
export function pageObjects(p: Pdfium, doc: OpenDoc, index: number, edits: OriginalEdit[] = [], fonts: FontChars = new Map(), fields: FieldEdit[] = []): PageObjects {
  const own = edits.filter((edit) => edit.pageIndex === index);
  const ownFields = fields.filter((field) => field.pageIndex === index);
  const copy = own.length > 0 || ownFields.length > 0 ? reopenPdf(p, doc) : null;
  const page = p.FPDF_LoadPage((copy ?? doc).handle, index);
  if (page === 0) {
    if (copy) closeDoc(p, copy);
    throw new EngineFailure({ kind: "damaged" });
  }
  try {
    // A corrected text may now sit in a standard font, but the next correction applies to the original: its font is the one to tell.
    const names = fontNames(p, page);
    // The lines are the original page's too: regrouping the retouched copy could merge a moved line with its neighbour.
    const { ranks, groups } = applyEdits(p, (copy ?? doc).handle, page, index, own, fonts);
    applyFieldEdits(p, (copy ?? doc).handle, page, ownFields);
    return { ...listed(p, page, ranks, names, groups), fields: fieldsOf(p, (copy ?? doc).handle, page, displayed(p, page)), rotation: (p.FPDFPage_GetRotation(page) * 90) as Rotation };
  } finally {
    p.FPDF_ClosePage(page);
    if (copy) closeDoc(p, copy);
  }
}

type Named = { font: string; family: EditFont; bold: boolean; italic: boolean };

function fontNames(p: Pdfium, page: number): Map<number, Named> {
  const names = new Map<number, Named>();
  const buffer = malloc(p, 64);
  try {
    for (let rank = 0; rank < p.FPDFPage_CountObjects(page); rank++) {
      const object = p.FPDFPage_GetObject(page, rank);
      if (p.FPDFPageObj_GetType(object) !== 1) continue;
      const font = p.FPDFTextObj_GetFont(object);
      const name = fontName(p, font, buffer);
      names.set(rank, { font: name, ...fontStyle(p, font, name) });
    }
  } finally {
    p.pdfium._free(buffer);
  }
  return names;
}

function listed(p: Pdfium, page: number, ranks: Map<number, number>, names: Map<number, Named>, groups: Map<number, number[]>): Omit<PageObjects, "fields" | "rotation"> {
  const text = p.FPDFText_LoadPage(page);
  const numbers = malloc(p, 64);
  try {
    const shown = toDisplayed(displayed(p, page));
    const entries = new Map<number, PageObject>();
    for (const [rank, object] of [...ranks].sort(([a], [b]) => a - b)) {
      const type = p.FPDFPageObj_GetType(object);
      const kind = type === 5 && innerImage(p, object) ? "image" : kinds[type];
      if (!kind || (kind === "text" && invisible.has(p.FPDFTextObj_GetTextRenderMode(object)))) continue;
      const box = boundsOf(p, object, shown, numbers);
      if (!box) continue;
      const entry: PageObject = { index: rank, kind, box };
      if (kind === "text") {
        const matrix = matrixOf(p, object, numbers);
        p.FPDFTextObj_GetFontSize(object, numbers);
        Object.assign(entry, {
          text: textOf(p, object, text), ...names.get(rank),
          size: Math.round(p.pdfium.getValue(numbers, "float") * Math.hypot(matrix[2], matrix[3]) * 2) / 2,
          color: fillColor(p, object, numbers), baseline: apply(shown, { x: matrix[4], y: matrix[5] }),
        });
      } else if (kind === "image") {
        const matrix = pictureMatrix(p, object, numbers);
        const corner = (point: Point) => apply(shown, apply(matrix, point));
        entry.corners = { topLeft: corner({ x: 0, y: 1 }), topRight: corner({ x: 1, y: 1 }), bottomLeft: corner({ x: 0, y: 0 }) };
        if (type === 3 && isUpright(matrix)) entry.croppable = true;
      }
      entries.set(rank, entry);
    }
    const objects: PageObject[] = [];
    const grouped = new Set<number>();
    for (const [leader, members] of groups) {
      const parts = members.map((rank) => entries.get(rank)).filter((entry): entry is PageObject => entry !== undefined);
      if (parts.length < 2) continue;
      for (const part of parts) grouped.add(part.index);
      entries.set(parts[0]!.index, lineOf(parts, (part) => advanceOf(p, ranks.get(part.index)!, part, numbers)));
      if (parts[0]!.index !== leader) entries.delete(leader);
    }
    // PDFium's text page ends a word's object with a space when the next word stands apart: nothing to correct.
    for (const [rank, entry] of [...entries].sort(([a], [b]) => a - b)) {
      if (grouped.has(rank) && !entry.members) continue;
      objects.push(entry.members || entry.text === undefined ? entry : { ...entry, text: entry.text.trimEnd() });
    }
    return { objects, words: text === 0 ? [] : wordsOf(p, text, shown, numbers) };
  } finally {
    p.pdfium._free(numbers);
    if (text !== 0) p.FPDFText_ClosePage(text);
  }
}

/**
 * How far a glyph's text advances the pen, from its font: the gap after it tells a word boundary, where a glyph's box
 * would not. A ligature or a run of letters falls back on the box: the lookup by Unicode answers for one letter only.
 */
function advanceOf(p: Pdfium, object: number, part: PageObject, numbers: number): number {
  const font = p.FPDFTextObj_GetFont(object);
  const text = part.text ?? "";
  const size = part.size ?? 12;
  if ([...text].length !== 1 || font === 0 || !p.FPDFFont_GetGlyphWidth(font, text.codePointAt(0) ?? 32, size, numbers)) return part.box.width;
  const width = p.pdfium.getValue(numbers, "float");
  // A lookup that failed answers with the width of code 0, often a whole em: the box tells better then.
  return width > 0 && width <= part.box.width + 0.5 * size ? width : part.box.width;
}

/** One text out of a line's glyphs, a space set where the pen jumped by a fifth of an em or more between two of them. */
function lineOf(parts: PageObject[], advance: (part: PageObject) => number): PageObject {
  const [first, ...rest] = parts as [PageObject, ...PageObject[]];
  let text = first.text ?? "";
  let box = first.box;
  let previous = first;
  for (const part of rest) {
    const gap = (part.baseline?.x ?? 0) - ((previous.baseline?.x ?? 0) + advance(previous));
    if (gap > 0.2 * (first.size ?? 12) && !text.endsWith(" ") && !(part.text ?? "").startsWith(" ")) text += " ";
    text += part.text ?? "";
    previous = part;
    const right = Math.max(box.x + box.width, part.box.x + part.box.width), bottom = Math.max(box.y + box.height, part.box.y + part.box.height);
    const left = Math.min(box.x, part.box.x), top = Math.min(box.y, part.box.y);
    box = { x: left, y: top, width: right - left, height: bottom - top };
  }
  return { ...first, text: text.trimEnd(), box, members: parts.map((part) => part.index) };
}

/** PDFium writes "\r\n" between the lines it finds. */
function wordsOf(p: Pdfium, text: number, shown: Affine, numbers: number): PageWord[] {
  const words: PageWord[] = [];
  let word: PageWord | null = null;
  let line = 0;
  const double = (offset: number) => p.pdfium.getValue(numbers + offset, "double");
  for (let index = 0; index < p.FPDFText_CountChars(text); index++) {
    const code = p.FPDFText_GetUnicode(text, index);
    if (code === 13 || code === 10) {
      if (word) line++;
      word = null;
      continue;
    }
    if (code <= 32 || code === 0xa0) {
      word = null;
      continue;
    }
    if (!p.FPDFText_GetCharBox(text, index, numbers, numbers + 8, numbers + 16, numbers + 24)) continue;
    const corners = [{ x: double(0), y: double(16) }, { x: double(8), y: double(24) }, { x: double(0), y: double(24) }, { x: double(8), y: double(16) }].map((corner) => apply(shown, corner));
    const xs = corners.map((corner) => corner.x), ys = corners.map((corner) => corner.y);
    const box = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
    if (!(box.width > 0 && box.height > 0)) continue;
    const char = code > 0xffff ? String.fromCodePoint(code) : String.fromCharCode(code);
    if (!word) {
      word = { text: char, box, line };
      words.push(word);
    } else {
      word.text += char;
      const right = Math.max(word.box.x + word.box.width, box.x + box.width), bottom = Math.max(word.box.y + word.box.height, box.y + box.height);
      const left = Math.min(word.box.x, box.x), top = Math.min(word.box.y, box.y);
      word.box = { x: left, y: top, width: right - left, height: bottom - top };
    }
  }
  return words;
}
