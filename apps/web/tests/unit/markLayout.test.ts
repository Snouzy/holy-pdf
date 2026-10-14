import { describe, expect, it } from "vitest";
import { textWidth } from "../../src/engine/editMetrics";
import { markLines } from "../../src/engine/markLayout";

const a4 = { width: 595, height: 842 };
/** The middle of the capitals, from the left end of the baseline. */
const middle = (line: ReturnType<typeof markLines>[number], degrees: number) => {
  const [a, rise] = [degrees * Math.PI / 180, 0.359 * line.size];
  return { x: line.origin.x + line.width / 2 * Math.cos(a) - rise * Math.sin(a), y: line.origin.y - line.width / 2 * Math.sin(a) - rise * Math.cos(a) };
};

describe("markLines", () => {
  it("centres a single mark on the page, as wide as asked", () => {
    const lines = markLines(a4, { tiled: false, width: 0.5, text: "DRAFT", angle: 30 });
    expect(lines).toHaveLength(1);
    expect(lines[0]!.width).toBeCloseTo(297.5, 6);
    expect(middle(lines[0]!, 30)).toEqual({ x: expect.closeTo(297.5, 6), y: expect.closeTo(421, 6) });
  });

  it("tiles rows from edge to edge, each longer than the diagonal, every other one shifted by half a copy", () => {
    const size = 0.04 * 595;
    const lines = markLines(a4, { tiled: true, size: 0.04, spacing: "medium", text: "SECRET", angle: 0 });
    expect(new Set(lines.map((line) => line.text)).size).toBe(1);
    expect(lines[0]!.width).toBeGreaterThan(Math.hypot(595, 842));
    const heights = lines.map((line) => middle(line, 0).y);
    heights.slice(1).forEach((y, index) => expect(heights[index]! - y).toBeCloseTo(3.5 * size, 6));
    expect([Math.min(...heights) < size, Math.max(...heights) > 842 - size]).toEqual([true, true]);
    expect(Math.abs(lines[1]!.origin.x - lines[0]!.origin.x)).toBeCloseTo(textWidth("SECRET       ", "Helvetica", true, size) / 2, 6);
  });

  it("packs more rows when the spacing tightens", () => {
    const rows = (spacing: "tight" | "medium" | "loose") => markLines(a4, { tiled: true, size: 0.04, spacing, text: "SECRET", angle: 45 }).length;
    expect(rows("tight")).toBeGreaterThan(rows("medium"));
    expect(rows("medium")).toBeGreaterThan(rows("loose"));
  });
});
