import { failureOf } from "./failure";
import { signatureImages } from "./signatureImages";
import type { EngineReply, EngineRequest, Progress, RequestMessage, WorkerMessage } from "./protocol";
import type { ScanPdfPage } from "./scanPdf";
import type { CompressLevel, EngineError, ExportPlan, FieldEdit, FileKind, ImageMode, ImageQuality, NamedBytes, OriginalEdit, Outline, PageFont, PageObjects, PageSize, Result, SignatureImage, SignaturePlacement, TransformOp } from "./types";

/** The part of `Worker` the client uses, so tests can pass a fake. */
export type EngineWorker = {
  postMessage(message: RequestMessage, transfer: Transferable[]): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<WorkerMessage>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
};

export type OnProgress = (progress: Progress) => void;

export type Engine = {
  /** Starts the worker early: PDFium takes a moment to download and compile. */
  warmUp(): void;
  /** `repair`: rebuild the PDF with qpdf before PDFium opens it; the open document is then the repaired copy. */
  open(docId: string, file: File, kind: FileKind, password?: string, repair?: boolean): Promise<Result<PageSize[]>>;
  /**
   * A JPEG: the browser drops decoded images that are off screen, a canvas would keep its pixels. With `edits`, the page
   * is drawn with those retouches of its own objects, on a copy.
   */
  thumbnail(docId: string, index: number, width: number, edits?: OriginalEdit[], fields?: FieldEdit[]): Promise<Result<Blob>>;
  /** The objects and the words of a page, as the reader sees it, retouched by `edits`. */
  objects(docId: string, index: number, edits?: OriginalEdit[], fields?: FieldEdit[]): Promise<Result<PageObjects>>;
  /** The fonts of the document, with the letters each one is sure to write. */
  fonts(docId: string): Promise<Result<Record<string, PageFont>>>;
  /** The full names of the document's form fields, one per widget. */
  fieldNames(docId: string): Promise<Result<string[]>>;
  /** One PDF of scanned pages. */
  scanPdf(pages: ScanPdfPage[], title: string, name: string): Promise<Result<NamedBytes[]>>;
  /** How many characters each page already holds. */
  textCounts(docId: string): Promise<Result<number[]>>;
  bookmarks(docId: string): Promise<Result<Outline>>;
  export(plans: ExportPlan[], names: string[], onProgress?: OnProgress): Promise<Result<NamedBytes[]>>;
  compress(docIds: string[], level: CompressLevel, names: string[], onProgress?: OnProgress): Promise<Result<NamedBytes[]>>;
  sign(docId: string, image: SignatureImage, placements: SignaturePlacement[], name: string, onProgress?: OnProgress, pageRotations?: Record<number, number>, images?: Record<string, SignatureImage>): Promise<Result<NamedBytes[]>>;
  images(docIds: string[], mode: ImageMode, quality: ImageQuality, prefixes: string[], onProgress?: OnProgress): Promise<Result<NamedBytes[]>>;
  transform(docIds: string[], op: TransformOp, names: string[], onProgress?: OnProgress): Promise<Result<NamedBytes[]>>;
  /** Copies the files instead of moving them: the page keeps them, to share or zip them again. */
  zip(files: NamedBytes[]): Promise<Result<Uint8Array<ArrayBuffer>>>;
  close(docId: string): void;
};

type OpenFile = { file: File; kind: FileKind; password: string; repair: boolean };

