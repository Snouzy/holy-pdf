import type { TargetedPointerEvent } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { SignatureImage } from "../engine/types";
import type { Lang } from "../tools";
import { drawingHeight, drawingWidth, paintSegment, SignatureDrawing, type InkPoint } from "./drawing";
import { drawingImage } from "./image";
import { SignatureInputError } from "./geometry";
import { signatureText } from "./text";
import "./drawing.css";

type Props = { lang: Lang; disabled: boolean; actionDisabled?: boolean; hideAction?: boolean; onUse: (image: SignatureImage) => void; onReady?: (image: SignatureImage | null) => void; onError: (cause: unknown) => void };
export function DrawingSurface({ lang, disabled, actionDisabled, hideAction, onUse, onReady, onError }: Props) {
  const t = signatureText[lang];
  const model = useRef(new SignatureDrawing());
  const inline = useRef<HTMLCanvasElement>(null);
  const enlarged = useRef<HTMLCanvasElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const pointer = useRef<{ id: number; canvas: HTMLCanvasElement; rect: DOMRect; context: CanvasRenderingContext2D } | null>(null);
  const image = useRef<SignatureImage | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const [hasInk, setHasInk] = useState(false);
  const [ready, setReady] = useState(false);
  const [full, setFull] = useState(false);
  function invalidate() { image.current = null; setReady(false); onReadyRef.current?.(null); }
  function prepare(canvas: HTMLCanvasElement | null) {
    if (!canvas || !model.current.hasInk) return;
    try { image.current = drawingImage(canvas); setReady(true); }
    catch (cause) { invalidate(); onError(cause); return; }
    onReadyRef.current?.(image.current);
  }
  function context(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx || ctx.isContextLost?.()) throw new SignatureInputError("decode");
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.strokeStyle = "#141A2E"; ctx.fillStyle = "#141A2E";
    ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.lineJoin = "round";
    return ctx;
  }
  function replay(canvas: HTMLCanvasElement | null) {
    if (!canvas) return;
    try {
      const ctx = context(canvas);
      ctx.clearRect(0, 0, drawingWidth, drawingHeight);
      model.current.replay((segment) => paintSegment(ctx, segment));
    } catch (cause) { onError(cause); }
  }
  function changed() { setHasInk(model.current.hasInk); setFull(model.current.full); }
  function finish() {
    const current = pointer.current;
    if (!current) return;
    paintSegment(current.context, model.current.end());
    pointer.current = null;
    if (current.canvas.hasPointerCapture(current.id)) current.canvas.releasePointerCapture(current.id);
    changed();
    prepare(current.canvas);
  }
  function point(event: PointerEvent, rect: DOMRect): InkPoint {
    return { x: Math.max(0, Math.min(drawingWidth, (event.clientX - rect.left) * drawingWidth / rect.width)),
      y: Math.max(0, Math.min(drawingHeight, (event.clientY - rect.top) * drawingHeight / rect.height)), time: event.timeStamp };
  }
  function start(event: TargetedPointerEvent<HTMLCanvasElement>) {
    if (disabled || pointer.current || event.button !== 0 || !event.isPrimary || model.current.full) return;
    event.preventDefault();
    invalidate();
    try {
      const canvas = event.currentTarget, ctx = context(canvas), rect = canvas.getBoundingClientRect();
      canvas.setPointerCapture(event.pointerId);
      pointer.current = { id: event.pointerId, canvas, rect, context: ctx };
      paintSegment(ctx, model.current.begin(point(event, rect), event.pointerType));
    } catch (cause) { onError(cause); }
  }
  function move(event: TargetedPointerEvent<HTMLCanvasElement>) {
    const current = pointer.current;
    if (!current || current.id !== event.pointerId || disabled) return;
    const samples = event.getCoalescedEvents?.() ?? [];
    for (const sample of samples.length ? samples : [event]) {
      paintSegment(current.context, model.current.append(point(sample, current.rect)));
      if (model.current.full) { finish(); break; }
    }
  }
  function end(event: TargetedPointerEvent<HTMLCanvasElement>) {
    const current = pointer.current;
    if (!current || current.id !== event.pointerId) return;
    paintSegment(current.context, model.current.append(point(event, current.rect), true));
    finish();
  }
  function edit(clear = false) {
    finish();
    invalidate();
    if (clear) model.current.clear(); else model.current.undo();
    const canvas = dialog.current?.open ? enlarged.current : inline.current;
    replay(canvas); changed(); prepare(canvas);
  }
  function use() {
    finish();
    try {
      if (!image.current) return;
      onUse(image.current); dialog.current?.close();
    } catch (cause) { onError(cause); }
  }
  useEffect(() => {
    const canvases = [inline.current, enlarged.current];
    return () => { pointer.current = null; image.current = null; model.current.clear(); for (const canvas of canvases) if (canvas) { canvas.width = 0; canvas.height = 0; } };
  }, []);
  useEffect(() => { if (disabled) finish(); }, [disabled]);
  const handlers = { onPointerDown: start, onPointerMove: move, onPointerUp: end, onPointerCancel: finish, onLostPointerCapture: finish };
  const actions = (showAdd = !hideAction) => <div class="signature-buttons">
    {showAdd && <button class="signature-add" type="button" disabled={disabled || actionDisabled || !ready} onClick={use}>{t.use}</button>}
    <button type="button" disabled={disabled || !hasInk} onClick={() => edit()}>{t.undoStroke}</button>
    <button type="button" disabled={disabled || !hasInk} onClick={() => edit(true)}>{t.clear}</button>
  </div>;
  return <div class="signature-drawing">
    <canvas ref={inline} width={drawingWidth * 2} height={drawingHeight * 2} aria-label={t.drawLabel} {...handlers} />
    <button ref={opener} type="button" class="signature-enlarge" disabled={disabled} onClick={() => { finish(); dialog.current?.showModal(); replay(enlarged.current); }}>{t.enlargeDrawing}</button>
    {actions()}
    {full && <p role="status" class="signature-hint">{t.drawingLimit}</p>}
    <dialog ref={dialog} class="signature-drawing-dialog" aria-labelledby="signature-drawing-title" onClose={() => { finish(); replay(inline.current); opener.current?.focus({ preventScroll: true }); }}>
      <div class="signature-drawing-heading"><h2 id="signature-drawing-title">{t.enlargeDrawing}</h2><button type="button" onClick={() => dialog.current?.close()} aria-label={t.closeDrawing}>×</button></div>
      <p class="signature-hint">{t.drawingHelp}</p>
      <canvas ref={enlarged} width={drawingWidth * 2} height={drawingHeight * 2} aria-label={t.largeDrawLabel} {...handlers} />
      {actions(true)}
      {full && <p role="status" class="signature-hint">{t.drawingLimit}</p>}
    </dialog>
  </div>;
}
