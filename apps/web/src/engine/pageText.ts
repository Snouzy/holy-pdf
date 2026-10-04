import { outsideWinAnsi, pdfText } from "./editMetrics";
import { EngineFailure } from "./failure";
import { malloc, type Pdfium } from "./pdfium";
import { pageFrame } from "./sign";
import type { OcrPage, PageNumbers, Watermark } from "./types";

/** Points between a page number and the edges of the page as the reader sees it. */
const margin = 24;

type Matrix = [number, number, number, number, number, number];
type Axes = { origin: { x: number; y: number }; across: { x: number; y: number }; up: { x: number; y: number }; width: number; height: number };

export function numberPages(p: Pdfium, handle: number, op: PageNumbers): void {
  const last = Math.min(op.to, p.FPDF_GetPageCount(handle));
  const total = op.first + last - op.from;
  eachPage(p, handle, op.from, last, (page, index) => {
    const value = op.first + index - (op.from - 1);
    const object = textObject(p, handle, "Helvetica", op.size, op.format === "of" ? `${value} / ${total}` : op.format === "page" ? `Page ${value}` : String(value));
    const { left, right } = bounds(p, object);
    const axes = displayed(p, page);
    const [vertical, horizontal] = op.position.split("-");
    const x = horizontal === "left" ? margin : horizontal === "right" ? axes.width - margin - (right - left) : (axes.width - right + left) / 2;
    const y = vertical === "top" ? axes.height - margin - op.size : margin;
    return { object, matrix: [axes.across.x, axes.across.y, axes.up.x, axes.up.y, ...at(axes, x, y)] };
  });
}

export function watermarkPages(p: Pdfium, handle: number, op: Watermark): void {
  const [red, green, blue] = op.color;
  eachPage(p, handle, op.from, Math.min(op.to, p.FPDF_GetPageCount(handle)), (page) => {
    const object = textObject(p, handle, "Helvetica-Bold", 100, op.text);
    if (!p.FPDFPageObj_SetFillColor(object, red, green, blue, Math.round(op.opacity * 255))) throw new EngineFailure({ kind: "damaged" });
    const { left, bottom, right, top } = bounds(p, object);
    const axes = displayed(p, page);
    const scale = op.width * axes.width / (right - left);
    const angle = op.angle * Math.PI / 180;
    const along = { x: Math.cos(angle) * axes.across.x + Math.sin(angle) * axes.up.x, y: Math.cos(angle) * axes.across.y + Math.sin(angle) * axes.up.y };
    const rise = { x: -Math.sin(angle) * axes.across.x + Math.cos(angle) * axes.up.x, y: -Math.sin(angle) * axes.across.y + Math.cos(angle) * axes.up.y };
    const [cx, cy] = at(axes, axes.width / 2, axes.height / 2);
    const middle = { x: (left + right) / 2, y: (bottom + top) / 2 };
    return {
      object,
      matrix: [
        scale * along.x, scale * along.y, scale * rise.x, scale * rise.y,
        cx - scale * (middle.x * along.x + middle.y * rise.x), cy - scale * (middle.x * along.y + middle.y * rise.y),
      ],
    };
  });
}

const invisible = 3;

/** Invisible text over each line the reader sees: search finds it and selection copies it, the page looks the same. */
export function writeTextLayer(p: Pdfium, handle: number, pages: OcrPage[]): void {
  for (const { pageIndex, lines } of pages) {
    const page = p.FPDF_LoadPage(handle, pageIndex);
    if (page === 0) throw new EngineFailure({ kind: "damaged" });
    try {
      const axes = displayed(p, page);
      for (const line of lines) {
        const text = encodable(line.text).trim();
        if (!text) continue;
        const object = textObject(p, handle, "Helvetica", 10, text);
        if (!p.FPDFTextObj_SetTextRenderMode(object, invisible)) throw new EngineFailure({ kind: "damaged" });
        const { left, bottom, right, top } = bounds(p, object);
        const [across, up] = [line.width * axes.width / (right - left), line.height * axes.height / (top - bottom)];
        const origin = at(axes, line.x * axes.width - left * across, (1 - line.y - line.height) * axes.height - bottom * up);
        p.FPDFPageObj_Transform(object, axes.across.x * across, axes.across.y * across, axes.up.x * up, axes.up.y * up, ...origin);
        p.FPDFPage_InsertObject(page, object);
      }
      if (!p.FPDFPage_GenerateContent(page)) throw new EngineFailure({ kind: "damaged" });
    } finally {
      p.FPDF_ClosePage(page);
    }
  }
}

