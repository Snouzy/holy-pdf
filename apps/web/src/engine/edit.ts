import { isAnnotation, writeAnnotations } from "./editAnnotations";
import { type Assets, closeAssets, imageAsset, placement } from "./editImages";
import { arrowHead, ascent, lineHeight, pdfFont, stampLayout, wrapped, writable } from "./editMetrics";
import { applyEdits } from "./editOriginals";
import { EngineFailure } from "./failure";
import { applyFieldEdits, checkFieldNames, createFields, isField } from "./formFields";
import { type FontChars, fontCharsOf } from "./pageObjects";
import { at, displayed, textObject } from "./pageText";
import type { Pdfium } from "./pdfium";
import { type EditImage, type EditItem, type FieldEdit, type OriginalEdit, plainPicture, type Point, type Rgb } from "./types";

type Axes = ReturnType<typeof displayed>;

/** The handle length of a Bézier curve that draws a quarter of an ellipse. */
const kappa = 0.5523;
const [noFill, windingFill] = [0, 2];
const round = 1;

/** Retouches the pages' own objects, then writes the additions into their content, in their order: the last one is on top. */
export function editPages(p: Pdfium, handle: number, items: EditItem[], images: Record<string, EditImage>, edits: OriginalEdit[] = [], fields: FieldEdit[] = []): void {
  const pages = p.FPDF_GetPageCount(handle);
  const unwritable = (item: EditItem) => (item.kind === "text" && !writable(item.text)) || (item.kind === "stamp" && !writable(item.text + (item.date ?? ""))) || (item.kind === "image" && !images[item.imageId]);
  if ([...items, ...edits, ...fields].some((each) => each.pageIndex < 0 || each.pageIndex >= pages) || items.some(unwritable)) throw new EngineFailure({ kind: "damaged" });
  if (items.some(isField)) checkFieldNames(p, handle, items.filter(isField));
  const fonts: FontChars = edits.some((edit) => edit.text !== undefined) ? fontCharsOf(p, handle) : new Map();
  const assets: Assets = new Map();
  try {
    for (const pageIndex of new Set([...edits, ...items, ...fields].map((each) => each.pageIndex))) {
      const page = p.FPDF_LoadPage(handle, pageIndex);
      if (page === 0) throw new EngineFailure({ kind: "damaged" });
      try {
        applyEdits(p, handle, page, pageIndex, edits, fonts);
        applyFieldEdits(p, handle, page, fields.filter((field) => field.pageIndex === pageIndex));
        const axes = displayed(p, page);
        const own = items.filter((item) => item.pageIndex === pageIndex);
        for (const item of own) {
          if (isAnnotation(item)) continue;
          for (const object of objectsOf(p, handle, axes, item, images, assets)) p.FPDFPage_InsertObject(page, object);
        }
        if (!p.FPDFPage_GenerateContent(page)) throw new EngineFailure({ kind: "damaged" });
        writeAnnotations(p, handle, page, axes, own.filter(isAnnotation));
        createFields(p, handle, page, axes, own.filter(isField));
      } finally {
        p.FPDF_ClosePage(page);
      }
    }
  } finally {
    closeAssets(p, assets);
  }
}

