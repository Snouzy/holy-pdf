import { closeDoc, openPdf, reopenPdf, savePdf, type OpenDoc } from "./documents";
import { EngineFailure } from "./failure";
import { decodedData, fingerprint, smallestSide } from "./imageObjects";
import { readObject, readXref } from "./imageStreams";
import { checkImageSize } from "./jpeg";
import type { Pdfium } from "./pdfium";

export type NativeImage = { index: number; width: number; height: number };

/**
 * PDFium's rendered-image API honors the object's clip. A temporary document draws each original image resource
 * once, without that clip or placement, retaining its own mask, decode array and colour space. Serialize once;
 * appended pages reuse the original objects instead of duplicating image data for every photo.
 */
export async function nativeImageDocument(p: Pdfium, doc: OpenDoc): Promise<{ doc: OpenDoc; images: Map<string, NativeImage[]> }> {
  const copy = reopenPdf(p, doc);
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    if (!p.EPDF_RemoveEncryption(copy.handle)) throw new EngineFailure({ kind: "damaged" });
    bytes = savePdf(p, copy.handle);
  } finally {
    closeDoc(p, copy);
  }
  const xref = readXref(bytes);
  if (!xref) throw new EngineFailure({ kind: "damaged" });
  const objects = new Map([...xref.offsets].map(([num, offset]) => [num, readObject(bytes, offset)]));
  const dictionary = (value: string | undefined): string => {
    const ref = /^(\d+)\s+\d+\s+R$/.exec(value ?? "");
    return ref ? (objects.get(Number(ref[1]))?.dict ?? "") : (value ?? "");
  };
  const masks = new Set<number>();
  const colours = new Map<number, Set<string>>();
  for (const { dict } of objects.values()) {
    for (const key of ["SMask", "Mask"]) {
      const ref = /^(\d+)\s+\d+\s+R$/.exec(valueOf(dict, key) ?? "");
      if (ref) masks.add(Number(ref[1]));
    }
    const resources = dictionary(valueOf(dict, "Resources"));
    const xobjects = dictionary(valueOf(resources, "XObject"));
    const colour = valueOf(resources, "ColorSpace") ?? "";
    for (const ref of xobjects.matchAll(/\/(?:[^\s/<>[\]()]+)\s+(\d+)\s+\d+\s+R/g)) {
      const num = Number(ref[1]);
      colours.set(num, (colours.get(num) ?? new Set()).add(colour));
    }
  }

  // PDF strings may contain binary Indexed palettes: retain their bytes, never transcode them to UTF-8.
  const encode = (text: string) => Uint8Array.from(text, (char) => char.charCodeAt(0));
  const parts: Uint8Array[] = [bytes];
  let offset = bytes.length;
  const first = [...xref.offsets.keys()].reduce((max, num) => Math.max(max, num), 0) + 1;
  const offsets: number[] = [];
  const addObject = (body: string): number => {
    const num = first + offsets.length;
    const part = encode(`${num} 0 obj\n${body}\nendobj\n`);
    offsets.push(offset);
    parts.push(part);
    offset += part.length;
    return num;
  };
  const catalog = first;
  const pages = first + 1;
  const images = new Map<string, NativeImage[]>();
  const entries: { num: number; generation: number; width: number; height: number; colour: string }[] = [];
  for (const [num, object] of objects) {
    if (!object.data || !colours.has(num) || masks.has(num) || valueOf(object.dict, "Subtype") !== "/Image") continue;
    const width = Number(valueOf(object.dict, "Width"));
    const height = Number(valueOf(object.dict, "Height"));
    if (width < smallestSide || height < smallestSide) continue;
    try {
      checkImageSize(width, height);
    } catch {
      continue;
    }
    const at = xref.offsets.get(num) ?? 0;
    const header = String.fromCharCode(...bytes.subarray(at, at + 32));
    const generation = Number(/^\d+ (\d+) obj/.exec(header)?.[1]);
    if (!Number.isSafeInteger(generation)) throw new EngineFailure({ kind: "damaged" });
    for (const colour of colours.get(num) ?? []) entries.push({ num, generation, width, height, colour });
  }
  const kids = entries.map((_, index) => `${first + 2 + index * 2} 0 R`);
  addObject(`<< /Type /Catalog /Pages ${pages} 0 R >>`);
  addObject(`<< /Type /Pages /Count ${entries.length} /Kids [${kids.join(" ")}] >>`);
  entries.forEach(({ num, generation, width, height, colour }, index) => {
    const content = `q ${width} 0 0 ${height} 0 0 cm /Photo Do Q`;
    addObject(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Photo ${num} ${generation} R >> ${colour ? `/ColorSpace ${colour}` : ""} >> /Contents ${first + 3 + index * 2} 0 R >>`);
    addObject(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });
  const table = offsets.map((at) => `${String(at).padStart(10, "0")} 00000 n \n`).join("");
  const tail = encode(`xref\n${first} ${offsets.length}\n${table}trailer\n<< /Size ${first + offsets.length} /Root ${catalog} 0 R /Prev ${xref.at} >>\nstartxref\n${offset}\n%%EOF\n`);
  parts.push(tail);
  const result = new Uint8Array(offset + tail.length);
  let at = 0;
  for (const part of parts) {
    result.set(part, at);
    at += part.length;
  }
  const native = openPdf(p, result);
  try {
    for (const [index, { width, height }] of entries.entries()) {
      const page = p.FPDF_LoadPage(native.handle, index);
      if (!page) throw new EngineFailure({ kind: "damaged" });
      try {
        const object = p.FPDFPage_GetObject(page, 0);
        if (!object) throw new EngineFailure({ kind: "damaged" });
        const key = await fingerprint(decodedData(p, object));
        images.set(key, [...(images.get(key) ?? []), { index, width, height }]);
      } finally {
        p.FPDF_ClosePage(page);
      }
    }
    return { doc: native, images };
  } catch (error) {
    closeDoc(p, native);
    throw error;
  }
}

/** Read one top-level dictionary value in PDFium's serialized dictionaries, skipping nested values and strings. */
function valueOf(dict: string, key: string): string | undefined {
  let at = 2;
  while (at < dict.length - 2) {
    while (/\s/.test(dict[at] ?? "")) at++;
    if (dict[at] !== "/") return undefined;
    const name = /^\/[^\s/<>[\]()]+/.exec(dict.slice(at))?.[0];
    if (!name) return undefined;
    at += name.length;
    while (/\s/.test(dict[at] ?? "")) at++;
    const start = at;
    at = valueEnd(dict, at);
    if (name === `/${key}`) return dict.slice(start, at);
  }
  return undefined;
}

function valueEnd(text: string, start: number): number {
  const stack: string[] = [];
  let at = start;
  if (text.startsWith("<<", at)) { stack.push(">>"); at += 2; }
  else if (text[at] === "[") { stack.push("]"); at++; }
  else if (text[at] !== "(" && text[at] !== "<") {
    return at + (/^\d+\s+\d+\s+R\b|^\/[^\s/<>[\]()]+|^[^\s/<>[\]()]+/.exec(text.slice(at))?.[0].length ?? 1);
  }
  while (at < text.length) {
    if (text[at] === "(") {
      let depth = 1;
      for (at++; at < text.length && depth > 0; at++) {
        if (text[at] === "\\") at++;
        else if (text[at] === "(") depth++;
        else if (text[at] === ")") depth--;
      }
      if (stack.length === 0) return at;
    } else if (text.startsWith("<<", at)) { stack.push(">>"); at += 2; }
    else if (text[at] === "<") {
      at = text.indexOf(">", at) + 1;
      if (at === 0) return text.length;
      if (stack.length === 0) return at;
    } else if (text[at] === "[") { stack.push("]"); at++; }
    else if (stack.length && text.startsWith(stack[stack.length - 1] ?? "", at)) {
      at += stack.pop()?.length ?? 0;
      if (stack.length === 0) return at;
    } else at++;
  }
  return at;
}
