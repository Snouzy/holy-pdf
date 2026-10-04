import { describe, expect, it } from "vitest";
import { drawn, shifted, stretched } from "../../src/crop/box";

const box = { x: 0.2, y: 0.2, width: 0.5, height: 0.4 };
const close = (actual: object, expected: object) => expect(actual).toEqual(Object.fromEntries(Object.entries(expected).map(([key, value]) => [key, expect.closeTo(value as number, 9)])));

describe("crop zone", () => {
  it("draws a zone in any direction, inside the page, and ignores a click", () => {
    close(drawn({ x: 0.8, y: 0.9 }, { x: 0.3, y: 0.1 })!, { x: 0.3, y: 0.1, width: 0.5, height: 0.8 });
    close(drawn({ x: -0.2, y: 0.5 }, { x: 0.5, y: 1.4 })!, { x: 0, y: 0.5, width: 0.5, height: 0.5 });
    expect(drawn({ x: 0.5, y: 0.5 }, { x: 0.505, y: 0.9 })).toBeNull();
  });

  it("moves a zone without letting it leave the page", () => {
    close(shifted(box, 0.1, -0.1), { x: 0.3, y: 0.1, width: 0.5, height: 0.4 });
    close(shifted(box, 0.9, -0.9), { x: 0.5, y: 0, width: 0.5, height: 0.4 });
  });

  it("moves the edges a handle holds, inside the page, never below the smallest size", () => {
    close(stretched(box, "se", { x: 0.9, y: 0.8 }), { x: 0.2, y: 0.2, width: 0.7, height: 0.6 });
    close(stretched(box, "n", { x: 0.9, y: 0.1 }), { x: 0.2, y: 0.1, width: 0.5, height: 0.5 });
    close(stretched(box, "w", { x: -0.5, y: 0 }), { x: 0, y: 0.2, width: 0.7, height: 0.4 });
    close(stretched(box, "e", { x: 0.1, y: 0 }), { x: 0.2, y: 0.2, width: 0.02, height: 0.4 });
    close(stretched(box, "nw", { x: 0.95, y: 0.95 }), { x: 0.68, y: 0.58, width: 0.02, height: 0.02 });
  });
});
