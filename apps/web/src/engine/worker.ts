import wasmUrl from "@embedpdf/pdfium/pdfium.wasm?url";
import { buildPdf } from "./build";
// A lazy helper chunk can import this worker entry and re-run its initialization in WebKit.
// QPDF itself remains lazy: compactPdf starts a separate worker only when it is called.
import { listBookmarks } from "./bookmarks";
import { compactPdf, repairPdf } from "./compact";
import { compressPdf } from "./compress";
import { closeDoc, type ImageInput, type OpenDoc, openImage, openPdf, reopenPdf } from "./documents";
import { applyEdits } from "./editOriginals";
import { EngineFailure, failureOf } from "./failure";
import { applyFieldEdits, fieldNamesOf } from "./formFields";
import { formOf } from "./forms";
import { extractImages, pagesToJpeg } from "./images";
import { encodeJpeg } from "./jpeg";
import { zipFiles } from "./output";
import { overlaid } from "./overlay";
import { type FontChars, fontCharsOf, pageFonts, pageObjects } from "./pageObjects";
import { textCounts } from "./pageText";
import { loadPdfium, type Pdfium } from "./pdfium";
import { pixelizePdf } from "./pixelize";
import { redactPdf } from "./redact";
import { openRepaired } from "./repair";
import { scanPdf } from "./scanPdf";
import type { EngineReply, EngineRequest, Progress, ProgressMessage, ReplyMessage, RequestMessage } from "./protocol";
import { type RenderedPage, renderLoaded, renderPage } from "./render";
import { signPdf } from "./sign";
import { transformPdf } from "./transform";
import { wordOf } from "./word";
import type { FieldEdit, NamedBytes, OriginalEdit } from "./types";

// Loading starts with the worker, so the engine is ready by the time a file is dropped.
const pdfium = loadPdfium({ url: wasmUrl });
const docs = new Map<string, OpenDoc>();

// Requests run one at a time, in arrival order: a close must not overtake the open it follows
// while that open still decodes a PNG.
let queue = Promise.resolve();
self.onmessage = ({ data }: MessageEvent<RequestMessage>) => {
  queue = queue.then(() => serve(data));
};

async function serve({ id, request }: RequestMessage): Promise<void> {
  let p: Pdfium;
  try {
    p = await pdfium;
  } catch {
    reply({ id, result: { ok: false, error: { kind: "engineUnavailable" } }, fatal: true });
    return;
  }
  try {
    const value = await handle(p, request, (progress) => self.postMessage({ id, progress } satisfies ProgressMessage));
    reply({ id, result: { ok: true, value }, fatal: false }, transferables(value));
  } catch (error) {
    if (!(error instanceof EngineFailure)) console.error(error);
    const { error: engineError, fatal } = failureOf(error);
    // Recreate the engine and reopen its documents after a dependency failed to load.
    reply({ id, result: { ok: false, error: engineError }, fatal: fatal || engineError.kind === "engineUnavailable" });
  }
}

function reply(message: ReplyMessage, transfer: Transferable[] = []): void {
  self.postMessage(message, { transfer });
}

function transferables(value: EngineReply): Transferable[] {
  if (value.type === "files") return value.files.map((file) => file.bytes.buffer);
  if (value.type === "zip") return [value.bytes.buffer];
  return [];
}

