import type { EngineError, NamedBytes } from "../engine/types";
import type { ToolId } from "../tools";
import type { Board } from "./state";

/** What the tool made. It stays in memory until the visitor starts over or changes the board. */
export const docxType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type Made = {
  files: NamedBytes[];
  /** The name of the `.zip` that holds the files, when there are several and the device zips them. */
  zipName: string;
  type: "application/pdf" | "image/jpeg" | typeof docxType;
  /** The number the result's title says: parts, pages, images or percent saved, by tool. */
  count: number;
  before: number;
  after: number;
  /** Pages of the one PDF made, 0 when that is not the proof to show. */
  pages: number;
};

export type Flow =
  | { step: "setup"; error: EngineError | null }
  | { step: "working"; done: number; total: number }
  | { step: "result"; made: Made };

export type FlowEvent =
  | { type: "started" }
  | { type: "progressed"; done: number; total: number }
  | { type: "finished"; made: Made }
  | { type: "failed"; error: EngineError }
  | { type: "back" }
  | { type: "edited" };

export const setup: Flow = { step: "setup", error: null };

export function advance(flow: Flow, event: FlowEvent): Flow {
  switch (event.type) {
    case "started":
      return { step: "working", done: 0, total: 1 };
    case "progressed":
      return flow.step === "working" ? { step: "working", done: event.done, total: event.total } : flow;
    case "finished":
      return flow.step === "working" ? { step: "result", made: event.made } : flow;
    case "failed":
      return { step: "setup", error: event.error };
    case "back":
    case "edited":
      return flow.step === "working" ? flow : setup;
  }
}

export function percentDone(flow: Flow): number {
  return flow.step === "working" && flow.total > 0 ? Math.round((flow.done / flow.total) * 100) : 0;
}

/** The percent saved, 0 when the files did not get smaller. */
export function saved(before: number, after: number): number {
  return before > 0 && after < before ? Math.round((1 - after / before) * 100) : 0;
}

export function countOf(toolId: ToolId, board: Board, files: number, savedPercent = 0): number {
  switch (toolId) {
    case "split":
    case "pdf-to-jpg":
    case "protect":
    case "unlock":
    case "page-numbers":
    case "watermark":
    case "flatten":
    case "pages-per-sheet":
    case "split-in-half":
    case "pixelize":
    case "redact":
    case "ocr":
    case "pdf-to-word":
    case "scan":
    case "overlay":
    case "bookmarks":
    case "repair":
    case "edit":
    case "crop":
      return files;
    case "delete-pages":
      return sourcePages(board) - board.pages.length;
    case "extract-pages":
      return board.selected.length;
    case "compress":
      return savedPercent;
    default:
      return board.pages.length;
  }
}

/** Saving less than 1 % is not worth a new file: the visitor keeps the one they know. */
export function keepsOriginal(original: number, compressed: number): boolean {
  return compressed > original * 0.99;
}

export function totalSize(files: NamedBytes[]): number {
  return files.reduce((total, file) => total + file.bytes.length, 0);
}

function sourcePages(board: Board): number {
  return board.docs.reduce((total, doc) => total + (doc.status.kind === "ready" ? doc.status.pageCount : 0), 0);
}
