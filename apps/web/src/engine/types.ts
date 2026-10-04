export type FileKind = "pdf" | "jpeg" | "png";

/** In PDF points, after the page's own rotation. */
export type PageSize = { width: number; height: number };

export type Rotation = 0 | 90 | 180 | 270;

export type PlanPage = { docId: string; index: number; rotation: Rotation };

export type ExportPlan = PlanPage[];

export type EngineError =
  | { kind: "unsupportedFormat" }
  | { kind: "passwordRequired" }
  | { kind: "wrongPassword" }
  | { kind: "damaged" }
  | { kind: "outOfMemory" }
  | { kind: "engineUnavailable" }
  | { kind: "noImages" }
  | { kind: "alreadySigned" }
  | { kind: "fieldNameTaken" }
  | { kind: "xfaForm" }
  | { kind: "textAlready" }
  | { kind: "noTextRead" }
  | { kind: "invalidSignature" };

export type Result<T> = { ok: true; value: T } | { ok: false; error: EngineError };

export type CompressLevel = "extreme" | "recommended" | "low";

export type NamedBytes = { name: string; bytes: Uint8Array<ArrayBuffer> };

export type ImageMode = "pages" | "extract";
export type ImageQuality = "normal" | "high";

export type SignatureImage = { width: number; height: number; pixels: Uint8ClampedArray<ArrayBuffer> };

/** Fractions of the original displayed page, before editing its rotation; angle is clockwise around the rectangle center. */
export type SignaturePlacement = { id: string; imageId?: string; pageIndex: number; x: number; y: number; width: number; height: number; rotation?: number };

export type NumberFormat = "number" | "of" | "page";
export type NumberPosition = "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";
/** `from` and `to` count from 1 and include both ends. */
export type PageNumbers = { kind: "numbers"; format: NumberFormat; position: NumberPosition; first: number; size: number; from: number; to: number };
/** `color` in 0–255 RGB, `opacity` 0–1, `angle` in degrees counterclockwise as the page is read, `width` a share of the page's width. */
export type Watermark = { kind: "watermark"; text: string; color: [number, number, number]; opacity: number; angle: number; width: number; from: number; to: number };
export type PerSheet = 2 | 4 | 6 | 9 | 16;
/** `vertical`: a left and a right half, as the page is read; `horizontal`: a top and a bottom half. */
export type HalfCut = "vertical" | "horizontal";
export type TransformOp = { kind: "protect"; password: string } | { kind: "unlock" } | { kind: "flatten" } | { kind: "nup"; perSheet: PerSheet } | { kind: "halves"; cut: HalfCut } | { kind: "pixelize"; ppi: number } | { kind: "redact"; zones: RedactZone[] } | { kind: "ocr"; pages: OcrPage[] } | { kind: "word" } | { kind: "overlay"; layerId: string; under: boolean } | { kind: "bookmarks"; bookmarks: Bookmark[] } | { kind: "repair" } | { kind: "edit"; items: EditItem[]; images: Record<string, EditImage>; edits: OriginalEdit[]; fields?: FieldEdit[] } | { kind: "crop"; box: Box; page: number | null } | PageNumbers | Watermark;
/** A line read in a page's picture, in fractions of the page as the reader sees it, from its top-left corner. */
export type OcrLine = { text: string; x: number; y: number; width: number; height: number };
export type OcrPage = { pageIndex: number; lines: OcrLine[] };
/** A rectangle to cover in black, in fractions of the page as the reader sees it, from its top-left corner. */
export type RedactZone = { pageIndex: number; x: number; y: number; width: number; height: number };
/** A PDF destination's fit and parameters as the file holds them: `null` for a parameter left unspecified. */
export type BookmarkView = { fit: "XYZ" | "Fit" | "FitH" | "FitV" | "FitR" | "FitB" | "FitBH" | "FitBV"; params: (number | null)[] };
/** `level`: 0 at the top, at most one deeper than the bookmark before. Without `view`, the top-left of the page as the reader sees it. */
export type Bookmark = { title: string; pageIndex: number; level: number; view?: BookmarkView };
/** `skipped`: bookmarks that lead to no page of the document or have no title. */
export type Outline = { bookmarks: Bookmark[]; skipped: number };
/** Page points from the top-left corner of the page as the reader sees it, y down. */
export type Point = { x: number; y: number };
export type Box = { x: number; y: number; width: number; height: number };
export type Rgb = [number, number, number];
export type EditFont = "Helvetica" | "Times" | "Courier";
/** `at`: the top-left corner of the first line. `width`: a text box, whose lines wrap at it; without it, the lines as typed. */
export type EditText = { kind: "text"; at: Point; text: string; font: EditFont; bold: boolean; size: number; color: Rgb; width?: number };
export type EditShape = { kind: "rectangle" | "ellipse"; box: Box; stroke: Rgb | null; fill: Rgb | null; lineWidth: number };
export type EditLine = { kind: "line" | "arrow"; from: Point; to: Point; color: Rgb; lineWidth: number };
/** A sticky note: `at` is the top-left corner of its icon, `noteSize` points a side. */
export type EditNote = { kind: "note"; at: Point; text: string; author: string; color: Rgb };
/** Text markup over words, one quad per line; written as an annotation. */
export type EditMarkup = { kind: "markup"; style: "highlight" | "underline" | "strikeout"; quads: Box[]; color: Rgb };
export type EditLink = { kind: "link"; box: Box; target: { url: string } | { page: number } };
/** A rubber stamp drawn into the page: a framed word in capitals, a date under it when asked. */
export type EditStamp = { kind: "stamp"; box: Box; text: string; date: string | null; color: Rgb };
export type FieldKind = "text" | "checkbox" | "combo";
/** A form field to add: `name` is the field's `/T`, unique on the document; a list's `options` serve as labels and export values alike. */
export type EditField = { kind: "field"; box: Box; field: FieldKind; name: string; multiline: boolean; options: string[] };
export type EditItem = { id: string; pageIndex: number } & (
  | EditText
  | EditShape
  | EditLine
  | EditNote
  | EditMarkup
  | EditLink
  | EditStamp
  | EditField
  | { kind: "image"; box: Box; imageId: string; picture?: Picture }
  | { kind: "ink"; points: Point[]; color: Rgb; lineWidth: number }
  | { kind: "highlight"; box: Box; color: Rgb }
);
export const noteSize = 20;
/**
 * How an image is shown: `crop` in fractions of its pixels from the top-left corner (null for all of them), then a
 * clockwise rotation, then mirrors as the reader sees the result.
 */
