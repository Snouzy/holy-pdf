import type { Detection } from "./detect";
import type { RenderMode } from "./enhance";
import type { Quad } from "./geometry";
import type { PageEdits } from "./pipeline";

export type PhotoKind = "jpeg" | "png" | "heic";
export type ScanFailure = "unsupported" | "unreadable" | "renderFailed" | "engineUnavailable";

/** `photo` is sent, and transferred, with each request: the worker keeps only the last decoded photos. */
export type ScanRequest = { pageId: string; photo: ArrayBuffer; kind: PhotoKind; edits: PageEdits; detection?: Detection | undefined; withPreview: boolean };

export type ScanResult = {
  detection: Detection; quad: Quad; quarterTurns: number; mode: RenderMode; keepWatermark: boolean;
  width: number; height: number; page: Blob; thumbnail: Blob;
  /** The photo as the correction view shows it, under its corners. */
  preview?: { image: Blob; width: number; height: number } | undefined;
};

export type ScanReply = { id: number } & ({ ok: true; value: ScanResult } | { ok: false; error: ScanFailure });

/** By the first bytes: a photo's name or type cannot be trusted, an iPhone may call a HEIC « .jpg ». */
export function photoKind(bytes: Uint8Array): PhotoKind | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  const box = String.fromCharCode(...bytes.slice(4, 12));
  if (box.startsWith("ftyp") && /^(heic|heix|hevc|heim|heis|mif1|msf1)$/.test(box.slice(4))) return "heic";
  return null;
}
