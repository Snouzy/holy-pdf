import type { ScanPdfPage } from "./scanPdf";
import type { CompressLevel, ExportPlan, FieldEdit, FileKind, ImageMode, ImageQuality, NamedBytes, OriginalEdit, Outline, PageFont, PageObjects, PageSize, Result, SignatureImage, SignaturePlacement, TransformOp } from "./types";

export type EngineRequest =
  | { type: "open"; docId: string; kind: FileKind; bytes: ArrayBuffer; password: string; repair: boolean }
  | { type: "thumbnail"; docId: string; index: number; width: number; edits?: OriginalEdit[]; fields?: FieldEdit[] }
  | { type: "objects"; docId: string; index: number; edits?: OriginalEdit[]; fields?: FieldEdit[] }
  | { type: "fonts"; docId: string }
  | { type: "fieldNames"; docId: string }
  | { type: "textCounts"; docId: string }
  | { type: "bookmarks"; docId: string }
  | { type: "scanPdf"; pages: ScanPdfPage[]; title: string; name: string }
  | { type: "export"; plans: ExportPlan[]; names: string[] }
  | { type: "compress"; docIds: string[]; level: CompressLevel; names: string[] }
  | { type: "sign"; docId: string; image: SignatureImage; placements: SignaturePlacement[]; name: string; pageRotations?: Record<number, number>; images?: Record<string, SignatureImage> }
  | { type: "images"; docIds: string[]; mode: ImageMode; quality: ImageQuality; prefixes: string[] }
  | { type: "transform"; docIds: string[]; op: TransformOp; names: string[] }
  | { type: "zip"; files: NamedBytes[] }
  | { type: "close"; docId: string };

export type EngineReply =
  | { type: "open"; sizes: PageSize[] }
  | { type: "thumbnail"; image: Blob }
  | { type: "objects"; result: PageObjects }
  | { type: "fonts"; fonts: Record<string, PageFont> }
  | { type: "fieldNames"; names: string[] }
  | { type: "textCounts"; counts: number[] }
  | { type: "bookmarks"; outline: Outline }
  | { type: "files"; files: NamedBytes[] }
  | { type: "zip"; bytes: Uint8Array<ArrayBuffer> }
  | { type: "close" };

export type Progress = { done: number; total: number };

export type RequestMessage = { id: number; request: EngineRequest };

/** `fatal`: The engine aborted or a module failed to load. Recreate the worker before retrying. */
export type ReplyMessage = { id: number; result: Result<EngineReply>; fatal: boolean };

/** Sent before the reply of a long request. It never ends the request. */
export type ProgressMessage = { id: number; progress: Progress };

export type WorkerMessage = ReplyMessage | ProgressMessage;
