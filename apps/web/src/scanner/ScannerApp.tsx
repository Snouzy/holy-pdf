import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Worker as Reader } from "tesseract.js";
import type { Confirm, Saver } from "../board/deliver";
import type { DocumentSkeleton } from "../board/DocumentSkeleton";
import type { Engine } from "../engine/client";
import { heicCaptureDay, jpegCaptureDay } from "../engine/exif";
import type { NamedBytes } from "../engine/types";
import { createScanner } from "../scan/client";
import { photoKind } from "../scan/protocol";
import { suggest } from "../scan/suggest";
import type { Lang } from "../tools";
import { Correction } from "./Correction";
import { needsCheck } from "./pages";
import { Planche } from "./Planche";
import { type Doc, type Edits, emptyHistory, emptySession, type History, imported, type Op, type Page, patched, perform, redo, type Session, undo } from "./session";
import { scannerTexts } from "./texts";
import "./scanner.css";

type Props = {
  photos: File[]; lang: Lang; onPhotos: (files: File[]) => void;
  /** Passed by Board, not imported: a module shared with Board's chunk becomes one more request before LCP on every tool page. */
  engine: Pick<Engine, "scanPdf" | "zip">; Skeleton: typeof DocumentSkeleton;
  saver: Saver; confirm: Confirm; onSavedChange?: (saved: boolean) => void;
};
type State = { session: Session; history: History };

