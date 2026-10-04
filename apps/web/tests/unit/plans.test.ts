import { describe, expect, it } from "vitest";
import { canExport, exportPlans } from "../../src/board/plans";
import { type Action, type Board, emptyBoard, reduce } from "../../src/board/state";

const a4 = { width: 595, height: 842 };
const run = (...actions: Action[]): Board => actions.reduce(reduce, emptyBoard);
const threePages = (...more: Action[]) =>
  run(
    { type: "docsAdded", docs: [{ id: "a", name: "a.pdf" }] },
    { type: "docOpened", docId: "a", sizes: [a4, a4, a4] },
    ...more,
  );

describe("export plans", () => {
  it("exports every page in board order, with rotations", () => {
    const board = threePages({ type: "pageMoved", pageId: "a:2", toIndex: 0 }, { type: "pageRotated", pageId: "a:2" });
    expect(exportPlans(board, "one")).toEqual([
      [{ docId: "a", index: 2, rotation: 90 }, { docId: "a", index: 0, rotation: 0 }, { docId: "a", index: 1, rotation: 0 }],
    ]);
  });

  it("exports the selection in board order, not click order", () => {
    const board = threePages(
      { type: "selectionToggled", pageId: "a:2" },
      { type: "selectionToggled", pageId: "a:0" },
    );
    expect(exportPlans(board, "selection")).toEqual([
      [{ docId: "a", index: 0, rotation: 0 }, { docId: "a", index: 2, rotation: 0 }],
    ]);
  });

  it("splits at each cut", () => {
    const board = threePages({ type: "cutToggled", afterPageId: "a:0" });
    expect(exportPlans(board, "split").map((plan) => plan.map((p) => p.index))).toEqual([[0], [1, 2]]);
  });

  it("has nothing to export without pages, selection or useful cut", () => {
    expect(exportPlans(emptyBoard, "one")).toEqual([]);
    expect(exportPlans(threePages(), "selection")).toEqual([]);
    expect(exportPlans(threePages({ type: "cutToggled", afterPageId: "a:2" }), "split")).toEqual([]);
  });

  it("waits for every file to finish opening", () => {
    const board = threePages({ type: "docsAdded", docs: [{ id: "b", name: "b.pdf" }] });
    expect(canExport(board, "one")).toBe(false);
    expect(canExport(reduce(board, { type: "docOpened", docId: "b", sizes: [a4] }), "one")).toBe(true);
  });

  it("ignores a file that failed", () => {
    const board = threePages(
      { type: "docsAdded", docs: [{ id: "b", name: "b.pdf" }] },
      { type: "docFailed", docId: "b", error: { kind: "damaged" } },
    );
    expect(canExport(board, "one")).toBe(true);
  });
});
