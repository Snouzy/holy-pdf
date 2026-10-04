import { createWorker, OEM, type Worker } from "tesseract.js";

/** French, English, and Romanian for the Scanner: the reference batch is Romanian. */
export type Language = "fra" | "eng" | "ron";

/**
 * A Tesseract worker on the files the site serves itself (`public/ocr/`): no request leaves for another server, and the
 * language data is downloaded once.
 */
export function tesseractWorker(languages: Language[]): Promise<Worker> {
  // Tesseract's worker rejects a path without its origin.
  const at = (path: string) => new URL(path, location.origin).href;
  return createWorker(languages, OEM.LSTM_ONLY, {
    workerPath: at("/ocr/worker.min.js"),
    corePath: at("/ocr/core"),
    langPath: at("/ocr/lang"),
    workerBlobURL: false,
    // Without it, a failed page also throws out of the promise; the promise alone carries the failure.
    errorHandler: () => {},
  });
}
