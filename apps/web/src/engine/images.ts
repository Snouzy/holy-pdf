import { closeDoc, imagePixelSize, type OpenDoc } from "./documents";
import { EngineFailure } from "./failure";
import { decodedData, type EncodeJpeg, fingerprint, imagesOnPage, imageBitmap, type Pixels, smallestSide } from "./imageObjects";
import { checkImageSize } from "./jpeg";
import { nativeImageDocument } from "./nativeImages";
import type { Pdfium } from "./pdfium";
import { renderPage } from "./render";
import type { ImageMode, ImageQuality, NamedBytes, PageSize } from "./types";

export const imageQualities: Record<ImageQuality, { ppi: number; quality: number }> = {
  normal: { ppi: 150, quality: 0.85 },
  high: { ppi: 300, quality: 0.92 },
};

/** A bitmap this big weighs 64 MB: more would not fit on a phone. */
const maxPixels = 16_000_000;

/** The width to render a page at `ppi`, lowered so the image stays under 16 million pixels. */
export function renderWidth(size: PageSize, ppi: number): number {
  const width = (size.width / 72) * ppi;
  const height = (size.height / 72) * ppi;
  return Math.max(1, Math.floor(width * Math.min(1, Math.sqrt(maxPixels / (width * height)))));
}

export function imageName(prefix: string, mode: ImageMode, n: number): string {
  return mode === "pages" ? `${prefix}-${n}.jpg` : `${prefix}-image-${n}.jpg`;
}

export async function pagesToJpeg(
  p: Pdfium,
  doc: OpenDoc,
  prefix: string,
  quality: ImageQuality,
  encode: EncodeJpeg,
  onPage: () => void,
): Promise<NamedBytes[]> {
  const { ppi, quality: jpegQuality } = imageQualities[quality];
  const files: NamedBytes[] = [];
  for (const [index, size] of doc.sizes.entries()) {
    const page = renderPage(p, doc, index, renderWidth(size, ppi));
    files.push({ name: imageName(prefix, "pages", index + 1), bytes: await encode(page, page.width, page.height, jpegQuality) });
    onPage();
  }
  return files;
}

/** The photos of every page, at their own size, each once (`seen` spans the files), without bullets, lines or icons. */
export async function extractImages(
  p: Pdfium,
  doc: OpenDoc,
  prefix: string,
  quality: ImageQuality,
  encode: EncodeJpeg,
  seen: Set<string>,
  onPage: () => void,
): Promise<NamedBytes[]> {
  const files: NamedBytes[] = [];
  let native: Awaited<ReturnType<typeof nativeImageDocument>> | undefined;
  const extracted = new Set<number>();
  const keep = async (pixels: Pixels) => {
    // Equal image streams can have different masks, palettes or decode arrays.
    const key = `${pixels.width}x${pixels.height}:${await fingerprint(new Uint8Array(pixels.pixels.buffer))}`;
    if (seen.has(key)) return;
    const bytes = await encode(pixels, pixels.width, pixels.height, imageQualities[quality].quality);
    seen.add(key);
    files.push({ name: imageName(prefix, "extract", files.length + 1), bytes });
  };
  try {
    for (let index = 0; index < doc.sizes.length; index++) {
      const page = p.FPDF_LoadPage(doc.handle, index);
      if (page === 0) throw new EngineFailure({ kind: "damaged" });
      try {
        for (const image of imagesOnPage(p, page)) {
          const [width = 0, height = 0] = imagePixelSize(p, image) ?? [];
          if (width < smallestSide || height < smallestSide) continue;
          checkImageSize(width, height);
          native ??= await nativeImageDocument(p, doc);
          const rawKey = await fingerprint(decodedData(p, image));
          const candidates = native.images.get(rawKey)?.filter((entry) => entry.width === width && entry.height === height);
          if (!candidates?.length) {
            // An inline image (BI…EI) has no XObject to draw alone; its own bitmap is already unclipped.
            const pixels = imageBitmap(p, image);
            if (pixels) await keep(pixels);
            continue;
          }
          for (const entry of candidates) {
            if (extracted.has(entry.index)) continue;
            extracted.add(entry.index);
            await keep(renderPage(p, native.doc, entry.index, width));
          }
        }
      } finally {
        p.FPDF_ClosePage(page);
      }
      onPage();
    }
  } finally {
    if (native) closeDoc(p, native.doc);
  }
  return files;
}
