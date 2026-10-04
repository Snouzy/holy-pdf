import { readObject, readXref, topLevelKeys } from "./imageStreams";

const maxMetadataBytes = 1_048_576;
const profileMarker = /http:\/\/www\.aiim\.org\/pdfa\/ns\/id\/|http:\/\/www\.npes\.org\/pdfx\/ns\/id\/|\bpdf(?:a|x)id\s*:|PDF\s*\/\s*[AX]-\d|GTS_PDFX(?:Version|Conformance)/i;

/**
 * Conservative guard for PDFium's classic-xref serialization, not a PDF/A or PDF/X validator.
 * Any archival/print profile declaration or unreadable metadata keeps object streams disabled.
 * Image recompression has separate colour-profile constraints; this does not certify its output.
 */
export async function allowsObjectStreams(bytes: Uint8Array): Promise<boolean> {
  try {
    const xref = readXref(bytes);
    if (!xref || xref.offsets.size === 0) return false;
    const objects = new Map([...xref.offsets].map(([id, offset]) => [id, readObject(bytes, offset)]));
    const metadata = new Set<number>();
    const references = new Map<number, number>();
    let catalog = false;
    for (const [id, object] of objects) {
      if (!object.dict) continue;
      const dict = dictionarySyntax(object.dict);
      if (dict === null) return false;
      if (/GTS_PDFX(?:Version|Conformance)\b/i.test(dict)) return false;
      if (/\/Type\s*\/Catalog\b/.test(dict)) catalog = true;
      if (/\/Type\s*\/Metadata\b|\/Subtype\s*\/XML\b/.test(dict)) metadata.add(id);
      if (topLevelKeys(dict).includes("Metadata")) {
        const refs = [...dict.matchAll(/\/Metadata\b\s*(\d+)\s+(\d+)\s+R\b/g)];
        if (refs.length !== 1 || refs[0]?.[2] !== "0") return false;
        const target = Number(refs[0]?.[1]);
        references.set(id, target);
        metadata.add(target);
      }
    }
    if (!catalog) return false;
    const checked = new Set<number>();
    for (let id of metadata) {
      let object = objects.get(id);
      const visited = new Set<number>();
      // Some saved image metadata is a typed dictionary wrapping a separate XML stream.
      while (object && !object.data) {
        if (visited.has(id) || visited.size >= 8) return false;
        visited.add(id);
        const target = references.get(id);
        if (target === undefined) return false;
        id = target;
        object = objects.get(id);
      }
      if (!object?.data) return false;
      if (checked.has(id)) continue;
      checked.add(id);
      const dict = dictionarySyntax(object.dict);
      if (dict === null) return false;
      const keys = topLevelKeys(dict);
      if (keys.includes("DecodeParms")) return false;
      const data = bytes.subarray(object.data.start, object.data.end);
      if (data.length > maxMetadataBytes) return false;
      let decoded = data;
      if (keys.includes("Filter")) {
        const filters = [...dict.matchAll(/\/Filter\b\s*(\[[^\]]*\]|\/[^\s<>\[\]()%/]+)/g)];
        if (filters.length !== 1 || !/^(?:\/(?:FlateDecode|Fl)|\[\s*\/(?:FlateDecode|Fl)\s*\])$/.test(filters[0]?.[1] ?? "")) return false;
        decoded = await inflateMetadata(data);
      }
      const xml = decodeXml(decoded);
      if (xml === null || profileMarker.test(xml)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Ignore string contents before inspecting names; a URL's %20 is not a PDF comment. */
function dictionarySyntax(dict: string): string | null {
  if (!dict.endsWith(">>")) return null;
  let syntax = "";
  for (let i = 0; i < dict.length; i++) {
    const char = dict[i];
    if (char === "%") return null; // PDFium does not write comments inside dictionaries.
    if (char === "(") {
      let depth = 1;
      for (i++; i < dict.length && depth > 0; i++) {
        if (dict[i] === "\\") i++;
        else if (dict[i] === "(") depth++;
        else if (dict[i] === ")") depth--;
      }
      if (depth !== 0) return null;
      i--;
      syntax += "()";
    } else if (char === "<" && dict[i + 1] === "<") {
      syntax += "<<";
      i++;
    } else if (char === "<") {
      const end = dict.indexOf(">", i + 1);
      if (end < 0 || !/^[\da-f\s]*$/i.test(dict.slice(i + 1, end))) return null;
      syntax += "<>";
      i = end;
    } else syntax += char;
  }
  return syntax.replace(/#([\da-f]{2})/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
}

async function inflateMetadata(bytes: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const reader = new Blob([Uint8Array.from(bytes)]).stream().pipeThrough(new DecompressionStream("deflate")).getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > maxMetadataBytes) throw new Error("Metadata exceeds limit");
      chunks.push(value);
    }
    const result = new Uint8Array(length);
    let at = 0;
    for (const chunk of chunks) { result.set(chunk, at); at += chunk.length; }
    return result;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function decodeXml(bytes: Uint8Array): string | null {
  const encoding = (bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0x3c && bytes[1] === 0) ? "utf-16le"
    : (bytes[0] === 0xfe && bytes[1] === 0xff) || (bytes[0] === 0 && bytes[1] === 0x3c) ? "utf-16be" : "utf-8";
  let xml = new TextDecoder(encoding, { fatal: true }).decode(bytes);
  const declared = /<\?xml\b[^?]*\bencoding\s*=\s*["']([^"']+)["']/i.exec(xml)?.[1]?.toLowerCase();
  if (declared && declared !== encoding && !(declared === "utf-16" && encoding.startsWith("utf-16"))) return null;
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || !/<(?:[\w.-]+:)?(?:xmpmeta|RDF)\b/.test(xml)) return null;
  let unknownEntity = false;
  xml = xml.replace(/&([^;\s<]*);?/g, (_, entity: string) => {
    if (/^#(?:x[\da-f]+|\d+)$/i.test(entity)) {
      const point = entity[1]?.toLowerCase() === "x" ? Number.parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return String.fromCodePoint(point);
    }
    const known: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
    if (known[entity] !== undefined) return known[entity];
    unknownEntity = true;
    return "";
  });
  return unknownEntity ? null : xml;
}
