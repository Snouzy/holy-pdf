import { describe, expect, it } from "vitest";
import type { PageSize, SignaturePlacement } from "../../src/engine/types";
import { fitPlacement, inkBounds, jpegSize, pngSize, maxSignatureBytes, movePlacement, previewWidth, resizeFromCorner, signatureSize, sizePlacement, signatureBounds } from "../../src/signature/geometry";

function header(width: number, height: number, marker = 0xc0) {
  return new Uint8Array([0xff, 0xd8, 0xff, marker, 0, 11, 8, height >> 8, height & 255, width >> 8, width & 255, 1, 1, 0x11, 0]);
}

describe("signature JPEG limits before decoding", () => {
  it.each([0xc0, 0xc2])("reads baseline and progressive frames (%s)", (marker) => {
    expect(jpegSize(header(4032, 3024, marker))).toEqual({ width: 4032, height: 3024 });
  });
  it("skips metadata segments without interpreting their contents as dimensions", () => {
    const jpeg = header(100, 50);
    expect(jpegSize(new Uint8Array([...jpeg.slice(0, 2), 0xff, 0xe1, 0, 6, 0xff, 0xc0, 0xff, 0xff, ...jpeg.slice(2)]))).toEqual({ width: 100, height: 50 });
  });
  it("rejects disguised PNGs, broken segment lengths and missing frames", () => {
    for (const bytes of [new Uint8Array([137, 80, 78, 71]), new Uint8Array([255, 216, 255, 225, 255, 255]), header(0, 100), header(1, 1).slice(0, 12)]) {
      expect(() => jpegSize(bytes)).toThrow(expect.objectContaining({ problem: "format" }));
    }
  });
  it("rejects excessive file bytes or decoded pixel count", () => {
    expect(() => jpegSize(new Uint8Array(maxSignatureBytes + 1))).toThrow(expect.objectContaining({ problem: "bytes" }));
    expect(() => jpegSize(header(4001, 4000))).toThrow(expect.objectContaining({ problem: "pixels" }));
    expect(jpegSize(header(4000, 4000))).toEqual({ width: 4000, height: 4000 });
  });
  it.each([[4032, 3024], [16000, 1], [1, 16000], [100, 30], [4000, 4000]])("bounds normalized signatures without enlarging (%s×%s)", (width, height) => {
    const size = signatureSize(width, height);
    expect(size.width * size.height).toBeLessThanOrEqual(1_000_000);
    expect(Math.max(size.width, size.height)).toBeLessThanOrEqual(1600);
    expect(size.width).toBeLessThanOrEqual(width);
    expect(size.height).toBeLessThanOrEqual(height);
  });
});

function pngHeader(width: number, height: number) {
  const bytes = new Uint8Array(33);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  view.setUint32(12, 0x49484452);
  view.setUint32(16, width);
  view.setUint32(20, height);
  bytes.set([8, 6, 0, 0, 0], 24);
  return bytes;
}

describe("signature PNG limits before decoding", () => {
  it("reads unsigned IHDR dimensions, including headers in a subarray", () => {
    const bytes = new Uint8Array(40);
    bytes.set(pngHeader(4000, 4000), 7);
    expect(pngSize(bytes.subarray(7))).toEqual({ width: 4000, height: 4000 });
  });
  it("rejects malformed signatures, missing IHDR, invalid lengths and zero dimensions", () => {
    const badSignature = pngHeader(20, 10); badSignature[7] = 0;
    const badChunk = pngHeader(20, 10); badChunk[12] = 0;
    const badLength = pngHeader(20, 10); badLength[11] = 12;
    for (const bytes of [header(20, 10), badSignature, badChunk, badLength, pngHeader(0, 10), pngHeader(10, 0), pngHeader(20, 10).slice(0, 32), pngHeader(0xffffffff, 1)]) {
      expect(() => pngSize(bytes)).toThrow(expect.objectContaining({ problem: "format" }));
    }
  });
  it("rejects excessive bytes and PNG dimensions before bitmap allocation", () => {
    expect(() => pngSize(new Uint8Array(maxSignatureBytes + 1))).toThrow(expect.objectContaining({ problem: "bytes" }));
    expect(() => pngSize(pngHeader(4001, 4000))).toThrow(expect.objectContaining({ problem: "pixels" }));
    expect(() => pngSize(pngHeader(0x7fffffff, 0x7fffffff))).toThrow(expect.objectContaining({ problem: "pixels" }));
  });
});

