import { init, type WrappedPdfiumModule } from "@embedpdf/pdfium";
import { EngineFailure } from "./failure";

export type Pdfium = WrappedPdfiumModule;

export async function loadPdfium(wasm: { url: string } | { bytes: ArrayBuffer }): Promise<Pdfium> {
  const pdfium = await init("url" in wasm ? { locateFile: () => wasm.url } : { wasmBinary: wasm.bytes });
  pdfium.PDFiumExt_Init();
  return pdfium;
}

export function malloc(p: Pdfium, size: number): number {
  const pointer = p.pdfium._malloc(size);
  if (pointer === 0) throw new EngineFailure({ kind: "outOfMemory" });
  return pointer;
}

/** Read `HEAPU8` again after every allocation: memory growth replaces the view. */
export function copyIn(p: Pdfium, bytes: Uint8Array): number {
  const pointer = malloc(p, bytes.length);
  p.pdfium.HEAPU8.set(bytes, pointer);
  return pointer;
}
