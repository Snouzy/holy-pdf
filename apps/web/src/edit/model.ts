import { lineHeight, stampWords, wrapped, writable } from "../engine/editMetrics";
import { nameTaken } from "../engine/formFields";
import { type Box, type EditField, type EditFont, type EditImage, type EditItem, type EditMarkup, type EditText, type FieldEdit, type FieldKind, noteSize, type OriginalEdit, type PageWord, type Picture, plainPicture, type Point, type Rgb } from "../engine/types";

export type Tool = "select" | "text" | "rectangle" | "ellipse" | "line" | "arrow" | "ink" | "highlight" | "note" | "markHighlight" | "underline" | "strikeout" | "link" | "stamp" | "field";
export const markupTools: Record<"markHighlight" | "underline" | "strikeout", EditMarkup["style"]> = { markHighlight: "highlight", underline: "underline", strikeout: "strikeout" };
/** One key per tool, as drawing apps have them; `i` opens the image picker. */
export const toolKeys: Record<Tool | "image", string> = { select: "v", text: "t", rectangle: "r", ellipse: "o", line: "l", arrow: "a", ink: "p", highlight: "h", note: "n", markHighlight: "m", underline: "u", strikeout: "s", link: "k", stamp: "b", field: "f", image: "i" };
export const toolForKey = (key: string): Tool | "image" | null => (Object.entries(toolKeys).find(([, letter]) => letter === key.toLowerCase())?.[0] as Tool | "image" | undefined) ?? null;

/** The tool taken up, with a colour that shows: a highlighter in black would hide the text, a white line nothing. */
export function picked(draft: EditDraft, tool: Tool): EditDraft {
  const current = draft.style.color.join();
  const color: Rgb | null = (tool === "highlight" || tool === "markHighlight" || tool === "note") && ["0,0,0", "255,255,255"].includes(current) ? [250, 204, 21]
    : (tool === "underline" || tool === "strikeout") && ["255,255,255", "250,204,21"].includes(current) ? [220, 38, 38]
    : tool === "stamp" && ["0,0,0", "255,255,255", "250,204,21"].includes(current) ? [220, 38, 38] : null;
  return { ...draft, tool, selectedId: null, cropping: null, style: color ? { ...draft.style, color } : draft.style };
}
/** `stamp`: the word the stamp tool puts next; `field`: the kind of field the Field tool draws next. */
export type Style = { color: Rgb; fill: boolean; lineWidth: number; font: EditFont; bold: boolean; size: number; stamp: string; field: FieldKind };
export type Handle = "nw" | "ne" | "sw" | "se" | "from" | "to" | "e" | "w";
export const narrowest = 20;
/** The width of a text's widest line, in points. */
export type Measure = (item: EditText) => number;
/** What undo takes back in one step: the additions and the retouches of the document's own objects. */
export type Snapshot = { items: EditItem[]; edits: OriginalEdit[]; fields: FieldEdit[] };
/**
 * `previews`: an address the page can show for each image. `selectedId`: an addition's id, or an original's key.
 * `taken`: the names the document's own form fields carry, read when the Field tool comes out.
 */
export type EditDraft = {
  docId: string; pageIndex: number; items: EditItem[]; edits: OriginalEdit[]; fields: FieldEdit[]; taken: string[]; images: Record<string, EditImage>; previews: Record<string, string>;
  selectedId: string | null; tool: Tool; style: Style; past: Snapshot[]; future: Snapshot[];
  /** The frame being drawn on the selected picture, in page points, until it is applied. */
  cropping: Box | null;
};

const smallest = 4;
/** The thinnest form field: a real form's lines run 14 to 18 points, its boxes 10 to 14. */
const fieldFloor = 8;
const history = 100;

