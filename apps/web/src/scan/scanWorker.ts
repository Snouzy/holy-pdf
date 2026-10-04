import { type CV, type Mat, matOf, type Rgba } from "./cv";
import { fitted, maxPhotoSide, scanPage } from "./pipeline";
import type { ScanFailure, ScanReply, ScanRequest, ScanResult } from "./protocol";

type Libheif = { HeifDecoder: new () => { decode(bytes: Uint8Array): HeifImage[] } };
type HeifImage = { get_width(): number; get_height(): number; display(target: ImageData, done: (shown: ImageData | null) => void): void };

let opencv: Promise<CV> | undefined;
let heif: Promise<Libheif> | undefined;
/** The last decoded photos: a corner moved twice does not decode its photo twice. */
const photos = new Map<string, Mat>();
const keptPhotos = 2;

/** Run as a classic script, the way it was built: it sets `globalThis.cv` to a promise of the module. */
async function script(path: string, exported: string): Promise<unknown> {
  const response = await fetch(new URL(path, self.location.origin));
  if (!response.ok) throw new Error(path);
  return new Function(`${await response.text()}\nreturn typeof ${exported} === "undefined" ? undefined : ${exported};`)();
}

function loadOpenCv(): Promise<CV> {
  opencv ??= script("/scan/opencv.js", "globalThis.cv").then(async (module) => (await module) as CV);
  return opencv;
}

function loadHeif(): Promise<Libheif> {
  heif ??= (async () => {
    const [factory, wasm] = await Promise.all([script("/scan/libheif.js", "libheif"), fetch(new URL("/scan/libheif.wasm", self.location.origin)).then((response) => response.arrayBuffer())]);
    return (factory as (options: { wasmBinary: ArrayBuffer }) => Promise<Libheif>)({ wasmBinary: wasm });
  })();
  return heif;
}

async function decode(request: ScanRequest): Promise<Rgba> {
  if (request.kind === "heic") {
    const [image] = new (await loadHeif()).HeifDecoder().decode(new Uint8Array(request.photo));
    if (!image) throw failure("unreadable");
    const target = new ImageData(image.get_width(), image.get_height());
    const shown = await new Promise<ImageData | null>((resolve) => image.display(target, resolve));
    if (!shown) throw failure("unreadable");
    return { pixels: shown.data, width: shown.width, height: shown.height };
  }
  const bitmap = await createImageBitmap(new Blob([request.photo]), { imageOrientation: "from-image" }).catch(() => {
    throw failure("unreadable");
  });
  const factor = Math.min(1, maxPhotoSide / Math.max(bitmap.width, bitmap.height));
  const [width, height] = [Math.max(1, Math.round(bitmap.width * factor)), Math.max(1, Math.round(bitmap.height * factor))];
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) throw failure("renderFailed");
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const { data } = context.getImageData(0, 0, width, height);
  return { pixels: data, width, height };
}

async function photoFor(cv: CV, request: ScanRequest): Promise<Mat> {
  const known = photos.get(request.pageId);
  if (known) {
    photos.delete(request.pageId);
    photos.set(request.pageId, known);
    return known;
  }
  const decoded = matOf(cv, await decode(request));
  const photo = fitted(cv, decoded);
  decoded.delete();
  photos.set(request.pageId, photo);
  for (const [pageId, old] of photos) {
    if (photos.size <= keptPhotos) break;
    old.delete();
    photos.delete(pageId);
  }
  return photo;
}

async function jpeg(cv: CV, image: Mat, longest: number, quality: number): Promise<Blob> {
  const factor = Math.min(1, longest / Math.max(image.cols, image.rows));
  const small = new cv.Mat();
  cv.resize(image, small, new cv.Size(Math.max(1, Math.round(image.cols * factor)), Math.max(1, Math.round(image.rows * factor))), 0, 0, cv.INTER_AREA);
  const canvas = new OffscreenCanvas(small.cols, small.rows);
  canvas.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(small.data), small.cols, small.rows), 0, 0);
  small.delete();
  return canvas.convertToBlob({ type: "image/jpeg", quality });
}

const failure = (kind: ScanFailure) => Object.assign(new Error(kind), { kind });

async function handle(request: ScanRequest): Promise<ScanResult> {
  const cv = await loadOpenCv().catch(() => {
    opencv = undefined;
    throw failure("engineUnavailable");
  });
  const photo = await photoFor(cv, request);
  const scanned = scanPage(cv, photo, request.edits, request.detection);
  if (!scanned) throw failure("renderFailed");
  try {
    // JPEG 0.8 in a browser is libjpeg's 80: the quality the prototype and algorithm.md mean.
    const [page, thumbnail, preview] = await Promise.all([
      jpeg(cv, scanned.image, Number.POSITIVE_INFINITY, 0.8),
      jpeg(cv, scanned.image, 360, 0.8),
      request.withPreview ? jpeg(cv, photo, 1600, 0.85) : undefined,
    ]);
    const previewSize = Math.min(1, 1600 / Math.max(photo.cols, photo.rows));
    return {
      detection: scanned.detection, quad: scanned.quad, quarterTurns: scanned.quarterTurns, mode: scanned.mode, keepWatermark: scanned.keepWatermark,
      width: scanned.image.cols, height: scanned.image.rows, page, thumbnail,
      preview: preview && { image: preview, width: Math.round(photo.cols * previewSize), height: Math.round(photo.rows * previewSize) },
    };
  } finally {
    scanned.image.delete();
  }
}

self.onmessage = async ({ data }: MessageEvent<{ id: number; request: ScanRequest }>) => {
  let reply: ScanReply;
  try {
    reply = { id: data.id, ok: true, value: await handle(data.request) };
  } catch (error) {
    const kind = (error as { kind?: ScanFailure }).kind;
    reply = { id: data.id, ok: false, error: kind ?? (error instanceof WebAssembly.RuntimeError || error instanceof RangeError ? "renderFailed" : "unreadable") };
  }
  self.postMessage(reply);
};