export function ScannerApp({ photos, lang, onPhotos, engine, Skeleton, saver, confirm, onSavedChange }: Props) {
  const t = scannerTexts[lang];
  const saving = saver.kind === "save";
  const [state, setState] = useState<State>({ session: emptySession, history: emptyHistory });
  const [view, setView] = useState<{ kind: "board" } | { kind: "correct"; pageId: string }>({ kind: "board" });
  const [onlyToCheck, setOnlyToCheck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);
  useEffect(() => onSavedChange?.(saved), [saved]);
  const [inFlight, setInFlight] = useState<ReadonlySet<string>>(new Set());
  const [reading, setReading] = useState<string | null>(null);
  const [searchable, setSearchable] = useState(true);
  /** Set by any change to the board: the reading then never regroups or renames the documents again. */
  const [manual, setManual] = useState(false);
  const seen = useRef(0);
  /** What each page was last drawn with: a page is drawn again when its edits or its turns change. */
  const drawn = useRef(new Map<string, { edits: Edits; turns: number }>());
  const reader = useRef<Promise<Reader | null>>();
  const suggested = useRef("");
  const live = useRef({ state, view });
  live.current = { state, view };
  const scanner = useMemo(() => createScanner(() => new Worker(new URL("../scan/scanWorker.ts", import.meta.url), { type: "module" })), []);

  useEffect(() => {
    const fresh = photos.slice(seen.current);
    seen.current = photos.length;
    if (fresh.length === 0) return;
    setState((current) => ({ ...current, session: imported(current.session, fresh, () => crypto.randomUUID()) }));
    setSaved(false);
  }, [photos.length]);

  useEffect(() => {
    for (const page of Object.values(state.session.pages)) {
      if (inFlight.has(page.id) || isDrawn(page)) continue;
      void draw(page.id);
    }
  }, [state.session.pages, inFlight]);

  useEffect(() => {
    if (reading) return;
    const order = state.session.documents.flatMap((doc) => doc.pageIds).map((id) => state.session.pages[id]!);
    const next = order.find((page) => page.status.kind === "ready" && !inFlight.has(page.id) && isDrawn(page) && page.text !== "unread" && page.text?.of !== page.status.result.page);
    if (next) void read(next.id);
  }, [state.session, inFlight, reading]);

  useEffect(() => {
    if (manual || reading) return;
    const order = state.session.documents.flatMap((doc) => doc.pageIds).map((id) => state.session.pages[id]!);
    const settled = order.length > 0 && order.every((page) => page.status.kind === "failed" || (page.status.kind === "ready" && (page.text === "unread" || page.text?.of === page.status.result.page)));
    const signature = order.map((page) => `${page.id}:${page.text === "unread" ? "-" : page.text?.lines.length}`).join(",");
    if (!settled || signature === suggested.current) return;
    suggested.current = signature;
    const today = new Date();
    const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const documents = suggest(order.map((page) => ({ id: page.id, lines: page.text && page.text !== "unread" ? page.text.lines : [], captureDay: page.captureDay })), day)
      .map((suggestion): Doc => ({ id: crypto.randomUUID(), name: suggestion.name, pageIds: suggestion.pageIds, reason: suggestion.evidence.map((evidence) => evidence.text).join(" · ") || undefined }));
    setState((current) => ({ ...current, session: { ...current.session, documents } }));
  }, [state.session, manual, reading]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (saved) return;
      event.preventDefault();
      event.returnValue = t.leave;
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saved]);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.target instanceof HTMLInputElement) return;
      const key = event.key.toLowerCase();
      if (key === "z") setState(event.shiftKey ? redo : undo);
      else if (key === "y") setState(redo);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  // Unknown automatic turns draw the page as it lies: finding 0 later must not draw it, and read it, a second time.
  const turnsOf = (page: Page) => page.edits.quarterTurns ?? page.autoTurns ?? 0;

  function isDrawn(page: Page) {
    const last = drawn.current.get(page.id);
    return last?.edits === page.edits && last.turns === turnsOf(page);
  }

  async function draw(pageId: string) {
    const page = live.current.state.session.pages[pageId];
    if (!page) return;
    const { edits } = page;
    const turns = turnsOf(page);
    setInFlight((current) => new Set(current).add(pageId));
    const bytes = await page.file.arrayBuffer();
    const kind = photoKind(new Uint8Array(bytes.slice(0, 16)));
    const captureDay = (kind === "jpeg" ? jpegCaptureDay(new Uint8Array(bytes)) : kind === "heic" ? heicCaptureDay(new Uint8Array(bytes)) : null) ?? undefined;
    const previous = page.status.kind === "ready" ? page.status.result : undefined;
    const current = live.current.view;
    const outcome = kind
      ? await scanner.scan({ pageId, photo: bytes, kind, edits: { ...edits, quarterTurns: turns }, detection: previous?.detection, withPreview: !previous }, current.kind === "correct" && current.pageId === pageId)
      : { ok: false as const, error: "unsupported" as const };
    drawn.current.set(pageId, { edits, turns });
    setState((state) => ({
      ...state,
      session: patched(state.session, pageId, {
        captureDay,
        status: outcome.ok ? { kind: "ready", result: { ...outcome.value, preview: outcome.value.preview ?? previous?.preview } } : { kind: "failed", error: outcome.error },
      }),
    }));
    setInFlight((current) => {
      const next = new Set(current);
      next.delete(pageId);
      return next;
    });
  }

  /** Turns the page upright the first time, then reads its lines; a page the reader cannot read keeps no text. */
  async function read(pageId: string) {
    setReading(pageId);
    try {
      const page = live.current.state.session.pages[pageId];
      if (page?.status.kind !== "ready") return;
      reader.current ??= import("../ocr/tesseract").then((module) => module.tesseractWorker(["ron", "fra", "eng"])).catch(() => null);
      const worker = await reader.current;
      const { result } = page.status;
      if (!worker) {
        setState((state) => ({ ...state, session: patched(state.session, pageId, { text: "unread" }) }));
        return;
      }
      const { uprightTurns, readLines } = await import("./reading");
      if (page.autoTurns === undefined && page.edits.quarterTurns === undefined) {
        const turns = await uprightTurns(worker, result.page);
        setState((state) => ({ ...state, session: patched(state.session, pageId, { autoTurns: turns }) }));
        if (turns !== 0) return;
      }
      const lines = await readLines(worker, result.page, result.width, result.height);
      setState((state) => ({ ...state, session: patched(state.session, pageId, { text: { lines, of: result.page } }) }));
    } catch {
      setState((state) => ({ ...state, session: patched(state.session, pageId, { text: "unread" }) }));
    } finally {
      setReading(null);
    }
  }

  useEffect(() => () => void reader.current?.then((worker) => worker?.terminate()), []);

  function act(op: Op) {
    setState((current) => perform(current, op));
    if (op.kind !== "edit") setManual(true);
    setSaved(false);
  }

  async function download(docs: Doc[]) {
    const toCheck = docs.flatMap((doc) => doc.pageIds.map((id) => live.current.state.session.pages[id]!)).filter(needsCheck).length;
    if (toCheck > 0 && !(await confirm(t.stillToCheck(toCheck, saving), { cancel: t.cancel, confirm: saving ? t.saveConfirm : t.download }))) return;
    // Read again: the reading, a redraw or Cmd+Z may have changed the pages while the question was open.
    const { session } = live.current.state;
    setBusy(true);
    setFailure(null);
    try {
      const files: NamedBytes[] = [];
      for (const doc of docs) {
        const ready = doc.pageIds.map((id) => session.pages[id]!).flatMap((page) => (page.status.kind === "ready" ? [{ page, result: page.status.result }] : []));
        if (ready.length === 0) continue;
        const pdfPages = await Promise.all(ready.map(async ({ page, result }) => ({
          jpeg: new Uint8Array(await result.page.arrayBuffer()), width: result.width, height: result.height, format: page.edits.format,
          lines: searchable && page.text && page.text !== "unread" && page.text.of === result.page ? page.text.lines.map(({ text, box }) => ({ text, ...box })) : undefined,
        })));
        const made = await engine.scanPdf(pdfPages, doc.name, `${doc.name.replace(/[\\/:*?"<>|]/g, "-")}.pdf`);
        if (made.ok) files.push(...made.value);
      }
      if (files.length === 0) return;
      const zipped = files.length > 1 ? await engine.zip(files) : null;
      if (zipped && !zipped.ok) return;
      const outcome = await saver.save(zipped ? zipped.value : files[0]!.bytes, zipped ? "scan.zip" : files[0]!.name, zipped ? "application/zip" : "application/pdf");
      if (outcome.kind !== "cancelled" && docs.length === session.documents.length) setSaved(true);
    } catch (problem) {
      setFailure(problem instanceof Error ? problem.message : String(problem));
    } finally {
      setBusy(false);
    }
  }

  const { session, history } = state;
  if (view.kind === "correct") {
    const order = session.documents.flatMap((doc) => doc.pageIds).filter((id) => !onlyToCheck || needsCheck(session.pages[id]!));
    const page = session.pages[view.pageId];
    const index = order.indexOf(view.pageId);
    if (page && session.documents.some((doc) => doc.pageIds.includes(page.id))) {
      return (
        <div class="scanner">
        <Correction page={page} t={t} Skeleton={Skeleton} rendering={inFlight.has(page.id)} isLast={index === order.length - 1} canUndo={history.undo.length > 0} canRedo={history.redo.length > 0}
          onEdit={(edits) => act({ kind: "edit", pageId: page.id, edits })} onUndo={() => setState(undo)} onRedo={() => setState(redo)}
          onNext={() => setView(index >= 0 && index < order.length - 1 ? { kind: "correct", pageId: order[index + 1]! } : { kind: "board" })} onBack={() => setView({ kind: "board" })} />
        </div>
      );
    }
  }
  return (
    <div class="scanner">
    {failure && <p class="hint" role="alert">{t.saveFailed} {failure}</p>}
    <Planche session={session} t={t} onlyToCheck={onlyToCheck} searchable={searchable} onSearchable={setSearchable}
      readingCount={reading ? Object.values(session.pages).filter((page) => page.status.kind === "ready" && page.text === undefined).length : 0} canUndo={history.undo.length > 0} canRedo={history.redo.length > 0} busy={busy}
      onOp={act} onUndo={() => setState(undo)} onRedo={() => setState(redo)} onCorrect={(pageId) => setView({ kind: "correct", pageId })}
      onDownload={(docs) => void download(docs)} onOnlyToCheck={setOnlyToCheck} onPhotos={onPhotos} saving={saving} confirm={confirm} />
    </div>
  );
}
