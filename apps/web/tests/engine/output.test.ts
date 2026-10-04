import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { zipFiles } from "../../src/engine/output";

describe("zipFiles", () => {
  it("stores every file under its name", () => {
    const zip = zipFiles([
      { name: "a-1.pdf", bytes: new Uint8Array([1, 2]) },
      { name: "a-2.pdf", bytes: new Uint8Array([3]) },
    ]);
    const files = unzipSync(zip);
    expect(Object.keys(files)).toEqual(["a-1.pdf", "a-2.pdf"]);
    expect([...(files["a-2.pdf"] ?? [])]).toEqual([3]);
  });
});
