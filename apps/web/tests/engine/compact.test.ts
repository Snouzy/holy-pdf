import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compactPdf } from "../../src/engine/compact";
import { allowsObjectStreams } from "../../src/engine/compressionProfile";
import type { CompactReply, CompactRequest } from "../../src/engine/qpdf.worker";

vi.mock("../../src/engine/compressionProfile", () => ({ allowsObjectStreams: vi.fn(async () => true) }));

class FakeWorker {
  static latest: FakeWorker;
  static sendError: Error | undefined;
  onmessage: ((event: MessageEvent<CompactReply>) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn((_request: CompactRequest, _transfer: Transferable[]) => { if (FakeWorker.sendError) throw FakeWorker.sendError; });
  constructor() { FakeWorker.latest = this; }
  reply(reply: CompactReply) { this.onmessage?.({ data: reply } as MessageEvent<CompactReply>); }
}

beforeEach(() => { vi.stubGlobal("Worker", FakeWorker); FakeWorker.sendError = undefined; vi.mocked(allowsObjectStreams).mockResolvedValue(true); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("disposable compaction worker", () => {
  it("automatically disables object streams when the document profile requires it", async () => {
    vi.mocked(allowsObjectStreams).mockResolvedValue(false);
    const input = new Uint8Array(100);
    const task = compactPdf(input);
    await Promise.resolve();
    expect(FakeWorker.latest.postMessage.mock.calls[0]?.[0].options.objectStreams).toBe(false);
    FakeWorker.latest.reply({ ok: true, result: { bytes: new Uint8Array(60), repaired: false } });
    await expect(task).resolves.toHaveLength(60);
  });

  it("transfers a copy, preserves the input and terminates the worker after success", async () => {
    const input = new Uint8Array(100);
    const task = compactPdf(input, { objectStreams: false });
    const worker = FakeWorker.latest;
    const sent = worker.postMessage.mock.calls[0]?.[0];
    expect(sent?.bytes).not.toBe(input);
    expect(sent?.options.objectStreams).toBe(false);
    worker.reply({ ok: true, result: { bytes: new Uint8Array(60), repaired: false } });
    expect((await task).length).toBe(60);
    expect(input.length).toBe(100);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("keeps the caller's input if compaction is not smaller", async () => {
    const input = new Uint8Array(100);
    const task = compactPdf(input, { objectStreams: true });
    FakeWorker.latest.reply({ ok: true, result: { bytes: new Uint8Array(100), repaired: false } });
    expect(await task).toBe(input);
  });

  it("terminates the worker on typed failures and permits a fresh retry", async () => {
    const first = compactPdf(new Uint8Array(100), { objectStreams: true });
    const failed = FakeWorker.latest;
    failed.reply({ ok: false, error: { kind: "engineUnavailable" } });
    await expect(first).rejects.toMatchObject({ error: { kind: "engineUnavailable" } });
    expect(failed.terminate).toHaveBeenCalledOnce();
    const second = compactPdf(new Uint8Array(100), { objectStreams: true });
    const replacement = FakeWorker.latest;
    expect(replacement).not.toBe(failed);
    replacement.reply({ ok: true, result: { bytes: new Uint8Array(20), repaired: false } });
    await expect(second).resolves.toHaveLength(20);
    expect(replacement.terminate).toHaveBeenCalledOnce();
  });

  it("terminates a crashed worker", async () => {
    const task = compactPdf(new Uint8Array(100), { objectStreams: true });
    FakeWorker.latest.onerror?.();
    await expect(task).rejects.toMatchObject({ error: { kind: "engineUnavailable" } });
    expect(FakeWorker.latest.terminate).toHaveBeenCalledOnce();
  });

  it("terminates a worker that exceeds the processing limit", async () => {
    vi.useFakeTimers();
    const task = compactPdf(new Uint8Array(100), { objectStreams: true });
    const rejection = expect(task).rejects.toMatchObject({ error: { kind: "outOfMemory" } });
    await vi.advanceTimersByTimeAsync(120_000);
    await rejection;
    expect(FakeWorker.latest.terminate).toHaveBeenCalledOnce();
  });

  it("cleans the worker and timer when transferring input fails", async () => {
    vi.useFakeTimers();
    FakeWorker.sendError = new RangeError("Allocation failed");
    const task = compactPdf(new Uint8Array(100), { objectStreams: true });
    await expect(task).rejects.toMatchObject({ error: { kind: "outOfMemory" } });
    expect(FakeWorker.latest.terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
