import { rotatedSignatureBounds } from "../engine/signatureGeometry";
import type { PageSize, SignaturePlacement } from "../engine/types";

export { rotatedSignatureBounds as signatureBounds };

export const maxSignatureBytes = 10 * 1024 * 1024;
export const maxSignaturePixels = 16_000_000;
export type SignatureProblem = "format" | "bytes" | "pixels" | "decode" | "empty" | "assets";

export class SignatureInputError extends Error {
  constructor(readonly problem: SignatureProblem) { super(problem); }
}

/** Read JPEG dimensions before asking the browser to allocate its decoded bitmap. */
export function jpegSize(bytes: Uint8Array): PageSize {
  if (bytes.length > maxSignatureBytes) throw new SignatureInputError("bytes");
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new SignatureInputError("format");
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset++] !== 0xff) break;
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === undefined || marker === 0xda || marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const length = (bytes[offset]! << 8) | bytes[offset + 1]!;
    if (length < 2 || offset + length > bytes.length) break;
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      if (length < 8) break;
      const height = (bytes[offset + 3]! << 8) | bytes[offset + 4]!;
      const width = (bytes[offset + 5]! << 8) | bytes[offset + 6]!;
      if (!width || !height) break;
      if (width * height > maxSignaturePixels) throw new SignatureInputError("pixels");
      return { width, height };
    }
    offset += length;
  }
  throw new SignatureInputError("format");
}

/** PNG dimensions are always in the first IHDR, before compressed pixels. */
export function pngSize(bytes: Uint8Array): PageSize {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length > maxSignatureBytes) throw new SignatureInputError("bytes");
  if (bytes.length < 33 || !signature.every((byte, index) => bytes[index] === byte)) throw new SignatureInputError("format");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(8) !== 13 || view.getUint32(12) !== 0x49484452) throw new SignatureInputError("format");
  const width = view.getUint32(16), height = view.getUint32(20);
  if (!width || !height || width > 0x7fffffff || height > 0x7fffffff) throw new SignatureInputError("format");
  if (width * height > maxSignaturePixels) throw new SignatureInputError("pixels");
  return { width, height };
}

export function signatureSize(width: number, height: number): PageSize {
  const scale = Math.min(1, 1600 / width, 1600 / height, Math.sqrt(1_000_000 / (width * height)));
  return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) };
}

export function inkBounds(pixels: Uint8ClampedArray, width: number, height: number) {
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (pixels[(y * width + x) * 4 + 3]) {
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
  }
  if (right < 0) throw new SignatureInputError("empty");
  left = Math.max(0, left - 8); top = Math.max(0, top - 8);
  return { x: left, y: top, width: Math.min(width, right + 9) - left, height: Math.min(height, bottom + 9) - top };
}

export function movePlacement(placement: SignaturePlacement, x: number, y: number, page?: PageSize): SignaturePlacement {
  if (page) return fitPlacement({ ...placement, x, y }, page);
  return { ...placement, x: Math.max(0, Math.min(1 - placement.width, x)), y: Math.max(0, Math.min(1 - placement.height, y)) };
}

export function fitPlacement(placement: SignaturePlacement, page: PageSize): SignaturePlacement {
  const { width: rotatedWidth, height: rotatedHeight } = rotatedSignatureBounds(placement, page);
  const scale = Math.min(1, 1 / rotatedWidth, 1 / rotatedHeight);
  const width = placement.width * scale, height = placement.height * scale;
  const halfWidth = rotatedWidth * scale / 2;
  const halfHeight = rotatedHeight * scale / 2;
  const centerX = Math.max(halfWidth, Math.min(1 - halfWidth, placement.x + placement.width / 2));
  const centerY = Math.max(halfHeight, Math.min(1 - halfHeight, placement.y + placement.height / 2));
  return { ...placement, width, height, x: centerX - width / 2, y: centerY - height / 2 };
}

export function sizePlacement(placement: SignaturePlacement, width: number, image: PageSize, page: PageSize): SignaturePlacement {
  const ratio = (image.height / image.width) * (page.width / page.height);
  const nextWidth = Math.max(Math.min(0.03, 1 / ratio), width);
  const nextHeight = nextWidth * ratio;
  return fitPlacement({ ...placement, width: nextWidth, height: nextHeight,
    x: placement.x + (placement.width - nextWidth) / 2, y: placement.y + (placement.height - nextHeight) / 2 }, page);
}

/** Drag the local bottom-right corner while keeping the rotated top-left corner fixed. */
export function resizeFromCorner(placement: SignaturePlacement, dx: number, dy: number, page: PageSize): SignaturePlacement {
  const width = placement.width * page.width, height = placement.height * page.height;
  const radians = (placement.rotation ?? 0) * Math.PI / 180;
  const cos = Math.cos(radians), sin = Math.sin(radians);
  const horizontal = { x: width * cos, y: width * sin };
  const vertical = { x: -height * sin, y: height * cos };
  const diagonal = { x: horizontal.x + vertical.x, y: horizontal.y + vertical.y };
  const anchorX = (placement.x + placement.width / 2) * page.width - diagonal.x / 2;
  const anchorY = (placement.y + placement.height / 2) * page.height - diagonal.y / 2;
  const requested = 1 + (dx * page.width * diagonal.x + dy * page.height * diagonal.y) / (width * width + height * height);
  let maximum = Infinity;
  for (const corner of [horizontal, vertical, diagonal]) {
    if (corner.x > 1e-10) maximum = Math.min(maximum, (page.width - anchorX) / corner.x);
    if (corner.x < -1e-10) maximum = Math.min(maximum, -anchorX / corner.x);
    if (corner.y > 1e-10) maximum = Math.min(maximum, (page.height - anchorY) / corner.y);
    if (corner.y < -1e-10) maximum = Math.min(maximum, -anchorY / corner.y);
  }
  const minimum = Math.min(1, 0.03 / placement.width, maximum);
  const scale = Math.max(minimum, Math.min(maximum, requested));
  const nextWidth = placement.width * scale, nextHeight = placement.height * scale;
  return { ...placement, width: nextWidth, height: nextHeight,
    x: (anchorX + diagonal.x * scale / 2) / page.width - nextWidth / 2,
    y: (anchorY + diagonal.y * scale / 2) / page.height - nextHeight / 2 };
}

/** PDFium renders by width; reject pages whose height cannot fit even at one pixel wide. */
export function previewWidth(page: PageSize): number | null {
  if (![page.width, page.height].every((value) => Number.isFinite(value) && value > 0)) return null;
  const ratio = page.width / page.height;
  const width = Math.floor(Math.min(1200, 1600 * ratio, Math.sqrt(1_500_000 * ratio)));
  return width >= 1 ? width : null;
}
