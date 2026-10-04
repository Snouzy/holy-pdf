import { smallestCrop } from "../crop/box";
import { EngineFailure } from "./failure";
import type { Pdfium } from "./pdfium";
import { pageFrame } from "./sign";
import type { Box } from "./types";

/** `box`: the zone to keep, in fractions of each page as the reader sees it; `only`: one page index, or every page. */
export function cropPages(p: Pdfium, handle: number, box: Box, only: number | null): void {
  const count = p.FPDF_GetPageCount(handle);
  // A handle pushed to the smallest size leaves a width such as 0.25 - 0.23 = 0.019999…: compare with the same slack as the edges.
  const slack = 1e-9;
  const fits = box.x >= 0 && box.y >= 0 && box.x + box.width <= 1 + slack && box.y + box.height <= 1 + slack;
  if (!fits || box.width < smallestCrop - slack || box.height < smallestCrop - slack || (only !== null && (only < 0 || only >= count))) {
    throw new EngineFailure({ kind: "damaged" });
  }
  for (const index of only === null ? Array.from({ length: count }, (_, each) => each) : [only]) {
    const page = p.FPDF_LoadPage(handle, index);
    if (page === 0) throw new EngineFailure({ kind: "damaged" });
    try {
      const { topLeft, topRight, bottomLeft } = pageFrame(p, page);
      const at = (fx: number, fy: number) => ({
        x: topLeft.x + (topRight.x - topLeft.x) * fx + (bottomLeft.x - topLeft.x) * fy,
        y: topLeft.y + (topRight.y - topLeft.y) * fx + (bottomLeft.y - topLeft.y) * fy,
      });
      const [a, b] = [at(box.x, box.y), at(box.x + box.width, box.y + box.height)];
      const point = (value: number) => Math.round(value * 100) / 100;
      p.FPDFPage_SetCropBox(page, point(Math.min(a.x, b.x)), point(Math.min(a.y, b.y)), point(Math.max(a.x, b.x)), point(Math.max(a.y, b.y)));
    } finally {
      p.FPDF_ClosePage(page);
    }
  }
}