export const emptyEdit = (docId: string, lang: keyof typeof stampWords = "fr"): EditDraft => ({
  docId, pageIndex: 0, items: [], edits: [], fields: [], taken: [], images: {}, previews: {}, selectedId: null, tool: "select", cropping: null,
  style: { color: [0, 0, 0], fill: false, lineWidth: 3, font: "Helvetica", bold: false, size: 16, stamp: stampWords[lang][0]!, field: "text" }, past: [], future: [],
});

export const canSave = (draft: EditDraft) => (draft.items.length > 0 || draft.edits.length > 0 || draft.fields.length > 0) && fieldsValid(draft.items, draft.taken) && draft.items.every((item) => ((item.kind !== "text" && item.kind !== "stamp") || writable(item.text)) && (item.kind !== "link" || validLink(item)));

export const validLink = (item: Extract<EditItem, { kind: "link" }>) => ("url" in item.target ? /^(https?:\/\/|mailto:)\S+$/i.test(item.target.url) : Number.isInteger(item.target.page) && item.target.page >= 0);

/** The words the rectangle touches, one box per line: what a markup covers. Empty when it touches no word. */
export function quadsOf(words: PageWord[], rect: Box): Box[] {
  const lines = new Map<number, Box>();
  for (const word of words) {
    const { box } = word;
    if (box.x + box.width < rect.x || box.x > rect.x + rect.width || box.y + box.height < rect.y || box.y > rect.y + rect.height) continue;
    const line = lines.get(word.line);
    lines.set(word.line, line ? spanned({ x: Math.min(line.x, box.x), y: Math.min(line.y, box.y) }, { x: Math.max(line.x + line.width, box.x + box.width), y: Math.max(line.y + line.height, box.y + box.height) }) : box);
  }
  return [...lines.values()];
}

export const originalKey = (pageIndex: number, index: number) => `o:${pageIndex}:${index}`;

export function parseOriginalKey(key: string | null): { pageIndex: number; index: number } | null {
  const match = key && /^o:(\d+):(\d+)$/.exec(key);
  return match ? { pageIndex: Number(match[1]), index: Number(match[2]) } : null;
}

/** A change that undo can take back, to `before`: the items before a change made in several steps, such as typing. */
export function edited(draft: EditDraft, items: EditItem[], before = draft.items): EditDraft {
  return { ...draft, items, past: [...draft.past, { items: before, edits: draft.edits, fields: draft.fields }].slice(-history), future: [] };
}

/** A retouch of one of the document's own objects, merged into the one it already has. */
export function revised(draft: EditDraft, edit: OriginalEdit, before = draft.edits, items = draft.items): EditDraft {
  const same = (each: OriginalEdit) => each.pageIndex === edit.pageIndex && each.index === edit.index;
  const current = draft.edits.find(same);
  const edits = current ? draft.edits.map((each) => (each === current ? { ...current, ...edit } : each)) : [...draft.edits, edit];
  return { ...draft, edits, past: [...draft.past, { items, edits: before, fields: draft.fields }].slice(-history), future: [] };
}

export const fieldKey = (pageIndex: number, index: number) => `f:${pageIndex}:${index}`;

export function parseFieldKey(key: string | null): { pageIndex: number; index: number } | null {
  const match = key && /^f:(\d+):(\d+)$/.exec(key);
  return match ? { pageIndex: Number(match[1]), index: Number(match[2]) } : null;
}

/** One value per widget, the latest kept and applied last: two widgets of one field take the latest click. One undo step each. */
export function filled(draft: EditDraft, field: FieldEdit): EditDraft {
  const same = (each: FieldEdit) => each.pageIndex === field.pageIndex && each.index === field.index;
  const fields = [...draft.fields.filter((each) => !same(each)), field];
  return { ...draft, fields, past: [...draft.past, { items: draft.items, edits: draft.edits, fields: draft.fields }].slice(-history), future: [] };
}

export function undone(draft: EditDraft): EditDraft {
  const previous = draft.past.at(-1);
  if (!previous) return draft;
  return { ...draft, ...previous, past: draft.past.slice(0, -1), future: [...draft.future, { items: draft.items, edits: draft.edits, fields: draft.fields }], selectedId: null, cropping: null };
}

