import type { TargetedKeyboardEvent, TargetedPointerEvent } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import type { DocumentSkeleton } from "../board/DocumentSkeleton";
import type { Engine } from "../engine/client";
import { Icon } from "../illustrations/Icon";
import type { PageSize, SignatureImage, SignaturePlacement } from "../engine/types";
import type { Lang } from "../tools";
import { fitPlacement, movePlacement, resizeFromCorner, signatureBounds, previewWidth, SignatureInputError, type SignatureProblem, sizePlacement } from "./geometry";
import { importSignatureImage } from "./image";
import { DrawingSurface } from "./DrawingSurface";
import { TypedSignature } from "./TypedSignature";
import { signatureText } from "./text";
import { useActionHeight } from "./actionHeight";
import "./signature.css";

export type SignatureDraft = {
  image: SignatureImage | null;
  imageId: string | null;
  imageKind: "signature" | "text";
  images: Record<string, SignatureImage>;
  placements: SignaturePlacement[];
  pageIndex: number;
  pageRotations: Record<number, number>;
  selectedId: string | null;
  processing: boolean;
};
export const emptySignature: SignatureDraft = { image: null, imageId: null, imageKind: "signature", images: {}, placements: [], pageIndex: 0, pageRotations: {}, selectedId: null, processing: false };
export type SignatureProps = {
  docId: string; sizes: PageSize[]; lang: Lang; value: SignatureDraft;
  onChange: (draft: SignatureDraft) => void; disabled: boolean;
  previewReady: boolean;
  onPreviewReady: (ready: boolean) => void;
  /** Passed by Board, not imported: a module shared with Board's chunk becomes one more request before LCP on every tool page. */
  engine: Pick<Engine, "thumbnail">; Skeleton: typeof DocumentSkeleton;
};

function keepImages(images: Record<string, SignatureImage>, placements: SignaturePlacement[], currentId: string | null) {
  const used = new Set(placements.map((placement) => placement.imageId));
  if (currentId) used.add(currentId);
  return Object.fromEntries(Object.entries(images).filter(([id]) => used.has(id)));
}

function removePlacement(value: SignatureDraft, id: string): SignatureDraft {
  const placements = value.placements.filter((placement) => placement.id !== id);
  return { ...value, selectedId: null, placements, images: keepImages(value.images, placements, value.imageId) };
}

function preparedDraft(value: SignatureDraft, image: SignatureImage | null, imageKind: SignatureDraft["imageKind"]): SignatureDraft {
  if (!image) return { ...value, image: null, imageId: null, imageKind, images: keepImages(value.images, value.placements, null) };
  const id = Object.entries(value.images).find(([, asset]) => asset === image)?.[0] ?? crypto.randomUUID();
  const images = { ...keepImages(value.images, value.placements, null), [id]: image };
  if ([...new Set(Object.values(images))].reduce((sum, asset) => sum + asset.width * asset.height, 0) > 16_000_000) throw new SignatureInputError("assets");
  return { ...value, image, imageId: id, imageKind, images, processing: false };
}

function addToPage(value: SignatureDraft, page: PageSize, point?: { x: number; y: number }): SignatureDraft {
  const { image, imageId } = value;
  if (!image || !imageId) return value;
  const onPage = value.placements.filter((placement) => placement.pageIndex === value.pageIndex).length;
  const width = value.imageKind === "text" ? Math.max(0.03, Math.min(0.65, image.width / image.height * 24 / page.width)) : 0.3;
  let placement = sizePlacement({ id: crypto.randomUUID(), imageId, pageIndex: value.pageIndex, x: 0.1, y: 0.65 + (onPage % 3) * 0.08, width, height: 0.1 }, width, image, page);
  if (point) placement = fitPlacement({ ...placement, x: point.x - placement.width / 2, y: point.y - placement.height / 2 }, page);
  return { ...value, placements: [...value.placements, placement], selectedId: placement.id };
}

