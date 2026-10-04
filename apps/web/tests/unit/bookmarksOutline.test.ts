import { describe, expect, it } from "vitest";
import { added, canSave, type BookmarksDraft, removed, type Row, settled } from "../../src/bookmarks/outline";

const rows = (...items: [title: string, pageIndex: number, level: number][]): Row[] =>
  items.map(([title, pageIndex, level], id) => ({ id, bookmark: { title, pageIndex, level } }));
const shape = (list: Row[]) => list.map(({ bookmark }) => [bookmark.title, bookmark.pageIndex, bookmark.level]);

describe("bookmark list", () => {
  it("places a new bookmark after those of its page and of the pages before it", () => {
    const list = rows(["Un", 0, 0], ["Deux", 2, 0], ["Trois", 4, 0]);
    expect(shape(added(list, 2, "Nouveau", 9))).toEqual([["Un", 0, 0], ["Deux", 2, 0], ["Nouveau", 2, 0], ["Trois", 4, 0]]);
    expect(shape(added(list, 0, "Avant", 9)).map(([title]) => title)).toEqual(["Un", "Avant", "Deux", "Trois"]);
    expect(shape(added([], 3, "Seul", 9))).toEqual([["Seul", 3, 0]]);
  });

  it("makes a new bookmark between a bookmark and its children a child too", () => {
    const list = rows(["Partie", 0, 0], ["Chapitre", 3, 1]);
    expect(shape(added(list, 1, "Nouveau", 9))).toEqual([["Partie", 0, 0], ["Nouveau", 1, 1], ["Chapitre", 3, 1]]);
    expect(added(list, 1, "Nouveau", 9)[1]?.id).toBe(9);
  });

  it("keeps each level at most one deeper than the one before, and at least zero", () => {
    expect(shape(settled(rows(["Un", 0, 1], ["Deux", 0, 3], ["Trois", 0, -1])))).toEqual([["Un", 0, 0], ["Deux", 0, 1], ["Trois", 0, 0]]);
  });

  it("lifts the children of a removed bookmark one level, in its place", () => {
    const list = rows(["Partie I", 0, 0], ["Chapitre 1", 1, 1], ["Section", 1, 2], ["Chapitre 2", 2, 1], ["Partie II", 3, 0]);
    expect(shape(removed(list, 0))).toEqual([["Chapitre 1", 1, 0], ["Section", 1, 1], ["Chapitre 2", 2, 0], ["Partie II", 3, 0]]);
    expect(shape(removed(list, 2)).map(([, , level]) => level)).toEqual([0, 1, 1, 0]);
  });

  it("saves only after a change, and never with a blank title", () => {
    const draft: BookmarksDraft = { docId: "a", pageIndex: 0, rows: rows(["Un", 0, 0]), skipped: 0, edited: false };
    expect(canSave(draft)).toBe(false);
    expect(canSave({ ...draft, edited: true })).toBe(true);
    expect(canSave({ ...draft, edited: true, rows: [] })).toBe(true);
    expect(canSave({ ...draft, edited: true, rows: rows([" ", 0, 0]) })).toBe(false);
  });
});
