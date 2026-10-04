import type { NamedBytes } from "../engine/types";

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
