import { describe, expect, it } from "vitest";
import { a4, placeOnA4 } from "../../src/engine/imagePage";

describe("placeOnA4", () => {
  it("fits a portrait image to the width of a portrait page, centered", () => {
    const placement = placeOnA4(1000, 1000);
    expect(placement.pageWidth).toBe(a4.width);
    expect(placement.width).toBeCloseTo(a4.width);
    expect(placement.y).toBeCloseTo((a4.height - a4.width) / 2);
  });

  it("turns the page for a landscape image", () => {
    const placement = placeOnA4(4000, 3000);
    expect(placement.pageWidth).toBe(a4.height);
    expect(placement.height).toBeCloseTo(a4.width);
    expect(placement.x).toBeCloseTo((a4.height - (a4.width * 4) / 3) / 2);
  });
});
