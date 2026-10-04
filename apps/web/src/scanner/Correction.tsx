import type { TargetedPointerEvent } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { DocumentSkeleton } from "../board/DocumentSkeleton";
import { Icon } from "../illustrations/Icon";
import { turnedMark } from "../scan/erase";
import { cornersOf, isUsable, type Point, type Quad, quadOf } from "../scan/geometry";
import type { PageFormat } from "../scan/sizing";
import { needsCheck, useBlobUrl } from "./pages";
import type { Edits, Page } from "./session";
import type { ScannerTexts } from "./texts";

type Props = {
  page: Page; t: ScannerTexts; Skeleton: typeof DocumentSkeleton; rendering: boolean; isLast: boolean; canUndo: boolean; canRedo: boolean;
  onEdit: (edits: Edits) => void; onUndo: () => void; onRedo: () => void; onNext: () => void; onBack: () => void;
};

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const loupeZoom = 3;
const loupeSize = 112;

export function Correction({ page, t, Skeleton, rendering, isLast, canUndo, canRedo, onEdit, onUndo, onRedo, onNext, onBack }: Props) {
  const result = page.status.kind === "ready" ? page.status.result : undefined;
  const [tool, setTool] = useState<"corners" | "eraser">("corners");
  const [radius, setRadius] = useState(0.02);
  /** `frame`: the photo's size on screen when the corner was taken, in CSS pixels, for the loupe. */
  const [draft, setDraft] = useState<{ quad: Quad; corner: number; frame: { width: number; height: number } } | null>(null);
  const [stroke, setStroke] = useState<Point[] | null>(null);
  const [crossed, setCrossed] = useState(false);
  const photo = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const previewUrl = useBlobUrl(result?.preview?.image);
  const pageUrl = useBlobUrl(result?.page);
  const edits = page.edits;
  const quad = draft?.quad ?? edits.quad ?? result?.quad;

  useEffect(() => {
    if (!crossed) return;
    const timer = setTimeout(() => setCrossed(false), 3000);
    return () => clearTimeout(timer);
  }, [crossed]);
  useEffect(() => setCrossed(false), [edits]);

  const at = (event: PointerEvent, element: HTMLElement | null): Point => {
    const rect = element!.getBoundingClientRect();
    return { x: clamp((event.clientX - rect.left) / rect.width), y: clamp((event.clientY - rect.top) / rect.height) };
  };

  function moveCorner(event: TargetedPointerEvent<HTMLElement>, corner: number) {
    if (!draft) return;
    const corners = cornersOf(draft.quad);
    corners[corner] = at(event, photo.current);
    setDraft({ ...draft, quad: quadOf(corners), corner });
  }

  function dropCorner() {
    if (!draft) return;
    if (isUsable(draft.quad)) onEdit({ ...edits, quad: draft.quad });
    else setCrossed(true);
    setDraft(null);
  }

  function rotate() {
    if (!result) return;
    const size = { width: result.width, height: result.height };
    onEdit({ ...edits, quarterTurns: ((edits.quarterTurns ?? result.quarterTurns) + 1) % 4, erase: edits.erase.map((mark) => turnedMark(mark, 1, size)) });
  }

  const reasons = result && needsCheck(page) ? result.detection.reasons.map((reason) => t.reasons[reason]) : [];
  const held = draft && previewUrl ? cornersOf(draft.quad)[draft.corner] : undefined;
  return (
    <div class="correction">
      <div class="correction-bar">
        <button type="button" onClick={onBack}><Icon name="back" size={18} />{t.back}</button>
        <div class="correction-tools" role="group">
          <button type="button" aria-pressed={tool === "corners"} onClick={() => setTool("corners")}>{t.corners}</button>
          <button type="button" aria-pressed={tool === "eraser"} onClick={() => setTool("eraser")}>{t.eraser}</button>
          <label class="correction-size">{t.eraserSize}
            <input type="range" min="0.005" max="0.06" step="0.005" value={radius} disabled={tool !== "eraser"} onInput={(event) => setRadius(Number(event.currentTarget.value))} />
          </label>
          <button type="button" aria-label={t.rotate} title={t.rotate} disabled={!result} onClick={rotate}><Icon name="rotate" size={18} /></button>
          <button type="button" aria-label={t.undo} title={t.undo} disabled={!canUndo} onClick={onUndo}><Icon name="undo" size={18} /></button>
          <button type="button" class="redo" aria-label={t.redo} title={t.redo} disabled={!canRedo} onClick={onRedo}><Icon name="undo" size={18} /></button>
        </div>
        <button type="button" class="primary" onClick={onNext}>{isLast ? t.finish : t.next}</button>
      </div>
      <div class="correction-panes">
        <figure class="correction-photo">
          <figcaption>{t.photo}</figcaption>
          {previewUrl && result?.preview && quad ? (
            <div class="correction-frame" ref={photo} style={{ "--ratio": result.preview.width / result.preview.height }}>
              <img src={previewUrl} alt="" draggable={false} />
              <svg viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
                <polygon points={cornersOf(quad).map((corner) => `${corner.x},${corner.y}`).join(" ")} />
              </svg>
              {cornersOf(quad).map((corner, index) => (
                <button type="button" key={index} class="correction-corner" style={{ left: `${corner.x * 100}%`, top: `${corner.y * 100}%` }} aria-label={`${t.corners} ${index + 1}`}
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    const { width, height } = photo.current!.getBoundingClientRect();
                    setDraft({ quad, corner: index, frame: { width, height } });
                  }}
                  onPointerMove={(event) => moveCorner(event, index)} onPointerUp={dropCorner} onPointerCancel={() => setDraft(null)} />
              ))}
              {held && draft && (
                // The photo drawn three times larger than its frame, moved so that the held point sits at the loupe's centre.
                <span class="correction-loupe" aria-hidden="true" style={{
                  left: `${held.x * 100}%`, top: `${held.y * 100}%`, width: `${loupeSize}px`, height: `${loupeSize}px`, margin: `${-loupeSize - 40}px 0 0 ${-loupeSize / 2}px`,
                  backgroundImage: `url(${previewUrl})`, backgroundSize: `${draft.frame.width * loupeZoom}px ${draft.frame.height * loupeZoom}px`,
                  backgroundPosition: `${loupeSize / 2 - held.x * draft.frame.width * loupeZoom}px ${loupeSize / 2 - held.y * draft.frame.height * loupeZoom}px`,
                }} />
              )}
            </div>
          ) : page.status.kind === "failed" ? <p class="correction-waiting" role="alert">{t.failures[page.status.error]}</p>
            : <div class="correction-frame correction-placeholder" style={{ "--ratio": 3 / 4 }} role="status" aria-label={t.waiting} />}
          {crossed && <p role="alert" class="correction-crossed">{t.crossed}</p>}
        </figure>
        <figure class="correction-result">
          <figcaption>{t.result}</figcaption>
          {pageUrl && result ? (
            <div class={`correction-sheet${tool === "eraser" ? " erasing" : ""}`} ref={sheet} style={{ "--ratio": result.width / result.height }}
              onPointerDown={(event) => {
                if (tool !== "eraser") return;
                event.currentTarget.setPointerCapture(event.pointerId);
                setStroke([at(event, sheet.current)]);
              }}
              onPointerMove={(event) => stroke && setStroke([...stroke, at(event, sheet.current)])}
              onPointerUp={() => {
                if (stroke) onEdit({ ...edits, erase: [...edits.erase, { kind: "stroke", points: stroke, radius }] });
                setStroke(null);
              }}>
              <img src={pageUrl} alt="" draggable={false} />
              {stroke && (
                <svg viewBox={`0 0 ${result.width} ${result.height}`} aria-hidden="true">
                  <polyline points={stroke.map((point) => `${point.x * result.width},${point.y * result.height}`).join(" ")} stroke-width={2 * radius * result.width} />
                </svg>
              )}
              {rendering && <span class="correction-updating" role="status">{t.updating}</span>}
            </div>
          ) : page.status.kind !== "failed" && <div class="correction-sheet correction-paper" style={{ "--ratio": 1654 / 2339 }}><Skeleton label={t.waiting} /></div>}
        </figure>
      </div>
      <p class="correction-status" role="status">
        {reasons.length > 0 ? <span class="correction-warning">⚠ {reasons.join(" ")}</span> : edits.quad ? t.manualCorners : ""} {tool === "corners" ? t.cornersHint : t.eraserHint}
      </p>
      {result && (
        <div class="correction-settings">
          <label>{t.render}
            <select value={edits.mode ?? result.mode} onChange={(event) => onEdit({ ...edits, mode: event.currentTarget.value as "document" | "color" })}>
              <option value="document">{t.document}</option>
              <option value="color">{t.color}</option>
            </select>
          </label>
          <label>{t.watermark}
            <select value={edits.keepWatermark === undefined ? "auto" : edits.keepWatermark ? "keep" : "drop"} disabled={(edits.mode ?? result.mode) === "color"}
              onChange={(event) => {
                const value = event.currentTarget.value;
                onEdit({ ...edits, keepWatermark: value === "auto" ? undefined : value === "keep" });
              }}>
              <option value="auto">{t.watermarkAuto(result.keepWatermark)}</option>
              <option value="keep">{t.watermarkKeep}</option>
              <option value="drop">{t.watermarkDrop}</option>
            </select>
          </label>
          <label>{t.format}
            <select value={edits.format} onChange={(event) => onEdit({ ...edits, format: event.currentTarget.value as PageFormat })}>
              {(["auto", "a4", "a5", "letter"] as const).map((format) => <option key={format} value={format}>{t.formats[format]}</option>)}
            </select>
          </label>
          <button type="button" disabled={!edits.quad} onClick={() => onEdit({ ...edits, quad: undefined })}>{t.restoreAuto}</button>
        </div>
      )}
    </div>
  );
}