function useSignatureUrls(images: Record<string, SignatureImage>, attempt: number) {
  type Asset = { url: string | null; failed: boolean };
  const cache = useRef(new Map<SignatureImage, Asset>());
  const previousAttempt = useRef(attempt);
  const [, changed] = useState(0);
  useEffect(() => {
    const wanted = new Set(Object.values(images));
    for (const [image, asset] of cache.current) {
      if (!wanted.has(image) || previousAttempt.current !== attempt) {
        if (asset.url) URL.revokeObjectURL(asset.url);
        cache.current.delete(image);
      }
    }
    previousAttempt.current = attempt;
    for (const image of wanted) {
      if (cache.current.has(image)) continue;
      const asset: Asset = { url: null, failed: false };
      cache.current.set(image, asset);
      const canvas = document.createElement("canvas");
      const release = () => { canvas.width = 0; canvas.height = 0; };
      const failed = () => { release(); if (cache.current.get(image) === asset) { asset.failed = true; changed((version) => version + 1); } };
      try {
        canvas.width = image.width; canvas.height = image.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) failed();
        else {
          ctx.putImageData(new ImageData(image.pixels, image.width, image.height), 0, 0);
          if (ctx.isContextLost?.()) failed();
          else canvas.toBlob((blob) => {
            release();
            if (cache.current.get(image) !== asset) return;
            if (!blob) { failed(); return; }
            asset.url = URL.createObjectURL(blob); changed((version) => version + 1);
          }, "image/png");
        }
      } catch { failed(); }
    }
    changed((version) => version + 1);
  }, [images, attempt]);
  useEffect(() => () => {
    for (const asset of cache.current.values()) if (asset.url) URL.revokeObjectURL(asset.url);
    cache.current.clear();
  }, []);
  return Object.fromEntries(Object.entries(images).map(([id, image]) => [id, cache.current.get(image)]));
}