async function handle(p: Pdfium, request: EngineRequest, report: (progress: Progress) => void): Promise<EngineReply> {
  switch (request.type) {
    case "open": {
      const bytes = new Uint8Array(request.bytes);
      const doc =
        request.kind === "pdf"
          ? request.repair ? await openRepaired(p, bytes, request.password, repairPdf) : openPdf(p, bytes, request.password)
          : openImage(p, request.kind === "jpeg" ? { kind: "jpeg", bytes } : await decodePng(bytes));
      closeIfOpen(p, request.docId);
      docs.set(request.docId, doc);
      return { type: "open", sizes: doc.sizes };
    }
    case "thumbnail": {
      const doc = openDoc(request.docId);
      const edits = request.edits?.filter((edit) => edit.pageIndex === request.index) ?? [];
      const fields = request.fields?.filter((field) => field.pageIndex === request.index) ?? [];
      const page = edits.length > 0 || fields.length > 0 ? renderEdited(p, doc, request.index, request.width, edits, fontsFor(p, request.docId, edits), fields) : renderPage(p, doc, request.index, request.width);
      const canvas = new OffscreenCanvas(page.width, page.height);
      canvas.getContext("2d")?.putImageData(new ImageData(page.pixels, page.width, page.height), 0, 0);
      return { type: "thumbnail", image: await canvas.convertToBlob({ type: "image/jpeg", quality: 0.85 }) };
    }
    case "objects": {
      const edits = request.edits?.filter((edit) => edit.pageIndex === request.index) ?? [];
      return { type: "objects", result: pageObjects(p, openDoc(request.docId), request.index, edits, fontsFor(p, request.docId, edits), request.fields?.filter((field) => field.pageIndex === request.index) ?? []) };
    }
    case "fonts":
      return { type: "fonts", fonts: pageFonts(fontsOf(p, request.docId)) };
    case "fieldNames":
      return { type: "fieldNames", names: fieldNamesOf(p, openDoc(request.docId).handle) };
    case "textCounts": {
      const doc = docs.get(request.docId);
      if (!doc) throw new EngineFailure({ kind: "damaged" });
      return { type: "textCounts", counts: textCounts(p, doc.handle) };
    }
    case "bookmarks":
      return { type: "bookmarks", outline: listBookmarks(p, openDoc(request.docId).handle) };
    case "scanPdf":
      return { type: "files", files: [{ name: request.name, bytes: scanPdf(p, request.pages, request.title) }] };
    case "export": {
      const files: NamedBytes[] = [];
      for (const [index, plan] of request.plans.entries()) {
        files.push({ name: request.names[index] ?? `${index + 1}.pdf`, bytes: buildPdf(p, plan, docs) });
        report({ done: index + 1, total: request.plans.length });
      }
      return { type: "files", files };
    }
    case "compress": {
      const total = pageCount(request.docIds) + request.docIds.length;
      let done = 0;
      const files: NamedBytes[] = [];
      for (const [index, docId] of request.docIds.entries()) {
        const doc = openDoc(docId);
        // Any rewrite invalidates a digital signature, even when its fields remain visible.
        if (p.FPDF_GetSignatureCount(doc.handle) > 0) {
          files.push({ name: request.names[index] ?? `${index + 1}.pdf`, bytes: p.pdfium.HEAPU8.slice(doc.buffer, doc.buffer + doc.size) });
          done += doc.sizes.length + 1;
          report({ done, total });
          continue;
        }
        const bytes = await compressPdf(p, doc, request.level, encodeJpeg, () => report({ done: ++done, total }));
        files.push({ name: request.names[index] ?? `${index + 1}.pdf`, bytes: await compactPdf(bytes) });
        report({ done: ++done, total });
      }
      return { type: "files", files };
    }
    case "transform": {
      const files: NamedBytes[] = [];
      for (const [index, docId] of request.docIds.entries()) {
        const doc = openDoc(docId);
        const { op } = request;
        const bytes = op.kind === "pixelize" ? await pixelizePdf(p, doc, op.ppi, encodeJpeg)
          : op.kind === "redact" ? await redactPdf(p, doc, op.zones, encodeJpeg)
          : op.kind === "word" ? await wordOf(p, doc, encodeJpeg)
          : op.kind === "overlay" ? overlaid(p, doc, openDoc(op.layerId), op.under)
          : transformPdf(p, doc, op);
        files.push({ name: request.names[index] ?? `${index + 1}.pdf`, bytes });
        report({ done: index + 1, total: request.docIds.length });
      }
      return { type: "files", files };
    }
    case "sign":
      return { type: "files", files: [{ name: request.name, bytes: signPdf(p, openDoc(request.docId), request.image, request.placements, report, request.pageRotations, request.images) }] };
    case "images": {
      const total = pageCount(request.docIds);
      let done = 0;
      const seen = new Set<string>();
      const files: NamedBytes[] = [];
      for (const [index, docId] of request.docIds.entries()) {
        const doc = openDoc(docId);
        const prefix = request.prefixes[index] ?? `${index + 1}`;
        const onPage = () => report({ done: ++done, total });
        files.push(
          ...(request.mode === "pages"
            ? await pagesToJpeg(p, doc, prefix, request.quality, encodeJpeg, onPage)
            : await extractImages(p, doc, prefix, request.quality, encodeJpeg, seen, onPage)),
        );
      }
      if (files.length === 0) throw new EngineFailure({ kind: "noImages" });
      return { type: "files", files };
    }
    case "zip":
      return { type: "zip", bytes: zipFiles(request.files) };
    case "close":
      closeIfOpen(p, request.docId);
      return { type: "close" };
  }
}

/** The letters each font writes, once per document: scanning every page is only worth it once a text is corrected. */
const fontsCache = new Map<string, FontChars>();

const fontsFor = (p: Pdfium, docId: string, edits: OriginalEdit[]): FontChars => (edits.some((edit) => edit.text !== undefined) ? fontsOf(p, docId) : new Map());

function fontsOf(p: Pdfium, docId: string): FontChars {
  let fonts = fontsCache.get(docId);
  if (!fonts) {
    fonts = fontCharsOf(p, openDoc(docId).handle);
    fontsCache.set(docId, fonts);
  }
  return fonts;
}

function renderEdited(p: Pdfium, doc: OpenDoc, index: number, width: number, edits: OriginalEdit[], fonts: FontChars, fields: FieldEdit[]): RenderedPage {
  const copy = reopenPdf(p, doc);
  try {
    const page = p.FPDF_LoadPage(copy.handle, index);
    if (page === 0) throw new EngineFailure({ kind: "damaged" });
    try {
      applyEdits(p, copy.handle, page, index, edits, fonts);
      applyFieldEdits(p, copy.handle, page, fields);
      return renderLoaded(p, page, width, formOf(p, copy.handle));
    } finally {
      p.FPDF_ClosePage(page);
    }
  } finally {
    closeDoc(p, copy);
  }
}

function openDoc(docId: string): OpenDoc {
  const doc = docs.get(docId);
  if (!doc) throw new EngineFailure({ kind: "damaged" });
  return doc;
}

function pageCount(docIds: string[]): number {
  return docIds.reduce((total, docId) => total + (docs.get(docId)?.sizes.length ?? 0), 0);
}

function closeIfOpen(p: Pdfium, docId: string): void {
  fontsCache.delete(docId);
  const doc = docs.get(docId);
  if (!doc) return;
  closeDoc(p, doc);
  docs.delete(docId);
}

async function decodePng(bytes: Uint8Array<ArrayBuffer>): Promise<ImageInput> {
  const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext("2d");
  if (!context) throw new EngineFailure({ kind: "outOfMemory" });
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  return { kind: "rgba", width: canvas.width, height: canvas.height, pixels: data };
}
