import { describe, expect, it } from "vitest";
import { formatSize } from "../../src/board/size";

const fr = { kilo: "Ko", mega: "Mo" };
const en = { kilo: "KB", mega: "MB" };

describe("formatSize", () => {
  it("writes kilobytes without decimals", () => {
    expect(formatSize(184_320, "fr", fr)).toBe("184 Ko");
    expect(formatSize(184_320, "en", en)).toBe("184 KB");
  });

  it("writes megabytes with one decimal, in each language's style", () => {
    expect(formatSize(1_234_567, "fr", fr)).toBe("1,2 Mo");
    expect(formatSize(1_234_567, "en", en)).toBe("1.2 MB");
  });

  it("never says zero for a small file", () => {
    expect(formatSize(200, "en", en)).toBe("1 KB");
  });
});