export function redone(draft: EditDraft): EditDraft {
  const next = draft.future.at(-1);
  if (!next) return draft;
  return { ...draft, ...next, past: [...draft.past, { items: draft.items, edits: draft.edits, fields: draft.fields }], future: draft.future.slice(0, -1), selectedId: null, cropping: null };
}

export function reordered(draft: EditDraft, id: string, front: boolean): EditDraft {
  const item = draft.items.find((each) => each.id === id);
  if (!item) return draft;
  const others = draft.items.filter((each) => each !== item);
  return edited(draft, front ? [...others, item] : [item, ...others]);
}

/** With Shift, the far corner follows the longer side: a square, a circle. */
export function squared(from: Point, to: Point): Point {
  const side = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
  return { x: from.x + (to.x < from.x ? -side : side), y: from.y + (to.y < from.y ? -side : side) };
}

/** A click without a drag gives a shape of a usable size, from where it was clicked. `square`: Shift held. */
/** A frame drawn too small to hold a word is a tap: the stamp takes its default size instead. */
const holdsWord = (from: Point, to: Point) => Math.abs(to.x - from.x) >= narrowest && Math.abs(to.y - from.y) >= narrowest;

export function created(tool: Exclude<Tool, "select" | "ink" | keyof typeof markupTools>, id: string, pageIndex: number, from: Point, dragTo: Point, style: Style, square = false): EditItem {
  const to = square && (tool === "rectangle" || tool === "ellipse") ? squared(from, dragTo) : dragTo;
  const dragged = Math.abs(to.x - from.x) >= smallest || Math.abs(to.y - from.y) >= smallest;
  const { color, lineWidth } = style;
  switch (tool) {
    case "text": {
      const box = spanned(from, to);
      return { id, pageIndex, kind: "text", at: dragged ? { x: box.x, y: box.y } : from, text: "", font: style.font, bold: style.bold, size: style.size, color, ...(dragged ? { width: Math.max(narrowest, box.width) } : {}) };
    }
    case "note":
      return { id, pageIndex, kind: "note", at: { x: from.x - noteSize / 2, y: from.y - noteSize / 2 }, text: "", author: "", color };
    case "link":
      return { id, pageIndex, kind: "link", box: dragged ? spanned(from, to) : { ...from, width: 160, height: 24 }, target: { url: "" } };
    case "stamp":
      return { id, pageIndex, kind: "stamp", box: holdsWord(from, to) ? spanned(from, to) : { x: from.x - 80, y: from.y - 25, width: 160, height: 50 }, text: style.stamp, date: null, color };
    case "field": {
      const square = style.field === "checkbox";
      const field = { id, pageIndex, kind: "field" as const, field: style.field, name: "", multiline: false, options: [] };
      if (!dragged) return { ...field, box: square ? { x: from.x - 7, y: from.y - 7, width: 14, height: 14 } : { x: from.x - 80, y: from.y - 12, width: 160, height: 24 } };
      const drawn = spanned(from, to);
      const side = Math.max(fieldFloor, Math.min(drawn.width, drawn.height));
      return { ...field, box: square ? { x: to.x < from.x ? from.x - side : from.x, y: to.y < from.y ? from.y - side : from.y, width: side, height: side } : { ...drawn, width: Math.max(fieldFloor, drawn.width), height: Math.max(fieldFloor, drawn.height) } };
    }
    case "line":
    case "arrow":
      return { id, pageIndex, kind: tool, from, to: dragged ? to : { x: from.x + 120, y: from.y }, color, lineWidth };
    case "highlight":
      return { id, pageIndex, kind: "highlight", box: dragged ? spanned(from, to) : { ...from, width: 160, height: 18 }, color };
    default:
      return {
        id, pageIndex, kind: tool, box: dragged ? spanned(from, to) : { ...from, width: 120, height: 80 },
        stroke: style.fill ? null : color, fill: style.fill ? color : null, lineWidth,
      };
  }
}

