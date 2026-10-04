import { describe, expect, it } from "vitest";
import { photoKind } from "../../src/scan/protocol";

const bytes = (...values: (number | string)[]) => Uint8Array.from(values.flatMap((value) => (typeof value === "string" ? [...value].map((char) => char.charCodeAt(0)) : [value])));

describe("photoKind", () => {
  it("knows a photo by its first bytes, whatever its name", () => {
    expect(photoKind(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpeg");
    expect(photoKind(bytes(0x89, "PNG", 0x0d, 0x0a))).toBe("png");
    expect(photoKind(bytes(0, 0, 0, 0x18, "ftypheic", 0, 0, 0, 0))).toBe("heic");
    expect(photoKind(bytes(0, 0, 0, 0x18, "ftypmif1", 0, 0, 0, 0))).toBe("heic");
    expect(photoKind(bytes("%PDF-1.7"))).toBeNull();
  });
});
