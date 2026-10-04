import { type Affine, type Axes, compose, fromDisplayed, rotation, scaling, translation } from "./affine";
import { setJpeg, setRgba } from "./documents";
import { EngineFailure } from "./failure";
import { readBitmap } from "./imageObjects";
import { matrixOf } from "./objectInfo";
import type { Pdfium } from "./pdfium";
import type { Box, EditImage, Picture, Point } from "./types";

export type Asset = { document: number; xobject: number };
export type Assets = Map<string, Asset>;

const [pathType, imageType, formType] = [2, 3, 5];
const mostPixels = 16_000_000;

/**
 * A one-unit scratch page holds the image so that `FPDF_NewXObjectFromPage` makes a form of it: ten placements share one
 * image. The user's pages are never copied. A crop is not a form's BBox: PDFium's bounds of a form ignore it.
 */
export function imageAsset(p: Pdfium, target: number, image: EditImage): Asset {
  const document = p.FPDF_CreateNewDocument();
  if (document === 0) throw new EngineFailure({ kind: "outOfMemory" });
  try {
    const page = p.FPDFPage_New(document, 0, 1, 1);
    if (page === 0) throw new EngineFailure({ kind: "outOfMemory" });
    try {
      const object = p.FPDFPageObj_NewImageObj(document);
      if (object === 0) throw new EngineFailure({ kind: "outOfMemory" });
      let inserted = false;
      try {
        const set = image.kind === "jpeg" ? setJpeg(p, object, image.bytes) : setRgba(p, object, image);
        if (!set || !p.FPDFImageObj_SetMatrix(object, 1, 0, 0, 1, 0, 0)) throw new EngineFailure({ kind: "damaged" });
        p.FPDFPage_InsertObject(page, object);
        inserted = true;
        if (!p.FPDFPage_GenerateContent(page)) throw new EngineFailure({ kind: "damaged" });
      } finally {
        if (!inserted) p.FPDFPageObj_Destroy(object);
      }
    } finally {
      p.FPDF_ClosePage(page);
    }
    const xobject = p.FPDF_NewXObjectFromPage(target, document, 0);
    if (xobject === 0) throw new EngineFailure({ kind: "damaged" });
    return { document, xobject };
  } catch (error) {
    p.FPDF_CloseDocument(document);
    throw error;
  }
}

export function closeAssets(p: Pdfium, assets: Assets): void {
  for (const asset of assets.values()) {
    p.FPDF_CloseXObject(asset.xobject);
    p.FPDF_CloseDocument(asset.document);
  }
  assets.clear();
}

/** Where a shown picture lands in the page's own space: its box filled by the unit square, then turned and mirrored about the box's centre. */
export function placement(axes: Axes, box: Box, picture: Picture): Affine {
  const turned = picture.rotate % 180 !== 0;
  const base = turned ? { x: box.x + box.width / 2 - box.height / 2, y: box.y + box.height / 2 - box.width / 2, width: box.height, height: box.width } : box;
  const unitToBase: Affine = [base.width, 0, 0, -base.height, base.x, base.y + base.height];
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  return compose(compose(unitToBase, turnedAbout(centre, picture)), fromDisplayed(axes));
}

function turnedAbout(centre: Point, picture: Picture): Affine {
  const about = (transform: Affine) => compose(compose(translation(-centre.x, -centre.y), transform), translation(centre.x, centre.y));
  return compose(about(rotation(picture.rotate)), about(scaling(picture.flipX ? -1 : 1, picture.flipY ? -1 : 1)));
}

/** A form made of one image is a picture too: a crop of ours, or an illustrator's frame. */
export function innerImage(p: Pdfium, object: number): number | null {
  if (p.FPDFPageObj_GetType(object) !== formType || p.FPDFFormObj_CountObjects(object) !== 1) return null;
  const inner = p.FPDFFormObj_GetObject(object, 0);
  return inner !== 0 && p.FPDFPageObj_GetType(inner) === imageType ? inner : null;
}

export function isScalable(p: Pdfium, object: number): boolean {
  const type = p.FPDFPageObj_GetType(object);
  return type === imageType || type === pathType || innerImage(p, object) !== null;
}

/** The matrix that lays the picture's pixels, unit square to page: through the form when there is one. */
export function pictureMatrix(p: Pdfium, object: number, numbers: number): Affine {
  const inner = innerImage(p, object);
  return inner ? compose(matrixOf(p, inner, numbers), matrixOf(p, object, numbers)) : matrixOf(p, object, numbers);
}

/**
 * Applies a picture's settings to an image the page already had: a crop cuts its pixels and keeps the object, which then
 * covers the cropped part of where it stood; the turn and the mirrors are a matrix about its centre as shown.
 */
