import type { Rotation } from "./types";

/** Mirrored orientations (2, 4, 5, 7) keep only their rotation: mirrored photos are rare. */
const rotationByOrientation: Partial<Record<number, Rotation>> = { 3: 180, 4: 180, 5: 270, 6: 90, 7: 90, 8: 270 };

type Tiff = { view: DataView; start: number; little: boolean };

/** Clockwise rotation that shows a JPEG upright, read from its EXIF orientation. 0 when absent or unreadable. */
export function jpegRotation(jpeg: Uint8Array): Rotation {
  const tiff = exifOf(jpeg);
  const orientation = tiff && entry(tiff, tiff.start + tiff.view.getUint32(tiff.start + 4, tiff.little), 0x0112);
  return orientation === null || !tiff ? 0 : rotationByOrientation[tiff.view.getUint16(orientation + 8, tiff.little)] ?? 0;
}

/** The ISO day a JPEG photo was taken (EXIF DateTimeOriginal), or `null`. */
export function jpegCaptureDay(jpeg: Uint8Array): string | null {
  const tiff = exifOf(jpeg);
  return tiff ? captureDay(tiff) : null;
}

/**
 * The same for a HEIC photo, whose EXIF block is an item of the file: `iinf` names it « Exif », `iloc` says where its
 * bytes lie. The block starts with the offset of its TIFF header.
 */
export function heicCaptureDay(heic: Uint8Array): string | null {
  const view = new DataView(heic.buffer, heic.byteOffset, heic.byteLength);
  try {
    const meta = boxes(view, 0, view.byteLength).find((box) => box.type === "meta");
    if (!meta) return null;
    const children = boxes(view, meta.start + 4, meta.end);
    const info = children.find((box) => box.type === "iinf");
    const locations = children.find((box) => box.type === "iloc");
    if (!info || !locations) return null;
    const infoVersion = view.getUint8(info.start);
    const entries = boxes(view, info.start + 4 + (infoVersion === 0 ? 2 : 4), info.end);
    const exif = entries.find((box) => box.type === "infe" && view.getUint8(box.start) >= 2 && type4(view, box.start + 4 + (view.getUint8(box.start) === 2 ? 4 : 6)) === "Exif");
    if (!exif) return null;
    const item = view.getUint8(exif.start) === 2 ? view.getUint16(exif.start + 4) : view.getUint32(exif.start + 4);
    const at = itemOffset(view, locations.start, item);
    if (at === null) return null;
    return captureDay({ view, start: at + 4 + view.getUint32(at), little: view.getUint16(at + 4 + view.getUint32(at)) === 0x4949 });
  } catch {
    return null;
  }
}

function captureDay(tiff: Tiff): string | null {
  try {
    const pointer = entry(tiff, tiff.start + tiff.view.getUint32(tiff.start + 4, tiff.little), 0x8769);
    const original = pointer === null ? null : entry(tiff, tiff.start + tiff.view.getUint32(pointer + 8, tiff.little), 0x9003);
    if (original === null) return null;
    const at = tiff.start + tiff.view.getUint32(original + 8, tiff.little);
    const text = String.fromCharCode(...Array.from({ length: 10 }, (_, index) => tiff.view.getUint8(at + index)));
    const match = /^(\d{4}):(\d{2}):(\d{2})$/.exec(text);
    return match && match[2] !== "00" && match[3] !== "00" ? `${match[1]}-${match[2]}-${match[3]}` : null;
  } catch {
    return null;
  }
}

type Box = { type: string; start: number; end: number };
const type4 = (view: DataView, at: number) => String.fromCharCode(...[0, 1, 2, 3].map((index) => view.getUint8(at + index)));

/** The boxes between `from` and `to`; `start` is where a box's content begins. */
function boxes(view: DataView, from: number, to: number): Box[] {
  const found: Box[] = [];
  for (let at = from; at + 8 <= to;) {
    const size = view.getUint32(at);
    const large = size === 1;
    const length = large ? Number(view.getBigUint64(at + 8)) : size === 0 ? to - at : size;
    if (length < 8) break;
    found.push({ type: type4(view, at + 4), start: at + (large ? 16 : 8), end: at + length });
    at += length;
  }
  return found;
}

/** Where the bytes of `item` start in the file, from the `iloc` box (its first extent). */
function itemOffset(view: DataView, start: number, item: number): number | null {
  const version = view.getUint8(start);
  const sizes = view.getUint16(start + 4);
  const [offsetSize, lengthSize, baseSize, indexSize] = [sizes >> 12, (sizes >> 8) & 15, (sizes >> 4) & 15, version > 0 ? sizes & 15 : 0];
  const read = (at: number, size: number) => (size === 0 ? 0 : size === 4 ? view.getUint32(at) : size === 8 ? Number(view.getBigUint64(at)) : view.getUint16(at));
  let at = start + 6;
  const count = version < 2 ? view.getUint16(at) : view.getUint32(at);
  at += version < 2 ? 2 : 4;
  for (let index = 0; index < count; index++) {
    const id = version < 2 ? view.getUint16(at) : view.getUint32(at);
    at += version < 2 ? 2 : 4;
    if (version > 0) at += 2;
    at += 2;
    const base = read(at, baseSize);
    at += baseSize;
    const extents = view.getUint16(at);
    at += 2;
    if (id === item && extents > 0) return base + read(at + indexSize, offsetSize);
    at += extents * (indexSize + offsetSize + lengthSize);
  }
  return null;
}

function exifOf(jpeg: Uint8Array): Tiff | null {
  const view = new DataView(jpeg.buffer, jpeg.byteOffset, jpeg.byteLength);
  try {
    let offset = 2;
    while (offset + 4 <= view.byteLength && view.getUint8(offset) === 0xff) {
      const marker = view.getUint8(offset + 1);
      if (marker === 0xda) return null;
      if (marker === 0xe1 && [0x45, 0x78, 0x69, 0x66, 0, 0].every((byte, i) => view.getUint8(offset + 4 + i) === byte)) {
        return { view, start: offset + 10, little: view.getUint16(offset + 10) === 0x4949 };
      }
      offset += 2 + view.getUint16(offset + 2);
    }
  } catch {
    return null;
  }
  return null;
}

/** The offset of the entry for `tag` in the directory at `ifd`, or `null`. */
function entry({ view, little }: Tiff, ifd: number, tag: number): number | null {
  try {
    const count = view.getUint16(ifd, little);
    for (let index = 0; index < count; index++) {
      const at = ifd + 2 + index * 12;
      if (view.getUint16(at, little) === tag) return at;
    }
  } catch {
    return null;
  }
  return null;
}
