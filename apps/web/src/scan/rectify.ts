import { type CV, type Mat, using } from "./cv";
import { cornersOf, measuredSize, pixel, type Quad, type Size } from "./geometry";
import { renderSize } from "./sizing";

export const outputSize = (quad: Quad, size: Size): Size | null => renderSize(measuredSize(quad, size));

export function rectify(cv: CV, image: Mat, quad: Quad): Mat | null {
  const size = { width: image.cols, height: image.rows };
  const target = outputSize(quad, size);
  if (!target) return null;
  // Flattened at the size it has in the photo first: a warp that also shrinks the page would alias its text.
  const measured = measuredSize(quad, size);
  const flat = { width: Math.max(target.width, Math.round(measured.width)), height: Math.max(target.height, Math.round(measured.height)) };
  const from = cv.matFromArray(4, 1, cv.CV_32FC2, cornersOf(quad).flatMap((corner) => { const at = pixel(corner, size); return [at.x, at.y]; }));
  const to = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, flat.width, 0, flat.width, flat.height, 0, flat.height]);
  const [transform, warped, page] = [cv.getPerspectiveTransform(from, to), new cv.Mat(), new cv.Mat()];
  return using([from, to, transform, warped], () => {
    cv.warpPerspective(image, warped, transform, new cv.Size(flat.width, flat.height), cv.INTER_LINEAR, cv.BORDER_REPLICATE);
    cv.resize(warped, page, new cv.Size(target.width, target.height), 0, 0, cv.INTER_AREA);
    return page;
  });
}

export function turnedClockwise(cv: CV, page: Mat, quarterTurns: number): Mat {
  const turn = ((quarterTurns % 4) + 4) % 4;
  const out = new cv.Mat();
  if (turn === 0) page.copyTo(out);
  else cv.rotate(page, out, [cv.ROTATE_90_CLOCKWISE, cv.ROTATE_180, cv.ROTATE_90_COUNTERCLOCKWISE][turn - 1]!);
  return out;
}
