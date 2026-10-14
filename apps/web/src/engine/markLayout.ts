import { textWidth } from "./editMetrics";
import type { MarkLayout, MarkSpacing, PageSize, Point } from "./types";

/** One line of the mark, from the left end of its baseline, in points of the page as the reader sees it, y down. */
export type MarkLine = { text: string; size: number; width: number; origin: Point };

/** Helvetica-Bold's capitals rise 0.718 em: the mark is centred on them. */
const capHeight = 0.718;
const space = textWidth(" ", "Helvetica", true, 1);
/** In ems: the blank between two copies on a row, and the step from one row to the next. */
const spacings: Record<MarkSpacing, { gap: number; pitch: number }> = { tight: { gap: 1, pitch: 2 }, medium: { gap: 2, pitch: 3.5 }, loose: { gap: 4, pitch: 6 } };

/** The engine writes these lines and the preview draws them: the preview shows the file. */
export function markLines(page: PageSize, mark: MarkLayout & { text: string; angle: number }): MarkLine[] {
  const angle = mark.angle * Math.PI / 180;
  const along = { x: Math.cos(angle), y: -Math.sin(angle) }, up = { x: -Math.sin(angle), y: -Math.cos(angle) };
  const centre = { x: page.width / 2, y: page.height / 2 };
  const line = (text: string, size: number, middle: Point): MarkLine => {
    const width = textWidth(text, "Helvetica", true, size);
    const [half, rise] = [width / 2, capHeight * size / 2];
    return { text, size, width, origin: { x: middle.x - half * along.x - rise * up.x, y: middle.y - half * along.y - rise * up.y } };
  };
  if (!mark.tiled) return [line(mark.text, mark.width * page.width / textWidth(mark.text, "Helvetica", true, 1), centre)];
  const size = mark.size * Math.min(page.width, page.height);
  const { gap, pitch } = spacings[mark.spacing];
  const unit = mark.text + " ".repeat(Math.max(1, Math.round(gap / space)));
  const period = textWidth(unit, "Helvetica", true, size);
  // Each row is long enough to cross the page's diagonal from any of its shifts.
  const row = unit.repeat(Math.ceil(Math.hypot(page.width, page.height) / period) + 2).trimEnd();
  const reach = (Math.abs(page.width * up.x) + Math.abs(page.height * up.y)) / 2 + size;
  const rows = Math.floor(reach / (pitch * size));
  return Array.from({ length: 2 * rows + 1 }, (_, index) => {
    const step = index - rows;
    const [offset, shift] = [step * pitch * size, step % 2 === 0 ? 0 : period / 2];
    return line(row, size, { x: centre.x + offset * up.x + shift * along.x, y: centre.y + offset * up.y + shift * along.y });
  });
}
