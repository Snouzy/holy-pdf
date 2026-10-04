import { describe, expect, it } from "vitest";
import { createEngine, type EngineWorker } from "../../src/engine/client";
import type { EngineRequest, Progress, ReplyMessage, RequestMessage, WorkerMessage } from "../../src/engine/protocol";

type Answer = Omit<ReplyMessage, "id"> & { before?: Progress[] };
const a4 = { width: 595, height: 842 };

class FakeWorker implements EngineWorker {
  onmessage: ((event: MessageEvent<WorkerMessage>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  received: EngineRequest["type"][] = [];
  transferred: number[] = [];
  terminated = false;
  answer: (request: EngineRequest) => Answer | null;

  constructor(answer: (request: EngineRequest) => Answer | null) {
    this.answer = answer;
  }

  postMessage({ id, request }: RequestMessage, transfer: Transferable[]): void {
    this.received.push(request.type);
    this.transferred.push(transfer.length);
    const answer = this.answer(request);
    if (!answer) return;
    queueMicrotask(() => {
      for (const progress of answer.before ?? []) this.onmessage?.(new MessageEvent("message", { data: { id, progress } }));
      this.onmessage?.(new MessageEvent("message", { data: { id, result: answer.result, fatal: answer.fatal } }));
    });
  }

  terminate(): void {
    this.terminated = true;
  }
}

class FakeErrorEvent extends Event {
  message = "failed to load";
  filename = "";
  lineno = 0;
  colno = 0;
  error = null;
}

const opened: Answer = { result: { ok: true, value: { type: "open", sizes: [a4] } }, fatal: false };
const image = new Blob([new Uint8Array([0xff, 0xd8])], { type: "image/jpeg" });
const pdf = () => new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], "a.pdf");
const outOfMemory: Answer = { result: { ok: false, error: { kind: "outOfMemory" } }, fatal: true };

class FileThatFails extends File {
  reason: Error;
  constructor(reason: Error) {
    super([], "gone.pdf");
    this.reason = reason;
  }
  override arrayBuffer(): Promise<ArrayBuffer> {
    return Promise.reject(this.reason);
  }
}

