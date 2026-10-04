/** A position in normalized page coordinates: 0 to 1, origin top-left. */
export type Point = { x: number; y: number };
export type Quad = { topLeft: Point; topRight: Point; bottomRight: Point; bottomLeft: Point };
export type Size = { width: number; height: number };

export const fullImage: Quad = { topLeft: { x: 0, y: 0 }, topRight: { x: 1, y: 0 }, bottomRight: { x: 1, y: 1 }, bottomLeft: { x: 0, y: 1 } };

export const cornersOf = (quad: Quad): Point[] => [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft];
export const quadOf = ([topLeft, topRight, bottomRight, bottomLeft]: Point[]): Quad => ({ topLeft: topLeft!, topRight: topRight!, bottomRight: bottomRight!, bottomLeft: bottomLeft! });

export const pixel = (point: Point, size: Size): Point => ({ x: point.x * size.width, y: point.y * size.height });
export const normalized = (point: Point, size: Size): Point => ({ x: point.x / size.width, y: point.y / size.height });
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function measuredSize(quad: Quad, size: Size): Size {
  const [a, b, c, d] = cornersOf(quad).map((corner) => pixel(corner, size)) as [Point, Point, Point, Point];
  return { width: (distance(a, b) + distance(c, d)) / 2, height: (distance(d, a) + distance(b, c)) / 2 };
}

/** Where a point of an upright page lands when the page turns clockwise by `quarterTurns`. */
export function rotatedClockwise(point: Point, quarterTurns: number): Point {
  let turned = point;
  for (let turn = 0; turn < ((quarterTurns % 4) + 4) % 4; turn++) turned = { x: 1 - turned.y, y: turned.x };
  return turned;
}

export function isUsable(quad: Quad): boolean {
  const corners = cornersOf(quad);
  if (!corners.every((corner) => corner.x >= 0 && corner.x <= 1 && corner.y >= 0 && corner.y <= 1)) return false;
  for (let index = 0; index < 4; index++) {
    const [a, b, next] = [corners[index]!, corners[(index + 1) % 4]!, corners[(index + 2) % 4]!];
    if ((b.x - a.x) * (next.y - b.y) - (b.y - a.y) * (next.x - b.x) <= 0) return false;
  }
  return area(quad) >= 0.01;
}

/** Shoelace area, as a fraction of the photo. */
export function area(quad: Quad): number {
  const corners = cornersOf(quad);
  return corners.reduce((sum, corner, index) => sum + corner.x * corners[(index + 1) % 4]!.y - corners[(index + 1) % 4]!.x * corner.y, 0) / 2;
}

/** The longest corner move, as a fraction of the photo's diagonal. */
export function maxCornerShift(from: Quad, to: Quad, size: Size): number {
  const before = cornersOf(from);
  const moves = cornersOf(to).map((corner, index) => distance(pixel(before[index]!, size), pixel(corner, size)));
  return Math.max(...moves) / Math.hypot(size.width, size.height);
}
