import type { FileKind } from "./engine/types";

export const languages = ["fr", "en"] as const;
export type Lang = (typeof languages)[number];

export const toolIds = ["merge", "split", "organize", "delete-pages", "extract-pages", "rotate", "jpg-to-pdf", "pdf-to-jpg", "compress", "edit", "sign", "watermark", "page-numbers", "protect", "unlock", "flatten", "pages-per-sheet", "split-in-half", "pixelize", "redact", "ocr", "pdf-to-word", "scan", "overlay", "bookmarks", "repair", "crop"] as const;
export type ToolId = (typeof toolIds)[number];

export type Tool = {
  id: ToolId;
  slug: Record<Lang, string>;
  /** `photo`: images from a camera, HEIC included, read by the Scanner itself. */
  accepts: "pdf" | "image" | "photo";
  multipleFiles: boolean;
  output: "one" | "split" | "selection" | "images" | "compressed" | "signed" | "transformed";
  related: ToolId[];
  workspace: "pages" | "files" | "signature" | "redact" | "bookmarks" | "edit" | "crop" | "scanner";
};

export const tools: Record<ToolId, Tool> = {
  merge: {
    id: "merge", slug: { fr: "fusionner-pdf", en: "merge-pdf" },
    workspace: "pages",
    accepts: "pdf", multipleFiles: true, output: "one", related: ["split", "organize", "jpg-to-pdf"],
  },
  split: {
    id: "split", slug: { fr: "diviser-pdf", en: "split-pdf" },
    workspace: "pages",
    accepts: "pdf", multipleFiles: false, output: "split", related: ["extract-pages", "merge", "delete-pages"],
  },
  organize: {
    id: "organize", slug: { fr: "organiser-pdf", en: "organize-pdf" },
    workspace: "pages",
    accepts: "pdf", multipleFiles: false, output: "one", related: ["delete-pages", "rotate", "merge"],
  },
  "delete-pages": {
    id: "delete-pages", slug: { fr: "supprimer-pages-pdf", en: "delete-pdf-pages" },
    workspace: "pages",
    accepts: "pdf", multipleFiles: false, output: "one", related: ["extract-pages", "organize", "split"],
  },
  "extract-pages": {
    id: "extract-pages", slug: { fr: "extraire-pages-pdf", en: "extract-pdf-pages" },
    workspace: "pages",
    accepts: "pdf", multipleFiles: false, output: "selection", related: ["split", "delete-pages", "merge"],
  },
  rotate: {
    id: "rotate", slug: { fr: "pivoter-pdf", en: "rotate-pdf" },
    workspace: "pages",
    accepts: "pdf", multipleFiles: true, output: "one", related: ["organize", "merge", "delete-pages"],
  },
  "jpg-to-pdf": {
    id: "jpg-to-pdf", slug: { fr: "jpg-en-pdf", en: "jpg-to-pdf" },
    workspace: "pages",
    accepts: "image", multipleFiles: true, output: "one", related: ["merge", "organize", "rotate"],
  },
  "pdf-to-jpg": {
    id: "pdf-to-jpg", slug: { fr: "pdf-en-jpg", en: "pdf-to-jpg" },
    accepts: "pdf", multipleFiles: true, output: "images", workspace: "files", related: ["jpg-to-pdf", "split", "extract-pages"],
  },
  compress: {
    id: "compress", slug: { fr: "compresser-pdf", en: "compress-pdf" },
    accepts: "pdf", multipleFiles: true, output: "compressed", workspace: "files", related: ["merge", "split", "pdf-to-jpg"],
  },
  sign: {
    id: "sign", slug: { fr: "signer-pdf", en: "sign-pdf" },
    accepts: "pdf", multipleFiles: false, output: "signed", workspace: "signature", related: ["merge", "organize", "compress"],
  },
  watermark: {
    id: "watermark", slug: { fr: "filigrane-pdf", en: "watermark-pdf" },
    accepts: "pdf", multipleFiles: true, output: "transformed", workspace: "files", related: ["sign", "page-numbers", "protect"],
  },
  "page-numbers": {
    id: "page-numbers", slug: { fr: "numeroter-pdf", en: "page-numbers-pdf" },
    accepts: "pdf", multipleFiles: false, output: "transformed", workspace: "files", related: ["organize", "merge", "sign"],
  },
  protect: {
    id: "protect", slug: { fr: "proteger-pdf", en: "protect-pdf" },
    accepts: "pdf", multipleFiles: true, output: "transformed", workspace: "files", related: ["unlock", "compress", "merge"],
  },
  overlay: {
    id: "overlay", slug: { fr: "superposer-pdf", en: "overlay-pdf" },
    accepts: "pdf", multipleFiles: true, output: "transformed", workspace: "files", related: ["watermark", "merge", "pages-per-sheet"],
  },
  crop: {
    id: "crop", slug: { fr: "rogner-pdf", en: "crop-pdf" },
    accepts: "pdf", multipleFiles: false, output: "transformed", workspace: "crop", related: ["split-in-half", "edit", "pages-per-sheet"],
  },
  edit: {
    id: "edit", slug: { fr: "modifier-pdf", en: "edit-pdf" },
    accepts: "pdf", multipleFiles: false, output: "transformed", workspace: "edit", related: ["sign", "watermark", "redact"],
  },
  repair: {
    id: "repair", slug: { fr: "reparer-pdf", en: "repair-pdf" },
    accepts: "pdf", multipleFiles: true, output: "transformed", workspace: "files", related: ["compress", "unlock", "flatten"],
  },
  bookmarks: {
    id: "bookmarks", slug: { fr: "signets-pdf", en: "pdf-bookmarks" },
    accepts: "pdf", multipleFiles: false, output: "transformed", workspace: "bookmarks", related: ["organize", "page-numbers", "merge"],
  },
  scan: {
    id: "scan", slug: { fr: "scanner", en: "scanner" },
    accepts: "photo", multipleFiles: true, output: "transformed", workspace: "scanner", related: ["jpg-to-pdf", "ocr", "compress"],
  },
  "pdf-to-word": {
    id: "pdf-to-word", slug: { fr: "pdf-en-word", en: "pdf-to-word" },
    accepts: "pdf", multipleFiles: true, output: "transformed", workspace: "files", related: ["pdf-to-jpg", "ocr", "compress"],
  },
  ocr: {
    id: "ocr", slug: { fr: "ocr-pdf", en: "ocr-pdf" },
    accepts: "pdf", multipleFiles: false, output: "transformed", workspace: "files", related: ["compress", "pixelize", "pdf-to-jpg"],
  },
  redact: {
    id: "redact", slug: { fr: "noircir-pdf", en: "redact-pdf" },
    accepts: "pdf", multipleFiles: false, output: "transformed", workspace: "redact", related: ["pixelize", "flatten", "protect"],
  },
  pixelize: {
    id: "pixelize", slug: { fr: "pixelliser-pdf", en: "pixelize-pdf" },
    accepts: "pdf", multipleFiles: true, output: "transformed", workspace: "files", related: ["flatten", "protect", "pdf-to-jpg"],
  },
  "split-in-half": {
    id: "split-in-half", slug: { fr: "couper-pages-en-deux", en: "split-pages-in-half" },
    accepts: "pdf", multipleFiles: true, output: "transformed", workspace: "files", related: ["split", "organize", "pages-per-sheet"],
  },
  "pages-per-sheet": {
    id: "pages-per-sheet", slug: { fr: "pages-par-feuille", en: "pages-per-sheet" },
    accepts: "pdf", multipleFiles: true, output: "transformed", workspace: "files", related: ["merge", "organize", "split"],
  },
  flatten: {
    id: "flatten", slug: { fr: "aplatir-pdf", en: "flatten-pdf" },
    accepts: "pdf", multipleFiles: true, output: "transformed", workspace: "files", related: ["compress", "protect", "sign"],
  },
  unlock: {
    id: "unlock", slug: { fr: "deverrouiller-pdf", en: "unlock-pdf" },
    accepts: "pdf", multipleFiles: true, output: "transformed", workspace: "files", related: ["protect", "compress", "merge"],
  },
};

export const toolList: Tool[] = toolIds.map((id) => tools[id]);

export function acceptsKind(tool: Tool, kind: FileKind): boolean {
  return tool.accepts === "pdf" ? kind === "pdf" : kind !== "pdf";
}