export function repictured(p: Pdfium, handle: number, page: number, object: number, picture: Picture, shown: Affine, numbers: number, centreOf: (object: number) => Point | null): number {
  const current = picture.crop ? cropped(p, handle, page, object, picture.crop, numbers) : object;
  if (picture.rotate !== 0 || picture.flipX || picture.flipY) {
    const centre = centreOf(current);
    if (centre) {
      const matrix = compose(compose(shown, turnedAbout(centre, picture)), invertedShown(shown));
      p.FPDFPageObj_Transform(current, ...matrix);
      p.FPDFPageObj_TransformClipPath(current, ...matrix);
    }
  }
  return current;
}

function invertedShown([a, b, c, d, e, f]: Affine): Affine {
  const det = a * d - b * c;
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}

/**
 * The pixels are read as the page shows them, transparency included, at the image's own size (16 Mpx at most), cut to
 * the crop and written into a fresh image object that takes the old one's rank, covering the crop's share of where it
 * stood. The old object's stream may be drawn elsewhere in the document: writing into it would crop every placement.
 * A JPEG becomes a stream of pixels: PDFium cannot cut a JPEG's bytes.
 */
function cropped(p: Pdfium, handle: number, page: number, object: number, crop: Box, numbers: number): number {
  if (p.FPDFPageObj_GetType(object) !== imageType) return object;
  if (!(crop.width > 0 && crop.height > 0 && crop.x >= 0 && crop.y >= 0 && crop.x + crop.width <= 1.0001 && crop.y + crop.height <= 1.0001)) throw new EngineFailure({ kind: "damaged" });
  if (!p.FPDFImageObj_GetImagePixelSize(object, numbers, numbers + 4)) throw new EngineFailure({ kind: "damaged" });
  const [width, height] = [p.pdfium.getValue(numbers, "i32"), p.pdfium.getValue(numbers + 4, "i32")];
  const scale = Math.min(1, Math.sqrt(mostPixels / (width * height)));
  const matrix = matrixOf(p, object, numbers);
  const whole = rendered(p, handle, page, object, Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)), numbers);
  if (!whole) throw new EngineFailure({ kind: "damaged" });
  const left = Math.round(crop.x * whole.width), top = Math.round(crop.y * whole.height);
  const right = Math.min(whole.width, Math.round((crop.x + crop.width) * whole.width)), bottom = Math.min(whole.height, Math.round((crop.y + crop.height) * whole.height));
  const cut = { width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
  const pixels = new Uint8ClampedArray(cut.width * cut.height * 4);
  for (let row = 0; row < cut.height; row++) {
    const from = ((top + row) * whole.width + left) * 4;
    pixels.set(whole.pixels.subarray(from, from + cut.width * 4), row * cut.width * 4);
  }
  const fresh = p.FPDFPageObj_NewImageObj(handle);
  if (fresh === 0) throw new EngineFailure({ kind: "outOfMemory" });
  let placed = false;
  try {
    if (!setRgba(p, fresh, { kind: "rgba", ...cut, pixels })) throw new EngineFailure({ kind: "damaged" });
    p.FPDFImageObj_SetMatrix(fresh, ...compose([crop.width, 0, 0, crop.height, crop.x, 1 - crop.y - crop.height], matrix));
    if (!p.FPDFPage_InsertObjectAtIndex(page, fresh, rankOf(p, page, object))) throw new EngineFailure({ kind: "damaged" });
    placed = true;
  } finally {
    if (!placed) p.FPDFPageObj_Destroy(fresh);
  }
  if (!p.FPDFPage_RemoveObject(page, object)) throw new EngineFailure({ kind: "damaged" });
  p.FPDFPageObj_Destroy(object);
  return fresh;
}

function rankOf(p: Pdfium, page: number, object: number): number {
  for (let rank = 0; rank < p.FPDFPage_CountObjects(page); rank++) if (p.FPDFPage_GetObject(page, rank) === object) return rank;
  throw new EngineFailure({ kind: "damaged" });
}

/** A crop frame is drawn straight: an image laid at any other angle than a quarter turn would come out skewed. */
export function isUpright([a, b, c, d]: Affine): boolean {
  const slack = 1e-3 * Math.max(Math.abs(a), Math.abs(b), Math.abs(c), Math.abs(d));
  return (Math.abs(b) <= slack && Math.abs(c) <= slack) || (Math.abs(a) <= slack && Math.abs(d) <= slack);
}

/** `FPDFImageObj_GetRenderedBitmap` draws at the image's size on the page: the matrix is set to the wanted size for the time of the render. */
function rendered(p: Pdfium, handle: number, page: number, object: number, width: number, height: number, numbers: number) {
  const matrix = matrixOf(p, object, numbers);
  p.FPDFImageObj_SetMatrix(object, width, 0, 0, height, 0, 0);
  try {
    const bitmap = p.FPDFImageObj_GetRenderedBitmap(handle, page, object);
    if (bitmap === 0) return null;
    try {
      return readBitmap(p, bitmap);
    } finally {
      p.FPDFBitmap_Destroy(bitmap);
    }
  } finally {
    p.FPDFImageObj_SetMatrix(object, ...matrix);
  }
}

