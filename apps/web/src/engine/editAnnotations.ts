import { apply, type Axes, fromDisplayed } from "./affine";
import { EngineFailure } from "./failure";
import { copyIn, malloc, type Pdfium } from "./pdfium";
import { pageFrame } from "./sign";
import { type Box, type EditItem, noteSize, type Point, type Rgb } from "./types";

export type Annotated = Extract<EditItem, { kind: "note" | "markup" | "link" }>;
export const isAnnotation = (item: EditItem): item is Annotated => item.kind === "note" || item.kind === "markup" || item.kind === "link";

const subtypes = { note: 1, link: 2, highlight: 9, underline: 10, strikeout: 12 };
const [print, noZoom, noRotate] = [4, 8, 16];
const colorOfAnnotation = 0;

/**
 * Writes the annotations of one page. A note has no appearance stream: readers draw their own icon for it, as they do
 * for Acrobat's. A markup gets its appearance from the reader too, and PDFium draws one when it renders.
 */
export function writeAnnotations(p: Pdfium, handle: number, page: number, axes: Axes, items: Annotated[]): void {
  const back = fromDisplayed(axes);
  const toPage = (point: Point) => apply(back, point);
  const numbers = malloc(p, 32);
  try {
    for (const item of items) {
      const subtype = item.kind === "markup" ? subtypes[item.style] : subtypes[item.kind];
      const annot = p.FPDFPage_CreateAnnot(page, subtype);
      if (annot === 0) throw new EngineFailure({ kind: "damaged" });
      try {
        if (item.kind === "note") {
          setRect(p, annot, { ...item.at, width: noteSize, height: noteSize }, toPage, numbers);
          setString(p, annot, "Contents", item.text);
          if (item.author.trim() !== "") setString(p, annot, "T", item.author);
          setColor(p, annot, item.color);
          // With NoRotate, Acrobat pivots the icon on the Rect's corner in unrotated page space: on a rotated page it lands one icon away.
          const upright = Math.abs(axes.across.x - 1) < 1e-6;
          p.FPDFAnnot_SetFlags(annot, print | noZoom | (upright ? noRotate : 0));
        } else if (item.kind === "markup") {
          if (item.quads.length === 0) throw new EngineFailure({ kind: "damaged" });
          for (const quad of item.quads) appendQuad(p, annot, quad, toPage, numbers);
          setRect(p, annot, union(item.quads), toPage, numbers);
          setColor(p, annot, item.color);
          p.FPDFAnnot_SetFlags(annot, print);
        } else {
          setRect(p, annot, item.box, toPage, numbers);
          p.FPDFAnnot_SetBorder(annot, 0, 0, 0);
          if ("url" in item.target) setUri(p, annot, item.target.url);
          else setGoTo(p, handle, annot, item.target.page);
        }
      } finally {
        p.FPDFPage_CloseAnnot(annot);
      }
    }
  } finally {
    p.pdfium._free(numbers);
  }
}

function corners({ x, y, width, height }: Box, toPage: (point: Point) => Point): Point[] {
  return [{ x, y }, { x: x + width, y }, { x, y: y + height }, { x: x + width, y: y + height }].map(toPage);
}

/** `FS_RECTF` is left, top, right, bottom. */
function setRect(p: Pdfium, annot: number, box: Box, toPage: (point: Point) => Point, numbers: number): void {
  const points = corners(box, toPage);
  const xs = points.map((point) => point.x), ys = points.map((point) => point.y);
  [Math.min(...xs), Math.max(...ys), Math.max(...xs), Math.min(...ys)].forEach((value, index) => p.pdfium.setValue(numbers + index * 4, value, "float"));
  if (!p.FPDFAnnot_SetRect(annot, numbers)) throw new EngineFailure({ kind: "damaged" });
}

/** `FS_QUADPOINTSF` runs upper-left, upper-right, lower-left, lower-right, as the reader sees the page. */
function appendQuad(p: Pdfium, annot: number, quad: Box, toPage: (point: Point) => Point, numbers: number): void {
  corners(quad, toPage).forEach((point, index) => {
    p.pdfium.setValue(numbers + index * 8, point.x, "float");
    p.pdfium.setValue(numbers + index * 8 + 4, point.y, "float");
  });
  if (!p.FPDFAnnot_AppendAttachmentPoints(annot, numbers)) throw new EngineFailure({ kind: "damaged" });
}

function union(boxes: Box[]): Box {
  const xs = boxes.flatMap((box) => [box.x, box.x + box.width]), ys = boxes.flatMap((box) => [box.y, box.y + box.height]);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

function setColor(p: Pdfium, annot: number, [red, green, blue]: Rgb): void {
  if (!p.FPDFAnnot_SetColor(annot, colorOfAnnotation, red, green, blue, 255)) throw new EngineFailure({ kind: "damaged" });
}

function setString(p: Pdfium, annot: number, key: string, value: string): void {
  const pointer = malloc(p, (value.length + 1) * 2);
  try {
    for (let index = 0; index <= value.length; index++) p.pdfium.setValue(pointer + index * 2, index < value.length ? value.charCodeAt(index) : 0, "i16");
    if (!p.FPDFAnnot_SetStringValue(annot, key, pointer)) throw new EngineFailure({ kind: "damaged" });
  } finally {
    p.pdfium._free(pointer);
  }
}

/** A `/URI` is 7-bit ASCII: the host goes to punycode and the path to percent-encoding, as a browser would send them. */
export function asciiUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return ["http:", "https:", "mailto:"].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

function setUri(p: Pdfium, annot: number, url: string): void {
  const ascii = asciiUrl(url);
  if (!ascii) throw new EngineFailure({ kind: "damaged" });
  const pointer = copyIn(p, new TextEncoder().encode(`${ascii}\0`));
  try {
    if (!p.FPDFAnnot_SetURI(annot, pointer)) throw new EngineFailure({ kind: "damaged" });
  } finally {
    p.pdfium._free(pointer);
  }
}

function setGoTo(p: Pdfium, handle: number, annot: number, pageIndex: number): void {
  if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= p.FPDF_GetPageCount(handle)) throw new EngineFailure({ kind: "damaged" });
  const target = p.FPDF_LoadPage(handle, pageIndex);
  if (target === 0) throw new EngineFailure({ kind: "damaged" });
  try {
    const { topLeft } = pageFrame(p, target);
    const destination = p.EPDFDest_CreateXYZ(target, true, topLeft.x, true, topLeft.y, false, 0);
    const action = destination === 0 ? 0 : p.EPDFAction_CreateGoTo(handle, destination);
    if (action === 0 || !p.EPDFAnnot_SetAction(annot, action)) throw new EngineFailure({ kind: "damaged" });
  } finally {
    p.FPDF_ClosePage(target);
  }
}
