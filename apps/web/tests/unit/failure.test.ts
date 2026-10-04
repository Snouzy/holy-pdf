import { describe, expect, it } from "vitest";
import { EngineFailure, failureOf } from "../../src/engine/failure";

describe("failureOf", () => {
  it("keeps the error an engine failure carries", () => {
    expect(failureOf(new EngineFailure({ kind: "wrongPassword" }))).toEqual({ error: { kind: "wrongPassword" }, fatal: false });
  });

  it("treats a PDFium abort as fatal lack of memory", () => {
    expect(failureOf(new WebAssembly.RuntimeError("Aborted()"))).toEqual({ error: { kind: "outOfMemory" }, fatal: true });
  });

  it("treats a failed JavaScript allocation as lack of memory, not as a damaged file", () => {
    expect(failureOf(new RangeError("Array buffer allocation failed"))).toEqual({ error: { kind: "outOfMemory" }, fatal: false });
  });

  it("treats anything else as a file that cannot be read", () => {
    expect(failureOf(new DOMException("gone", "NotReadableError"))).toEqual({ error: { kind: "damaged" }, fatal: false });
  });
});