export function restyled(item: EditItem, change: Partial<Style>): EditItem {
  const color = change.color;
  switch (item.kind) {
    case "text":
      return { ...item, color: color ?? item.color, font: change.font ?? item.font, bold: change.bold ?? item.bold, size: change.size ?? item.size };
    case "rectangle":
    case "ellipse": {
      const paint = color ?? item.stroke ?? item.fill ?? [0, 0, 0];
      const filled = change.fill ?? item.fill !== null;
      return { ...item, stroke: filled ? null : paint, fill: filled ? paint : null, lineWidth: change.lineWidth ?? item.lineWidth };
    }
    case "line":
    case "arrow":
    case "ink":
      return { ...item, color: color ?? item.color, lineWidth: change.lineWidth ?? item.lineWidth };
    case "highlight":
    case "note":
    case "markup":
    case "stamp":
      return { ...item, color: color ?? item.color };
    case "image":
    case "link":
    case "field":
      return item;
  }
}

/** The first free name of the series: « Champ 1 », « Champ 2 »… `taken`: the names the page's own fields carry. */
export function fieldName(prefix: string, items: EditItem[], taken: string[] = []): string {
  const used = new Set([...taken, ...items.flatMap((item) => (item.kind === "field" ? [item.name.trim()] : []))]);
  let count = 1;
  while (used.has(`${prefix} ${count}`)) count++;
  return `${prefix} ${count}`;
}

/**
 * A field's name is its `/T`: readers merge fields of one name, so each added field needs its own, apart from the
 * document's; a period would split it into a hierarchy. A list needs a choice to offer.
 */
export function fieldsValid(items: EditItem[], taken: string[] = []): boolean {
  const names = items.flatMap((item) => (item.kind === "field" ? [item.name.trim()] : []));
  return names.every((name) => name !== "" && !name.includes(".") && !nameTaken(name, taken)) && new Set(names).size === names.length
    && items.every((item) => item.kind !== "field" || item.field !== "combo" || item.options.some((option) => option.trim() !== ""));
}

/** A box is square, a text or a list is a line: the frame follows the kind the field takes. */
export function rekinded(item: EditItem & EditField, field: FieldKind): EditItem & EditField {
  const side = Math.min(item.box.width, item.box.height);
  if (field === "checkbox") return { ...item, field, box: { ...item.box, width: side, height: side } };
  return { ...item, field, box: item.field === "checkbox" ? { ...item.box, width: Math.max(item.box.width, 160), height: Math.max(item.box.height, 24) } : item.box };
}

/** The style an item shows, the rest taken from `fallback`. */
export function styleOf(item: EditItem, fallback: Style): Style {
  switch (item.kind) {
    case "text":
      return { ...fallback, color: item.color, font: item.font, bold: item.bold, size: item.size };
    case "rectangle":
    case "ellipse":
      return { ...fallback, color: item.stroke ?? item.fill ?? fallback.color, fill: item.fill !== null, lineWidth: item.lineWidth };
    case "line":
    case "arrow":
    case "ink":
      return { ...fallback, color: item.color, lineWidth: item.lineWidth };
    case "highlight":
    case "note":
    case "markup":
    case "stamp":
      return { ...fallback, color: item.color };
    case "image":
    case "link":
    case "field":
      return fallback;
  }
}

export function boundsOf(item: EditItem, measure: Measure): Box {
  switch (item.kind) {
    case "text":
      return { ...item.at, width: item.width ?? measure(item), height: item.size * lineHeight * wrapped(item.text, item.font, item.bold, item.size, item.width).length };
    case "line":
    case "arrow":
      return spanned(item.from, item.to);
    case "ink": {
      const xs = item.points.map((point) => point.x), ys = item.points.map((point) => point.y);
      return spanned({ x: Math.min(...xs), y: Math.min(...ys) }, { x: Math.max(...xs), y: Math.max(...ys) });
    }
    case "note":
      return { ...item.at, width: noteSize, height: noteSize };
    case "markup": {
      const xs = item.quads.flatMap((quad) => [quad.x, quad.x + quad.width]), ys = item.quads.flatMap((quad) => [quad.y, quad.y + quad.height]);
      return spanned({ x: Math.min(...xs), y: Math.min(...ys) }, { x: Math.max(...xs), y: Math.max(...ys) });
    }
    default:
      return item.box;
  }
}