describe("signature crop and placement", () => {
  it("crops by alpha, preserves transparent padding and clamps at canvas edges", () => {
    const pixels = new Uint8ClampedArray(100 * 40 * 4);
    pixels[(15 * 100 + 20) * 4 + 3] = 255;
    pixels[(20 * 100 + 99) * 4 + 3] = 1;
    expect(inkBounds(pixels, 100, 40)).toEqual({ x: 12, y: 7, width: 88, height: 22 });
  });
  it("rejects an empty drawing", () => {
    expect(() => inkBounds(new Uint8ClampedArray(400), 10, 10)).toThrow(expect.objectContaining({ problem: "empty" }));
  });
  const placement = { id: "p", pageIndex: 2, x: 0.8, y: 0.9, width: 0.2, height: 0.1 };
  it("keeps dragging within every page edge", () => {
    expect(movePlacement(placement, -1, 2)).toMatchObject({ x: 0, y: 0.9 });
    expect(movePlacement(placement, 2, -1)).toMatchObject({ x: 0.8, y: 0 });
  });
  it.each([{ width: 595, height: 842 }, { width: 842, height: 595 }])("preserves physical aspect ratio on portrait and rotated pages", (page) => {
    const image = { width: 500, height: 100 };
    const result = sizePlacement(placement, 2, image, page);
    expect(result.width * page.width / (result.height * page.height)).toBeCloseTo(5);
    expect(result.x + result.width).toBeLessThanOrEqual(1);
    expect(result.y + result.height).toBeLessThanOrEqual(1);
    expect(result.pageIndex).toBe(2);
  });
  it("bounds extremely tall signatures on the page", () => {
    const result = sizePlacement(placement, 0.3, { width: 1, height: 1600 }, { width: 600, height: 800 });
    expect(result.height).toBeLessThanOrEqual(1);
    expect(result.y + result.height).toBeLessThanOrEqual(1);
  });
});

function expectRotatedCornersInside(place: SignaturePlacement, page: PageSize) {
  const radians = (place.rotation ?? 0) * Math.PI / 180;
  const centerX = (place.x + place.width / 2) * page.width;
  const centerY = (place.y + place.height / 2) * page.height;
  for (const horizontal of [-0.5, 0.5]) for (const vertical of [-0.5, 0.5]) {
    const x = horizontal * place.width * page.width;
    const y = vertical * place.height * page.height;
    const cornerX = (centerX + x * Math.cos(radians) - y * Math.sin(radians)) / page.width;
    const cornerY = (centerY + x * Math.sin(radians) + y * Math.cos(radians)) / page.height;
    expect(cornerX).toBeGreaterThanOrEqual(-1e-9);
    expect(cornerX).toBeLessThanOrEqual(1 + 1e-9);
    expect(cornerY).toBeGreaterThanOrEqual(-1e-9);
    expect(cornerY).toBeLessThanOrEqual(1 + 1e-9);
  }

}

