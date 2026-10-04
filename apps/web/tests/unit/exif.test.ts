import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { heicCaptureDay, jpegCaptureDay, jpegRotation } from "../../src/engine/exif";

function jpegWithOrientation(orientation: number, littleEndian: boolean): Uint8Array {
  const tiff = new DataView(new ArrayBuffer(26));
  tiff.setUint16(0, littleEndian ? 0x4949 : 0x4d4d);
  tiff.setUint16(2, 42, littleEndian);
  tiff.setUint32(4, 8, littleEndian);
  tiff.setUint16(8, 1, littleEndian);
  tiff.setUint16(10, 0x0112, littleEndian);
  tiff.setUint16(12, 3, littleEndian);
  tiff.setUint32(14, 1, littleEndian);
  tiff.setUint16(18, orientation, littleEndian);
  const exif = [0x45, 0x78, 0x69, 0x66, 0, 0, ...new Uint8Array(tiff.buffer)];
  const length = exif.length + 2;
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, length >> 8, length & 0xff, ...exif, 0xff, 0xda, 0, 2]);
}

describe("jpegRotation", () => {
  it("reads the rotation of a phone photo, in both byte orders", () => {
    expect(jpegRotation(jpegWithOrientation(6, true))).toBe(90);
    expect(jpegRotation(jpegWithOrientation(6, false))).toBe(90);
    expect(jpegRotation(jpegWithOrientation(3, true))).toBe(180);
    expect(jpegRotation(jpegWithOrientation(8, false))).toBe(270);
    expect(jpegRotation(jpegWithOrientation(1, true))).toBe(0);
  });

  it("returns 0 without EXIF, and for a truncated file", () => {
    expect(jpegRotation(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]))).toBe(0);
    expect(jpegRotation(jpegWithOrientation(6, true).subarray(0, 20))).toBe(0);
  });
});

/** A JPEG start with an EXIF block whose sub-directory holds DateTimeOriginal (0x9003). */
function withCaptureDate(text: string): Uint8Array {
  const tiff = new DataView(new ArrayBuffer(8 + 18 + 18 + 20));
  tiff.setUint16(0, 0x4d4d);
  tiff.setUint16(2, 42);
  tiff.setUint32(4, 8);
  tiff.setUint16(8, 1);
  tiff.setUint16(10, 0x8769);
  tiff.setUint16(12, 4);
  tiff.setUint32(14, 1);
  tiff.setUint32(18, 26);
  tiff.setUint16(26, 1);
  tiff.setUint16(28, 0x9003);
  tiff.setUint16(30, 2);
  tiff.setUint32(32, 20);
  tiff.setUint32(36, 44);
  [...text].forEach((char, index) => tiff.setUint8(44 + index, char.charCodeAt(0)));
  const segment = [0x45, 0x78, 0x69, 0x66, 0, 0, ...new Uint8Array(tiff.buffer)];
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, (segment.length + 2) >> 8, (segment.length + 2) & 0xff, ...segment, 0xff, 0xda]);
}

describe("jpegCaptureDay", () => {
  it("reads the day a photo was taken, and nothing from a JPEG without it", () => {
    expect(jpegCaptureDay(withCaptureDate("2026:09:18 10:21:07"))).toBe("2026-09-18");
    expect(jpegCaptureDay(new Uint8Array([0xff, 0xd8, 0xff, 0xda]))).toBeNull();
    expect(jpegCaptureDay(withCaptureDate("0000:00:00 00:00:00")), "a camera with no clock set").toBeNull();
  });
});

const privateHeic = new URL("../../../../fixtures-private/photos/IMG_7984.HEIC", import.meta.url).pathname;

describe("heicCaptureDay", () => {
  it.skipIf(!existsSync(privateHeic))("reads the day an iPhone photo was taken from its EXIF item", () => {
    expect(heicCaptureDay(readFileSync(privateHeic))).toMatch(/^2026-0\d-\d{2}$/);
  });

  it("finds nothing in a file that is not a HEIC", () => {
    expect(heicCaptureDay(new Uint8Array([0, 0, 0, 8, 0x66, 0x72, 0x65, 0x65]))).toBeNull();
  });
});
