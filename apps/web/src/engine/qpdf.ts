import createQpdfCore, { type QpdfCore, type QpdfCoreOptions } from "@wasm-zoo/qpdf/qpdf-core.js";
import wasmUrl from "@wasm-zoo/qpdf/qpdf-core.wasm?url";
import { EngineFailure, failureOf } from "./failure";

/** `repair`: the rewritten file even when it is not smaller. */
export type CompactOptions = { objectStreams?: boolean; password?: string; repair?: boolean };
export type CompactResult = { bytes: Uint8Array<ArrayBuffer>; repaired: boolean };
export const maxCompactBytes = 128 * 1024 * 1024;

const input = "/input.pdf";
const endMark = new TextEncoder().encode("\n%%EOF\n");
const output = "/output.pdf";

/** Run once in a disposable worker: unloading its realm releases QPDF's WASM heap, not only its files. */
export async function runQpdf(
  bytes: Uint8Array<ArrayBuffer>,
  options: CompactOptions = {},
  factory: (options: QpdfCoreOptions) => Promise<QpdfCore> = createQpdfCore,
): Promise<CompactResult> {
  if (!bytes.length) throw new EngineFailure({ kind: "damaged" });
  if (bytes.length > maxCompactBytes) throw new EngineFailure({ kind: "outOfMemory" });
  let core: QpdfCore;
  const messages: string[] = [];
  try {
    core = await factory({ locateFile: () => wasmUrl, noInitialRun: true, print: () => {}, printErr: (line) => messages.push(line) });
  } catch {
    throw new EngineFailure({ kind: "engineUnavailable" });
  }
  try {
    // A file that ends right after an object, as one whose writer stopped before the xref table, loses that object
    // in qpdf's recovery ("EOF after endobj"). A comment after it keeps it, and readers skip comments.
    core.FS.writeFile(input, options.repair ? concat(bytes, endMark) : bytes);
    let status: number;
    try {
      const password = options.password ? [`--password=${options.password}`] : [];
      status = core.callMain([input, output, `--object-streams=${options.objectStreams === false ? "disable" : "generate"}`, "--compress-streams=y", ...password]);
    } catch (error) {
      if (error && typeof error === "object" && "status" in error && typeof error.status === "number") status = error.status;
      else throw error;
    }
    // QPDF exits 3 after producing a valid file with recoverable warnings, such as repaired xref offsets.
    if (status !== 0 && status !== 3) {
      const locked = messages.some((line) => line.includes("invalid password"));
      throw new EngineFailure({ kind: !locked ? "damaged" : options.password ? "wrongPassword" : "passwordRequired" });
    }
    const size = core.FS.stat(output).size;
    if (!Number.isSafeInteger(size) || size <= 0) throw new EngineFailure({ kind: "damaged" });
    if (size >= bytes.length && !options.repair) return { bytes, repaired: status === 3 };
    const compacted = new Uint8Array(core.FS.readFile(output));
    const head = new TextDecoder().decode(compacted.subarray(0, 8));
    const tail = new TextDecoder().decode(compacted.subarray(Math.max(0, compacted.length - 64))).trimEnd();
    if (compacted.length !== size || !head.startsWith("%PDF-") || !tail.endsWith("%%EOF")) throw new EngineFailure({ kind: "damaged" });
    return { bytes: compacted, repaired: status === 3 };
  } catch (error) {
    throw new EngineFailure(failureOf(error).error);
  } finally {
    for (const path of [input, output]) {
      try { core.FS.unlink(path); } catch { /* A failed CLI invocation may not have created the output. */ }
    }
  }
}

function concat(first: Uint8Array, second: Uint8Array): Uint8Array {
  const joined = new Uint8Array(first.length + second.length);
  joined.set(first);
  joined.set(second, first.length);
  return joined;
}
