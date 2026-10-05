import type { JSX } from "preact";
import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "preact/hooks";
import type { BookmarksDraft } from "../bookmarks/outline";
import type { CropDraft } from "../crop/box";
import type { EditDraft } from "../edit/model";
import { readKind } from "../engine/format";
import type { Progress } from "../engine/protocol";
import type { EngineError, NamedBytes, RedactZone, TransformOp } from "../engine/types";
import { boardTexts } from "../i18n/board";
import type { Dictionary, MonkTexts } from "../i18n/fr";
import { Icon } from "../illustrations/Icon";
import type { SignatureDraft } from "../signature/SignatureEditor";
import { acceptsKind, type Lang, languages, looksLikeImage, type ToolId, tools } from "../tools";
import "./board.css";
import { bubbleOf } from "./bubble";
import { useConfirm } from "./ConfirmDialog";
import { type Confirm, downloader, type Saver } from "./deliver";
import { type BoardDocument, documentOf, release } from "./document";
import { DropZone } from "./DropZone";
import { DocumentSkeleton } from "./DocumentSkeleton";
import { engine } from "./engine";
import { FileCards } from "./FileCards";
import { Failure, FileList } from "./FileList";
import { FilePicker } from "./FilePicker";
import { baseName, distinct, outputName, partName } from "./fileName";
import { advance, countOf, docxType, keepsOriginal, type Made, saved, setup, totalSize } from "./flow";
import { defaultSettings, markColors, Options, optionsReady, type Settings } from "./Options";
import type { PageGrid as PageGridView } from "./PageGrid";
import { Panel } from "./Panel";
import { canProduce, exportPlans } from "./plans";
import { Result } from "./Result";
import { emptyBoard, reduce } from "./state";
import { forgetThumbnails } from "./thumbnails";
import { useFileDrop } from "./useFileDrop";

type Props = {
  toolId: ToolId; lang: Lang; monks: Record<Lang, MonkTexts>;
  /** Given by the desktop shell; the site mounts the board without them. `files` opens on each new array: hand one over
   *  only for new files, and keep the same reference otherwise, or the files come back on every render. */
  files?: File[]; saver?: Saver; confirm?: Confirm; onDocumentChange?: (document: BoardDocument) => void;
};

