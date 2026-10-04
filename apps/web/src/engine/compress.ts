import { closeDoc, type OpenDoc, openPdf, reopenPdf, savePdf } from "./documents";
import { EngineFailure } from "./failure";
import { type EncodeJpeg, fingerprint, imageBitmap, imagesOnPage, rawData, smallestSide } from "./imageObjects";
import { replaceImageStreams, type StreamJpeg } from "./imageStreams";
import { malloc, type Pdfium } from "./pdfium";
import type { CompressLevel } from "./types";

type Level = { ppi: number; quality: number };

export const compressLevels: Record<CompressLevel, Level> = {
  extreme: { ppi: 96, quality: 0.5 },
  recommended: { ppi: 150, quality: 0.6 },
  low: { ppi: 200, quality: 0.8 },
};

export type ImageFacts = { width: number; height: number; ppi: number; bitsPerPixel: number };

/** The size to encode an image at, or null to leave it alone: JPEG blurs one-bit scans, and small images are not photos. */
export function targetSize(facts: ImageFacts, maxPpi: number): { width: number; height: number } | null {
  if (facts.bitsPerPixel <= 1 || facts.width < smallestSide || facts.height < smallestSide) return null;
  const scale = facts.ppi > maxPpi ? maxPpi / facts.ppi : 1;
  return { width: Math.max(1, Math.round(facts.width * scale)), height: Math.max(1, Math.round(facts.height * scale)) };
}

/** Rewrites image streams in a saved copy of the original document, preserving the document's object graph. */
export async function compressPdf(
  p: Pdfium,
  doc: OpenDoc,
  level: CompressLevel,
  encode: EncodeJpeg,
  onPage: () => void,
): Promise<Uint8Array<ArrayBuffer>> {
  const source = reopenPdf(p, doc);
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    if (!p.EPDF_RemoveEncryption(source.handle)) throw new EngineFailure({ kind: "damaged" });
    bytes = savePdf(p, source.handle);
  } finally {
    closeDoc(p, source);
  }
  // Saving can change a stream's encoding: inventory and replacement must fingerprint the same serialized bytes.
  const copy = openPdf(p, bytes);
  try {
    const draws = await imageDraws(p, copy);
    const jpegs = new Map<string, StreamJpeg>();
    for (let index = 0; index < doc.sizes.length; index++) {
      const page = loadPage(p, copy, index);
      try {
        for (const image of imagesOnPage(p, page)) {
          await shrinkImage(p, image, compressLevels[level], encode, draws, jpegs);
        }
      } finally {
        p.FPDF_ClosePage(page);
      }
      onPage();
    }
    return await replaceImageStreams(bytes, jpegs);
  } finally {
    closeDoc(p, copy);
  }
}

type Transform = [number, number, number, number];
const identity: Transform = [1, 0, 0, 1];

/** Use every draw, including nested forms, to avoid downsampling an image for only its smallest appearance. */
async function imageDraws(p: Pdfium, doc: OpenDoc): Promise<Map<string, ImageFacts>> {
  const draws = new Map<string, ImageFacts>();
  const matrix = malloc(p, 24);
  try {
    for (let index = 0; index < doc.sizes.length; index++) {
      const page = loadPage(p, doc, index);
      try {
        const visit = async (object: number, parent: Transform | null, depth: number): Promise<void> => {
          const known = p.FPDFPageObj_GetMatrix(object, matrix);
          const [a, b, c, d] = known ? [0, 4, 8, 12].map((offset) => p.pdfium.getValue(matrix + offset, "float")) as Transform : identity;
          const [pa, pb, pc, pd] = parent ?? identity;
          const transform: Transform = [pa * a + pc * b, pb * a + pd * b, pa * c + pc * d, pb * c + pd * d];
          const type = p.FPDFPageObj_GetType(object);
          if (type === 3) {
            const facts = imageFacts(p, page, object);
            facts.ppi = known && parent ? Math.min(facts.width / Math.hypot(transform[0], transform[1]), facts.height / Math.hypot(transform[2], transform[3])) * 72 : 0;
            const key = await fingerprint(rawData(p, object));
            const previous = draws.get(key);
            draws.set(key, previous && previous.ppi <= facts.ppi ? previous : facts);
          } else if (type === 5) {
            if (depth >= 64) throw new EngineFailure({ kind: "unsupportedFormat" });
            for (let i = 0; i < p.FPDFFormObj_CountObjects(object); i++) {
              await visit(p.FPDFFormObj_GetObject(object, i), known && parent ? transform : null, depth + 1);
            }
          }
        };
        for (let i = 0; i < p.FPDFPage_CountObjects(page); i++) await visit(p.FPDFPage_GetObject(page, i), identity, 0);
      } finally {
        p.FPDF_ClosePage(page);
      }
    }
  } finally {
    p.pdfium._free(matrix);
  }
  return draws;
}

function loadPage(p: Pdfium, doc: OpenDoc, index: number): number {
  const page = p.FPDF_LoadPage(doc.handle, index);
  if (page === 0) throw new EngineFailure({ kind: "damaged" });
  return page;
}

async function shrinkImage(
  p: Pdfium,
  image: number,
  { ppi, quality }: Level,
  encode: EncodeJpeg,
  draws: Map<string, ImageFacts>,
  jpegs: Map<string, StreamJpeg>,
): Promise<void> {
  const raw = rawData(p, image);
  const key = await fingerprint(raw);
  const facts = draws.get(key);
  draws.delete(key);
  const size = facts ? targetSize(facts, ppi) : null;
  if (!size) return;
  const jpeg = await shrink(p, image, raw.length, size, quality, encode);
  if (jpeg) jpegs.set(key, { jpeg, ...size });
}

/** The image's own pixels, soft mask left out, as a JPEG; null when that is not smaller. */
async function shrink(
  p: Pdfium,
  image: number,
  rawLength: number,
  size: { width: number; height: number },
  quality: number,
  encode: EncodeJpeg,
): Promise<Uint8Array<ArrayBuffer> | null> {
  const pixels = imageBitmap(p, image);
  if (!pixels) return null;
  const jpeg = await encode(pixels, size.width, size.height, quality);
  return jpeg.length < rawLength ? jpeg : null;
}

/** FPDF_IMAGEOBJ_METADATA, 28 bytes: width and height (u32), horizontal and vertical dpi (float), bits per pixel (u32), … */
function imageFacts(p: Pdfium, page: number, image: number): ImageFacts {
  const meta = malloc(p, 28);
  try {
    const known = p.FPDFImageObj_GetImageMetadata(image, page, meta);
    const read = (offset: number, type: "i32" | "float") => (known ? p.pdfium.getValue(meta + offset, type) : 0);
    return {
      width: read(0, "i32"),
      height: read(4, "i32"),
      ppi: read(8, "float"),
      bitsPerPixel: read(16, "i32"),
    };
  } finally {
    p.pdfium._free(meta);
  }
}
