import { type CV, type Mat, using } from "./cv";
import { cornersOf, normalized, pixel, type Point, type Quad, quadOf } from "./geometry";

/** A small grayscale copy for the edge search: 0 to 255, top row first. */
type Gray = { width: number; height: number; pixels: Float32Array };
type Line = { point: Point; direction: Point };
/** Share of edge samples kept by the line fit: top, right, bottom, left. */
export type Refined = { quad: Quad; inlierRatios: number[] };

const scale = 0.25;
const samplesPerEdge = 80;
const minDrop = 12;
const strongFraction = 0.6;
const minPoints = 10;

function grayOf(cv: CV, image: Mat, factor: number): Gray {
  const [gray, small, blurred] = [new cv.Mat(), new cv.Mat(), new cv.Mat()];
  const kernel = cv.matFromArray(1, 5, cv.CV_32F, [1, 4, 6, 4, 1].map((weight) => weight / 16));
  return using([gray, small, blurred, kernel], () => {
    cv.cvtColor(image, gray, cv.COLOR_RGBA2GRAY);
    const size = new cv.Size(Math.max(1, Math.round(image.cols * factor)), Math.max(1, Math.round(image.rows * factor)));
    cv.resize(gray, small, size, 0, 0, cv.INTER_AREA);
    small.convertTo(small, cv.CV_32F);
    cv.sepFilter2D(small, blurred, cv.CV_32F, kernel, kernel, new cv.Point(-1, -1), 0, cv.BORDER_REPLICATE);
    return { width: blurred.cols, height: blurred.rows, pixels: new Float32Array(blurred.data32F) };
  });
}

/** Bilinear. Outside the image reads as 0, so a page that fills the frame still shows an edge at the border. */
function sample(gray: Gray, point: Point): number {
  const { width, height, pixels } = gray;
  if (point.x < 0 || point.y < 0 || point.x > width - 1 || point.y > height - 1) return 0;
  const [x0, y0] = [Math.floor(point.x), Math.floor(point.y)];
  const [x1, y1] = [Math.min(x0 + 1, width - 1), Math.min(y0 + 1, height - 1)];
  const [fx, fy] = [point.x - x0, point.y - y0];
  const top = pixels[y0 * width + x0]! * (1 - fx) + pixels[y0 * width + x1]! * fx;
  const bottom = pixels[y1 * width + x0]! * (1 - fx) + pixels[y1 * width + x1]! * fx;
  return top * (1 - fy) + bottom * fy;
}

/**
 * Moves each edge of a rough quad onto the paper edge, then rebuilds the corners as the intersections of the edges.
 * A corner hidden under another sheet is rebuilt that way too.
 */
export function refine(cv: CV, image: Mat, quad: Quad): Refined {
  const gray = grayOf(cv, image, scale);
  const corners = cornersOf(quad).map((corner) => pixel(corner, gray));
  const center = { x: corners.reduce((sum, corner) => sum + corner.x, 0) / 4, y: corners.reduce((sum, corner) => sum + corner.y, 0) / 4 };
  const band = Math.max(2, Math.floor(0.03 * Math.min(gray.width, gray.height)));
  const lines: Line[] = [];
  const ratios: number[] = [];
  for (let index = 0; index < 4; index++) {
    const [start, end] = [corners[index]!, corners[(index + 1) % 4]!];
    const fit = fitEdge(gray, start, end, center, band);
    if (fit) {
      lines.push(fit.line);
      ratios.push(fit.inlierRatio);
    } else {
      const length = Math.hypot(end.x - start.x, end.y - start.y);
      lines.push({ point: start, direction: length > 0 ? { x: (end.x - start.x) / length, y: (end.y - start.y) / length } : { x: 1, y: 0 } });
      ratios.push(0);
    }
  }
  const refined = corners.map((corner, index) => normalized(intersect(lines[(index + 3) % 4]!, lines[index]!) ?? corner, gray));
  return { quad: quadOf(refined), inlierRatios: ratios };
}

function fitEdge(gray: Gray, start: Point, end: Point, center: Point, band: number): { line: Line; inlierRatio: number } | null {
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  if (length <= 1) return null;
  const direction = { x: (end.x - start.x) / length, y: (end.y - start.y) / length };
  let normal = { x: -direction.y, y: direction.x };
  if (normal.x * ((start.x + end.x) / 2 - center.x) + normal.y * ((start.y + end.y) / 2 - center.y) < 0) normal = { x: -normal.x, y: -normal.y };
  const points: Point[] = [];
  for (let index = 0; index < samplesPerEdge; index++) {
    const t = 0.06 + 0.88 * index / (samplesPerEdge - 1);
    const base = { x: start.x + t * (end.x - start.x), y: start.y + t * (end.y - start.y) };
    const profile: number[] = [];
    for (let step = -band; step <= band; step++) profile.push(sample(gray, { x: base.x + step * normal.x, y: base.y + step * normal.y }));
    const drops = profile.slice(0, -3).map((value, at) => value - profile[at + 3]!);
    const strongest = Math.max(...drops);
    if (!(strongest > minDrop)) continue;
    // Bold text just inside the edge can drop more than the paper edge itself: the outermost strong drop wins.
    const outermost = drops.findLastIndex((drop) => drop > strongFraction * strongest);
    points.push({ x: base.x + (outermost + 1 - band) * normal.x, y: base.y + (outermost + 1 - band) * normal.y });
  }
  if (points.length < minPoints) return null;
  let keep = points.map(() => true);
  let line = fitLine(points);
  for (let pass = 0; pass < 4; pass++) {
    const residuals = points.map((point) => distanceTo(point, line));
    const limit = Math.max(1.5, 2.5 * median(residuals.filter((_, index) => keep[index])));
    keep = residuals.map((residual) => residual < limit);
    const inliers = points.filter((_, index) => keep[index]);
    if (inliers.length < 2) break;
    line = fitLine(inliers);
  }
  return { line, inlierRatio: keep.filter(Boolean).length / points.length };
}

/** Total least squares: the direction is the main axis of the points. */
function fitLine(points: Point[]): Line {
  const mean = { x: points.reduce((sum, point) => sum + point.x, 0) / points.length, y: points.reduce((sum, point) => sum + point.y, 0) / points.length };
  let [sxx, sxy, syy] = [0, 0, 0];
  for (const point of points) {
    const [dx, dy] = [point.x - mean.x, point.y - mean.y];
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return { point: mean, direction: { x: Math.cos(angle), y: Math.sin(angle) } };
}

const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x;
const distanceTo = (point: Point, line: Line) => Math.abs(cross({ x: point.x - line.point.x, y: point.y - line.point.y }, line.direction));

function intersect(a: Line, b: Line): Point | null {
  const denominator = cross(a.direction, b.direction);
  if (Math.abs(denominator) <= 1e-9) return null;
  const t = cross({ x: b.point.x - a.point.x, y: b.point.y - a.point.y }, b.direction) / denominator;
  return { x: a.point.x + t * a.direction.x, y: a.point.y + t * a.direction.y };
}

function median(values: number[]): number {
  return values.length === 0 ? 0 : [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
}
