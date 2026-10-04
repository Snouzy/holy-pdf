import type { CV, Mat } from "./cv";
import { pixel, type Point, rotatedClockwise, type Size } from "./geometry";

/** In page coordinates; a stroke's `radius` is a fraction of the page width. */
export type EraseMark = { kind: "polygon"; points: Point[] } | { kind: "stroke"; points: Point[]; radius: number };

/** Paints the marks white on the page, in place. */
export function erase(cv: CV, page: Mat, marks: EraseMark[]): void {
  const size = { width: page.cols, height: page.rows };
  const white = new cv.Scalar(255, 255, 255, 255);
  for (const mark of marks) {
    const points = mark.points.map((point) => pixel(point, size));
    if (mark.kind === "polygon") {
      if (points.length < 3) continue;
      const outline = cv.matFromArray(points.length, 1, cv.CV_32SC2, points.flatMap((point) => [Math.round(point.x), Math.round(point.y)]));
      const outlines = new cv.MatVector();
      outlines.push_back(outline);
      cv.fillPoly(page, outlines, white);
      outlines.delete();
      outline.delete();
      continue;
    }
    const width = Math.round(2 * mark.radius * size.width);
    if (width <= 0) continue;
    // OpenCV draws square line ends: a disk at each point makes the stroke round, like a brush.
    for (const point of points) cv.circle(page, new cv.Point(point.x, point.y), Math.max(1, Math.round(width / 2)), white, -1);
    for (let index = 1; index < points.length; index++) {
      cv.line(page, new cv.Point(points[index - 1]!.x, points[index - 1]!.y), new cv.Point(points[index]!.x, points[index]!.y), white, width);
    }
  }
}

/** The same mark on the page turned clockwise. `pageSize` is the size before the turn. */
export function turnedMark(mark: EraseMark, quarterTurns: number, pageSize: Size): EraseMark {
  const turns = ((quarterTurns % 4) + 4) % 4;
  const points = mark.points.map((point) => rotatedClockwise(point, turns));
  if (mark.kind === "polygon") return { kind: "polygon", points };
  // The radius is a fraction of the page width, and an odd turn swaps width and height.
  return { kind: "stroke", points, radius: mark.radius * (turns % 2 === 1 ? pageSize.width / pageSize.height : 1) };
}
