import { describe, expect, it } from "vitest";
import { advance, countOf, type Flow, keepsOriginal, type Made, percentDone, saved, setup, totalSize } from "../../src/board/flow";
import { type Action, type Board, emptyBoard, reduce } from "../../src/board/state";

const a4 = { width: 595, height: 842 };
const made: Made = { files: [], zipName: "a-merged.zip", type: "application/pdf", count: 1, before: 0, after: 10, pages: 1 };
const working: Flow = { step: "working", done: 0, total: 1 };
const board = (...actions: Action[]): Board => actions.reduce(reduce, emptyBoard);
const threePages = (...more: Action[]) =>
  board({ type: "docsAdded", docs: [{ id: "a", name: "a.pdf" }] }, { type: "docOpened", docId: "a", sizes: [a4, a4, a4] }, ...more);

describe("advance", () => {
  it("starts working with nothing done", () => {
    expect(advance(setup, { type: "started" })).toEqual(working);
  });

  it("follows the progress while working, and only then", () => {
    expect(advance(working, { type: "progressed", done: 2, total: 4 })).toEqual({ step: "working", done: 2, total: 4 });
    expect(advance(setup, { type: "progressed", done: 2, total: 4 })).toBe(setup);
  });

  it("shows the result when the work is done", () => {
    expect(advance(working, { type: "finished", made })).toEqual({ step: "result", made });
  });

  it("goes back to the settings with the error when the work fails", () => {
    expect(advance(working, { type: "failed", error: { kind: "outOfMemory" } })).toEqual({ step: "setup", error: { kind: "outOfMemory" } });
  });

  it("goes back to the settings from the result", () => {
    expect(advance({ step: "result", made }, { type: "back" })).toBe(setup);
  });

  it("forgets the result and the last error at the next change, but not the work under way", () => {
    expect(advance({ step: "result", made }, { type: "edited" })).toBe(setup);
    expect(advance({ step: "setup", error: { kind: "damaged" } }, { type: "edited" })).toBe(setup);
    expect(advance(working, { type: "edited" })).toBe(working);
  });
});

describe("percentDone", () => {
  it("rounds the part done to a percentage", () => {
    expect(percentDone(setup)).toBe(0);
    expect(percentDone({ step: "working", done: 1, total: 3 })).toBe(33);
    expect(percentDone({ step: "working", done: 4, total: 4 })).toBe(100);
  });
});

describe("saved", () => {
  it("gives the percent saved, and 0 when nothing got smaller", () => {
    expect(saved(12_400_000, 3_100_000)).toBe(75);
    expect(saved(100, 120)).toBe(0);
    expect(saved(0, 0)).toBe(0);
  });
});

describe("countOf", () => {
  it("counts what each tool's title says", () => {
    const split = threePages({ type: "cutToggled", afterPageId: "a:0" });
    expect(countOf("split", split, 2)).toBe(2);
    expect(countOf("delete-pages", threePages({ type: "pageRemoved", pageId: "a:1" }), 1)).toBe(1);
    expect(countOf("extract-pages", threePages({ type: "selectionToggled", pageId: "a:2" }), 1)).toBe(1);
    expect(countOf("merge", threePages(), 1)).toBe(3);
  });

  it("counts the images PDF to JPG made", () => {
    expect(countOf("pdf-to-jpg", threePages(), 5)).toBe(5);
  });

  it("counts the percent Compress saved", () => {
    expect(countOf("compress", threePages(), 1, 75)).toBe(75);
  });
});

describe("keepsOriginal", () => {
  it("keeps the original unless the compressed file saves 1 % at least", () => {
    expect(keepsOriginal(1000, 995)).toBe(true);
    expect(keepsOriginal(1000, 1200)).toBe(true);
    expect(keepsOriginal(1000, 980)).toBe(false);
  });
});

describe("totalSize", () => {
  it("adds up the bytes of the files", () => {
    expect(totalSize([{ name: "a", bytes: new Uint8Array(3) }, { name: "b", bytes: new Uint8Array(4) }])).toBe(7);
  });
});
