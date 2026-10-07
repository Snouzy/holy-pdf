import type { FileKind } from "./engine/types";

export const languages = ["fr", "en", "pt-br"] as const;
export type Lang = (typeof languages)[number];

/** The BCP 47 tag of each language, for `lang`, `hreflang`, `inLanguage` and `Intl`. The URL keeps the lower-case code. */
export const locales: Record<Lang, string> = { fr: "fr", en: "en", "pt-br": "pt-BR" };

/** Each language names itself: the switch shows the name a reader of that language looks for. */
export const languageNames: Record<Lang, string> = { fr: "Français", en: "English", "pt-br": "Português" };

export const perLanguage = <T,>(make: (lang: Lang) => T): Record<Lang, T> => Object.fromEntries(languages.map((lang) => [lang, make(lang)])) as Record<Lang, T>;

export const toolIds = ["merge", "split", "organize", "delete-pages", "extract-pages", "rotate", "jpg-to-pdf", "pdf-to-jpg", "compress", "edit", "sign", "watermark", "page-numbers", "protect", "unlock", "flatten", "pages-per-sheet", "split-in-half", "pixelize", "redact", "ocr", "pdf-to-word", "scan", "overlay", "bookmarks", "repair", "crop"] as const;
export type ToolId = (typeof toolIds)[number];

export type Tool = {
  id: ToolId;
  slug: Record<Lang, string>;
  /** `photo`: images from a camera, HEIC included, read by the Scanner itself. */
  accepts: "pdf" | "image" | "photo";
  /** Images arrive too, each turned into a page once the user agrees. */
  convertsImages?: true;
  multipleFiles: boolean;
  output: "one" | "split" | "selection" | "images" | "compressed" | "signed" | "transformed";
  related: ToolId[];
  workspace: "pages" | "files" | "signature" | "redact" | "bookmarks" | "edit" | "crop" | "scanner";
};

