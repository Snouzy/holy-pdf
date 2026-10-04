import type { EngineError } from "./types";

/** Thrown inside the engine; the worker turns it into a `Result`. */
export class EngineFailure extends Error {
  readonly error: EngineError;
  constructor(error: EngineError) {
    super(error.kind);
    this.error = error;
  }
}

/** `fatal`: PDFium aborted, so its memory can no longer be trusted and the worker must be replaced. */
export function failureOf(error: unknown): { error: EngineError; fatal: boolean } {
  if (error instanceof EngineFailure) return { error: error.error, fatal: false };
  if (error instanceof WebAssembly.RuntimeError) return { error: { kind: "outOfMemory" }, fatal: true };
  if (error instanceof RangeError) return { error: { kind: "outOfMemory" }, fatal: false };
  return { error: { kind: "damaged" }, fatal: false };
}
