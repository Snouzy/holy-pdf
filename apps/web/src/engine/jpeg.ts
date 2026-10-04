import { EngineFailure } from "./failure";
import type { EncodeJpeg } from "./imageObjects";

export const maxImagePixels = 16_000_000;
const maxImageSide = 16_384;

export function checkImageSize(width: number, height: number): void {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
    throw new EngineFailure({ kind: "damaged" });
  }
  if (width > maxImageSide || height > maxImageSide || width * height > maxImagePixels) {
    throw new EngineFailure({ kind: "outOfMemory" });
  }
}

/** The browser resizes on a canvas, faster and smoother than JavaScript would. */
export const encodeJpeg: EncodeJpeg = async ({ pixels, width, height }, outWidth, outHeight, quality) => {
  checkImageSize(width, height);
  checkImageSize(outWidth, outHeight);
  if (pixels.length !== width * height * 4 || !Number.isFinite(quality) || quality < 0 || quality > 1) {
    throw new EngineFailure({ kind: "damaged" });
  }
  let source: OffscreenCanvas | undefined;
  let target: OffscreenCanvas | undefined;
  try {
    source = new OffscreenCanvas(width, height);
    const context = source.getContext("2d");
    if (!context || context.isContextLost?.()) throw new EngineFailure({ kind: "outOfMemory" });
    context.putImageData(new ImageData(pixels, width, height), 0, 0);
    if (context.isContextLost?.()) throw new EngineFailure({ kind: "outOfMemory" });
    target = source;
    if (outWidth !== width || outHeight !== height) {
      target = new OffscreenCanvas(outWidth, outHeight);
      const resized = target.getContext("2d");
      if (!resized || resized.isContextLost?.()) throw new EngineFailure({ kind: "outOfMemory" });
      resized.imageSmoothingQuality = "high";
      resized.drawImage(source, 0, 0, outWidth, outHeight);
      if (resized.isContextLost?.()) throw new EngineFailure({ kind: "outOfMemory" });
    }
    const blob = await target.convertToBlob({ type: "image/jpeg", quality });
    if (blob.type !== "image/jpeg" || blob.size === 0) throw new EngineFailure({ kind: "damaged" });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
      throw new EngineFailure({ kind: "damaged" });
    }
    return bytes;
  } finally {
    // Drop the backing stores immediately; the worker encodes many photos in succession.
    if (source) source.width = source.height = 0;
    if (target && target !== source) target.width = target.height = 0;
  }
};
