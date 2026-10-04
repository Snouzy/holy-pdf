import { type Affine, compose, fromDisplayed, scaling, toDisplayed, translation } from "./affine";
import { isScalable, repictured } from "./editImages";
import { keepsFont, oneLine, standardFont, writable } from "./editMetrics";
import { EngineFailure } from "./failure";
import { boundsOf, fillColor, fontName, fontStyle, matrixOf, textOf } from "./objectInfo";
import { type FontChars, pageFonts, textGroups } from "./pageObjects";
import { displayed, textObject } from "./pageText";
import { malloc, type Pdfium } from "./pdfium";
import type { Box, OriginalEdit } from "./types";

const textType = 1;

export type Applied = { ranks: Map<number, number>; groups: Map<number, number[]> };

/**
 * Applies the retouches of one loaded page and gives each surviving object under its original rank, with the lines the
 * original page was written as. The caller regenerates the page's content when it saves; a render needs no more than
 * the objects as they are now.
 */
export function applyEdits(p: Pdfium, handle: number, page: number, pageIndex: number, edits: OriginalEdit[], fonts: FontChars): Applied {
  const count = p.FPDFPage_CountObjects(page);
  const ranks = new Map(Array.from({ length: count }, (_, rank) => [rank, p.FPDFPage_GetObject(page, rank)]));
  const own = edits.filter((edit) => edit.pageIndex === pageIndex);
  if (own.some((edit) => !Number.isInteger(edit.index) || edit.index < 0 || edit.index >= count)) throw new EngineFailure({ kind: "damaged" });
  const axes = displayed(p, page);
  const [shown, back] = [toDisplayed(axes), fromDisplayed(axes)];
  const numbers = malloc(p, 64);
  try {
    // A line the file wrote glyph by glyph is one object to the screen: its edit reaches every glyph.
    const groups = textGroups(p, ranks, shown, numbers);
    if (own.length === 0) return { ranks, groups };
    for (const edit of own) {
      let object = ranks.get(edit.index);
      if (object === undefined) continue;
      const others = (groups.get(edit.index) ?? []).filter((rank) => rank !== edit.index);
      const dropOthers = () => {
        for (const rank of others) {
          const member = ranks.get(rank);
          if (member === undefined) continue;
          remove(p, page, member);
          ranks.delete(rank);
        }
      };
      if (edit.deleted || (edit.text !== undefined && edit.text.trim() === "")) {
        remove(p, page, object);
        ranks.delete(edit.index);
        dropOthers();
        continue;
      }
      if (edit.text !== undefined && p.FPDFPageObj_GetType(object) === textType) {
        object = retext(p, handle, page, object, edit.text, fonts, numbers);
        ranks.set(edit.index, object);
        dropOthers();
      }
      if (edit.picture) {
        object = repictured(p, handle, page, object, edit.picture, shown, numbers, (each) => {
          const bounds = boundsOf(p, each, shown, numbers);
          return bounds && { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
        });
        ranks.set(edit.index, object);
      }
      const inView = isScalable(p, object) ? fitted(p, object, edit.box, shown, numbers) : edit.move ? translation(edit.move.x, edit.move.y) : null;
      if (!inView) continue;
      const matrix = compose(compose(shown, inView), back);
      for (const each of [object, ...others.map((rank) => ranks.get(rank)).filter((member): member is number => member !== undefined)]) {
        p.FPDFPageObj_Transform(each, ...matrix);
        // The clip stays where the file put it unless it is moved too: a clipped image would leave its window and vanish.
        p.FPDFPageObj_TransformClipPath(each, ...matrix);
      }
    }
    return { ranks, groups };
  } finally {
    p.pdfium._free(numbers);
  }
}

/** An image or a drawing scales from its bounds to the box the screen holds. */
function fitted(p: Pdfium, object: number, box: Box | undefined, shown: Affine, numbers: number) {
  const before = box && boundsOf(p, object, shown, numbers);
  if (!box || !before) return null;
  const [sx, sy] = [box.width / before.width, box.height / before.height];
  if (!(sx > 0 && sy > 0 && Number.isFinite(sx) && Number.isFinite(sy))) throw new EngineFailure({ kind: "damaged" });
  return compose(compose(translation(-before.x, -before.y), scaling(sx, sy)), translation(box.x, box.y));
}

/**
 * Sets the text in place when the font can write it. Otherwise a fresh object in the closest standard font takes the
 * old one's rank, matrix, colour and render mode: the baseline does not move.
 */
function retext(p: Pdfium, handle: number, page: number, object: number, typed: string, fonts: FontChars, numbers: number): number {
  const value = oneLine(typed);
  const font = p.FPDFTextObj_GetFont(object);
  const name = fontName(p, font, numbers);
  if (keepsFont(pageFonts(fonts)[name], value)) {
    setText(p, object, value);
    // Two subsets of one name, from merged files, do not hold the same glyphs: a letter this one lacks reads back wrong.
    if (readsBack(p, page, object, value)) return object;
  }
  if (!writable(value)) throw new EngineFailure({ kind: "damaged" });
  p.FPDFTextObj_GetFontSize(object, numbers);
  const size = p.pdfium.getValue(numbers, "float");
  const matrix = matrixOf(p, object, numbers);
  const color = fillColor(p, object, numbers);
  const mode = p.FPDFTextObj_GetTextRenderMode(object);
  const { family, bold, italic } = fontStyle(p, font, name);
  const fresh = textObject(p, handle, standardFont(family, bold, italic), size, value);
  let placed = false;
  try {
    p.FPDFPageObj_SetFillColor(fresh, ...color, 255);
    p.FPDFTextObj_SetTextRenderMode(fresh, mode);
    matrix.forEach((value, index) => p.pdfium.setValue(numbers + index * 4, value, "float"));
    p.FPDFPageObj_SetMatrix(fresh, numbers);
    if (!p.FPDFPage_InsertObjectAtIndex(page, fresh, rankOf(p, page, object))) throw new EngineFailure({ kind: "damaged" });
    placed = true;
  } finally {
    if (!placed) p.FPDFPageObj_Destroy(fresh);
  }
  remove(p, page, object);
  return fresh;
}

function readsBack(p: Pdfium, page: number, object: number, value: string): boolean {
  const text = p.FPDFText_LoadPage(page);
  if (text === 0) return true;
  try {
    const bare = (string: string) => string.replace(/\s+/g, "");
    return bare(textOf(p, object, text)) === bare(value);
  } finally {
    p.FPDFText_ClosePage(text);
  }
}

function setText(p: Pdfium, object: number, value: string): void {
  const pointer = malloc(p, (value.length + 1) * 2);
  try {
    for (let index = 0; index <= value.length; index++) p.pdfium.setValue(pointer + index * 2, index < value.length ? value.charCodeAt(index) : 0, "i16");
    if (!p.FPDFText_SetText(object, pointer)) throw new EngineFailure({ kind: "damaged" });
  } finally {
    p.pdfium._free(pointer);
  }
}

function rankOf(p: Pdfium, page: number, object: number): number {
  for (let rank = 0; rank < p.FPDFPage_CountObjects(page); rank++) if (p.FPDFPage_GetObject(page, rank) === object) return rank;
  throw new EngineFailure({ kind: "damaged" });
}

function remove(p: Pdfium, page: number, object: number): void {
  if (!p.FPDFPage_RemoveObject(page, object)) throw new EngineFailure({ kind: "damaged" });
  p.FPDFPageObj_Destroy(object);
}
