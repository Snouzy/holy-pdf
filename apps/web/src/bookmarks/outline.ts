import type { Bookmark } from "../engine/types";

export type Row = { id: number; bookmark: Bookmark };
export type BookmarksDraft = { docId: string; pageIndex: number; rows: Row[]; skipped: number; edited: boolean };

/** The list shows what the copy will hold: a level is at most one deeper than the one before it. */
export function settled(rows: Row[]): Row[] {
  let previous = -1;
  return rows.map((row) => {
    const level = Math.min(Math.max(row.bookmark.level, 0), previous + 1);
    previous = level;
    return level === row.bookmark.level ? row : { ...row, bookmark: { ...row.bookmark, level } };
  });
}

/** After the bookmarks of its page and of the pages before it, so the list follows the pages without sorting. */
export function added(rows: Row[], pageIndex: number, title: string, id: number): Row[] {
  const at = rows.findLastIndex((row) => row.bookmark.pageIndex <= pageIndex) + 1;
  // Between a bookmark and its children, the new one is a child too: it does not take the children for itself.
  const level = Math.max(rows[at - 1]?.bookmark.level ?? 0, rows[at]?.bookmark.level ?? 0);
  return settled([...rows.slice(0, at), { id, bookmark: { title, pageIndex, level } }, ...rows.slice(at)]);
}

/** Its children take its place: one level up, not under the bookmark before it. */
export function removed(rows: Row[], id: number): Row[] {
  const at = rows.findIndex((row) => row.id === id);
  const level = rows[at]?.bookmark.level ?? 0;
  const end = rows.findIndex((row, index) => index > at && row.bookmark.level <= level);
  const lifted = rows.map((row, index) => (index > at && (end === -1 || index < end) ? { ...row, bookmark: { ...row.bookmark, level: row.bookmark.level - 1 } } : row));
  return settled(lifted.filter((row) => row.id !== id));
}

export const canSave = (draft: BookmarksDraft) => draft.edited && draft.rows.every((row) => row.bookmark.title.trim() !== "");