const pageShapes = [{ width: 595, height: 842 }, { width: 842, height: 595 }, { width: 320, height: 320 }];
const signatureAngles = [0, 1, 37, 89, 90, 135, 180, 223, 270, 359];
describe("rotated signature boundaries", () => {
  it.each(pageShapes)("fits all rotated corners without changing aspect ratio or enlarging on %j", (page) => {
    for (const rotation of signatureAngles) for (const [width, height] of [[0.8, 0.1], [0.1, 0.8], [1, 1]]) {
      for (const [x, y] of [[0, 0], [1 - width!, 1 - height!]]) {
        const original = { id: "edge", pageIndex: 2, x: x!, y: y!, width: width!, height: height!, rotation };
        const result = fitPlacement(original, page);
        expectRotatedCornersInside(result, page);
        expect(result.width / result.height).toBeCloseTo(original.width / original.height, 10);
        expect(result.width).toBeLessThanOrEqual(original.width);
        expect(result.height).toBeLessThanOrEqual(original.height);
        expect(result).toMatchObject({ id: "edge", pageIndex: 2, rotation });
        const twice = fitPlacement(result, page);
        for (const key of ["x", "y", "width", "height"] as const) expect(twice[key]).toBeCloseTo(result[key], 10);
      }
    }
  });

  it.each(pageShapes)("keeps rotated corners inside when dragged beyond any edge on %j", (page) => {
    for (const rotation of signatureAngles) {
      const original = fitPlacement({ id: "move", pageIndex: 0, x: 0.3, y: 0.4, width: 0.4, height: 0.1, rotation }, page);
      for (const [x, y] of [[-10, -10], [10, -10], [-10, 10], [10, 10], [0.4, 0.4]]) {
        const result = movePlacement(original, x!, y!, page);
        expectRotatedCornersInside(result, page);
        expect(result.width).toBeCloseTo(original.width, 10);
        expect(result.height).toBeCloseTo(original.height, 10);
        expect(result.rotation).toBe(rotation);
      }
    }
  });

  it.each(pageShapes)("keeps rotated corners inside and image proportions while resizing on %j", (page) => {
    for (const rotation of signatureAngles) for (const image of [{ width: 800, height: 100 }, { width: 100, height: 800 }]) {
      for (const width of [0.001, 0.3, 2]) {
        const result = sizePlacement({ id: "resize", pageIndex: 0, x: 0.95, y: 0.95, width: 0.04, height: 0.04, rotation }, width, image, page);
        expectRotatedCornersInside(result, page);
        expect(result.width * page.width / (result.height * page.height)).toBeCloseTo(image.width / image.height, 10);
        expect(result.rotation).toBe(rotation);
      }
    }
  });
});

describe("rotated signatures reach the page edges", () => {
  it.each(pageShapes)("allows the actual outline to touch each edge on %j", (page) => {
    for (const rotation of [37, 90, 135, 223, 270]) {
      const original = { id: "edge", pageIndex: 0, x: 0.3, y: 0.4, width: 0.4, height: 0.08, rotation };
      for (const [x, y, edge] of [[-2, 0.4, "left"], [2, 0.4, "right"], [0.3, -2, "top"], [0.3, 2, "bottom"]] as const) {
        const moved = movePlacement(original, x, y, page);
        expectRotatedCornersInside(moved, page);
        const bounds = signatureBounds(moved, page);
        const position = edge === "left" ? bounds.x : edge === "right" ? bounds.x + bounds.width : edge === "top" ? bounds.y : bounds.y + bounds.height;
        expect(position).toBeCloseTo(edge === "left" || edge === "top" ? 0 : 1, 10);
        expect(moved.width).toBeCloseTo(original.width, 10);
        expect(moved.height).toBeCloseTo(original.height, 10);
        if (edge === "left" && [90, 270].includes(rotation)) expect(moved.x).toBeLessThan(0);
      }
    }
  });

  it.each(pageShapes)("resizes around a stable center, including repeated shrink and grow, on %j", (page) => {
    for (const rotation of [0, 37, 90, 223, 270]) {
      const image = { width: 800, height: 100 };
      const height = 0.4 * image.height / image.width * page.width / page.height;
      const original = { id: "center", pageIndex: 0, x: 0.3, y: 0.5 - height / 2, width: 0.4, height, rotation };
      let result: SignaturePlacement = original;
      for (const width of [0.2, 0.4, 0.3, 0.4]) {
        result = sizePlacement(result, width, image, page);
        expectRotatedCornersInside(result, page);
        expect(result.x + result.width / 2).toBeCloseTo(0.5, 10);
        expect(result.y + result.height / 2).toBeCloseTo(0.5, 10);
      }
      expect(result.x).toBeCloseTo(original.x, 10);
      expect(result.y).toBeCloseTo(original.y, 10);
    }
  });
});

function physicalCorner(place: SignaturePlacement, page: PageSize, direction: -1 | 1) {
  const radians = (place.rotation ?? 0) * Math.PI / 180;
  const halfWidth = place.width * page.width / 2, halfHeight = place.height * page.height / 2;
  return {
    x: (place.x + place.width / 2) * page.width + direction * (halfWidth * Math.cos(radians) - halfHeight * Math.sin(radians)),
    y: (place.y + place.height / 2) * page.height + direction * (halfWidth * Math.sin(radians) + halfHeight * Math.cos(radians)),
  };
}

