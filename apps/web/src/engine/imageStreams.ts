import { fingerprint } from "./imageObjects";

export type StreamJpeg = { jpeg: Uint8Array; width: number; height: number };

type Xref = { at: number; table: string; trailerAt: number; startxrefAt: number; offsets: Map<number, number> };
type Edit = { start: number; end: number; bytes: Uint8Array[] };

function text(bytes: Uint8Array, start: number, end: number): string {
  let out = "";
  for (let i = start; i < end && i < bytes.length; i++) out += String.fromCharCode(bytes[i] ?? 0);
  return out;
}

const binary = (ascii: string) => Uint8Array.from(ascii, (c) => c.charCodeAt(0));

function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

// Keys the new dictionary can drop or rebuild. Any other key (/OC, /StructParent…) leaves the image as it is.
const known = new Set(["Type", "Subtype", "Width", "Height", "ColorSpace", "BitsPerComponent", "Filter", "DecodeParms", "Decode", "Length", "SMask", "Mask", "Interpolate", "Intent", "Name", "Metadata"]);

/**
 * Replaces image streams inside PDFium's saved original document, without rebuilding pages or their resources.
 * Each matching image keeps its soft mask; shared and form images change for every draw, with its clip and graphics
 * state. Catalog structures (outlines, forms, tags, attachments and metadata) are left untouched.
 * Only for the layout FPDF_SaveAsCopy writes: one classic xref table with right offsets, direct /Length, no object
 * streams. Any other file comes back unchanged.
 */
export async function replaceImageStreams(pdf: Uint8Array<ArrayBuffer>, jpegs: ReadonlyMap<string, StreamJpeg>): Promise<Uint8Array<ArrayBuffer>> {
  const xref = jpegs.size > 0 ? readXref(pdf) : null;
  if (!xref) return pdf;
  const objects = new Map([...xref.offsets].map(([num, offset]) => [num, readObject(pdf, offset)]));
  // Masks must stay gray or one-bit: never swap them for colour JPEGs, even when their bytes match an image's.
  const masks = new Set([...objects.values()].flatMap(({ dict }) => [...dict.matchAll(/\/(?:SMask|Mask)\s+(\d+)\s+\d+\s+R/g)].map((m) => Number(m[1]))));
  const appearances = appearanceImages(objects);
  const images: { num: number; dict: string; start: number; end: number; key: string }[] = [];
  for (const [num, { dict, start, data }] of objects) {
    if (data && /\/Subtype\s*\/Image\b/.test(dict)) images.push({ num, dict, start, end: data.end, key: await fingerprint(pdf.subarray(data.start, data.end)) });
  }
  // Equal bytes under two dictionaries (/Decode, a palette, swapped sizes…) are two images: one JPEG cannot serve both.
  const shapes = new Map<string, Set<string>>();
  for (const { dict, key } of images) shapes.set(key, (shapes.get(key) ?? new Set<string>()).add(dict.replace(/\s*\/(Length\s+\d+|(?:SMask|Mask)\s+\d+\s+\d+\s+R)\s*/g, "")));
  const edits: Edit[] = [];
  for (const { num, dict, start, end, key } of images) {
    const jpeg = jpegs.get(key);
    if (!jpeg || shapes.get(key)?.size !== 1 || masks.has(num) || appearances.has(num) || !topLevelKeys(dict).every((name) => known.has(name))) continue;
    const mask = /\/SMask\s+(\d+)\s+\d+\s+R/.exec(dict);
    const hardMask = /\/Mask\s+(\d+)\s+\d+\s+R/.exec(dict);
    // A colour-key mask depends on exact source pixel values, which lossy JPEG encoding cannot retain.
    if (topLevelKeys(dict).includes("Mask") && !hardMask) continue;
    if (hardMask && !/\/ImageMask\s*true\b/.test(objects.get(Number(hardMask[1]))?.dict ?? "")) continue;
    // /Matte means colours premultiplied at the mask's size: the base would have to keep that size.
    if (mask && /\/Matte\b/.test(objects.get(Number(mask[1]))?.dict ?? "/Matte")) continue;
    const kept = [...dict.matchAll(/\/Interpolate\s*(?:true|false)|\/Metadata\s+\d+\s+\d+\s+R|\/(?:Intent|Name)\s*\/[^\s/<>[\]()]+/g)].map((m) => m[0]).join("");
    const head = binary(
      `<</BitsPerComponent 8/ColorSpace/DeviceRGB/Filter/DCTDecode/Height ${jpeg.height}${kept}/Length ${jpeg.jpeg.length}` +
        `${mask?.[0] ?? ""}${hardMask?.[0] ?? ""}/Subtype/Image/Type/XObject/Width ${jpeg.width}>>stream\r\n`,
    );
    edits.push({ start, end, bytes: [head, jpeg.jpeg] });
  }
  return edits.length === 0 ? pdf : rewrite(pdf, xref, edits);
}