export const tools: Record<ToolId, Tool> = {
  merge: {
    id: "merge", slug: { fr: "fusionner-pdf", en: "merge-pdf", "pt-br": "juntar-pdf" },
    workspace: "pages",
    accepts: "pdf", convertsImages: true, multipleFiles: true, output: "one", related: ["split", "organize", "jpg-to-pdf"],
  },
  split: {
    id: "split", slug: { fr: "diviser-pdf", en: "split-pdf", "pt-br": "dividir-pdf" },
    workspace: "pages",
    accepts: "pdf", multipleFiles: false, output: "split", related: ["extract-pages", "merge", "delete-pages"],
  },
  organize: {
    id: "organize", slug: { fr: "organiser-pdf", en: "organize-pdf", "pt-br": "organizar-pdf" },
    workspace: "pages",
    accepts: "pdf", multipleFiles: false, output: "one", related: ["delete-pages", "rotate", "merge"],
  },
  "delete-pages": {
    id: "delete-pages", slug: { fr: "supprimer-pages-pdf", en: "delete-pdf-pages", "pt-br": "remover-paginas-pdf" },
    workspace: "pages",
    accepts: "pdf", multipleFiles: false, output: "one", related: ["extract-pages", "organize", "split"],
  },
  "extract-pages": {
    id: "extract-pages", slug: { fr: "extraire-pages-pdf", en: "extract-pdf-pages", "pt-br": "extrair-paginas-pdf" },
    workspace: "pages",
    accepts: "pdf", multipleFiles: false, output: "selection", related: ["split", "delete-pages", "merge"],
  },
  rotate: {
    id: "rotate", slug: { fr: "pivoter-pdf", en: "rotate-pdf", "pt-br": "girar-pdf" },
    workspace: "pages",
    accepts: "pdf", multipleFiles: true, output: "one", related: ["organize", "merge", "delete-pages"],
  },
  "jpg-to-pdf": {
    id: "jpg-to-pdf", slug: { fr: "jpg-en-pdf", en: "jpg-to-pdf", "pt-br": "jpg-para-pdf" },
    workspace: "pages",
    accepts: "image", multipleFiles: true, output: "one", related: ["merge", "organize", "rotate"],
  },
  "pdf-to-jpg": {
    id: "pdf-to-jpg", slug: { fr: "pdf-en-jpg", en: "pdf-to-jpg", "pt-br": "pdf-para-jpg" },
    accepts: "pdf", multipleFiles: true, output: "images", workspace: "files", related: ["jpg-to-pdf", "split", "extract-pages"],
  },
  compress: {
    id: "compress", slug: { fr: "compresser-pdf", en: "compress-pdf", "pt-br": "comprimir-pdf" },
    accepts: "pdf", multipleFiles: true, output: "compressed", workspace: "files", related: ["merge", "split", "pdf-to-jpg"],
  },
  sign: {
    id: "sign", slug: { fr: "signer-pdf", en: "sign-pdf", "pt-br": "assinar-pdf" },
    accepts: "pdf", multipleFiles: false, output: "signed", workspace: "signature", related: ["merge", "organize", "compress"],
  },
  watermark: {
    id: "watermark", slug: { fr: "filigrane-pdf", en: "watermark-pdf", "pt-br": "marca-dagua-pdf" },
    accepts: "pdf", multipleFiles: true, output: "transformed", workspace: "files", related: ["sign", "page-numbers", "protect"],
  },
  "page-numbers": {
    id: "page-numbers", slug: { fr: "numeroter-pdf", en: "page-numbers-pdf", "pt-br": "numerar-paginas-pdf" },
    accepts: "pdf", multipleFiles: false, output: "transformed", workspace: "files", related: ["organize", "merge", "sign"],
  },
  protect: {
    id: "protect", slug: { fr: "proteger-pdf", en: "protect-pdf", "pt-br": "proteger-pdf" },
    accepts: "pdf", multipleFiles: true, output: "transformed", workspace: "files", related: ["unlock", "compress", "merge"],
  },
  overlay: {
    id: "overlay", slug: { fr: "superposer-pdf", en: "overlay-pdf", "pt-br": "sobrepor-pdf" },
    accepts: "pdf", multipleFiles: true, output: "transformed", workspace: "files", related: ["watermark", "merge", "pages-per-sheet"],
  },
  crop: {
    id: "crop", slug: { fr: "rogner-pdf", en: "crop-pdf", "pt-br": "cortar-pdf" },
    accepts: "pdf", multipleFiles: false, output: "transformed", workspace: "crop", related: ["split-in-half", "edit", "pages-per-sheet"],
  },
  edit: {
    id: "edit", slug: { fr: "modifier-pdf", en: "edit-pdf", "pt-br": "editar-pdf" },
    accepts: "pdf", multipleFiles: false, output: "transformed", workspace: "edit", related: ["sign", "watermark", "redact"],
  },
  repair: {
    id: "repair", slug: { fr: "reparer-pdf", en: "repair-pdf", "pt-br": "reparar-pdf" },
    accepts: "pdf", multipleFiles: true, output: "transformed", workspace: "files", related: ["compress", "unlock", "flatten"],
  },
  bookmarks: {
    id: "bookmarks", slug: { fr: "signets-pdf", en: "pdf-bookmarks", "pt-br": "marcadores-pdf" },
    accepts: "pdf", multipleFiles: false, output: "transformed", workspace: "bookmarks", related: ["organize", "page-numbers", "merge"],
  },
  scan: {
    id: "scan", slug: { fr: "scanner", en: "scanner", "pt-br": "digitalizar-para-pdf" },
    accepts: "photo", multipleFiles: true, output: "transformed", workspace: "scanner", related: ["jpg-to-pdf", "ocr", "compress"],
  },
  "pdf-to-word": {
    id: "pdf-to-word", slug: { fr: "pdf-en-word", en: "pdf-to-word", "pt-br": "pdf-para-word" },
    accepts: "pdf", multipleFiles: true, output: "transformed", workspace: "files", related: ["pdf-to-jpg", "ocr", "compress"],
  },
  ocr: {
    id: "ocr", slug: { fr: "ocr-pdf", en: "ocr-pdf", "pt-br": "ocr-pdf" },
    accepts: "pdf", multipleFiles: false, output: "transformed", workspace: "files", related: ["compress", "pixelize", "pdf-to-jpg"],
  },
  redact: {
    id: "redact", slug: { fr: "noircir-pdf", en: "redact-pdf", "pt-br": "ocultar-texto-pdf" },
    accepts: "pdf", multipleFiles: false, output: "transformed", workspace: "redact", related: ["pixelize", "flatten", "protect"],
  },
  pixelize: {
    id: "pixelize", slug: { fr: "pixelliser-pdf", en: "pixelize-pdf", "pt-br": "pixelizar-pdf" },
    accepts: "pdf", multipleFiles: true, output: "transformed", workspace: "files", related: ["flatten", "protect", "pdf-to-jpg"],
  },
  "split-in-half": {
    id: "split-in-half", slug: { fr: "couper-pages-en-deux", en: "split-pages-in-half", "pt-br": "dividir-paginas-ao-meio" },
    accepts: "pdf", multipleFiles: true, output: "transformed", workspace: "files", related: ["split", "organize", "pages-per-sheet"],
  },
  "pages-per-sheet": {
    id: "pages-per-sheet", slug: { fr: "pages-par-feuille", en: "pages-per-sheet", "pt-br": "paginas-por-folha" },
    accepts: "pdf", multipleFiles: true, output: "transformed", workspace: "files", related: ["merge", "organize", "split"],
  },
  flatten: {
    id: "flatten", slug: { fr: "aplatir-pdf", en: "flatten-pdf", "pt-br": "achatar-pdf" },
    accepts: "pdf", multipleFiles: true, output: "transformed", workspace: "files", related: ["compress", "protect", "sign"],
  },
  unlock: {
    id: "unlock", slug: { fr: "deverrouiller-pdf", en: "unlock-pdf", "pt-br": "desbloquear-pdf" },
    accepts: "pdf", multipleFiles: true, output: "transformed", workspace: "files", related: ["protect", "compress", "merge"],
  },
};

export const toolList: Tool[] = toolIds.map((id) => tools[id]);

/** What Merge offers to turn into pages: the two image kinds the engine opens. HEIC and the rest stay refused. */
export const looksLikeImage = (file: File): boolean => /^image\/(jpeg|png)$/.test(file.type) || /\.(jpe?g|png)$/i.test(file.name);

export function acceptsKind(tool: Tool, kind: FileKind): boolean {
  return tool.accepts === "pdf" ? kind === "pdf" : kind !== "pdf";
}