export function SignatureWorkspace(props: SignatureProps) {
  const { docId, sizes, lang, value, onChange, disabled, engine, Skeleton } = props;
  const t = signatureText[lang];
  const pageIndex = Math.max(0, Math.min(value.pageIndex, sizes.length - 1));
  const size = sizes[pageIndex];
  const pageRotation = value.pageRotations[pageIndex] ?? 0;
  const sideways = pageRotation % 180 !== 0;
  const renderWidth = size ? previewWidth(size) : null;
  const [attempt, setAttempt] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [insertion, setInsertion] = useState<{ x: number; y: number; screenX: number; screenY: number } | null>(null);
  const outsideHadSelection = useRef(false);
  const pagePress = useRef<{ id: number; x: number; y: number; deselecting: boolean } | null>(null);
  const assets = useSignatureUrls(value.images, attempt);
  const assetsReady = Object.keys(value.images).every((id) => assets[id]?.url);
  const assetFailed = Object.values(assets).some((asset) => asset?.failed);
  const [preview, setPreview] = useState<{ key: string; url: string | null; failed: boolean } | null>(null);
  const requests = useRef(Promise.resolve());
  const workspaceRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const knownPlacements = useRef(new Set(value.placements.map((placement) => placement.id)));
  const reveal = useRef<string | null>(null);
  const live = useRef(props); live.current = props;
  const drag = useRef<{ id: number; startX: number; startY: number; pageWidth: number; pageHeight: number; placement: SignaturePlacement; mode: "move" | "resize" | "rotate"; centerX: number; centerY: number } | null>(null);
  const key = `${docId}:${pageIndex}`;
  const selected = value.placements.find((placement) => placement.id === value.selectedId && placement.pageIndex === pageIndex);
  let controls = selected && size ? signatureBounds(selected, size) : null;
  if (controls) {
    const { x, y, width, height } = controls;
    if (pageRotation === 90) controls = { x: 1 - y - height, y: x, width: height, height: width };
    if (pageRotation === 180) controls = { x: 1 - x - width, y: 1 - y - height, width, height };
    if (pageRotation === 270) controls = { x: y, y: 1 - x - width, width: height, height: width };
  }
  const controlsAbove = controls ? controls.y + controls.height > 0.85 : false;

  useActionHeight(workspaceRef);

  useEffect(() => {
    const isSelectionControl = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest(".signature-placement, .signature-actions, .signature-selection"));
    const clearSelection = () => {
      const current = live.current;
      if (!current.value.selectedId || current.disabled) return;
      drag.current = null;
      if (isSelectionControl(document.activeElement)) (document.activeElement as HTMLElement).blur();
      current.onChange({ ...current.value, selectedId: null });
    };
    const outside = (event: Event) => {
      if (event.target instanceof Element && event.target.closest(".signature-insert-here")) return;
      if (event.type === "pointerdown") outsideHadSelection.current = Boolean(live.current.value.selectedId);
      if (!isSelectionControl(event.target)) { clearSelection(); setInsertion(null); }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setInsertion(null);
      if (isSelectionControl(event.target)) clearSelection();
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  useEffect(() => {
    if (!size) return;
    let active = true, url: string | undefined;
    // Serialize page previews; a fast page change must not queue a document's worth of rasters.
    requests.current = requests.current.catch(() => undefined).then(async () => {
      if (!active) return;
      if (renderWidth === null) { setPreview({ key, url: null, failed: true }); return; }
      try {
        const result = await engine.thumbnail(docId, pageIndex, renderWidth);
        if (!active) return;
        if (result.ok) { url = URL.createObjectURL(result.value); setPreview({ key, url, failed: false }); }
        else setPreview({ key, url: null, failed: true });
      } catch { if (active) setPreview({ key, url: null, failed: true }); }
    });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [key, renderWidth, attempt]);

  const shown = preview?.key === key ? preview : null;
  const ready = Boolean(shown?.url && assetsReady);
  useLayoutEffect(() => {
    props.onPreviewReady(ready);
    return () => props.onPreviewReady(false);
  }, [ready, props.onPreviewReady]);

  useEffect(() => {
    const added = value.placements.filter((placement) => !knownPlacements.current.has(placement.id));
    knownPlacements.current = new Set(value.placements.map((placement) => placement.id));
    if (added.length) reveal.current = added[added.length - 1]!.id;
    if (!reveal.current) return;
    const button = pageRef.current?.querySelector<HTMLButtonElement>(`[data-signature-id="${CSS.escape(reveal.current)}"] .signature-move`);
    if (button) {
      reveal.current = null;
      button.focus({ preventScroll: true });
      button.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [value.placements, assetsReady, preview?.url]);

  useEffect(() => { setInsertion(null); pagePress.current = null; }, [pageIndex, pageRotation, zoom, value.imageId]);

  function proposeInsertion(event: TargetedPointerEvent<HTMLImageElement>) {
    const press = pagePress.current;
    pagePress.current = null;
    if (!press || press.id !== event.pointerId || press.deselecting || disabled || !ready || !value.image || !pageRef.current
      || Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8) return;
    const rect = pageRef.current.getBoundingClientRect();
    const screenX = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const screenY = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    const [x, y] = pageRotation === 90 ? [screenY, 1 - screenX] : pageRotation === 180 ? [1 - screenX, 1 - screenY] : pageRotation === 270 ? [1 - screenY, screenX] : [screenX, screenY];
    setInsertion({ x, y, screenX, screenY });
  }

  function update(placement: SignaturePlacement) {
    const current = live.current;
    if (current.disabled) return;
    const value = { ...current.value, selectedId: placement.id, placements: current.value.placements.map((p) => p.id === placement.id ? placement : p) };
    // Two key presses can arrive before the next render: the second one must start from the first.
    live.current = { ...current, value };
    current.onChange(value);
  }
  const latest = (placement: SignaturePlacement) => live.current.value.placements.find((p) => p.id === placement.id) ?? placement;
  function start(event: TargetedPointerEvent<HTMLElement>, rendered: SignaturePlacement, mode: "move" | "resize" | "rotate") {
    if (disabled || event.button !== 0 || !pageRef.current) return;
    const placement = latest(rendered);
    event.preventDefault(); event.stopPropagation();
    const element = pageRef.current.querySelector<HTMLElement>(`[data-signature-id="${CSS.escape(placement.id)}"]`);
    if (!element) return;
    const rect = element.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus();
    drag.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, pageWidth: pageRef.current.offsetWidth, pageHeight: pageRef.current.offsetHeight, placement, mode, centerX: rect.x + rect.width / 2, centerY: rect.y + rect.height / 2 };
    onChange({ ...live.current.value, selectedId: placement.id });
  }
  function move(event: TargetedPointerEvent<HTMLElement>) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId || !size || !value.image) return;
    if (current.mode === "rotate") {
      const start = Math.atan2(current.startY - current.centerY, current.startX - current.centerX);
      const next = Math.atan2(event.clientY - current.centerY, event.clientX - current.centerX);
      let delta = (next - start) * 180 / Math.PI;
      if (event.shiftKey) delta = Math.round(delta / 15) * 15;
      rotatePlacement(current.placement, (current.placement.rotation ?? 0) + delta);
      return;
    }
    const angle = pageRotation * Math.PI / 180;
    const screenX = event.clientX - current.startX, screenY = event.clientY - current.startY;
    const x = Math.cos(angle) * screenX + Math.sin(angle) * screenY;
    const y = -Math.sin(angle) * screenX + Math.cos(angle) * screenY;
    const dx = x / current.pageWidth, dy = y / current.pageHeight;
    update(current.mode === "resize" ? resizeFromCorner(current.placement, dx, dy, size)
      : movePlacement(current.placement, current.placement.x + dx, current.placement.y + dy, size));
  }
  function rotatePlacement(placement: SignaturePlacement, rotation: number) {
    if (size) update(fitPlacement({ ...placement, rotation: (rotation % 360 + 360) % 360 }, size));
  }
  function rotateKeyboard(event: TargetedKeyboardEvent<HTMLElement>, placement: SignaturePlacement) {
    const direction = ["ArrowRight", "ArrowUp", "+", "="].includes(event.key) ? 1 : ["ArrowLeft", "ArrowDown", "-"].includes(event.key) ? -1 : 0;
    if (!direction) return;
    event.preventDefault(); event.stopPropagation();
    const current = latest(placement);
    rotatePlacement(current, (current.rotation ?? 0) + direction * (event.shiftKey ? 15 : 1));
  }

  function keyboard(event: TargetedKeyboardEvent<HTMLElement>, rendered: SignaturePlacement) {
    const placement = latest(rendered);
    const image = value.images[placement.imageId ?? ""];
    if (disabled || !image || !size) return;
    const delta = event.shiftKey ? 0.03 : 0.005;
    const changes: Record<string, [number, number]> = { ArrowLeft: [-delta, 0], ArrowRight: [delta, 0], ArrowUp: [0, -delta], ArrowDown: [0, delta] };
    const direction = changes[event.key];
    if (direction) {
      const angle = pageRotation * Math.PI / 180;
      const dx = direction[0] * Math.cos(angle) + direction[1] * Math.sin(angle);
      const dy = -direction[0] * Math.sin(angle) + direction[1] * Math.cos(angle);
      update(movePlacement(placement, placement.x + dx, placement.y + dy, size));
    }
    else if (["+", "=", "-"].includes(event.key)) update(sizePlacement(placement, placement.width + (event.key === "-" ? -0.02 : 0.02), image, size));
    else return;
    event.preventDefault(); event.stopPropagation();
  }
  return <div class="signature-workspace" ref={workspaceRef}>
    <p class="signature-hint signature-workspace-help" id="signature-movement-help">
      <span aria-hidden={Boolean(selected)}>{t.placeHint}</span>
      <span aria-hidden={!selected}>{t.instructions}</span>
    </p>
    {(assetFailed || shown?.failed) && <p role="alert">{t.previewError} <button type="button" disabled={disabled} onClick={() => setAttempt(attempt + 1)}>{t.retry}</button></p>}
    <div class="signature-viewport">
    {size && <div class="signature-page-frame" style={{ width: `${zoom}%`, maxWidth: `${50 * zoom / 100}rem`, aspectRatio: sideways ? `${size.height} / ${size.width}` : `${size.width} / ${size.height}` }}>
    <div class={`signature-sheet${value.image && !selected && ready ? " can-insert" : ""}`} ref={pageRef} style={{ width: sideways ? `${size.width / size.height * 100}%` : "100%", aspectRatio: `${size.width} / ${size.height}`, transform: `translate(-50%, -50%) rotate(${pageRotation}deg)` }} aria-busy={!shown}>
      {shown?.url ? <img class="signature-page-image" src={shown.url} alt={`${t.preview} ${pageIndex + 1}`} draggable={false}
        onPointerDown={(event) => { if (event.button === 0 && event.isPrimary) pagePress.current = { id: event.pointerId, x: event.clientX, y: event.clientY, deselecting: outsideHadSelection.current }; }}
        onPointerUp={proposeInsertion} onPointerCancel={() => { pagePress.current = null; }} /> : shown?.failed ? <p role="status">{t.previewError}</p> : <Skeleton label={t.loading} />}
      {shown?.url && value.placements.filter((p) => p.pageIndex === pageIndex && assets[p.imageId ?? ""]?.url).map((placement) => <div key={placement.id} data-signature-id={placement.id}
        class={`signature-placement${value.selectedId === placement.id ? " is-selected" : ""}`}
        style={{ left: `${placement.x * 100}%`, top: `${placement.y * 100}%`, width: `${placement.width * 100}%`, height: `${placement.height * 100}%`, transform: `rotate(${placement.rotation ?? 0}deg)` }}>
        <button type="button" class="signature-move" aria-label={t.placement} aria-describedby="signature-movement-help" aria-pressed={value.selectedId === placement.id} disabled={disabled}
          onFocus={() => { if (live.current.value.selectedId !== placement.id) onChange({ ...live.current.value, selectedId: placement.id }); }}
          onPointerDown={(event) => start(event, placement, "move")} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }} onKeyDown={(event) => keyboard(event, placement)}>
          <img src={assets[placement.imageId ?? ""]?.url ?? undefined} alt="" draggable={false} />
        </button>
        {value.selectedId === placement.id && <button type="button" class="signature-resize" aria-label={t.resize} title={t.resize} aria-describedby="signature-movement-help" disabled={disabled}
          onPointerDown={(event) => start(event, placement, "resize")} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }} onKeyDown={(event) => keyboard(event, placement)}><span aria-hidden="true" /></button>}
      </div>)}
    </div>
    {insertion && ready && value.image && !disabled && <button type="button" class="signature-insert-here" style={{
      left: `clamp(70px, ${insertion.screenX * 100}%, calc(100% - 70px))`, top: `clamp(24px, ${insertion.screenY * 100}%, calc(100% - 24px))`,
    }} onClick={() => { onChange(addToPage(value, size, insertion)); setInsertion(null); }}><Icon name="plus" size={18} />{t.addHere}</button>}
    {shown?.url && selected && controls && <div class="signature-actions" style={{
      left: `clamp(70px, ${(controls.x + controls.width / 2) * 100}%, calc(100% - 70px))`,
      top: controlsAbove ? `calc(${controls.y * 100}% - 8px)` : `calc(${(controls.y + controls.height) * 100}% + 8px)`,
      transform: controlsAbove ? "translate(-50%, -100%)" : "translateX(-50%)",
    }}>
      <button type="button" class="signature-drag" aria-label={t.moveSignature} title={t.moveSignature} aria-describedby="signature-movement-help" disabled={disabled}
        onPointerDown={(event) => start(event, selected, "move")} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
        onKeyDown={(event) => keyboard(event, selected)}><span><Icon name="move" size={18} /></span></button>
      <button type="button" class="signature-rotate" aria-label={t.rotateSignature} title={`${t.rotateSignature} · ${Math.round(selected.rotation ?? 0)}°`} aria-describedby="signature-movement-help" disabled={disabled}
        onPointerDown={(event) => start(event, selected, "rotate")} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
        onKeyDown={(event) => rotateKeyboard(event, selected)}><span><Icon name="rotate" size={18} /></span></button>
      <button type="button" class="signature-delete" aria-label={t.remove} title={t.remove} disabled={disabled}
        onClick={() => onChange(removePlacement(live.current.value, selected.id))}><span><Icon name="delete" size={18} /></span></button>
    </div>}
    </div>}
    </div>
    <div class="signature-pagination">
      <div class="signature-toolbar-group">
      <button type="button" disabled={disabled || pageIndex === 0} onClick={() => onChange({ ...value, pageIndex: pageIndex - 1, selectedId: null })} aria-label={t.previous}>←</button>
      <label>{t.page} <select aria-label={t.page} value={pageIndex} disabled={disabled} onChange={(event) => onChange({ ...value, pageIndex: Number(event.currentTarget.value), selectedId: null })}>
        {sizes.map((_, index) => <option value={index} key={index}>{index + 1}</option>)}
      </select> {t.of} {sizes.length}</label>
      <button type="button" disabled={disabled || pageIndex >= sizes.length - 1} onClick={() => onChange({ ...value, pageIndex: pageIndex + 1, selectedId: null })} aria-label={t.next}>→</button>
      </div>
      <div class="signature-toolbar-group">
        <button type="button" aria-label={t.zoomOut} title={t.zoomOut} disabled={zoom <= 50} onClick={() => setZoom(Math.max(50, zoom - 25))}><Icon name="minus" size={18} /></button>
        <button type="button" class="signature-zoom" aria-label={t.resetZoom} title={t.resetZoom} onClick={() => setZoom(100)}>{zoom}%</button>
        <button type="button" aria-label={t.zoomIn} title={t.zoomIn} disabled={zoom >= 200} onClick={() => setZoom(Math.min(200, zoom + 25))}><Icon name="plus" size={18} /></button>
        <button type="button" aria-label={t.rotatePage} title={t.rotatePage} disabled={disabled} onClick={() => onChange({ ...value, pageRotations: { ...value.pageRotations, [pageIndex]: (pageRotation + 90) % 360 } })}><Icon name="rotate" size={18} /></button>
      </div>
    </div>
  </div>;
}