/** Annotation appearances are not visited by the page API; their images must not use a page-only target size. */
function appearanceImages(objects: ReadonlyMap<number, { dict: string }>): Set<number> {
  const visited = new Set<number>();
  const references = (dict: string) => [...dict.matchAll(/(\d+)\s+\d+\s+R\b/g)].map((match) => Number(match[1]));
  const pending = [...objects.values()].flatMap(({ dict }) =>
    [...dict.matchAll(/\/AP\s*/g)].flatMap((match) => {
      const start = match.index + match[0].length;
      const value = dict.startsWith("<<", start)
        ? dict.slice(start, dictEnd(binary(dict), start))
        : /^\d+\s+\d+\s+R/.exec(dict.slice(start))?.[0] ?? "";
      return references(value);
    }),
  );
  while (pending.length > 0) {
    const num = pending.pop();
    if (num === undefined || visited.has(num)) continue;
    visited.add(num);
    pending.push(...references(objects.get(num)?.dict ?? ""));
  }
  return visited;
}

export function readXref(pdf: Uint8Array): Xref | null {
  const at = Number(/startxref\s+(\d+)\s+%%EOF\s*$/.exec(text(pdf, Math.max(0, pdf.length - 64), pdf.length))?.[1] ?? NaN);
  const tail = text(pdf, at, pdf.length);
  const trailer = tail.indexOf("trailer");
  // /Prev or /XRefStm: an older table lists objects too, and its offsets would go stale.
  if (!tail.startsWith("xref") || trailer < 0 || /\/(Prev|XRefStm)\b/.test(tail.slice(trailer))) return null;
  const offsets = new Map<number, number>();
  let num = 0;
  for (const line of tail.slice(4, trailer).split(/\r\n|\r|\n/)) {
    const section = /^(\d+) \d+\s*$/.exec(line);
    const entry = /^(\d{10}) (\d{5}) ([nf])/.exec(line);
    if (section) num = Number(section[1]);
    else if (entry) {
      const offset = Number(entry[1]);
      if (entry[3] === "n") {
        if (!text(pdf, offset, offset + 24).startsWith(`${num} ${Number(entry[2])} obj`)) return null;
        offsets.set(num, offset);
      }
      num++;
    }
  }
  return { at, table: tail.slice(0, trailer), trailerAt: at + trailer, startxrefAt: at + tail.lastIndexOf("startxref"), offsets };
}

export function readObject(pdf: Uint8Array, offset: number): { dict: string; start: number; data?: { start: number; end: number } } {
  const start = offset + (/^\d+ \d+ obj\s*/.exec(text(pdf, offset, offset + 32))?.[0].length ?? 0);
  if (text(pdf, start, start + 2) !== "<<") return { dict: "", start };
  const end = dictEnd(pdf, start);
  const dict = text(pdf, start, end);
  const keyword = /^\s*stream\r?\n/.exec(text(pdf, end, end + 16))?.[0];
  const length = Number(/\/Length\s+(\d+)\b(?!\s+\d+\s+R)/.exec(dict)?.[1] ?? NaN);
  if (keyword === undefined || !(length >= 0)) return { dict, start };
  const data = end + keyword.length;
  if (!/^\s*endstream/.test(text(pdf, data + length, data + length + 16))) return { dict, start };
  return { dict, start, data: { start: data, end: data + length } };
}