/** The topmost item of the page under the point; a line or a stroke counts within `slack` points of its path. */
export function hit(items: EditItem[], pageIndex: number, point: Point, measure: Measure, slack: number): EditItem | undefined {
  return items.findLast((item) => {
    if (item.pageIndex !== pageIndex) return false;
    if (item.kind === "line" || item.kind === "arrow") return distance(point, item.from, item.to) <= slack + item.lineWidth / 2;
    if (item.kind === "ink") return item.points.some((each, index) => distance(point, item.points[index - 1] ?? each, each) <= slack + item.lineWidth / 2);
    const box = boundsOf(item, measure);
    return point.x >= box.x - slack && point.x <= box.x + box.width + slack && point.y >= box.y - slack && point.y <= box.y + box.height + slack;
  });
}

export function moved(item: EditItem, dx: number, dy: number): EditItem {
  const shift = (point: Point) => ({ x: point.x + dx, y: point.y + dy });
  switch (item.kind) {
    case "text":
      return { ...item, at: shift(item.at) };
    case "line":
    case "arrow":
      return { ...item, from: shift(item.from), to: shift(item.to) };
    case "ink":
      return { ...item, points: item.points.map(shift) };
    case "note":
      return { ...item, at: shift(item.at) };
    case "markup":
      return { ...item, quads: item.quads.map((quad) => ({ ...quad, ...shift(quad) })) };
    default:
      return { ...item, box: { ...item.box, ...shift(item.box) } };
  }
}

/** `ratio`: Shift held, the box keeps its proportions. */
export function resized(item: EditItem, handle: Handle, point: Point, measure?: Measure, ratio = false): EditItem {
  if (item.kind === "line" || item.kind === "arrow") return handle === "from" ? { ...item, from: point } : handle === "to" ? { ...item, to: point } : item;
  if (item.kind === "text") {
    // A side handle makes a text box of any text: its lines then wrap at the width drawn.
    const current = item.width ?? measure?.(item) ?? narrowest;
    if (handle === "e") return { ...item, width: Math.max(narrowest, point.x - item.at.x) };
    if (handle === "w") {
      const right = item.at.x + current;
      const x = Math.min(point.x, right - narrowest);
      return { ...item, at: { ...item.at, x }, width: right - x };
    }
    return item;
  }
  return "box" in item ? { ...item, box: resizedBox(item.box, handle, point, ratio, item.kind === "field" ? fieldFloor : smallest) } : item;
}

/** The corner the handle holds follows the point; the opposite corner stays. `ratio`: the height follows the width. */
export function resizedBox({ x, y, width, height }: Box, handle: Handle, point: Point, ratio = false, floor = smallest): Box {
  const fixed = { x: handle.endsWith("w") ? x + width : x, y: handle.startsWith("n") ? y + height : y };
  const box = spanned(fixed, point);
  const sized = { width: Math.max(floor, box.width), height: Math.max(floor, box.height) };
  if (ratio) sized.height = sized.width * height / width;
  return { x: point.x >= fixed.x ? fixed.x : fixed.x - sized.width, y: point.y >= fixed.y ? fixed.y : fixed.y - sized.height, ...sized };
}

/** The turn is drawn before the mirrors: with one mirror on, a turn to the right shows as a turn to the left. */
export function rotatedPicture(picture: Picture, quarters: 1 | -1): Picture {
  const step = picture.flipX !== picture.flipY ? -quarters : quarters;
  return { ...picture, rotate: (((picture.rotate + step * 90) % 360) + 360) % 360 as Picture["rotate"] };
}

