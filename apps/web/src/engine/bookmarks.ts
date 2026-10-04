import { EngineFailure } from "./failure";
import { malloc, type Pdfium } from "./pdfium";
import { pageFrame } from "./sign";
import type { Bookmark, BookmarkView, Outline } from "./types";

/** PDFium's view constants (PDFDEST_VIEW_*), from 1. */
const fits = [undefined, "XYZ", "Fit", "FitH", "FitV", "FitR", "FitB", "FitBH", "FitBV"] as const;
const goTo = 1;

/** The bookmarks in the order a reader lists them. One that leads to no page or has no title is skipped: its children take its place. */
export function listBookmarks(p: Pdfium, doc: number): Outline {
  const bookmarks: Bookmark[] = [];
  let skipped = 0;
  const seen = new Set<number>();
  const pages = p.FPDF_GetPageCount(doc);
  // A pile, not recursion: a deep outline would overflow the stack. The child goes on last, so it comes off first.
  const pending: [item: number, level: number][] = [[p.FPDFBookmark_GetFirstChild(doc, 0), 0]];
  while (pending.length > 0) {
    const [item, level] = pending.pop()!;
    if (item === 0 || seen.has(item)) continue;
    seen.add(item);
    pending.push([p.FPDFBookmark_GetNextSibling(doc, item), level]);
    const title = titleOf(p, item);
    const dest = destOf(p, doc, item);
    const pageIndex = dest === 0 ? -1 : p.FPDFDest_GetDestPageIndex(doc, dest);
    const listed = title.trim() !== "" && pageIndex >= 0 && pageIndex < pages;
    if (listed) {
      const view = viewOf(p, dest);
      bookmarks.push({ title, pageIndex, level, ...(view ? { view } : {}) });
    } else skipped++;
    pending.push([p.FPDFBookmark_GetFirstChild(doc, item), listed ? level + 1 : level]);
  }
  return { bookmarks, skipped };
}

/** Replaces the outline with `bookmarks`, in that order. A level more than one deeper than the one before is brought back to one deeper. */
export function writeBookmarks(p: Pdfium, doc: number, bookmarks: Bookmark[]): void {
  const pages = p.FPDF_GetPageCount(doc);
  if (bookmarks.some(({ title, pageIndex }) => title.trim() === "" || pageIndex < 0 || pageIndex >= pages)) {
    throw new EngineFailure({ kind: "damaged" });
  }
  if (!p.EPDFBookmark_Clear(doc)) throw new EngineFailure({ kind: "damaged" });
  // The root, then the last bookmark written at each level: `parents[n]` takes the next bookmark of level n.
  const parents = [0];
  for (const { title, pageIndex, level, view } of bookmarks) {
    const depth = Math.min(Math.max(level, 0), parents.length - 1);
    const item = withWide(p, title, (pointer) => p.EPDFBookmark_AppendChild(doc, parents[depth]!, pointer));
    // A loaded page holds its parsed content: a book with a bookmark on every chapter would hold hundreds.
    const page = p.FPDF_LoadPage(doc, pageIndex);
    try {
      const dest = page === 0 ? 0 : destination(p, page, view) || destination(p, page, undefined);
      if (item === 0 || dest === 0 || !p.EPDFBookmark_SetDest(doc, item, dest)) throw new EngineFailure({ kind: "damaged" });
    } finally {
      if (page !== 0) p.FPDF_ClosePage(page);
    }
    parents.length = depth + 1;
    parents.push(item);
  }
}

function destination(p: Pdfium, page: number, view: BookmarkView | undefined): number {
  if (!view) {
    const { topLeft } = pageFrame(p, page);
    return p.EPDFDest_CreateXYZ(page, true, topLeft.x, true, topLeft.y, false, 0);
  }
  if (view.fit === "XYZ") {
    const [x = null, y = null, zoom = null] = view.params;
    return p.EPDFDest_CreateXYZ(page, x !== null, x ?? 0, y !== null, y ?? 0, zoom !== null, zoom ?? 0);
  }
  const params = malloc(p, 16);
  try {
    view.params.slice(0, 4).forEach((value, index) => p.pdfium.setValue(params + index * 4, value ?? 0, "float"));
    return p.EPDFDest_CreateView(page, fits.indexOf(view.fit), params, Math.min(view.params.length, 4));
  } finally {
    p.pdfium._free(params);
  }
}

function titleOf(p: Pdfium, item: number): string {
  const length = p.FPDFBookmark_GetTitle(item, 0, 0);
  if (length <= 2) return "";
  const buffer = malloc(p, length);
  try {
    p.FPDFBookmark_GetTitle(item, buffer, length);
    return p.pdfium.UTF16ToString(buffer);
  } finally {
    p.pdfium._free(buffer);
  }
}

function destOf(p: Pdfium, doc: number, item: number): number {
  const dest = p.FPDFBookmark_GetDest(doc, item);
  if (dest !== 0) return dest;
  const action = p.FPDFBookmark_GetAction(item);
  return action !== 0 && p.FPDFAction_GetType(action) === goTo ? p.FPDFAction_GetDest(doc, action) : 0;
}

function viewOf(p: Pdfium, dest: number): BookmarkView | undefined {
  const memory = malloc(p, 4 + 16 + 12 + 12);
  const [count, params, has, xyz] = [memory, memory + 4, memory + 20, memory + 32];
  try {
    const fit = fits[p.FPDFDest_GetView(dest, count, params)];
    if (!fit) return undefined;
    // PDFium tells a null from a number only for an XYZ of five items; elsewhere a null reads 0.
    if (fit === "XYZ" && p.FPDFDest_GetLocationInPage(dest, has, has + 4, has + 8, xyz, xyz + 4, xyz + 8)) {
      return { fit, params: [0, 1, 2].map((index) => (p.pdfium.getValue(has + index * 4, "i32") ? p.pdfium.getValue(xyz + index * 4, "float") : null)) };
    }
    const values = Array.from({ length: Math.min(p.pdfium.getValue(count, "i32"), 4) }, (_, index) => p.pdfium.getValue(params + index * 4, "float"));
    // A top at 0 is the foot of the page: the file most likely said null, the top of the page.
    if ((fit === "FitH" || fit === "FitBH") && !values[0]) return undefined;
    return { fit, params: values };
  } finally {
    p.pdfium._free(memory);
  }
}

function withWide<T>(p: Pdfium, text: string, use: (pointer: number) => T): T {
  const bytes = (text.length + 1) * 2;
  const pointer = malloc(p, bytes);
  try {
    p.pdfium.stringToUTF16(text, pointer, bytes);
    return use(pointer);
  } finally {
    p.pdfium._free(pointer);
  }
}
