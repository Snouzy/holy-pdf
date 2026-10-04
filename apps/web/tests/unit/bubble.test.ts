import { describe, expect, it } from "vitest";
import { bubbleOf, moodOf } from "../../src/board/bubble";
import { setup } from "../../src/board/flow";
import { type Action, type Board, emptyBoard, reduce } from "../../src/board/state";

const a4 = { width: 595, height: 842 };
const board = (...actions: Action[]): Board => actions.reduce(reduce, emptyBoard);
const added: Action = { type: "docsAdded", docs: [{ id: "a", name: "a.pdf" }, { id: "b", name: "b.pdf" }] };
const aOpened: Action = { type: "docOpened", docId: "a", sizes: [a4, a4] };
const bOpened: Action = { type: "docOpened", docId: "b", sizes: [a4] };

describe("bubbleOf", () => {
  it("reads the file that is still opening", () => {
    expect(bubbleOf(board(added, aOpened), setup)).toEqual({ say: "reading", name: "b.pdf" });
  });

  it("counts files and pages once everything is open", () => {
    expect(bubbleOf(board(added, aOpened, bOpened), setup)).toEqual({ say: "ready", files: 2, pages: 3 });
  });

  it("works while the file is being made", () => {
    expect(bubbleOf(board(added, aOpened, bOpened), { step: "working", done: 0, total: 1 })).toEqual({ say: "working" });
  });

  it("reports a failed run", () => {
    expect(bubbleOf(board(added, aOpened, bOpened), { step: "setup", error: { kind: "outOfMemory" } })).toEqual({
      say: "failed",
      error: { kind: "outOfMemory" },
    });
  });

  it("reports a file that failed to open", () => {
    const failed: Action = { type: "docFailed", docId: "b", error: { kind: "passwordRequired" } };
    expect(bubbleOf(board(added, aOpened, failed), setup)).toEqual({ say: "failed", error: { kind: "passwordRequired" } });
  });
});

describe("moodOf", () => {
  it("gives each bubble its mood", () => {
    expect(moodOf({ say: "reading", name: "a.pdf" })).toBe("focus");
    expect(moodOf({ say: "ready", files: 1, pages: 1 })).toBe("happy");
    expect(moodOf({ say: "working" })).toBe("focus");
    expect(moodOf({ say: "failed", error: { kind: "damaged" } })).toBe("oops");
  });
});
