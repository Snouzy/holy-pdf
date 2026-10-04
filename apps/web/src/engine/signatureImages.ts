import type { SignatureImage, SignaturePlacement } from "./types";

/** Bound the copy into the worker as well as the native bitmap allocation. */
export function validSignatureImage(image: SignatureImage): boolean {
  return Number.isInteger(image.width) && Number.isInteger(image.height)
    && image.width > 0 && image.height > 0 && image.width <= 1600 && image.height <= 1600
    && image.width * image.height <= 1_000_000
    && image.pixels instanceof Uint8ClampedArray && image.pixels.length === image.width * image.height * 4;
}

/** Only referenced assets count toward the export's 64 MB decoded-pixel budget. */
export function signatureImages(image: SignatureImage, placements: SignaturePlacement[], images: Record<string, SignatureImage>): Map<string | undefined, SignatureImage> | null {
  if (placements.length === 0) return null;
  const referenced = new Map<string | undefined, SignatureImage>();
  const distinct = new Set<SignatureImage>();
  let pixels = 0;
  for (const { imageId } of placements) {
    if (referenced.has(imageId)) continue;
    const selected = imageId === undefined ? image : Object.hasOwn(images, imageId) ? images[imageId] : undefined;
    if (!selected || !validSignatureImage(selected)) return null;
    referenced.set(imageId, selected);
    if (!distinct.has(selected)) {
      distinct.add(selected);
      pixels += selected.width * selected.height;
      if (pixels > 16_000_000) return null;
    }
  }
  return referenced;
}