describe("engine client", () => {
  it("signs with a bounded snapshot while retaining the UI pixels and forwarding progress", async () => {
    const bytes = new Uint8Array([1, 2]);
    const pixels = new Uint8ClampedArray(new ArrayBuffer(1000), 20, 4);
    pixels.set([30, 50, 70, 255]);
    const place = { id: "signature", pageIndex: 0, x: 0.1, y: 0.2, width: 0.3, height: 0.1, rotation: 32 };
    const rotations = { 0: 90 };
    const worker = new FakeWorker((request) => {
      expect(request.type).toBe("sign");
      if (request.type !== "sign") throw new Error("Expected signature request");
      expect(request.image.pixels).not.toBe(pixels);
      expect(request.image.pixels.buffer.byteLength).toBe(4);
      expect([...request.image.pixels]).toEqual([30, 50, 70, 255]);
      expect(request.placements[0]?.x).toBe(0.1);
      expect(request.placements[0]?.rotation).toBe(32);
      expect(request.pageRotations).toEqual({ 0: 90 });
      return { fatal: false, before: [{ done: 1, total: 1 }], result: { ok: true, value: { type: "files", files: [{ name: request.name, bytes }] } } };
    });
    const engine = createEngine(() => worker);
    const progress: Progress[] = [];
    const signing = engine.sign("a", { width: 1, height: 1, pixels }, [place], "signed.pdf", (step) => progress.push(step), rotations);
    pixels[0] = 200;
    place.x = 0.7;
    place.rotation = 150;
    rotations[0] = 270;
    expect(await signing).toEqual({ ok: true, value: [{ name: "signed.pdf", bytes }] });
    expect(worker.transferred).toEqual([1]);
    expect(pixels.byteLength).toBe(4);
    expect(progress).toEqual([{ done: 1, total: 1 }]);
  });

  it("rejects an oversized signature before starting a worker or copying its pixels", async () => {
    const engine = createEngine(() => { throw new Error("Must not start"); });
    expect(await engine.sign("a", { width: 1601, height: 1, pixels: new Uint8ClampedArray(6404) }, [], "a.pdf")).toEqual({ ok: false, error: { kind: "invalidSignature" } });
  });

  it("copies each referenced image once, excludes unused entries and transfers only snapshots", async () => {
    const first = { width: 1, height: 1, pixels: new Uint8ClampedArray([255, 0, 0, 255]) };
    const second = { width: 1, height: 1, pixels: new Uint8ClampedArray([0, 0, 255, 100]) };
    const places = [undefined, "draw", "text", "alias"].map((imageId, index) => ({ id: String(index), ...(imageId === undefined ? {} : { imageId }), pageIndex: 0, x: 0.1, y: 0.1, width: 0.2, height: 0.2 }));
    const worker = new FakeWorker((request) => {
      if (request.type !== "sign") throw new Error("Expected signature request");
      expect(Object.keys(request.images!)).toEqual(["draw", "text", "alias"]);
      expect(request.images!.draw).toBe(request.image);
      expect(request.images!.text).toBe(request.images!.alias);
      expect(request.image.pixels).toEqual(new Uint8ClampedArray([255, 0, 0, 255]));
      expect(request.images!.text!.pixels).toEqual(new Uint8ClampedArray([0, 0, 255, 100]));
      expect(request.placements.map(({ imageId }) => imageId)).toEqual([undefined, "draw", "text", "alias"]);
      return { fatal: false, result: { ok: true, value: { type: "files", files: [] } } };
    });
    const originalPost = worker.postMessage.bind(worker);
    worker.postMessage = (message, transfer) => {
      // The real Worker detaches these buffers. Simulate it to detect accidental UI transfers.
      originalPost(structuredClone(message, { transfer: transfer as ArrayBuffer[] }), transfer);
    };
    const engine = createEngine(() => worker);
    const signing = engine.sign("a", first, places, "signed.pdf", undefined, {}, { draw: first, text: second, alias: second, unused: { ...second, width: 1601 } });
    first.pixels[0] = 42;
    second.pixels[3] = 200;
    places[0]!.imageId = "changed";
    expect((await signing).ok).toBe(true);
    expect(worker.transferred).toEqual([2]);
    expect([...first.pixels]).toEqual([42, 0, 0, 255]);
    expect([...second.pixels]).toEqual([0, 0, 255, 200]);
  });

  it("rejects missing, inherited or invalid image references before starting a worker", async () => {
    const engine = createEngine(() => { throw new Error("Must not start"); });
    const image = { width: 1, height: 1, pixels: new Uint8ClampedArray(4) };
    const place = { id: "one", imageId: "text", pageIndex: 0, x: 0.1, y: 0.1, width: 0.2, height: 0.2 };
    for (const images of [{}, Object.create({ text: image }), { text: { ...image, pixels: new Uint8ClampedArray(0) } }]) {
      expect(await engine.sign("a", image, [place], "a.pdf", undefined, {}, images)).toEqual({ ok: false, error: { kind: "invalidSignature" } });
    }
  });

  it("does not copy an unplaced current image", async () => {
    const current = { width: 1, height: 1, pixels: new Uint8ClampedArray([0, 0, 0, 255]) };
    const placed = { width: 1, height: 1, pixels: new Uint8ClampedArray([255, 0, 0, 255]) };
    const worker = new FakeWorker((request) => {
      if (request.type !== "sign") throw new Error("Expected signature request");
      expect(Object.keys(request.images!)).toEqual(["placed"]);
      expect(request.image).toBe(request.images!.placed);
      return { fatal: false, result: { ok: true, value: { type: "files", files: [] } } };
    });
    const engine = createEngine(() => worker);
    expect((await engine.sign("a", current, [{ id: "one", imageId: "placed", pageIndex: 0, x: 0.1, y: 0.1, width: 0.2, height: 0.2 }], "a.pdf", undefined, {}, { current, placed })).ok).toBe(true);
    expect(worker.transferred).toEqual([1]);
  });

  it("rejects more than 16 megapixels of distinct referenced images before copying or starting a worker", async () => {
    const image = { width: 1000, height: 1000, pixels: new Uint8ClampedArray(4_000_000) };
    const images = Object.fromEntries(Array.from({ length: 17 }, (_, index) => [String(index), { ...image }]));
    const places = Object.keys(images).map((imageId) => ({ id: imageId, imageId, pageIndex: 0, x: 0.1, y: 0.1, width: 0.2, height: 0.2 }));
    const engine = createEngine(() => { throw new Error("Must not start"); });
    expect(await engine.sign("a", image, places, "a.pdf", undefined, {}, images)).toEqual({ ok: false, error: { kind: "invalidSignature" } });
  });

  it("opens a file and returns its page sizes", async () => {
    const engine = createEngine(() => new FakeWorker(() => opened));
    expect(await engine.open("a", pdf(), "pdf")).toEqual({ ok: true, value: [a4] });
  });

  it("replaces a crashed worker and reopens open files before the next request", async () => {
    const workers: FakeWorker[] = [];
    const engine = createEngine(() => {
      const worker = new FakeWorker((request) => {
        if (request.type === "open") return opened;
        if (request.type === "export") return { result: { ok: false, error: { kind: "outOfMemory" } }, fatal: true };
        return { result: { ok: true, value: { type: "thumbnail", image } }, fatal: false };
      });
      workers.push(worker);
      return worker;
    });
    await engine.open("a", pdf(), "pdf");
    expect(await engine.export([[{ docId: "a", index: 0, rotation: 0 }]], [])).toEqual({
      ok: false,
      error: { kind: "outOfMemory" },
    });
    expect(workers[0]?.terminated).toBe(true);
    expect((await engine.thumbnail("a", 0, 300)).ok).toBe(true);
    expect(workers[1]?.received).toEqual(["open", "thumbnail"]);
  });

  it("fails waiting requests when the worker cannot load, then tries a new worker", async () => {
    const workers: FakeWorker[] = [];
    const engine = createEngine(() => {
      const worker = new FakeWorker(() => (workers.length === 1 ? null : opened));
      workers.push(worker);
      return worker;
    });
    const waiting = engine.open("a", pdf(), "pdf");
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    workers[0]?.onerror?.(new FakeErrorEvent("error"));
    expect(await waiting).toEqual({ ok: false, error: { kind: "engineUnavailable" } });
    expect((await engine.open("a", pdf(), "pdf")).ok).toBe(true);
    expect(workers).toHaveLength(2);
  });

  it("does not reopen a closed file", async () => {
    const workers: FakeWorker[] = [];
    const engine = createEngine(() => {
      const worker = new FakeWorker((request) =>
        request.type === "export" ? { result: { ok: false, error: { kind: "outOfMemory" } }, fatal: true } : opened,
      );
      workers.push(worker);
      return worker;
    });
    await engine.open("a", pdf(), "pdf");
    engine.close("a");
    await engine.export([], []);
    await engine.open("b", pdf(), "pdf");
    expect(workers[1]?.received).toEqual(["open"]);
  });

  it("reports a file the browser cannot read, instead of throwing", async () => {
    const engine = createEngine(() => new FakeWorker(() => opened));
    expect(await engine.open("a", new FileThatFails(new DOMException("gone", "NotReadableError")), "pdf")).toEqual({
      ok: false,
      error: { kind: "damaged" },
    });
    expect(await engine.open("b", new FileThatFails(new RangeError("allocation failed")), "pdf")).toEqual({
      ok: false,
      error: { kind: "outOfMemory" },
    });
  });

  it("starts a clean worker when the one reopening files crashes too", async () => {
    const workers: FakeWorker[] = [];
    const engine = createEngine(() => {
      const second = workers.length === 1;
      const worker = new FakeWorker((request) => {
        if (second || request.type === "export") return outOfMemory;
        return request.type === "open" ? opened : { result: { ok: true, value: { type: "thumbnail", image } }, fatal: false };
      });
      workers.push(worker);
      return worker;
    });
    await engine.open("a", pdf(), "pdf");
    await engine.export([], []);
    expect((await engine.thumbnail("a", 0, 300)).ok).toBe(true);
    expect(workers[2]?.received).toEqual(["thumbnail"]);
  });

  it("closes a file in the worker when it was closed while still opening", async () => {
    const workers: FakeWorker[] = [];
    const engine = createEngine(() => {
      const worker = new FakeWorker((request) => (request.type === "export" ? outOfMemory : opened));
      workers.push(worker);
      return worker;
    });
    const opening = engine.open("x", pdf(), "pdf");
    engine.close("x");
    await opening;
    expect(workers[0]?.received).toEqual(["close", "open", "close"]);
    await engine.export([], []);
    await engine.open("y", pdf(), "pdf");
    expect(workers[1]?.received).toEqual(["open"]);
  });

  const made = { name: "a.pdf", bytes: new Uint8Array([1, 2, 3]) };

  it("passes the progress to the caller before the files", async () => {
    const engine = createEngine(
      () =>
        new FakeWorker((request) =>
          request.type === "export"
            ? { result: { ok: true, value: { type: "files", files: [made] } }, fatal: false, before: [{ done: 1, total: 2 }, { done: 2, total: 2 }] }
            : opened,
        ),
    );
    const seen: Progress[] = [];
    const result = await engine.export([[{ docId: "a", index: 0, rotation: 0 }]], ["a.pdf"], (progress) => seen.push(progress));
    expect(seen).toEqual([{ done: 1, total: 2 }, { done: 2, total: 2 }]);
    expect(result).toEqual({ ok: true, value: [made] });
  });

  it("copies the files it zips, so the page keeps them", async () => {
    const workers: FakeWorker[] = [];
    const engine = createEngine(() => {
      const worker = new FakeWorker(() => ({ result: { ok: true, value: { type: "zip", bytes: new Uint8Array([9]) } }, fatal: false }));
      workers.push(worker);
      return worker;
    });
    expect(await engine.zip([made, { ...made, name: "b.pdf" }])).toEqual({ ok: true, value: new Uint8Array([9]) });
    expect(workers[0]?.transferred).toEqual([0]);
  });
});