export function createEngine(makeWorker: () => EngineWorker): Engine {
  let current: { worker: EngineWorker; ready: Promise<void> } | null = null;
  let nextId = 1;
  const pending = new Map<number, { resolve: (result: Result<EngineReply>) => void; onProgress: OnProgress | undefined }>();
  const openFiles = new Map<string, OpenFile>();
  const closed = new Set<string>();

  function stop(error: EngineError): void {
    current?.worker.terminate();
    current = null;
    for (const { resolve } of pending.values()) resolve({ ok: false, error });
    pending.clear();
  }

  function post(worker: EngineWorker, request: EngineRequest, transfer: Transferable[] = [], onProgress?: OnProgress): Promise<Result<EngineReply>> {
    const id = nextId++;
    return new Promise((resolve) => {
      pending.set(id, { resolve, onProgress });
      worker.postMessage({ id, request }, transfer);
    });
  }

  async function postOpen(worker: EngineWorker, docId: string, open: OpenFile): Promise<Result<EngineReply>> {
    let bytes: ArrayBuffer;
    try {
      bytes = await open.file.arrayBuffer();
    } catch (error) {
      return { ok: false, error: failureOf(error).error };
    }
    return post(worker, { type: "open", docId, kind: open.kind, bytes, password: open.password, repair: open.repair }, [bytes]);
  }

  /**
   * A replacement worker reopens every open file before it serves anything else. A file that fails to
   * reopen is forgotten, so a file that crashes PDFium cannot crash every new worker in turn.
   */
  async function worker(): Promise<EngineWorker> {
    for (;;) {
      if (!current) {
        const started = makeWorker();
        started.onmessage = ({ data }) => {
          if ("progress" in data) {
            pending.get(data.id)?.onProgress?.(data.progress);
            return;
          }
          pending.get(data.id)?.resolve(data.result);
          pending.delete(data.id);
          if (data.fatal) stop(data.result.ok ? { kind: "outOfMemory" } : data.result.error);
        };
        started.onerror = () => stop({ kind: "engineUnavailable" });
        const reopened = [...openFiles].map(async ([docId, open]) => {
          if (!(await postOpen(started, docId, open)).ok) openFiles.delete(docId);
        });
        current = { worker: started, ready: Promise.all(reopened).then(() => undefined) };
      }
      const awaited = current;
      await awaited.ready;
      if (current === awaited) return awaited.worker;
    }
  }

  function close(docId: string): void {
    closed.add(docId);
    openFiles.delete(docId);
    if (current) void post(current.worker, { type: "close", docId });
  }

  async function files(request: EngineRequest, onProgress?: OnProgress, transfer: Transferable[] = []): Promise<Result<NamedBytes[]>> {
    const result = await post(await worker(), request, transfer, onProgress);
    if (!result.ok) return result;
    if (result.value.type !== "files") throw unexpected(result.value);
    return { ok: true, value: result.value.files };
  }

  return {
    warmUp() {
      void worker();
    },
    async open(docId, file, kind, password = "", repair = false) {
      const open = { file, kind, password, repair };
      const result = await postOpen(await worker(), docId, open);
      if (!result.ok) return result;
      if (result.value.type !== "open") throw unexpected(result.value);
      // Closed while its bytes were read and sent: the worker opened it anyway.
      if (closed.has(docId)) close(docId);
      else openFiles.set(docId, open);
      return { ok: true, value: result.value.sizes };
    },
    async thumbnail(docId, index, width, edits, fields) {
      const result = await post(await worker(), { type: "thumbnail", docId, index, width, ...(edits?.length ? { edits } : {}), ...(fields?.length ? { fields } : {}) });
      if (!result.ok) return result;
      if (result.value.type !== "thumbnail") throw unexpected(result.value);
      return { ok: true, value: result.value.image };
    },
    async objects(docId, index, edits, fields) {
      const result = await post(await worker(), { type: "objects", docId, index, ...(edits?.length ? { edits } : {}), ...(fields?.length ? { fields } : {}) });
      if (!result.ok) return result;
      if (result.value.type !== "objects") throw unexpected(result.value);
      return { ok: true, value: result.value.result };
    },
    async fonts(docId) {
      const result = await post(await worker(), { type: "fonts", docId });
      if (!result.ok) return result;
      if (result.value.type !== "fonts") throw unexpected(result.value);
      return { ok: true, value: result.value.fonts };
    },
    async fieldNames(docId) {
      const result = await post(await worker(), { type: "fieldNames", docId });
      if (!result.ok) return result;
      if (result.value.type !== "fieldNames") throw unexpected(result.value);
      return { ok: true, value: result.value.names };
    },
    scanPdf(pages, title, name) {
      return files({ type: "scanPdf", pages, title, name }, undefined, pages.map((page) => page.jpeg.buffer));
    },
    async textCounts(docId) {
      const result = await post(await worker(), { type: "textCounts", docId });
      if (!result.ok) return result;
      if (result.value.type !== "textCounts") throw unexpected(result.value);
      return { ok: true, value: result.value.counts };
    },
    async bookmarks(docId) {
      const result = await post(await worker(), { type: "bookmarks", docId });
      if (!result.ok) return result;
      if (result.value.type !== "bookmarks") throw unexpected(result.value);
      return { ok: true, value: result.value.outline };
    },
    export(plans, names, onProgress) {
      return files({ type: "export", plans, names }, onProgress);
    },
    images(docIds, mode, quality, prefixes, onProgress) {
      return files({ type: "images", docIds, mode, quality, prefixes }, onProgress);
    },
    compress(docIds, level, names, onProgress) {
      return files({ type: "compress", docIds, level, names }, onProgress);
    },
    transform(docIds, op, names, onProgress) {
      return files({ type: "transform", docIds, op: { ...op }, names }, onProgress);
    },
    async sign(docId, image, placements, name, onProgress, pageRotations = {}, images = {}) {
      const referenced = signatureImages(image, placements, images);
      if (!referenced) return { ok: false, error: { kind: "invalidSignature" } };
      // An exact-size copy also bounds structured cloning when pixels is a view of a larger buffer.
      const snapshots = new Map<SignatureImage, SignatureImage>();
      const snapshot = (selected: SignatureImage) => {
        let copy = snapshots.get(selected);
        if (!copy) {
          copy = { ...selected, pixels: selected.pixels.slice() };
          snapshots.set(selected, copy);
        }
        return copy;
      };
      const fallback = snapshot(referenced.get(undefined) ?? referenced.values().next().value!);
      const selectedImages: Record<string, SignatureImage> = Object.create(null);
      for (const [id, selected] of referenced) if (id !== undefined) selectedImages[id] = snapshot(selected);
      const transfer = [...snapshots.values()].map(({ pixels }) => pixels.buffer);
      return files({ type: "sign", docId, image: fallback, images: selectedImages, placements: placements.map((placement) => ({ ...placement })), name, pageRotations: { ...pageRotations } }, onProgress, transfer);
    },
    async zip(list) {
      const result = await post(await worker(), { type: "zip", files: list });
      if (!result.ok) return result;
      if (result.value.type !== "zip") throw unexpected(result.value);
      return { ok: true, value: result.value.bytes };
    },
    close,
  };
}

function unexpected(reply: EngineReply): Error {
  return new Error(`Unexpected engine reply: ${reply.type}`);
}
