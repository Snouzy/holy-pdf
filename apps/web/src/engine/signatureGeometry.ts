import type { PageSize, SignaturePlacement } from "./types";

export function rotatedSignatureBounds(placement: SignaturePlacement, page: PageSize) {
  const angle = (placement.rotation ?? 0) * Math.PI / 180;
  const cosine = Math.abs(Math.cos(angle)), sine = Math.abs(Math.sin(angle));
  const width = cosine * placement.width + sine * placement.height * page.height / page.width;
  const height = sine * placement.width * page.width / page.height + cosine * placement.height;
  return { x: placement.x + (placement.width - width) / 2, y: placement.y + (placement.height - height) / 2, width, height };
}

export function validSignaturePlacement(placement: SignaturePlacement, pages: PageSize[]): boolean {
  const page = pages[placement.pageIndex];
  if (!Number.isInteger(placement.pageIndex) || !page
    || ![placement.x, placement.y, placement.width, placement.height, placement.rotation ?? 0].every(Number.isFinite)
    || Math.abs(placement.rotation ?? 0) > 360 || placement.width <= 0 || placement.height <= 0) return false;
  const bounds = rotatedSignatureBounds(placement, page);
  return bounds.x >= -1e-9 && bounds.y >= -1e-9 && bounds.x + bounds.width <= 1 + 1e-9 && bounds.y + bounds.height <= 1 + 1e-9;
}

export function validSignaturePageRotations(rotations: Record<number, number>, pageCount: number): boolean {
  return Object.entries(rotations).every(([key, angle]) => {
    const index = Number(key);
    return String(index) === key && Number.isInteger(index) && index >= 0 && index < pageCount && [0, 90, 180, 270].includes(angle);
  });
}

export type Point = { x: number; y: number };
export type PageFrame = { topLeft: Point; topRight: Point; bottomLeft: Point };

/** Image-space bottom-left, horizontal and vertical axes, expressed in PDF page coordinates. */
export function signatureMatrix(frame: PageFrame, placement: SignaturePlacement): [number, number, number, number, number, number] {
  const horizontal = { x: frame.topRight.x - frame.topLeft.x, y: frame.topRight.y - frame.topLeft.y };
  const down = { x: frame.bottomLeft.x - frame.topLeft.x, y: frame.bottomLeft.y - frame.topLeft.y };
  const angle = (placement.rotation ?? 0) * Math.PI / 180;
  const cosine = Math.cos(angle), sine = Math.sin(angle);
  const width = Math.hypot(horizontal.x, horizontal.y), height = Math.hypot(down.x, down.y);
  // Rotate in physical page units, otherwise a non-square page would skew the image.
  const right = {
    x: placement.width * (horizontal.x * cosine + down.x * width / height * sine),
    y: placement.width * (horizontal.y * cosine + down.y * width / height * sine),
  };
  const bottom = {
    x: placement.height * (down.x * cosine - horizontal.x * height / width * sine),
    y: placement.height * (down.y * cosine - horizontal.y * height / width * sine),
  };
  const center = {
    x: frame.topLeft.x + horizontal.x * (placement.x + placement.width / 2) + down.x * (placement.y + placement.height / 2),
    y: frame.topLeft.y + horizontal.y * (placement.x + placement.width / 2) + down.y * (placement.y + placement.height / 2),
  };
  return [right.x, right.y, -bottom.x, -bottom.y, center.x - right.x / 2 + bottom.x / 2, center.y - right.y / 2 + bottom.y / 2];
}
