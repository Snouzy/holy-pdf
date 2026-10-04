import { describe, expect, it } from "vitest";
import { type Action, type Board, emptyBoard, reduce } from "../../src/board/state";

const a4 = { width: 595, height: 842 };
const run = (...actions: Action[]): Board => actions.reduce(reduce, emptyBoard);
const pageIds = (board: Board) => board.pages.map((page) => page.id);

describe("board state", () => {
  it("adds files as opening, then lists their pages once opened", () => {
    const board = run(
      { type: "docsAdded", docs: [{ id: "a", name: "a.pdf" }] },
      { type: "docOpened", docId: "a", sizes: [a4, a4] },
    );
    expect(board.docs[0]?.status).toEqual({ kind: "ready", pageCount: 2, sizes: [a4, a4] });
    expect(pageIds(board)).toEqual(["a:0", "a:1"]);
  });

  it("keeps the order files were added in when the second one opens first", () => {
    const board = run(
      { type: "docsAdded", docs: [{ id: "a", name: "a.pdf" }, { id: "b", name: "b.pdf" }] },
      { type: "docOpened", docId: "b", sizes: [a4] },
      { type: "docOpened", docId: "a", sizes: [a4, a4] },
    );
    expect(pageIds(board)).toEqual(["a:0", "a:1", "b:0"]);
  });

  it("ignores a file that opens after it was removed", () => {
    const board = run(
      { type: "docsAdded", docs: [{ id: "a", name: "a.pdf" }] },
      { type: "docRemoved", docId: "a" },
      { type: "docOpened", docId: "a", sizes: [a4] },
    );
    expect(board.docs).toEqual([]);
    expect(board.pages).toEqual([]);
  });

  it("removes a file with all its pages", () => {
    const board = run(
      { type: "docsAdded", docs: [{ id: "a", name: "a.pdf" }, { id: "b", name: "b.pdf" }] },
      { type: "docOpened", docId: "a", sizes: [a4, a4] },
      { type: "docOpened", docId: "b", sizes: [a4] },
      { type: "selectionToggled", pageId: "a:1" },
      { type: "docRemoved", docId: "a" },
    );
    expect(board.docs.map((doc) => doc.id)).toEqual(["b"]);
    expect(pageIds(board)).toEqual(["b:0"]);
    expect(board.selected).toEqual([]);
  });

  it("never brings back the pages of a removed file with undo", () => {
    const board = run(
      { type: "docsAdded", docs: [{ id: "a", name: "a.pdf" }, { id: "b", name: "b.pdf" }] },
      { type: "docOpened", docId: "a", sizes: [a4] },
      { type: "docOpened", docId: "b", sizes: [a4] },
      { type: "pageRotated", pageId: "b:0" },
      { type: "docRemoved", docId: "a" },
      { type: "undone" },
    );
    expect(pageIds(board)).toEqual(["b:0"]);
    expect(board.pages[0]?.rotation).toBe(0);
  });

  it("moves, rotates and removes pages", () => {
    const board = run(
      { type: "docsAdded", docs: [{ id: "a", name: "a.pdf" }] },
      { type: "docOpened", docId: "a", sizes: [a4, a4, a4] },
      { type: "pageMoved", pageId: "a:2", toIndex: 0 },
      { type: "pageRotated", pageId: "a:0" },
      { type: "pageRotated", pageId: "a:0" },
      { type: "pageRemoved", pageId: "a:1" },
    );
    expect(board.pages.map((p) => [p.id, p.rotation])).toEqual([["a:2", 0], ["a:0", 180]]);
  });

  it("wraps rotation after a full turn", () => {
    const board = run(
      { type: "docsAdded", docs: [{ id: "a", name: "a.pdf" }] },
      { type: "docOpened", docId: "a", sizes: [a4] },
      { type: "allRotated" }, { type: "allRotated" }, { type: "allRotated" }, { type: "allRotated" },
    );
    expect(board.pages[0]?.rotation).toBe(0);
  });

  it("keeps a file that opened after an edit when that edit is undone", () => {
    const board = run(
      { type: "docsAdded", docs: [{ id: "a", name: "a.pdf" }, { id: "b", name: "b.pdf" }] },
      { type: "docOpened", docId: "a", sizes: [a4, a4] },
      { type: "pageRotated", pageId: "a:0" },
      { type: "docOpened", docId: "b", sizes: [a4] },
      { type: "undone" },
    );
    expect(board.pages.map((p) => [p.id, p.rotation])).toEqual([["a:0", 0], ["a:1", 0], ["b:0", 0]]);
  });

  it("drops the selection and the cut of a removed page", () => {
    const board = run(
      { type: "docsAdded", docs: [{ id: "a", name: "a.pdf" }] },
      { type: "docOpened", docId: "a", sizes: [a4, a4] },
      { type: "selectionToggled", pageId: "a:0" },
      { type: "cutToggled", afterPageId: "a:0" },
      { type: "pageRemoved", pageId: "a:0" },
    );
    expect(board.selected).toEqual([]);
    expect(board.cuts).toEqual([]);
  });

  it("cuts every N pages, never after the last page", () => {
    const board = run(
      { type: "docsAdded", docs: [{ id: "a", name: "a.pdf" }] },
      { type: "docOpened", docId: "a", sizes: [a4, a4, a4, a4] },
      { type: "cutEvery", pageCount: 2 },
    );
    expect(board.cuts).toEqual(["a:1"]);
  });

  it("undoes edits one by one, including a removal with its selection", () => {
    const opened = run(
      { type: "docsAdded", docs: [{ id: "a", name: "a.pdf" }] },
      { type: "docOpened", docId: "a", sizes: [a4, a4] },
      { type: "selectionToggled", pageId: "a:1" },
    );
    const removed = reduce(reduce(opened, { type: "pageRemoved", pageId: "a:1" }), { type: "allRotated" });
    const undoneOnce = reduce(removed, { type: "undone" });
    expect(undoneOnce.pages.map((p) => p.rotation)).toEqual([0]);
    const undoneTwice = reduce(undoneOnce, { type: "undone" });
    expect(pageIds(undoneTwice)).toEqual(["a:0", "a:1"]);
    expect(undoneTwice.selected).toEqual(["a:1"]);
  });

  it("starts over when cleared", () => {
    const board = run(
      { type: "docsAdded", docs: [{ id: "a", name: "a.pdf" }] },
      { type: "docOpened", docId: "a", sizes: [a4] },
      { type: "cleared" },
    );
    expect(board).toEqual(emptyBoard);
  });

  it("does nothing when there is nothing to undo", () => {
    expect(reduce(emptyBoard, { type: "undone" })).toBe(emptyBoard);
  });

  it("keeps at most 50 steps of history", () => {
    let board = run(
      { type: "docsAdded", docs: [{ id: "a", name: "a.pdf" }] },
      { type: "docOpened", docId: "a", sizes: [a4] },
    );
    for (let i = 0; i < 60; i++) board = reduce(board, { type: "allRotated" });
    expect(board.history).toHaveLength(50);
  });
});
