import { zipSync } from "fflate";
import type { NamedBytes } from "./types";

/** Stored, not compressed: PDF streams and JPEGs are compressed already. */
export function zipFiles(files: NamedBytes[]): Uint8Array<ArrayBuffer> {
  const zip = zipSync(Object.fromEntries(files.map((file) => [file.name, [file.bytes, { level: 0 }]])));
  // fflate types its output with ArrayBufferLike, but allocates a plain ArrayBuffer.
  return zip.buffer instanceof ArrayBuffer ? new Uint8Array(zip.buffer, zip.byteOffset, zip.byteLength) : zip.slice();
}