export const flippedPicture = (picture: Picture, axis: "x" | "y"): Picture => (axis === "x" ? { ...picture, flipX: !picture.flipX } : { ...picture, flipY: !picture.flipY });

/** The box of a picture turned by a quarter: the same centre, width and height swapped. */
export function turnedBox({ x, y, width, height }: Box): Box {
  return { x: x + width / 2 - height / 2, y: y + height / 2 - width / 2, width: height, height: width };
}

/** A rectangle drawn inside a shown picture, in fractions of the pixels it shows: the mirrors and the rotation undone. */
export function croppedPicture(picture: Picture, box: Box, inner: Box): Picture {
  let [u, v, w, h] = [(inner.x - box.x) / box.width, (inner.y - box.y) / box.height, inner.width / box.width, inner.height / box.height];
  if (picture.flipX) u = 1 - u - w;
  if (picture.flipY) v = 1 - v - h;
  const shown: Box = picture.rotate === 90 ? { x: v, y: 1 - u - w, width: h, height: w }
    : picture.rotate === 180 ? { x: 1 - u - w, y: 1 - v - h, width: w, height: h }
    : picture.rotate === 270 ? { x: 1 - v - h, y: u, width: h, height: w }
    : { x: u, y: v, width: w, height: h };
  return { ...picture, crop: composedCrop(picture.crop, shown) };
}

/** A rectangle drawn on an image of the document, in fractions of its pixels, from where its pixel corners show. */
export function fractionsIn(corners: { topLeft: Point; topRight: Point; bottomLeft: Point }, inner: Box): Box | null {
  const { topLeft, topRight, bottomLeft } = corners;
  const across = { x: topRight.x - topLeft.x, y: topRight.y - topLeft.y }, down = { x: bottomLeft.x - topLeft.x, y: bottomLeft.y - topLeft.y };
  const [along, deep] = [across.x ** 2 + across.y ** 2, down.x ** 2 + down.y ** 2];
  if (along === 0 || deep === 0) return null;
  const project = (point: Point) => ({ x: ((point.x - topLeft.x) * across.x + (point.y - topLeft.y) * across.y) / along, y: ((point.x - topLeft.x) * down.x + (point.y - topLeft.y) * down.y) / deep });
  const points = [{ x: inner.x, y: inner.y }, { x: inner.x + inner.width, y: inner.y }, { x: inner.x, y: inner.y + inner.height }, { x: inner.x + inner.width, y: inner.y + inner.height }].map(project);
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  const xs = points.map((point) => clamp(point.x)), ys = points.map((point) => clamp(point.y));
  const box = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  return box.width > 0.01 && box.height > 0.01 ? box : null;
}

/** A frame kept inside the picture's box, at least a few points a side. */
export function framed(frame: Box, box: Box): Box {
  const width = Math.min(Math.max(smallest, frame.width), box.width), height = Math.min(Math.max(smallest, frame.height), box.height);
  return { x: Math.min(Math.max(box.x, frame.x), box.x + box.width - width), y: Math.min(Math.max(box.y, frame.y), box.y + box.height - height), width, height };
}

/** A crop drawn on already cropped pixels, as fractions of the whole. */
export function composedCrop(previous: Box | null, relative: Box): Box {
  const base = previous ?? { x: 0, y: 0, width: 1, height: 1 };
  return { x: base.x + relative.x * base.width, y: base.y + relative.y * base.height, width: relative.width * base.width, height: relative.height * base.height };
}

export const pictureOf = (item: EditItem | undefined): Picture => (item?.kind === "image" ? item.picture ?? plainPicture : plainPicture);

export function spanned(a: Point, b: Point): Box {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
}

function distance(point: Point, a: Point, b: Point): number {
  const [dx, dy] = [b.x - a.x, b.y - a.y];
  const along = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (a.x + along * dx), point.y - (a.y + along * dy));
}