export type Picture = { crop: Box | null; rotate: 0 | 90 | 180 | 270; flipX: boolean; flipY: boolean };
export const plainPicture: Picture = { crop: null, rotate: 0, flipX: false, flipY: false };
export type EditImage = { kind: "jpeg"; bytes: Uint8Array<ArrayBuffer>; width: number; height: number } | { kind: "rgba"; width: number; height: number; pixels: Uint8ClampedArray<ArrayBuffer> };

/**
 * A retouch of one object the page already had, by its rank in the page as the file opened: one record per object.
 * `box`: where an image or a drawing now stands, in page points as the reader sees it; it scales to fit. `move`: how far
 * a text or a group was carried, in the same points; a corrected text's glyphs change height, so a box would not say
 * where its baseline goes. `text`: the corrected text of a text object.
 */
export type OriginalEdit = { pageIndex: number; index: number; deleted?: boolean; box?: Box; move?: Point; text?: string; picture?: Picture };
export type ObjectKind = "text" | "image" | "path" | "form" | "shading";
/** An object of the page as the file opened. `font` names the PDF font; `family` is the closest standard family. */
export type PageObject = {
  index: number; kind: ObjectKind; box: Box;
  text?: string; font?: string; family?: EditFont; bold?: boolean; italic?: boolean; size?: number; color?: Rgb;
  /** Where the first glyph's origin lies: the line the text sits on. */
  baseline?: Point;
  /** The ranks of the glyphs a line was written as, when the file set them one by one; `index` is the leftmost. */
  members?: number[];
  /** The displayed positions of an image's pixel corners. `croppable`: an image object of its own, whose pixels a crop can take. */
  corners?: { topLeft: Point; topRight: Point; bottomLeft: Point };
  croppable?: boolean;
};
export type PageWord = { text: string; box: Box; line: number };
/**
 * `chars`: every letter the document writes with this font, which its subset is sure to hold. `usable`: false for a font
 * a correction must not keep: unnamed, symbolic, or one name shared by fonts that are not all embedded.
 */
export type PageFont = { embedded: boolean; chars: string; usable: boolean };
/** `rotation`: the page's own turn; a form field cannot be added to a turned page. */
export type PageObjects = { objects: PageObject[]; words: PageWord[]; fields: FormField[]; rotation: Rotation };
/**
 * A value given to a form field: the widget annotation at `index` of the page. A checkbox takes "Off" or its export
 * value; a list takes the `option` chosen, whose export value may differ from its label.
 */
export type FieldEdit = { pageIndex: number; index: number; value: string; option?: number };
/**
 * A form field of a page as the reader sees it. `size` 0: the field sizes its text itself. `other`: a button or a
 * signature, left alone. `selected`: the chosen option of a list; `value` is then its label, not its export value.
 */
export type FormField = {
  index: number; kind: "text" | "checkbox" | "radio" | "combo" | "list" | "other"; name: string; value: string; box: Box;
  options: string[]; selected: number | null; checked: boolean; exportValue: string; readOnly: boolean; multiline: boolean; maxLength: number | null; size: number; color: Rgb;
};
