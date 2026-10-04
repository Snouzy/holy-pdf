import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizedSignatureText } from "../../src/signature/typedText";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe("typed signature text", () => {
  it("normalizes accents and line breaks without truncating a Unicode code point", () => {
    expect(normalizedSignatureText("  Lu et approuve\u0301\nA.B. \t ")).toBe("Lu et approuvé A.B.");
    expect(normalizedSignatureText("É".repeat(119) + "😀extra")).toBe("É".repeat(119) + "😀");
    expect(normalizedSignatureText(" \n\t ")).toBe("");
  });

  it("waits for the actual local font and retries after a rejected download", async () => {
    const { loadSignatureTextFont } = await import("../../src/signature/typedText");
    let finish: ((value: object) => void) | undefined;
    const face = { status: "loaded" };
    const load = vi.fn().mockRejectedValueOnce(new Error("network")).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const create = vi.fn();
    const add = vi.fn();
    vi.stubGlobal("FontFace", class { constructor(...args: unknown[]) { create(...args); } load = load; });
    vi.stubGlobal("document", { fonts: { add } });
    await expect(loadSignatureTextFont("handwritten")).rejects.toThrow("network");
    const pending = loadSignatureTextFont("handwritten");
    expect(add).not.toHaveBeenCalled();
    finish?.(face);
    await pending;
    await loadSignatureTextFont("handwritten");
    expect(load).toHaveBeenCalledTimes(2);
    expect(add).toHaveBeenCalledExactlyOnceWith(face);
    expect(create.mock.calls.every((call) => String(call[1]).startsWith('url("/fonts/signature/'))).toBe(true);
  });

  it("draws the simple style with the page's own font when the site font could not load", async () => {
    const { loadSignatureTextFont } = await import("../../src/signature/typedText");
    const load = vi.fn().mockRejectedValueOnce(new Error("NetworkError")).mockResolvedValueOnce([{ status: "error" }]).mockResolvedValueOnce([]);
    vi.stubGlobal("document", { fonts: { load } });
    await expect(loadSignatureTextFont("simple")).resolves.toBeUndefined();
    await expect(loadSignatureTextFont("simple")).resolves.toBeUndefined();
    await expect(loadSignatureTextFont("simple")).resolves.toBeUndefined();
  });
});
