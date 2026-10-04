export type InkPoint = { x: number; y: number; time: number };
export type InkSegment =
  | { kind: "dot"; at: InkPoint }
  | { kind: "curve"; from: InkPoint; control: InkPoint; to: InkPoint }
  | { kind: "line"; from: InkPoint; to: InkPoint };
export const drawingWidth = 640;
export const drawingHeight = 240;
export const maxDrawingPoints = 12_000;
const midpoint = (a: InkPoint, b: InkPoint): InkPoint => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, time: b.time });

export function smoothPoint(previous: InkPoint, raw: InkPoint, pointerType: string): InkPoint {
  if (pointerType !== "mouse") return raw;
  const speed = Math.hypot(raw.x - previous.x, raw.y - previous.y) / Math.max(1, raw.time - previous.time);
  const amount = Math.min(0.9, 0.4 + speed * 0.16);
  return { x: previous.x + (raw.x - previous.x) * amount, y: previous.y + (raw.y - previous.y) * amount, time: raw.time };
}

/** Every new sample commits one bounded segment; replay is reserved for undo or changing the surface. */
export class SignatureDrawing {
  readonly strokes: InkPoint[][] = [];
  pointCount = 0;
  private active: InkPoint[] | null = null;
  private cursor: InkPoint | null = null;
  private pointerType = "mouse";
  get full() { return this.pointCount >= maxDrawingPoints; }
  get hasInk() { return this.strokes.length > 0; }
  begin(point: InkPoint, pointerType: string): InkSegment | null {
    if (this.full) return null;
    this.active = [point]; this.strokes.push(this.active); this.pointCount++;
    this.cursor = point; this.pointerType = pointerType;
    return { kind: "dot", at: point };
  }
  append(raw: InkPoint, exact = false): InkSegment | null {
    if (!this.active || !this.cursor || this.full) return null;
    const previous = this.active[this.active.length - 1]!;
    if (raw.x === previous.x && raw.y === previous.y) return null;
    const next = exact ? raw : smoothPoint(previous, raw, this.pointerType);
    const end = midpoint(previous, next);
    const segment: InkSegment = { kind: "curve", from: this.cursor, control: previous, to: end };
    this.active.push(next); this.pointCount++; this.cursor = end;
    return segment;
  }
  end(): InkSegment | null {
    if (!this.active || !this.cursor) return null;
    const last = this.active[this.active.length - 1]!;
    const segment: InkSegment = { kind: "line", from: this.cursor, to: last };
    this.active = null; this.cursor = null;
    return segment;
  }
  undo() {
    this.end();
    this.pointCount -= this.strokes.pop()?.length ?? 0;
  }
  clear() { this.end(); this.strokes.length = 0; this.pointCount = 0; }
  replay(draw: (segment: InkSegment) => void) {
    for (const stroke of this.strokes) {
      let cursor = stroke[0]!;
      draw({ kind: "dot", at: cursor });
      for (let index = 1; index < stroke.length; index++) {
        const previous = stroke[index - 1]!, end = midpoint(previous, stroke[index]!);
        draw({ kind: "curve", from: cursor, control: previous, to: end });
        cursor = end;
      }
      draw({ kind: "line", from: cursor, to: stroke[stroke.length - 1]! });
    }
  }
}

export function paintSegment(ctx: CanvasRenderingContext2D, segment: InkSegment | null) {
  if (!segment) return;
  ctx.beginPath();
  if (segment.kind === "dot") {
    ctx.arc(segment.at.x, segment.at.y, 1.5, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.moveTo(segment.from.x, segment.from.y);
    if (segment.kind === "curve") ctx.quadraticCurveTo(segment.control.x, segment.control.y, segment.to.x, segment.to.y);
    else ctx.lineTo(segment.to.x, segment.to.y);
    ctx.stroke();
  }
}
