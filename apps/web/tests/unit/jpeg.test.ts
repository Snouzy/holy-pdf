import { afterEach, describe, expect, it, vi } from "vitest";
import { encodeJpeg } from "../../src/engine/jpeg";

const photo = { width: 2, height: 2, pixels: new Uint8ClampedArray(16) };
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

afterEach(() => vi.unstubAllGlobals());

function browser(contexts: (object | null)[] = []) {
  const context = { putImageData: vi.fn(), drawImage: vi.fn(), isContextLost: vi.fn(() => false) };
  const convert = vi.fn(async () => new Blob([jpeg], { type: "image/jpeg" }));
  const canvases: { width: number; height: number }[] = [];
  const constructor = vi.fn(function (this: object, width: number, height: number) {
    const canvas = { width, height, getContext: () => contexts.length ? contexts.shift() : context, convertToBlob: convert };
    canvases.push(canvas);
    return canvas;
  });
  vi.stubGlobal("OffscreenCanvas", constructor);
  vi.stubGlobal("ImageData", vi.fn(function () {}));
  return { context, convert, canvases, constructor };
}

describe("encodeJpeg", () => {
  it("fails when the source canvas has no context instead of encoding a black photo", async () => {
    const b = browser([null]);
    await expect(encodeJpeg(photo, 2, 2, 0.8)).rejects.toMatchObject({ error: { kind: "outOfMemory" } });
    expect(b.convert).not.toHaveBeenCalled();
    expect(b.canvases[0]?.width).toBe(0);
  });

  it("fails when the resize canvas has no context", async () => {
    const b = browser([{ putImageData: vi.fn(), isContextLost: () => false }, null]);
    await expect(encodeJpeg(photo, 1, 1, 0.8)).rejects.toMatchObject({ error: { kind: "outOfMemory" } });
    expect(b.convert).not.toHaveBeenCalled();
    expect(b.canvases.every((canvas) => canvas.width === 0)).toBe(true);
  });

  it("fails when the browser loses the context during drawing", async () => {
    const b = browser();
    b.context.isContextLost.mockReturnValueOnce(false).mockReturnValueOnce(true);
    await expect(encodeJpeg(photo, 2, 2, 0.8)).rejects.toMatchObject({ error: { kind: "outOfMemory" } });
    expect(b.convert).not.toHaveBeenCalled();
  });

  it.each([[20_000, 1], [4001, 4000]])("rejects oversized inputs before allocating a canvas (%s × %s)", async (width, height) => {
    const b = browser();
    await expect(encodeJpeg({ ...photo, width, height }, 1, 1, 0.8)).rejects.toMatchObject({ error: { kind: "outOfMemory" } });
    expect(b.constructor).not.toHaveBeenCalled();
  });

  it("rejects oversized output dimensions before allocating a canvas", async () => {
    const b = browser();
    await expect(encodeJpeg(photo, 8000, 4000, 0.8)).rejects.toMatchObject({ error: { kind: "outOfMemory" } });
    expect(b.constructor).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.2, Infinity, NaN])("rejects invalid dimensions (%s)", async (width) => {
    const b = browser();
    await expect(encodeJpeg({ ...photo, width }, 2, 2, 0.8)).rejects.toMatchObject({ error: { kind: "damaged" } });
    expect(b.constructor).not.toHaveBeenCalled();
  });

  it("rejects incomplete pixel buffers", async () => {
    browser();
    await expect(encodeJpeg({ ...photo, pixels: new Uint8ClampedArray(4) }, 2, 2, 0.8)).rejects.toMatchObject({ error: { kind: "damaged" } });
  });

  it.each([new Blob([], { type: "image/jpeg" }), new Blob([jpeg], { type: "image/png" }), new Blob([new Uint8Array(4)], { type: "image/jpeg" })])("rejects empty, fallback or invalid encoded data", async (blob) => {
    const b = browser();
    b.convert.mockResolvedValue(blob);
    await expect(encodeJpeg(photo, 2, 2, 0.8)).rejects.toMatchObject({ error: { kind: "damaged" } });
  });

  it("encodes and frees both backing stores after a successful resize", async () => {
    const b = browser();
    expect(await encodeJpeg(photo, 1, 1, 0.8)).toEqual(jpeg);
    expect(b.context.putImageData).toHaveBeenCalledOnce();
    expect(b.context.drawImage).toHaveBeenCalledOnce();
    expect(b.canvases.every((canvas) => canvas.width === 0 && canvas.height === 0)).toBe(true);
  });

  it("encodes with source and resize contexts that do not expose isContextLost (WebKit)", async () => {
    const source = { putImageData: vi.fn() };
    const target = { drawImage: vi.fn() };
    const b = browser([source, target]);
    expect(await encodeJpeg(photo, 1, 1, 0.8)).toEqual(jpeg);
    expect(source.putImageData).toHaveBeenCalledOnce();
    expect(target.drawImage).toHaveBeenCalledOnce();
    expect(b.convert).toHaveBeenCalledOnce();
  });

  it("frees the canvas when browser encoding rejects", async () => {
    const b = browser();
    b.convert.mockRejectedValue(new Error("Encoding failed"));
    await expect(encodeJpeg(photo, 2, 2, 0.8)).rejects.toThrow("Encoding failed");
    expect(b.canvases[0]?.width).toBe(0);
  });
});
