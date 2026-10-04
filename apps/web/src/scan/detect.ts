import { type CV, type Mat, using } from "./cv";
import { fullImage, maxCornerShift, measuredSize, type Point, type Quad, type Size } from "./geometry";
import { type Refined, refine } from "./refine";
import { isKnownRatio } from "./sizing";

export type ReviewReason = "noPageFound" | "unusualRatio" | "weakEdge" | "cornerMoved";
export type Detection = { quad: Quad; inlierRatios: number[]; reasons: ReviewReason[] };

const weakEdgeRatio = 0.7;
const maxShift = 0.01;
/** The rough search runs on a copy this size: the edge refinement brings the precision back. */
const workSide = 1000;
/** A smaller outline is a label or a photo on the page, not the page. */
const minArea = 0.2;
/** A larger one is the frame itself. Vision, too, finds no page when the paper fills the photo. */
const maxArea = 0.95;

export function detect(cv: CV, image: Mat): Detection {
  const rough = roughQuad(cv, image);
  if (!rough) return { quad: fullImage, inlierRatios: [], reasons: ["noPageFound"] };
  const refined = refine(cv, image, rough);
  return { quad: refined.quad, inlierRatios: refined.inlierRatios, reasons: reviewReasons(rough, refined, { width: image.cols, height: image.rows }) };
}

function reviewReasons(rough: Quad, refined: Refined, size: Size): ReviewReason[] {
  const reasons: ReviewReason[] = [];
  const measured = measuredSize(refined.quad, size);
  if (!isKnownRatio(Math.max(measured.width, measured.height) / Math.max(Math.min(measured.width, measured.height), 1))) reasons.push("unusualRatio");
  if (refined.inlierRatios.some((ratio) => ratio < weakEdgeRatio)) reasons.push("weakEdge");
  if (maxCornerShift(rough, refined.quad, size) > maxShift) reasons.push("cornerMoved");
  return reasons;
}

/**
 * Stands in for Vision's document detector: the paper is the largest four-sided outline. A closing first wipes the
 * text off the paper, so its lines do not break the outline; Otsu's threshold, half of it and all of it, sets Canny's.
 */
function roughQuad(cv: CV, image: Mat): Quad | null {
  const factor = Math.min(1, workSide / Math.max(image.cols, image.rows));
  const [gray, small, edges, binary] = [new cv.Mat(), new cv.Mat(), new cv.Mat(), new cv.Mat()];
  const [closing, thicken] = [cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(9, 9)), cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3))];
  return using([gray, small, edges, binary, closing, thicken], () => {
    cv.cvtColor(image, gray, cv.COLOR_RGBA2GRAY);
    cv.resize(gray, small, new cv.Size(Math.round(image.cols * factor), Math.round(image.rows * factor)), 0, 0, cv.INTER_AREA);
    cv.morphologyEx(small, small, cv.MORPH_CLOSE, closing);
    cv.GaussianBlur(small, small, new cv.Size(5, 5), 0);
    const otsu = cv.threshold(small, binary, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);
    cv.Canny(small, edges, otsu / 2, otsu);
    cv.dilate(edges, edges, thicken);
    return largestQuad(cv, edges, small) ?? largestQuad(cv, binary, small);
  });
}

function largestQuad(cv: CV, mask: Mat, frame: Mat): Quad | null {
  const [contours, hierarchy] = [new cv.MatVector(), new cv.Mat()];
  cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
  const outlines = Array.from({ length: contours.size() }, (_, index) => contours.get(index)).sort((a, b) => cv.contourArea(b) - cv.contourArea(a));
  try {
    const frameArea = frame.cols * frame.rows;
    for (const outline of outlines.slice(0, 8)) {
      const [hull, approx] = [new cv.Mat(), new cv.Mat()];
      try {
        cv.convexHull(outline, hull);
        const hullArea = cv.contourArea(hull);
        if (hullArea < minArea * frameArea || hullArea > maxArea * frameArea) continue;
        for (const epsilon of [0.02, 0.03, 0.04, 0.05]) {
          cv.approxPolyDP(hull, approx, epsilon * cv.arcLength(hull, true), true);
          if (approx.rows === 4) return ordered(Array.from({ length: 4 }, (_, index) => ({ x: approx.data32S[index * 2]! / frame.cols, y: approx.data32S[index * 2 + 1]! / frame.rows })));
        }
      } finally {
        hull.delete();
        approx.delete();
      }
    }
    return null;
  } finally {
    for (const outline of outlines) outline.delete();
    contours.delete();
    hierarchy.delete();
  }
}

function ordered(points: Point[]): Quad {
  const by = (score: (point: Point) => number) => points.reduce((best, point) => (score(point) > score(best) ? point : best));
  return {
    topLeft: by((point) => -(point.x + point.y)),
    topRight: by((point) => point.x - point.y),
    bottomRight: by((point) => point.x + point.y),
    bottomLeft: by((point) => point.y - point.x),
  };
}
