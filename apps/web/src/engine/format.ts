import { failureOf } from "./failure";
import type { FileKind, Result } from "./types";

/** Readers accept a PDF header anywhere in the first 1024 bytes, after junk bytes. */
const FORMAT_HEAD_BYTES = 1024;

const jpegSignature = [0xff, 0xd8, 0xff];
const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function detectFormat(head: Uint8Array): FileKind | null {
  if (startsWith(head, jpegSignature)) return "jpeg";
  if (startsWith(head, pngSignature)) return "png";
  return new TextDecoder("latin1").decode(head.subarray(0, FORMAT_HEAD_BYTES)).includes("%PDF-") ? "pdf" : null;
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.length <= bytes.length && signature.every((byte, i) => bytes[i] === byte);
}

/** Never throws: a file the browser cannot read (a folder, a cloud placeholder) becomes an error. */
export async function readKind(file: Blob): Promise<Result<FileKind>> {
  try {
    const kind = detectFormat(new Uint8Array(await file.slice(0, FORMAT_HEAD_BYTES).arrayBuffer()));
    return kind ? { ok: true, value: kind } : { ok: false, error: { kind: "unsupportedFormat" } };
  } catch (error) {
    return { ok: false, error: failureOf(error).error };
  }
}

