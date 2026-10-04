import { failureOf } from "./failure";
import { runQpdf, type CompactOptions, type CompactResult } from "./qpdf";
import type { EngineError } from "./types";

export type CompactRequest = { bytes: Uint8Array<ArrayBuffer>; options: CompactOptions };
export type CompactReply = { ok: true; result: CompactResult } | { ok: false; error: EngineError };

self.onmessage = async ({ data }: MessageEvent<CompactRequest>) => {
  try {
    const result = await runQpdf(data.bytes, data.options);
    self.postMessage({ ok: true, result } satisfies CompactReply, { transfer: [result.bytes.buffer] });
  } catch (error) {
    self.postMessage({ ok: false, error: failureOf(error).error } satisfies CompactReply);
  } finally {
    self.close();
  }
};
