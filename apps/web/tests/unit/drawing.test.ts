import { describe, expect, it } from "vitest";
import { maxDrawingPoints, SignatureDrawing, smoothPoint, type InkPoint, type InkSegment } from "../../src/signature/drawing";
const point = (x: number, y: number, time = 0): InkPoint => ({ x, y, time });

describe("incremental signature drawing", () => {
  it("rounds a corner with a real quadratic curve rather than a raw polyline", () => {
    const drawing = new SignatureDrawing();
    expect(drawing.begin(point(0, 0), "pen")).toEqual({ kind: "dot", at: point(0, 0) });
    drawing.append(point(10, 0));
    expect(drawing.append(point(10, 10))).toEqual({ kind: "curve", from: point(5, 0), control: point(10, 0), to: point(10, 5) });
    expect(drawing.end()).toEqual({ kind: "line", from: point(10, 5), to: point(10, 10) });
  });
  it("reduces slow mouse jitter but keeps touch and pen samples unchanged", () => {
    let filtered = point(0, 0);
    const input: number[] = [], output: number[] = [];
    for (let index = 1; index <= 100; index++) {
      const raw = point(index * 0.5, index % 2 ? 1 : -1, index * 16);
      filtered = smoothPoint(filtered, raw, "mouse"); input.push(raw.y); output.push(filtered.y);
      expect(smoothPoint(filtered, raw, "pen")).toBe(raw);
      expect(smoothPoint(filtered, raw, "touch")).toBe(raw);
    }
    const energy = (values: number[]) => values.reduce((sum, value) => sum + value * value, 0);
    expect(energy(output)).toBeLessThan(energy(input) * 0.3);
    expect(smoothPoint(point(0, 0), point(100, 0, 16), "mouse").x).toBeGreaterThan(85);
  });
  it("ends exactly at the pointer-up position and reproduces the committed drawing", () => {
    const drawing = new SignatureDrawing(), segments: InkSegment[] = [];
    segments.push(drawing.begin(point(10, 20), "mouse")!);
    segments.push(drawing.append(point(30, 50, 16))!);
    segments.push(drawing.append(point(60, 80, 32), true)!);
    segments.push(drawing.end()!);
    const replay: InkSegment[] = []; drawing.replay((segment) => replay.push(segment));
    expect(replay).toEqual(segments);
    expect(segments.at(-1)).toMatchObject({ to: point(60, 80, 32) });
  });
  it("keeps taps, cancels the final stroke only, and restores point budget after undo", () => {
    const drawing = new SignatureDrawing();
    drawing.begin(point(10, 20), "mouse"); drawing.end();
    expect(drawing.hasInk).toBe(true);
    drawing.begin(point(30, 20), "mouse"); drawing.append(point(45, 30)); drawing.end();
    drawing.undo(); expect(drawing.strokes).toEqual([[point(10, 20)]]); expect(drawing.pointCount).toBe(1);
    drawing.clear(); expect(drawing.hasInk).toBe(false); expect(drawing.pointCount).toBe(0);
  });
  it("bounds storage and emits at most one constant-size segment per input sample", () => {
    const drawing = new SignatureDrawing(); drawing.begin(point(0, 0), "mouse");
    let segments = 0;
    for (let index = 1; index <= maxDrawingPoints * 2; index++) {
      const segment = drawing.append(point(index, index % 2, index * 4));
      if (segment) { segments++; expect(Object.keys(segment)).toHaveLength(4); }
    }
    expect(segments).toBe(maxDrawingPoints - 1); expect(drawing.pointCount).toBe(maxDrawingPoints); expect(drawing.full).toBe(true);
    drawing.end(); expect(drawing.begin(point(1, 1), "mouse")).toBeNull();
    drawing.undo(); expect(drawing.full).toBe(false); expect(drawing.pointCount).toBe(0);
  });
});
