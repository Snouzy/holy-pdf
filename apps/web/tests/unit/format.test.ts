import { describe, expect, it } from "vitest";
import { detectFormat, readKind } from "../../src/engine/format";

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (value: string) => new TextEncoder().encode(value);

describe("detectFormat", () => {
  it("detects a PDF at the start", () => {
    expect(detectFormat(text("%PDF-1.7\n"))).toBe("pdf");
  });

  it("detects a PDF header after junk bytes", () => {
    expect(detectFormat(text("\r\n\r\ngarbage%PDF-1.4\n"))).toBe("pdf");
  });

  it("detects JPEG and PNG", () => {
    expect(detectFormat(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpeg");
    expect(detectFormat(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe("png");
  });

  it("rejects a PDF renamed from a text file, and an empty file", () => {
    expect(detectFormat(text("hello, this is not a PDF"))).toBeNull();
    expect(detectFormat(new Uint8Array())).toBeNull();
  });

  it("rejects HEIC", () => {
    expect(detectFormat(bytes(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63))).toBeNull();
  });
});

describe("readKind", () => {
  it("reads the kind of a file from its first bytes", async () => {
    expect(await readKind(new Blob(["%PDF-1.7\n"]))).toEqual({ ok: true, value: "pdf" });
    expect(await readKind(new Blob(["plain text"]))).toEqual({ ok: false, error: { kind: "unsupportedFormat" } });
  });

  it("reports a file the browser cannot read instead of throwing", async () => {
    const unreadable = new Blob(["%PDF-"]);
    unreadable.slice = () => {
      const part = new Blob();
      part.arrayBuffer = () => Promise.reject(new DOMException("gone", "NotReadableError"));
      return part;
    };
    expect(await readKind(unreadable)).toEqual({ ok: false, error: { kind: "damaged" } });
  });
});