/** A letter the font cannot write keeps its base letter: « ș » becomes « s », so a search without accents still finds it. */
function encodable(text: string): string {
  const outside = new RegExp(outsideWinAnsi, "gu");
  return [...text.normalize("NFC")].map((char) => (outsideWinAnsi.test(char) ? char.normalize("NFD").replace(/\p{M}/gu, "").replace(outside, "") : char)).join("");
}

export function textCounts(p: Pdfium, handle: number): number[] {
  return Array.from({ length: p.FPDF_GetPageCount(handle) }, (_, index) => {
    const page = p.FPDF_LoadPage(handle, index);
    if (page === 0) throw new EngineFailure({ kind: "damaged" });
    const text = p.FPDFText_LoadPage(page);
    try {
      return text === 0 ? 0 : p.FPDFText_CountChars(text);
    } finally {
      if (text !== 0) p.FPDFText_ClosePage(text);
      p.FPDF_ClosePage(page);
    }
  });
}

function eachPage(p: Pdfium, handle: number, from: number, last: number, place: (page: number, index: number) => { object: number; matrix: Matrix }): void {
  for (let index = from - 1; index < last; index++) {
    const page = p.FPDF_LoadPage(handle, index);
    if (page === 0) throw new EngineFailure({ kind: "damaged" });
    try {
      const { object, matrix } = place(page, index);
      p.FPDFPageObj_Transform(object, ...matrix);
      p.FPDFPage_InsertObject(page, object);
      if (!p.FPDFPage_GenerateContent(page)) throw new EngineFailure({ kind: "damaged" });
    } finally {
      p.FPDF_ClosePage(page);
    }
  }
}

/** The page's bottom-left corner and axes, in PDF coordinates, as the reader sees the page: text set on them reads upright. */
export function displayed(p: Pdfium, page: number): Axes {
  const { topLeft, topRight, bottomLeft } = pageFrame(p, page);
  const width = Math.hypot(topRight.x - topLeft.x, topRight.y - topLeft.y);
  const height = Math.hypot(bottomLeft.x - topLeft.x, bottomLeft.y - topLeft.y);
  return {
    origin: bottomLeft,
    across: { x: (topRight.x - topLeft.x) / width, y: (topRight.y - topLeft.y) / width },
    up: { x: (topLeft.x - bottomLeft.x) / height, y: (topLeft.y - bottomLeft.y) / height },
    width,
    height,
  };
}

export function at(axes: Axes, x: number, y: number): [number, number] {
  return [axes.origin.x + axes.across.x * x + axes.up.x * y, axes.origin.y + axes.across.y * x + axes.up.y * y];
}

export function textObject(p: Pdfium, handle: number, font: string, size: number, value: string): number {
  const object = p.FPDFPageObj_NewTextObj(handle, font, size);
  if (object === 0) throw new EngineFailure({ kind: "damaged" });
  const text = pdfText(value);
  const pointer = malloc(p, (text.length + 1) * 2);
  try {
    for (let index = 0; index <= text.length; index++) p.pdfium.setValue(pointer + index * 2, index < text.length ? text.charCodeAt(index) : 0, "i16");
    if (!p.FPDFText_SetText(object, pointer)) throw new EngineFailure({ kind: "damaged" });
  } finally {
    p.pdfium._free(pointer);
  }
  return object;
}

function bounds(p: Pdfium, object: number) {
  const box = malloc(p, 16);
  try {
    if (!p.FPDFPageObj_GetBounds(object, box, box + 4, box + 8, box + 12)) throw new EngineFailure({ kind: "damaged" });
    const read = (offset: number) => p.pdfium.getValue(box + offset, "float");
    return { left: read(0), bottom: read(4), right: read(8), top: read(12) };
  } finally {
    p.pdfium._free(box);
  }
}