describe("signature corner resizing", () => {
  it.each(pageShapes)("tracks the diagonal and fixes the opposite corner at every angle on %j", (page) => {
    for (const rotation of signatureAngles) {
      const original = { id: "corner", pageIndex: 0, x: 0.4, y: 0.45, width: 0.2, height: 0.1, rotation };
      const anchor = physicalCorner(original, page, -1), handle = physicalCorner(original, page, 1);
      for (const scale of [0.5, 1, 1.5]) {
        const dx = (handle.x - anchor.x) * (scale - 1) / page.width;
        const dy = (handle.y - anchor.y) * (scale - 1) / page.height;
        const result = resizeFromCorner(original, dx, dy, page);
        const fixed = physicalCorner(result, page, -1), resized = physicalCorner(result, page, 1);
        expect(fixed.x).toBeCloseTo(anchor.x, 10);
        expect(fixed.y).toBeCloseTo(anchor.y, 10);
        expect(resized.x).toBeCloseTo(handle.x + dx * page.width, 10);
        expect(resized.y).toBeCloseTo(handle.y + dy * page.height, 10);
        expect(result.width / result.height).toBeCloseTo(original.width / original.height, 10);
        expectRotatedCornersInside(result, page);
      }
    }
  });

  it.each(pageShapes)("ignores perpendicular drift rather than changing scale with radial distance on %j", (page) => {
    for (const rotation of signatureAngles) {
      const original = { id: "corner", pageIndex: 0, x: 0.4, y: 0.45, width: 0.2, height: 0.1, rotation };
      const anchor = physicalCorner(original, page, -1), handle = physicalCorner(original, page, 1);
      const result = resizeFromCorner(original, -(handle.y - anchor.y) / page.width, (handle.x - anchor.x) / page.height, page);
      for (const key of ["x", "y", "width", "height"] as const) expect(result[key]).toBeCloseTo(original[key], 10);
    }
  });

  it.each(pageShapes)("stops at the page boundary without moving the anchor or jumping on pointer down on %j", (page) => {
    for (const rotation of signatureAngles) for (const [x, y] of [[-2, 0.4], [2, 0.4], [0.3, -2], [0.3, 2]]) {
      const original = movePlacement({ id: "edge", pageIndex: 0, x: 0.4, y: 0.45, width: 0.2, height: 0.1, rotation }, x!, y!, page);
      const anchor = physicalCorner(original, page, -1), handle = physicalCorner(original, page, 1);
      const still = resizeFromCorner(original, 0, 0, page);
      for (const key of ["x", "y", "width", "height"] as const) expect(still[key]).toBeCloseTo(original[key], 10);
      for (const scale of [-100, 100]) {
        const result = resizeFromCorner(original, (handle.x - anchor.x) * scale / page.width, (handle.y - anchor.y) * scale / page.height, page);
        const fixed = physicalCorner(result, page, -1);
        expect(fixed.x).toBeCloseTo(anchor.x, 10);
        expect(fixed.y).toBeCloseTo(anchor.y, 10);
        expectRotatedCornersInside(result, page);
        expect(result.width).toBeGreaterThan(0);
        expect(result.height).toBeGreaterThan(0);
        expect(result.width / result.height).toBeCloseTo(original.width / original.height, 10);
        if (scale > 0) {
          const bounds = signatureBounds(result, page);
          expect(Math.min(bounds.x, bounds.y, 1 - bounds.x - bounds.width, 1 - bounds.y - bounds.height)).toBeCloseTo(0, 10);
        }
      }
    }
  });
});

describe("bounded page preview", () => {
  it.each([{ width: 595, height: 842 }, { width: 842, height: 595 }, { width: 1, height: 1600 }])("limits raster dimensions and pixel count", (page) => {
    const width = previewWidth(page);
    expect(width).not.toBeNull();
    const height = Math.round(width! * page.height / page.width);
    expect(width!).toBeLessThanOrEqual(1200);
    expect(height).toBeLessThanOrEqual(1600);
    expect(width! * height).toBeLessThanOrEqual(1_500_000);
  });
  it.each([{ width: 1, height: 1601 }, { width: 0, height: 100 }, { width: Infinity, height: 1 }])("refuses unrenderable pages before allocation", (page) => {
    expect(previewWidth(page)).toBeNull();
  });
});