function dictEnd(pdf: Uint8Array, start: number): number {
  let depth = 0;
  for (let i = start; i < pdf.length; i++) {
    const c = pdf[i];
    if (c === 0x28) i = stringEnd(pdf, i);
    else if (c === 0x3c && pdf[i + 1] === 0x3c) (depth++, i++);
    else if (c === 0x3e && pdf[i + 1] === 0x3e) {
      i++;
      if (--depth === 0) return i + 1;
    }
  }
  return pdf.length;
}

function stringEnd(pdf: Uint8Array, start: number): number {
  let depth = 0;
  for (let i = start; i < pdf.length; i++) {
    if (pdf[i] === 0x5c) i++;
    else if (pdf[i] === 0x28) depth++;
    else if (pdf[i] === 0x29 && --depth === 0) return i;
  }
  return pdf.length;
}

export function topLevelKeys(dict: string): string[] {
  const keys: string[] = [];
  let depth = 0;
  let expectKey = true;
  for (let i = 0; i < dict.length; i++) {
    const c = dict[i] ?? "";
    if (c === "(") {
      let nest = 0;
      for (; i < dict.length; i++) {
        if (dict[i] === "\\") i++;
        else if (dict[i] === "(") nest++;
        else if (dict[i] === ")" && --nest === 0) break;
      }
      if (depth === 1) expectKey = true;
    } else if (dict.startsWith("<<", i) || c === "[") {
      if (depth === 1) expectKey = true;
      depth++;
      i += c === "[" ? 0 : 1;
    } else if (dict.startsWith(">>", i) || c === "]") {
      depth--;
      i += c === "]" ? 0 : 1;
    } else if (c === "<" && depth >= 1) {
      i = dict.indexOf(">", i);
      if (depth === 1) expectKey = true;
    } else if (c === "/" && depth === 1) {
      const name = /^\/[^\s/<>[\]()]*/.exec(dict.slice(i))?.[0] ?? "/";
      if (expectKey) keys.push(name.slice(1));
      expectKey = !expectKey;
      i += name.length - 1;
    } else if (depth === 1 && /\S/.test(c)) {
      const token = /^[^\s/<>[\]()]+/.exec(dict.slice(i))?.[0] ?? c;
      const reference = /^\d+\s+\d+\s+R\b/.exec(dict.slice(i))?.[0];
      i += (reference ?? token).length - 1;
      expectKey = true;
    }
  }
  return keys;
}

function rewrite(pdf: Uint8Array, xref: Xref, edits: Edit[]): Uint8Array<ArrayBuffer> {
  edits.sort((a, b) => a.start - b.start);
  const growth = (edit: Edit) => edit.bytes.reduce((total, part) => total + part.length, 0) - (edit.end - edit.start);
  const shift = (offset: number) => edits.reduce((moved, edit) => (edit.end <= offset ? moved + growth(edit) : moved), offset);
  const parts: Uint8Array[] = [];
  let from = 0;
  for (const edit of edits) {
    parts.push(pdf.subarray(from, edit.start), ...edit.bytes);
    from = edit.end;
  }
  const table = xref.table.replace(/^\d{10}(?= \d{5} n)/gm, (offset) => String(shift(Number(offset))).padStart(10, "0"));
  parts.push(pdf.subarray(from, xref.at), binary(table), pdf.subarray(xref.trailerAt, xref.startxrefAt), binary(`startxref\r\n${shift(xref.at)}\r\n%%EOF\r\n`));
  return concat(parts);
}
