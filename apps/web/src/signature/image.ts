import type { SignatureImage } from "../engine/types";
import { inkBounds, jpegSize, pngSize, maxSignatureBytes, maxSignaturePixels, SignatureInputError, signatureSize } from "./geometry";

function context(canvas: HTMLCanvasElement) {
  const value = canvas.getContext("2d");
  if (!value || value.isContextLost?.()) throw new SignatureInputError("decode");
  return value;
}

export async function importSignatureImage(file: File): Promise<SignatureImage> {
  if (!/\.(png|jpe?g)$/i.test(file.name)) throw new SignatureInputError("format");
  if (file.size > maxSignatureBytes) throw new SignatureInputError("bytes");
  if (/\.png$/i.test(file.name)) pngSize(new Uint8Array(await file.slice(0, 33).arrayBuffer()));
  else jpegSize(new Uint8Array(await file.arrayBuffer()));
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > maxSignaturePixels) throw new SignatureInputError("pixels");
    const size = signatureSize(bitmap.width, bitmap.height);
    canvas.width = size.width; canvas.height = size.height;
    const ctx = context(canvas);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    if (ctx.isContextLost?.()) throw new SignatureInputError("decode");
    return { ...size, pixels: ctx.getImageData(0, 0, canvas.width, canvas.height).data };
  } finally { bitmap.close(); canvas.width = 0; canvas.height = 0; }
}

export function drawingImage(canvas: HTMLCanvasElement): SignatureImage {
  const ctx = context(canvas);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const bounds = inkBounds(pixels, canvas.width, canvas.height);
  const cropped = ctx.getImageData(bounds.x, bounds.y, bounds.width, bounds.height);
  return { width: bounds.width, height: bounds.height, pixels: cropped.data };
}
