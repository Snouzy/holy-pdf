import { EngineFailure, failureOf } from "./failure";
import { allowsObjectStreams } from "./compressionProfile";
import type { CompactOptions, CompactResult } from "./qpdf";
import type { CompactReply, CompactRequest } from "./qpdf.worker";

const timeoutMs = 120_000;
const maxBytes = 128 * 1024 * 1024;

/** QPDF is loaded only for compression and repair, in a child worker that never retains a heap between documents. */
export async function compactPdf(bytes: Uint8Array<ArrayBuffer>, options: CompactOptions = {}): Promise<Uint8Array<ArrayBuffer>> {
  if (!bytes.length) throw new EngineFailure({ kind: "damaged" });
  if (bytes.length > maxBytes) throw new EngineFailure({ kind: "outOfMemory" });
  const objectStreams = options.objectStreams ?? await allowsObjectStreams(bytes);
  const result = await inQpdfWorker(bytes, { objectStreams });
  if (result.repaired) console.warn("QPDF repaired recoverable PDF syntax while compacting the document.");
  return result.bytes.length < bytes.length ? result.bytes : bytes;
}

export async function repairPdf(bytes: Uint8Array<ArrayBuffer>, password: string): Promise<Uint8Array<ArrayBuffer>> {
  if (bytes.length > maxBytes) throw new EngineFailure({ kind: "outOfMemory" });
  return (await inQpdfWorker(bytes, { objectStreams: false, password, repair: true })).bytes;
}

async function inQpdfWorker(bytes: Uint8Array<ArrayBuffer>, options: CompactOptions): Promise<CompactResult> {
  let worker: Worker;
  try {
    worker = new Worker(new URL("./qpdf.worker.ts", import.meta.url), { type: "module" });
  } catch {
    throw new EngineFailure({ kind: "engineUnavailable" });
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new EngineFailure({ kind: "outOfMemory" })), timeoutMs);
      worker.onerror = () => {
        reject(new EngineFailure({ kind: "engineUnavailable" }));
      };
      worker.onmessageerror = () => reject(new EngineFailure({ kind: "damaged" }));
      worker.onmessage = ({ data }: MessageEvent<CompactReply>) => {
        if (!data.ok) reject(new EngineFailure(data.error));
        else resolve(data.result);
      };
      const copy = bytes.slice();
      worker.postMessage({ bytes: copy, options } satisfies CompactRequest, [copy.buffer]);
    });
  } catch (error) {
    throw new EngineFailure(failureOf(error).error);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    worker.terminate();
  }
}
