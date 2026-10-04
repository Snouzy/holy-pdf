import { EngineFailure } from "./failure";
import { savePdf } from "./documents";
import { malloc, type Pdfium } from "./pdfium";
import { pageFrame } from "./sign";
import type { HalfCut, PerSheet } from "./types";

const a4 = { short: 595.28, long: 841.89 };
/** Columns, rows, and whether the A4 sheet lies sideways so that each page keeps a portrait cell. */
const layouts: Record<PerSheet, [number, number, boolean]> = { 2: [2, 1, true], 4: [2, 2, false], 6: [3, 2, true], 9: [3, 3, false], 16: [4, 4, false] };

export function sheetsOf(p: Pdfium, handle: number, perSheet: PerSheet): Uint8Array<ArrayBuffer> {
  const [columns, rows, sideways] = layouts[perSheet];
  const sheets = p.FPDF_ImportNPagesToOne(handle, sideways ? a4.long : a4.short, sideways ? a4.short : a4.long, columns, rows);
  if (sheets === 0) throw new EngineFailure({ kind: "damaged" });
  try {
    return savePdf(p, sheets);
  } finally {
    p.FPDF_CloseDocument(sheets);
  }
}

export function halvesOf(p: Pdfium, handle: number, cut: HalfCut): Uint8Array<ArrayBuffer> {
  const count = p.FPDF_GetPageCount(handle);
  const target = p.FPDF_CreateNewDocument();
  if (target === 0) throw new EngineFailure({ kind: "outOfMemory" });
  try {
    const indexes = malloc(p, count * 8);
    p.pdfium.HEAP32.set(Array.from({ length: count * 2 }, (_, index) => Math.floor(index / 2)), indexes >> 2);
    const imported = p.FPDF_ImportPagesByIndex(target, handle, indexes, count * 2, 0);
    p.pdfium._free(indexes);
    if (!imported) throw new EngineFailure({ kind: "damaged" });
    for (let index = 0; index < count * 2; index++) {
      const page = p.FPDF_LoadPage(target, index);
      if (page === 0) throw new EngineFailure({ kind: "damaged" });
      try {
        const [left, bottom, right, top] = half(pageFrame(p, page), cut, index % 2 === 0);
        p.FPDFPage_SetMediaBox(page, left, bottom, right, top);
        p.FPDFPage_SetCropBox(page, left, bottom, right, top);
      } finally {
        p.FPDF_ClosePage(page);
      }
    }
    return savePdf(p, target);
  } finally {
    p.FPDF_CloseDocument(target);
  }
}

type Point = { x: number; y: number };

/** The box, in PDF coordinates, of the first or second half of the page as the reader sees it. */
function half({ topLeft, topRight, bottomLeft }: { topLeft: Point; topRight: Point; bottomLeft: Point }, cut: HalfCut, first: boolean): [number, number, number, number] {
  const bottomRight = { x: topRight.x + bottomLeft.x - topLeft.x, y: topRight.y + bottomLeft.y - topLeft.y };
  const middle = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const corners = cut === "vertical"
    ? first ? [topLeft, middle(topLeft, topRight), bottomLeft, middle(bottomLeft, bottomRight)] : [middle(topLeft, topRight), topRight, middle(bottomLeft, bottomRight), bottomRight]
    : first ? [topLeft, topRight, middle(topLeft, bottomLeft), middle(topRight, bottomRight)] : [middle(topLeft, bottomLeft), middle(topRight, bottomRight), bottomLeft, bottomRight];
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
