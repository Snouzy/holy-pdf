import type { NamedBytes } from "../engine/types";
import { download } from "./download";

export type Delivery = "one" | "share" | "zip";

export type Device = { coarsePointer: boolean; canShare: ((data: ShareData) => boolean) | undefined };

/** Several files go to the share sheet on a touch screen that can share them, and into a `.zip` everywhere else. */
export function deliveryOf(count: number, type: string, device: Device): Delivery {
  if (count === 1) return "one";
  if (!device.coarsePointer || !device.canShare) return "zip";
  return device.canShare({ files: [new File([], "probe", { type })] }) ? "share" : "zip";
}

export function thisDevice(): Device {
  return {
    coarsePointer: matchMedia("(pointer: coarse)").matches,
    canShare: "canShare" in navigator ? (data) => navigator.canShare(data) : undefined,
  };
}

/** False when the share sheet could not open: the caller zips instead. A sheet closed without a choice is not a failure. */
export async function shareFiles(
  files: NamedBytes[],
  type: string,
  send: (data: ShareData) => Promise<void> = (data) => navigator.share(data),
): Promise<boolean> {
  try {
    await send({ files: files.map((file) => new File([file.bytes], file.name, { type })) });
    return true;
  } catch (error) {
    return error instanceof DOMException && error.name === "AbortError";
  }
}

export type SaveOutcome = { kind: "saved"; path: string } | { kind: "downloaded" } | { kind: "cancelled" };

/** Where a result goes: the browser's download on the site, a native dialog in the desktop shell. The buttons say which. */
export type Saver = {
  kind: "download" | "save";
  platform?: "mac" | "windows" | "linux";
  save(bytes: Uint8Array<ArrayBuffer>, name: string, type: string): Promise<SaveOutcome>;
  /** « Voir » before saving: a new tab on the site, the system's viewer in the desktop shell. */
  preview?(bytes: Uint8Array<ArrayBuffer>, name: string, type: string): Promise<void>;
  open?(path: string): Promise<void>;
  reveal?(path: string): Promise<void>;
};

export type Confirm = (message: string, labels: { cancel: string; confirm: string }) => Promise<boolean>;

export const downloader: Saver = {
  kind: "download",
  async save(bytes, name, type) {
    download(bytes, name, type);
    return { kind: "downloaded" };
  },
  async preview(bytes, _name, type) {
    const url = URL.createObjectURL(new Blob([bytes], { type }));
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
};