function objectsOf(p: Pdfium, handle: number, axes: Axes, item: EditItem, images: Record<string, EditImage>, assets: Assets): number[] {
  const place = (point: Point) => at(axes, point.x, axes.height - point.y);
  switch (item.kind) {
    case "text":
      return wrapped(item.text, item.font, item.bold, item.size, item.width).flatMap((line, index) => {
        if (line.trim() === "") return [];
        const object = textObject(p, handle, pdfFont[item.font][item.bold ? 1 : 0], item.size, line);
        p.FPDFPageObj_SetFillColor(object, ...item.color, 255);
        const baseline = item.at.y + item.size * (ascent[item.font] + index * lineHeight);
        p.FPDFPageObj_Transform(object, axes.across.x, axes.across.y, axes.up.x, axes.up.y, ...place({ x: item.at.x, y: baseline }));
        return [object];
      });
    case "image": {
      const picture = item.picture ?? plainPicture;
      if (picture.crop) throw new EngineFailure({ kind: "damaged" });
      const asset = assets.get(item.imageId) ?? imageAsset(p, handle, images[item.imageId]!);
      assets.set(item.imageId, asset);
      const object = p.FPDF_NewFormObjectFromXObject(asset.xobject);
      if (object === 0) throw new EngineFailure({ kind: "outOfMemory" });
      p.FPDFPageObj_Transform(object, ...placement(axes, item.box, picture));
      return [object];
    }
    case "rectangle":
    case "highlight": {
      const { x, y, width, height } = item.box;
      const object = path(p, place, [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }], true);
      if (item.kind === "highlight") {
        paint(p, object, null, item.color, 0);
        p.FPDFPageObj_SetBlendMode(object, "Multiply");
      } else paint(p, object, item.stroke, item.fill, item.lineWidth);
      return [object];
    }
    case "ellipse": {
      const [rx, ry] = [item.box.width / 2, item.box.height / 2];
      const [cx, cy] = [item.box.x + rx, item.box.y + ry];
      const object = path(p, place, [{ x: cx + rx, y: cy }], false);
      for (const [dx, dy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]] as const) {
        const start = dx * dy > 0 ? { x: cx + dx * rx, y: cy } : { x: cx, y: cy + dy * ry };
        const end = dx * dy > 0 ? { x: cx, y: cy + dy * ry } : { x: cx + dx * rx, y: cy };
        const c1 = { x: start.x + (dx * dy > 0 ? 0 : dx * kappa * rx), y: start.y + (dx * dy > 0 ? dy * kappa * ry : 0) };
        const c2 = { x: end.x + (dx * dy > 0 ? dx * kappa * rx : 0), y: end.y + (dx * dy > 0 ? 0 : dy * kappa * ry) };
        if (!p.FPDFPath_BezierTo(object, ...place(c1), ...place(c2), ...place(end))) throw new EngineFailure({ kind: "damaged" });
      }
      p.FPDFPath_Close(object);
      paint(p, object, item.stroke, item.fill, item.lineWidth);
      return [object];
    }
    case "line":
      return [stroked(p, path(p, place, [item.from, item.to], false), item.color, item.lineWidth)];
    case "arrow": {
      const { base, wings } = arrowHead(item.from, item.to, item.lineWidth);
      const tip = path(p, place, [item.to, ...wings], true);
      paint(p, tip, null, item.color, 0);
      return [stroked(p, path(p, place, [item.from, base], false), item.color, item.lineWidth), tip];
    }
    case "ink": {
      const [first, ...rest] = item.points;
      if (!first) return [];
      return [stroked(p, path(p, place, [first, ...(rest.length > 0 ? rest : [first])], false), item.color, item.lineWidth)];
    }
    case "stamp": {
      const { box, color } = item;
      const layout = stampLayout(box, item.text, item.date);
      const [r, x, y, w, h] = [layout.radius, box.x, box.y, box.width, box.height];
      const frame = p.FPDFPageObj_CreateNewPath(...place({ x: x + r, y }));
      if (frame === 0) throw new EngineFailure({ kind: "outOfMemory" });
      const line = (point: Point) => { if (!p.FPDFPath_LineTo(frame, ...place(point))) throw new EngineFailure({ kind: "damaged" }); };
      const corner = (c1: Point, c2: Point, end: Point) => { if (!p.FPDFPath_BezierTo(frame, ...place(c1), ...place(c2), ...place(end))) throw new EngineFailure({ kind: "damaged" }); };
      const k = r * kappa;
      line({ x: x + w - r, y });
      corner({ x: x + w - r + k, y }, { x: x + w, y: y + r - k }, { x: x + w, y: y + r });
      line({ x: x + w, y: y + h - r });
      corner({ x: x + w, y: y + h - r + k }, { x: x + w - r + k, y: y + h }, { x: x + w - r, y: y + h });
      line({ x: x + r, y: y + h });
      corner({ x: x + r - k, y: y + h }, { x, y: y + h - r + k }, { x, y: y + h - r });
      line({ x, y: y + r });
      corner({ x, y: y + r - k }, { x: x + r - k, y }, { x: x + r, y });
      p.FPDFPath_Close(frame);
      paint(p, frame, color, null, layout.stroke);
      const word = (text: string, font: string, at: { size: number; x: number; y: number }) => {
        const object = textObject(p, handle, font, at.size, text);
        p.FPDFPageObj_SetFillColor(object, ...color, 255);
        p.FPDFPageObj_Transform(object, axes.across.x, axes.across.y, axes.up.x, axes.up.y, ...place({ x: at.x, y: at.y }));
        return object;
      };
      return [frame, ...(item.text.trim() ? [word(item.text, "Helvetica-Bold", layout.title)] : []), ...(item.date && layout.date ? [word(item.date, "Helvetica", layout.date)] : [])];
    }
    case "note":
    case "markup":
    case "link":
    case "field":
      return [];
  }
}

function path(p: Pdfium, place: (point: Point) => [number, number], [first, ...rest]: Point[], closed: boolean): number {
  const object = p.FPDFPageObj_CreateNewPath(...place(first!));
  if (object === 0) throw new EngineFailure({ kind: "outOfMemory" });
  for (const point of rest) if (!p.FPDFPath_LineTo(object, ...place(point))) throw new EngineFailure({ kind: "damaged" });
  if (closed) p.FPDFPath_Close(object);
  return object;
}

function paint(p: Pdfium, object: number, stroke: Rgb | null, fill: Rgb | null, lineWidth: number): void {
  if (stroke) {
    p.FPDFPageObj_SetStrokeColor(object, ...stroke, 255);
    p.FPDFPageObj_SetStrokeWidth(object, lineWidth);
  }
  if (fill) p.FPDFPageObj_SetFillColor(object, ...fill, 255);
  p.FPDFPath_SetDrawMode(object, fill ? windingFill : noFill, stroke !== null);
}

function stroked(p: Pdfium, object: number, color: Rgb, lineWidth: number): number {
  paint(p, object, color, null, lineWidth);
  p.FPDFPageObj_SetLineCap(object, round);
  p.FPDFPageObj_SetLineJoin(object, round);
  return object;
}
