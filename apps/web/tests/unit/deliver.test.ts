import { describe, expect, it, vi } from "vitest";
import { deliveryOf, downloader, shareFiles } from "../../src/board/deliver";
import { download } from "../../src/board/download";

const shares = (answer: boolean) => {
  const asked: ShareData[] = [];
  const canShare = (data: ShareData) => {
    asked.push(data);
    return answer;
  };
  return { asked, canShare };
};

describe("deliveryOf", () => {
  it("hands one file over as it is", () => {
    expect(deliveryOf(1, "image/jpeg", { coarsePointer: true, canShare: () => true })).toBe("one");
  });

  it("zips several files on a computer", () => {
    expect(deliveryOf(3, "image/jpeg", { coarsePointer: false, canShare: () => true })).toBe("zip");
  });

  it("zips when the browser cannot share files", () => {
    expect(deliveryOf(3, "image/jpeg", { coarsePointer: true, canShare: undefined })).toBe("zip");
    expect(deliveryOf(3, "image/jpeg", { coarsePointer: true, canShare: shares(false).canShare })).toBe("zip");
  });

  it("shares several files on a touch screen, after asking about a file of their type", () => {
    const device = shares(true);
    expect(deliveryOf(3, "application/pdf", { coarsePointer: true, canShare: device.canShare })).toBe("share");
    expect(device.asked[0]?.files?.[0]?.type).toBe("application/pdf");
  });
});

describe("shareFiles", () => {
  const files = [{ name: "a-1.jpg", bytes: new Uint8Array([1]) }, { name: "a-2.jpg", bytes: new Uint8Array([2]) }];

  it("sends every file, with its name and type", async () => {
    let sent: ShareData | undefined;
    expect(await shareFiles(files, "image/jpeg", async (data) => void (sent = data))).toBe(true);
    expect(sent?.files?.map((file) => [file.name, file.type])).toEqual([["a-1.jpg", "image/jpeg"], ["a-2.jpg", "image/jpeg"]]);
  });

  it("counts a closed share sheet as done", async () => {
    expect(await shareFiles(files, "image/jpeg", () => Promise.reject(new DOMException("closed", "AbortError")))).toBe(true);
  });

  it("reports a share sheet that could not open, so the caller zips", async () => {
    expect(await shareFiles(files, "image/jpeg", () => Promise.reject(new DOMException("no", "NotAllowedError")))).toBe(false);
    expect(await shareFiles(files, "image/jpeg", () => Promise.reject(new TypeError("no files")))).toBe(false);
  });
});

vi.mock("../../src/board/download", () => ({ download: vi.fn() }));

describe("downloader", () => {
  it("downloads the bytes and says so", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    await expect(downloader.save(bytes, "a.pdf", "application/pdf")).resolves.toEqual({ kind: "downloaded" });
    expect(download).toHaveBeenCalledWith(bytes, "a.pdf", "application/pdf");
    expect(downloader.kind).toBe("download");
  });
});