export default function Board({ toolId, lang: firstLang, monks, files: incoming, saver = downloader, confirm: askOutside, onDocumentChange }: Props) {
  const tool = tools[toolId];
  const [lang, setLang] = useState(firstLang);
  const t = useMemo(() => {
    const texts = boardTexts[lang];
    // On the repair page, a file that does not open is one too damaged to repair.
    const errors = toolId === "repair" ? { ...texts.errors, damaged: texts.repair.unreadable } : texts.errors;
    return { ...texts, errors, monks: { [toolId]: monks[lang] } } as Dictionary;
  }, [lang]);
  const [board, dispatch] = useReducer(reduce, emptyBoard);
  const [flow, move] = useReducer(advance, setup);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const verb = useRef<HTMLButtonElement>(null);
  const cameBack = useRef(false);
  const files = useRef(new Map<string, File>());
  const locked = useRef(new Set<string>());
  const [PageGrid, setPageGrid] = useState<typeof PageGridView | null>(null);
  const [signatureModule, setSignatureModule] = useState<typeof import("../signature/SignatureEditor") | null>(null);
  const [signature, setSignature] = useState<SignatureDraft | null>(null);
  const [redactModule, setRedactModule] = useState<typeof import("../redact/RedactEditor") | null>(null);
  const [zones, setZones] = useState<RedactZone[]>([]);
  const [bookmarksModule, setBookmarksModule] = useState<typeof import("../bookmarks/BookmarksEditor") | null>(null);
  const [bookmarks, setBookmarks] = useState<BookmarksDraft | null>(null);
  const [editModule, setEditModule] = useState<typeof import("../edit/EditEditor") | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [cropModule, setCropModule] = useState<typeof import("../crop/CropEditor") | null>(null);
  const [crop, setCrop] = useState<CropDraft | null>(null);
  const [editorLoadFailed, setEditorLoadFailed] = useState(false);
  const [layerError, setLayerError] = useState<string | null>(null);
  const [scannerModule, setScannerModule] = useState<typeof import("../scanner/ScannerApp") | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [signaturePreviewReady, setSignaturePreviewReady] = useState(false);
  const [ask, confirmDialog] = useConfirm();
  const confirm = askOutside ?? ask;
  // Every screen of the board can be asked a question: the dialog goes with each of them.
  const withDialog = (screen: JSX.Element) => (
    <>
      {screen}
      {confirmDialog}
    </>
  );
  const [savedMade, setSavedMade] = useState<Made | null>(null);
  const [scannerSaved, setScannerSaved] = useState(true);
  useFileDrop(addFiles);

  useEffect(() => {
    if (incoming && incoming.length > 0) addFiles(incoming);
  }, [incoming]);

  const made = flow.step === "result" ? flow.made : null;
  useEffect(() => {
    if (!onDocumentChange) return;
    if (tool.workspace === "scanner") onDocumentChange({ files: photos, unsaved: photos.length > 0 && !scannerSaved });
    else onDocumentChange(documentOf([...files.current.values()], made, savedMade));
  }, [board.docs, made, savedMade, photos, scannerSaved]);

  const held = useRef({ board, settings, editDraft });
  held.current = { board, settings, editDraft };
  useEffect(() => () => release(engine, { docs: held.current.board.docs, layer: held.current.settings.layer, previews: Object.values(held.current.editDraft?.previews ?? {}) }), []);

  // Loaded with the first file, not with the page: dnd-kit and preact/compat are half of the board's script, and every
  // module the page loads before its first paint counts in Lighthouse's LCP.
  useEffect(() => {
    if (board.docs.length === 0 || tool.workspace !== "pages") return;
    void import("./PageGrid").then((module) => setPageGrid(() => module.PageGrid));
  }, [board.docs.length === 0]);

  const pageEditor = tool.workspace === "signature" || tool.workspace === "redact" || tool.workspace === "bookmarks" || tool.workspace === "edit" || tool.workspace === "crop";
  const editingDoc = pageEditor ? board.docs.find((doc) => doc.status.kind === "ready") : undefined;
  const signingDoc = tool.id === "sign" ? editingDoc : undefined;
  useEffect(() => {
    if (!editingDoc) return;
    void loadEditor();
  }, [editingDoc?.id]);

  async function loadEditor() {
    setEditorLoadFailed(false);
    try {
      if (tool.id === "redact") {
        setRedactModule(await import("../redact/RedactEditor"));
        return;
      }
      if (tool.id === "bookmarks") {
        if (!editingDoc) return;
        const docId = editingDoc.id;
        const [module, outline] = await Promise.all([import("../bookmarks/BookmarksEditor"), engine.bookmarks(docId)]);
        if (!outline.ok) throw new Error(outline.error.kind);
        setBookmarksModule(module);
        const rows = outline.value.bookmarks.map((bookmark, id) => ({ id, bookmark }));
        setBookmarks({ docId, pageIndex: 0, rows, skipped: outline.value.skipped, edited: false });
        return;
      }
      if (tool.id === "crop") {
        if (!editingDoc) return;
        const docId = editingDoc.id;
        const module = await import("../crop/CropEditor");
        setCropModule(module);
        setCrop((current) => (current?.docId === docId ? current : module.cropStart(docId)));
        return;
      }
      if (tool.id === "edit") {
        if (!editingDoc) return;
        const docId = editingDoc.id;
        const module = await import("../edit/EditEditor");
        setEditModule(module);
        setEditDraft((current) => (current?.docId === docId ? current : module.emptyEdit(docId, lang)));
        return;
      }
      if (tool.workspace === "scanner") {
        setScannerModule(await import("../scanner/ScannerApp"));
        return;
      }
      const module = await import("../signature/SignatureEditor");
      setSignatureModule(module);
      setSignature((previous) => previous ?? module.emptySignature);
    } catch {
      setEditorLoadFailed(true);
    }
  }

  // The board survives a language switch with its first props (transition:persist-props): the page's
  // <html lang> says which language to show after each client-side navigation.
  useEffect(() => {
    const followPage = () => setLang(languages.find((code) => code === document.documentElement.lang) ?? firstLang);
    document.addEventListener("astro:after-swap", followPage);
    return () => document.removeEventListener("astro:after-swap", followPage);
  }, []);

  useEffect(() => {
    if (document.readyState === "complete") engine.warmUp();
    else window.addEventListener("load", () => engine.warmUp(), { once: true });
  }, []);


  // A result, or an error, holds until the next change to the board or to the settings.
  useEffect(() => move({ type: "edited" }), [board, settings, signature, zones, bookmarks, editDraft, crop]);

  useLayoutEffect(() => {
    if (flow.step !== "setup" || !cameBack.current) return;
    cameBack.current = false;
    verb.current?.focus();
  }, [flow]);

  useEffect(() => {
    if (tool.workspace !== "pages") return;
    const undoOnShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.key !== "z") return;
      if (event.target instanceof HTMLInputElement) return;
      event.preventDefault();
      dispatch({ type: "undone" });
    };
    window.addEventListener("keydown", undoOnShortcut);
    return () => window.removeEventListener("keydown", undoOnShortcut);
  }, []);

  function dropEdit() {
    setEditDraft((current) => {
      for (const url of Object.values(current?.previews ?? {})) URL.revokeObjectURL(url);
      return null;
    });
  }

  async function open(docId: string, file: File, password?: string, asImage = false) {
    const kind = await readKind(file);
    if (!kind.ok || !(asImage || acceptsKind(tool, kind.value))) {
      dispatch({ type: "docFailed", docId, error: kind.ok ? { kind: "unsupportedFormat" } : kind.error });
      return;
    }
    const result = await engine.open(docId, file, kind.value, password, tool.id === "repair");
    dispatch(result.ok ? { type: "docOpened", docId, sizes: result.value } : { type: "docFailed", docId, error: result.error });
  }

  function addFiles(list: File[]) {
    if (tool.workspace === "scanner") {
      if (list.length === 0) return;
      setPhotos((current) => [...current, ...list]);
      void loadEditor();
      return;
    }
    if (pageEditor && flow.step === "working") return;
    const chosen = tool.multipleFiles ? list : list.slice(0, 1);
    if (chosen.length === 0) return;
    if (!tool.multipleFiles) {
      for (const doc of board.docs) engine.close(doc.id);
      forgetThumbnails();
      files.current.clear();
      dispatch({ type: "cleared" });
      setSignature(null);
      setZones([]);
      setBookmarks(null);
      dropEdit();
      setCrop(null);
    }
    const images = tool.convertsImages ? chosen.filter(looksLikeImage) : [];
    start(chosen.filter((file) => !images.includes(file)));
    if (images.length > 0) void offerImages(images);
  }

  function start(list: File[], asImages = false) {
    if (list.length === 0) return;
    const added = list.map((file) => ({ id: crypto.randomUUID(), file }));
    for (const { id, file } of added) files.current.set(id, file);
    dispatch({ type: "docsAdded", docs: added.map(({ id, file }) => ({ id, name: file.name })) });
    for (const { id, file } of added) void open(id, file, undefined, asImages);
  }

  /** On Merge, images are not refused: the monk offers to make a page of each, as JPG to PDF does. */
  async function offerImages(images: File[]) {
    if (await confirm(t.board.imagesArrived(images.length, images[0]?.name ?? ""), { cancel: t.board.leaveImages, confirm: t.board.convertImages })) start(images, true);
  }

  function reopen(docId: string, password?: string) {
    const file = files.current.get(docId);
    if (!file) return;
    if (password) locked.current.add(docId);
    dispatch({ type: "docReopening", docId });
    void open(docId, file, password, Boolean(tool.convertsImages) && looksLikeImage(file));
  }

  function remove(docId: string) {
    if (pageEditor && flow.step === "working") return;
    engine.close(docId);
    files.current.delete(docId);
    dispatch({ type: "docRemoved", docId });
    if (tool.id === "sign") setSignature(null);
    setZones([]);
    setBookmarks(null);
    dropEdit();
    setCrop(null);
  }

  async function produce() {
    if (flow.step === "working") return;
    move({ type: "started" });
    const made = tool.output === "signed" ? await makeSigned() : tool.output === "images" ? await makeImages() : tool.output === "compressed" ? await makeCompressed() : tool.output === "transformed" ? await makeTransformed() : await makePdfs();
    if (made) move({ type: "finished", made });
  }

  async function makeSigned(): Promise<Made | null> {
    const image = signature?.image ?? Object.values(signature?.images ?? {})[0];
    if (!signingDoc || !signature || !image || signature.processing || !signaturePreviewReady || signature.placements.length === 0) {
      move({ type: "failed", error: { kind: "invalidSignature" } });
      return null;
    }
    const name = outputName(signingDoc.name, t.fileSuffix[tool.id], "pdf");
    const result = await engine.sign(signingDoc.id, image, signature.placements, name, onProgress, signature.pageRotations, signature.images);
    if (!result.ok) {
      move({ type: "failed", error: result.error });
      return null;
    }
    return { files: result.value, zipName: "signed.zip", type: "application/pdf", count: signature.placements.length, before: 0, after: totalSize(result.value), pages: board.pages.length };
  }

  async function makePdfs(): Promise<Made | null> {
    const plans = exportPlans(board, tool.output);
    const first = board.docs.find((doc) => doc.id === board.pages[0]?.docId)?.name ?? "document.pdf";
    const suffix = t.fileSuffix[tool.id];
    const names = plans.length === 1 ? [outputName(first, suffix, "pdf")] : plans.map((_, i) => partName(first, i + 1));
    const result = await engine.export(plans, names, onProgress);
    if (!result.ok) {
      move({ type: "failed", error: result.error });
      return null;
    }
    return {
      files: result.value,
      zipName: outputName(first, suffix, "zip"),
      type: "application/pdf",
      count: countOf(tool.id, board, result.value.length),
      before: 0,
      after: totalSize(result.value),
      pages: plans.length === 1 ? (plans[0]?.length ?? 0) : 0,
    };
  }

  async function makeImages(): Promise<Made | null> {
    const docs = board.docs.filter((doc) => doc.status.kind === "ready");
    const stems = distinct(docs.map((doc) => baseName(doc.name)));
    const result = await engine.images(docs.map((doc) => doc.id), settings.mode, settings.quality, stems, onProgress);
    if (!result.ok) {
      move({ type: "failed", error: result.error });
      return null;
    }
    return {
      files: result.value,
      zipName: outputName(docs[0]?.name ?? "document.pdf", t.fileSuffix[tool.id], "zip"),
      type: "image/jpeg",
      count: countOf(tool.id, board, result.value.length),
      before: 0,
      after: totalSize(result.value),
      pages: 0,
    };
  }

  async function makeTransformed(): Promise<Made | null> {
    const docs = board.docs.filter((doc) => doc.status.kind === "ready");
    const suffix = t.fileSuffix[tool.id];
    const toWord = tool.id === "pdf-to-word";
    const names = distinct(docs.map((doc) => baseName(doc.name))).map((stem) => `${stem}-${suffix}.${toWord ? "docx" : "pdf"}`);
    const read = tool.id === "ocr" ? await readText() : undefined;
    if (read === null) return null;
    const op: TransformOp = read ? read
      : tool.id === "protect" ? { kind: "protect", password: settings.password }
      : tool.id === "watermark" ? {
        kind: "watermark", text: settings.markText.trim() || t.watermark.defaultText, color: markColors[settings.markColor],
        opacity: settings.markOpacity / 100, angle: settings.markAngle, width: settings.markWidth / 100,
        from: settings.allPages ? 1 : settings.fromPage, to: settings.allPages ? Number.MAX_SAFE_INTEGER : settings.toPage,
      }
      : tool.id === "page-numbers" ? {
        kind: "numbers", format: settings.numberFormat, position: settings.numberPosition, first: settings.firstNumber, size: settings.numberSize,
        from: settings.allPages ? 1 : settings.fromPage, to: settings.allPages ? Number.MAX_SAFE_INTEGER : settings.toPage,
      }
      : tool.id === "flatten" ? { kind: "flatten" }
      : tool.id === "pages-per-sheet" ? { kind: "nup", perSheet: settings.perSheet }
      : tool.id === "split-in-half" ? { kind: "halves", cut: settings.halfCut }
      : tool.id === "pixelize" ? { kind: "pixelize", ppi: settings.pixelPpi }
      : tool.id === "redact" ? { kind: "redact", zones }
      : tool.id === "overlay" && settings.layer ? { kind: "overlay", layerId: settings.layer.docId, under: settings.layerUnder }
      : tool.id === "repair" ? { kind: "repair" }
      : tool.id === "crop" && crop ? { kind: "crop", box: crop.box, page: crop.page ? crop.pageIndex : null }
      : tool.id === "edit" && editDraft ? { kind: "edit", items: editDraft.items, edits: editDraft.edits, fields: editDraft.fields, images: Object.fromEntries(Object.entries(editDraft.images).filter(([id]) => editDraft.items.some((item) => item.kind === "image" && item.imageId === id))) }
      : tool.id === "bookmarks" && bookmarks ? { kind: "bookmarks", bookmarks: bookmarks.rows.map((row) => row.bookmark) }
      : toWord ? { kind: "word" }
      : { kind: "unlock" };
    const result = await engine.transform(docs.map((doc) => doc.id), op, names, onProgress);
    if (!result.ok) {
      move({ type: "failed", error: result.error });
      return null;
    }
    return {
      files: result.value,
      zipName: outputName(docs[0]?.name ?? "document.pdf", suffix, "zip"),
      type: toWord ? docxType : "application/pdf",
      ...(op.kind === "protect" ? { password: op.password } : {}),
      count: op.kind === "ocr" ? op.pages.filter((page) => page.lines.length > 0).length : countOf(tool.id, board, result.value.length),
      before: 0,
      after: totalSize(result.value),
      pages: 0,
    };
  }

  /** Reads the pages with almost no text: a scan often carries a stamp, a fax header or a page number. */
  async function readText(): Promise<TransformOp | null> {
    const doc = board.docs.find((each) => each.status.kind === "ready");
    const fail = (error: EngineError) => {
      move({ type: "failed", error });
      return null;
    };
    if (!doc || doc.status.kind !== "ready") return fail({ kind: "damaged" });
    const counts = await engine.textCounts(doc.id);
    if (!counts.ok) return fail(counts.error);
    const sizes = doc.status.sizes;
    const pages = counts.value.flatMap((count, index) => (count < 50 && sizes[index] ? [{ index, size: sizes[index] }] : []));
    if (pages.length === 0) return fail({ kind: "textAlready" });
    const reader = await import("../ocr/reader").catch(() => null);
    const read = reader ? await reader.readPages(engine, doc.id, pages, onProgress).catch(() => null) : null;
    if (!read) return fail({ kind: "engineUnavailable" });
    if (!read.ok) return fail(read.error);
    if (read.value.every((page) => page.lines.length === 0)) return fail({ kind: "noTextRead" });
    return { kind: "ocr", pages: read.value };
  }

  async function makeCompressed(): Promise<Made | null> {
    const docs = board.docs.filter((doc) => doc.status.kind === "ready");
    const suffix = t.fileSuffix[tool.id];
    const names = distinct(docs.map((doc) => baseName(doc.name))).map((stem) => `${stem}-${suffix}.pdf`);
    const result = await engine.compress(docs.map((doc) => doc.id), settings.level, names, onProgress);
    if (!result.ok) {
      move({ type: "failed", error: result.error });
      return null;
    }
    const kept = await Promise.all(result.value.map((file, index) => smallest(file, docs[index]?.id ?? "")));
    const before = docs.reduce((total, doc) => total + (files.current.get(doc.id)?.size ?? 0), 0);
    const after = totalSize(kept);
    return {
      files: kept,
      zipName: outputName(docs[0]?.name ?? "document.pdf", suffix, "zip"),
      type: "application/pdf",
      count: countOf(tool.id, board, kept.length, saved(before, after)),
      before,
      after,
      pages: 0,
    };
  }

  /** The original when compressing saved almost nothing. Not for a protected file: the original would still ask for its password. */
  async function smallest(compressed: NamedBytes, docId: string): Promise<NamedBytes> {
    const original = files.current.get(docId);
    if (!original || locked.current.has(docId) || !keepsOriginal(original.size, compressed.bytes.length)) return compressed;
    const bytes = await original.arrayBuffer().then((buffer) => new Uint8Array(buffer), () => null);
    return bytes ? { name: compressed.name, bytes } : compressed;
  }

  /** Opens the PDF to lay on the pages beside the board's documents; a protected one is refused with what to do. */
  async function chooseLayer(file: File) {
    setLayerError(null);
    const kind = await readKind(file);
    if (!kind.ok || kind.value !== "pdf") {
      setLayerError(t.errors.unsupportedFormat);
      return;
    }
    const docId = `layer-${crypto.randomUUID()}`;
    const opened = await engine.open(docId, file, "pdf");
    if (!opened.ok) {
      setLayerError(opened.error.kind === "passwordRequired" || opened.error.kind === "wrongPassword" ? t.overlay.locked : t.errors[opened.error.kind]);
      return;
    }
    setSettings((current) => {
      if (current.layer) engine.close(current.layer.docId);
      return { ...current, layer: { docId, name: file.name, pages: opened.value.length } };
    });
  }

  function onProgress({ done, total }: Progress) {
    move({ type: "progressed", done, total });
  }

  function back() {
    cameBack.current = true;
    move({ type: "back" });
  }

  function startOver() {
    for (const doc of board.docs) engine.close(doc.id);
    forgetThumbnails();
    files.current.clear();
    setSignature(null);
    setZones([]);
    setBookmarks(null);
    dropEdit();
    setCrop(null);
    dispatch({ type: "cleared" });
    move({ type: "back" });
  }

  if (tool.workspace === "scanner") {
    if (photos.length === 0) return <DropZone tool={tool} t={t} onFiles={addFiles} />;
    if (editorLoadFailed) return <p role="alert">{t.errors.engineUnavailable} <button type="button" onClick={() => void loadEditor()}>{t.retry}</button></p>;
    return withDialog(
      scannerModule ? (
        <scannerModule.ScannerApp photos={photos} lang={lang} engine={engine} onPhotos={addFiles} Skeleton={DocumentSkeleton} saver={saver} confirm={confirm} onSavedChange={setScannerSaved} />
      ) : <DocumentSkeleton label={t.board.opening} />,
    );
  }
  if (made) return withDialog(<Result tool={tool} t={t} lang={lang} made={made} saver={saver} onSaved={() => setSavedMade(made)} onBack={back} onAgain={startOver} />);
  if (board.docs.length === 0) return withDialog(<DropZone tool={tool} t={t} onFiles={addFiles} />);

  // The tabs and colour marks tell files apart. One ready file needs neither, and neither do images: one image is one
  // page, named under it. Sign uses a document placeholder; other tools keep opening/failed files in tabs.
  const alone = pageEditor || tool.accepts === "image" || (board.docs.length === 1 && board.docs[0]?.status.kind === "ready");
  const tabs = pageEditor ? [] : alone ? board.docs.filter((doc) => doc.status.kind !== "ready") : board.docs;
  const sizes = new Map([...files.current].map(([id, file]) => [id, file.size]));
  const signatureProps = signingDoc?.status.kind === "ready" && signature ? {
    docId: signingDoc.id, sizes: signingDoc.status.sizes, lang, value: signature, onChange: setSignature, disabled: flow.step === "working",
    previewReady: signaturePreviewReady, onPreviewReady: setSignaturePreviewReady, engine, Skeleton: DocumentSkeleton,
  } : null;
  const bookmarksProps = bookmarksModule && bookmarks && editingDoc?.status.kind === "ready" && bookmarks.docId === editingDoc.id ? {
    sizes: editingDoc.status.sizes, lang, value: bookmarks, disabled: flow.step === "working", engine, Skeleton: DocumentSkeleton,
    onChange: (update: (draft: BookmarksDraft) => BookmarksDraft) => setBookmarks((current) => current && update(current)),
  } : null;
  const editProps = editModule && editDraft && editingDoc?.status.kind === "ready" && editDraft.docId === editingDoc.id ? {
    sizes: editingDoc.status.sizes, lang, value: editDraft, disabled: flow.step === "working", engine, Skeleton: DocumentSkeleton,
    onChange: (update: (draft: EditDraft) => EditDraft) => setEditDraft((current) => current && update(current)),
  } : null;
  const cropProps = cropModule && crop && editingDoc?.status.kind === "ready" && crop.docId === editingDoc.id ? {
    sizes: editingDoc.status.sizes, lang, value: crop, disabled: flow.step === "working", engine, Skeleton: DocumentSkeleton,
    onChange: (update: (draft: CropDraft) => CropDraft) => setCrop((current) => current && update(current)),
  } : null;
  const editor = signatureModule && signatureProps ? <signatureModule.SignatureWorkspace {...signatureProps} />
    : redactModule && editingDoc?.status.kind === "ready" ? (
      <redactModule.RedactWorkspace docId={editingDoc.id} sizes={editingDoc.status.sizes} lang={lang} zones={zones} onZones={setZones} disabled={flow.step === "working"} engine={engine} Skeleton={DocumentSkeleton} />
    ) : bookmarksModule && bookmarksProps ? <bookmarksModule.BookmarksWorkspace {...bookmarksProps} />
    : editModule && editProps ? <editModule.EditWorkspace {...editProps} />
    : cropModule && cropProps ? <cropModule.CropWorkspace {...cropProps} /> : null;
  return withDialog(
    <div class={["board", alone && "alone", tabs.length === 0 && "untabbed"].filter(Boolean).join(" ")}>
      <div class="workspace">
        {pageEditor ? (
          <>
            {!editor && board.docs.map((doc) => (
              <div class="document-opening" key={doc.id}>
                <div class="document-opening-header">
                  <span class="file-name" title={doc.name}>{doc.name}</span>
                  <button type="button" aria-label={`${t.board.removeFile}, ${doc.name}`} onClick={() => remove(doc.id)}><Icon name="close" size={18} /></button>
                </div>
                {doc.status.kind === "failed" ? (
                  <div class="document-opening-error"><Failure docId={doc.id} error={doc.status.error} t={t} onPassword={reopen} onRetry={reopen} onRemove={remove} /></div>
                ) : !editorLoadFailed && (
                  <div class="document-opening-page" style={{ aspectRatio: doc.status.kind === "ready" && doc.status.sizes[0] ? `${doc.status.sizes[0].width} / ${doc.status.sizes[0].height}` : "210 / 297" }}>
                    <DocumentSkeleton label={t.board.opening} />
                  </div>
                )}
              </div>
            ))}
            {editor}
            {editorLoadFailed && <p role="alert">{t.errors.engineUnavailable} <button type="button" onClick={() => void loadEditor()}>{t.retry}</button></p>}
          </>
        ) : tool.workspace === "files" ? (
          <FileCards tool={tool} docs={board.docs} sizes={sizes} lang={lang} t={t} onFiles={addFiles} onPassword={reopen} onRetry={reopen} onRemove={remove} />
        ) : (
          <>
            <div class="board-top">
              {tabs.length > 0 && <FileList docs={tabs} sizes={sizes} lang={lang} t={t} onPassword={reopen} onRetry={reopen} onRemove={remove} />}
              <button
                type="button"
                class="undo"
                aria-label={t.board.undo}
                aria-keyshortcuts="Control+Z Meta+Z"
                title={t.board.undoHint}
                disabled={board.history.length === 0}
                onClick={() => dispatch({ type: "undone" })}
              >
                <Icon name="undo" size={18} />
              </button>
            </div>
            {PageGrid && <PageGrid board={board} tool={tool} t={t} lang={lang} sizes={sizes} dispatch={dispatch} onFiles={addFiles} />}
          </>
        )}
      </div>
      <Panel tool={tool} t={t} bubble={bubbleOf(board, flow)} flow={flow} ready={canProduce(board, tool) && optionsReady(tool, settings) && (tool.id !== "sign" || Boolean(signature?.placements.length && !signature.processing && signaturePreviewReady)) && (tool.id !== "redact" || zones.length > 0) && (tool.id !== "bookmarks" || Boolean(bookmarksModule && bookmarks && bookmarksModule.canSave(bookmarks))) && (tool.id !== "edit" || Boolean(editModule && editDraft && editModule.canSave(editDraft))) && (tool.id !== "crop" || cropProps !== null)} verb={verb} onGo={() => void produce()} beforeAction={signatureModule && signatureProps ? <signatureModule.SignatureAddAction {...signatureProps} /> : tool.workspace === "pages" && tool.multipleFiles && flow.step !== "working" && <FilePicker tool={tool} label={tool.accepts === "image" ? t.board.addImages : t.board.addPdf} icon="plus" onFiles={addFiles} class="add" />}>
        {tool.id === "sign" ? signatureModule && signatureProps && <signatureModule.SignatureOptions {...signatureProps} />
          : tool.id === "bookmarks" ? bookmarksModule && bookmarksProps && <bookmarksModule.BookmarksOptions {...bookmarksProps} />
          : tool.id === "edit" ? editModule && editProps && <editModule.EditOptions {...editProps} />
          : tool.id === "crop" ? cropModule && cropProps && <cropModule.CropOptions {...cropProps} /> : <Options tool={tool} t={t} board={board} dispatch={dispatch} settings={settings} onSettings={(change) => setSettings((current) => ({ ...current, ...change }))} onLayer={(file) => void chooseLayer(file)} layerError={layerError} />}
      </Panel>
    </div>,
  );
}