export function SignatureAddAction({ sizes, lang, value, onChange, disabled, previewReady }: SignatureProps) {
  const page = sizes[value.pageIndex];
  return <button type="button" class="signature-add" disabled={disabled || value.processing || !value.image || !page || !previewReady}
    onClick={() => { if (page) onChange(addToPage(value, page)); }}><Icon name="plus" size={18} />{signatureText[lang].add}</button>;
}

export function SignatureOptions(props: SignatureProps) {
  const { sizes, lang, value, onChange, disabled } = props;
  const t = signatureText[lang];
  const [mode, setMode] = useState<"draw" | "import" | "text">("draw");
  const [textOpened, setTextOpened] = useState(false);
  const modeRef = useRef(mode); modeRef.current = mode;
  const candidates = useRef<Record<typeof mode, SignatureImage | null>>({ draw: null, text: null, import: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<SignatureProblem | null>(null);
  const generation = useRef(0);
  const live = useRef(props); live.current = props;
  useEffect(() => {
    return () => { generation.current++; };
  }, []);
  const selected = value.placements.find((p) => p.id === value.selectedId);
  function prepare(image: SignatureImage | null, source: typeof mode) {
    candidates.current[source] = image;
    const current = live.current;
    if (current.disabled || modeRef.current !== source) return;
    try { current.onChange(preparedDraft(current.value, image, source === "text" ? "text" : "signature")); setError(null); }
    catch (cause) { current.onChange({ ...preparedDraft(current.value, null, source === "text" ? "text" : "signature"), processing: false }); failure(cause); }
  }
  function switchMode(next: typeof mode) {
    modeRef.current = next; setMode(next);
    if (next === "text") setTextOpened(true);
    prepare(candidates.current[next], next);
  }
  function use(image: SignatureImage, source: typeof mode) {
    const current = live.current;
    const page = current.sizes[current.value.pageIndex];
    if (current.disabled || !current.previewReady || !page) return;
    const draft = preparedDraft(current.value, image, source === "text" ? "text" : "signature");
    current.onChange(addToPage(draft, page)); setError(null);
  }
  function failure(cause: unknown) { setError(cause instanceof SignatureInputError ? cause.problem : "decode"); }
  async function upload(file: File | undefined) {
    if (!file) return;
    const id = ++generation.current; setBusy(true); setError(null);
    live.current.onChange({ ...live.current.value, processing: true });
    try { const image = await importSignatureImage(file); if (id === generation.current) prepare(image, "import"); }
    catch (cause) { if (id === generation.current) { failure(cause); live.current.onChange({ ...live.current.value, processing: false }); } }
    finally { if (id === generation.current) setBusy(false); }
  }
  return <div class="signature-options">
    <div class="signature-modes" role="group" aria-label={t.placement}>
      <button type="button" aria-pressed={mode === "draw"} disabled={disabled || busy} onClick={() => switchMode("draw")}>{t.draw}</button>
      <button type="button" aria-pressed={mode === "text"} disabled={disabled || busy} onClick={() => switchMode("text")}>{t.textMode}</button>
      <button type="button" aria-pressed={mode === "import"} disabled={disabled || busy} onClick={() => switchMode("import")}>{t.import}</button>
    </div>
    <div hidden={mode !== "draw"}>
      <DrawingSurface hideAction lang={lang} disabled={disabled || busy} actionDisabled={!props.previewReady} onReady={(image) => prepare(image, "draw")} onUse={(image) => use(image, "draw")} onError={failure} />
    </div>
    <div hidden={mode !== "text"}>{textOpened && <TypedSignature lang={lang} disabled={disabled || busy} onReady={(image) => prepare(image, "text")} />}</div>
    <div hidden={mode !== "import"} class="signature-import"
      onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); }}
      onDrop={(event) => { event.preventDefault(); if (!disabled && !busy) void upload(event.dataTransfer?.files[0]); }}>
      <label>{t.choose}<input type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" disabled={disabled || busy} onChange={(event) => { void upload(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} /></label>
      <p class="signature-hint">{t.formats}</p>
    </div>
    {error && <p role="alert" class="signature-error">{t[error]}</p>}
    {busy && <p role="status">{t.loadingImage}</p>}
    <p class="signature-hint">{t.placeHint}</p>
    {selected && value.image && <div class="signature-selection">
      <label>{t.size}<input type="range" min="3" max="100" step="1" value={Math.round(selected.width * 100)} disabled={disabled || busy} onInput={(event) => {
        const page = sizes[selected.pageIndex];
        const image = value.images[selected.imageId ?? ""];
        if (!page || !image) return;
        const placement = sizePlacement(selected, Number(event.currentTarget.value) / 100, image, page);
        onChange({ ...value, placements: value.placements.map((p) => p.id === selected.id ? placement : p) });
      }} /></label>
      <button type="button" disabled={disabled || busy} onClick={() => onChange(removePlacement(value, selected.id))}>{t.remove}</button>
    </div>}
    <p class="signature-hint">{t.note}</p>
  </div>;
}
