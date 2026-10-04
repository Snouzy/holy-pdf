import type { EngineError, PageSize, Rotation } from "../engine/types";

export type DocStatus =
  | { kind: "opening" }
  | { kind: "ready"; pageCount: number; sizes: PageSize[] }
  | { kind: "failed"; error: EngineError };

export type Doc = { id: string; name: string; status: DocStatus };

/** `rotation` is added to the rotation the page already has in its file. */
export type PageRef = { id: string; docId: string; index: number; rotation: Rotation };

type Edit = { pages: PageRef[]; selected: string[]; cuts: string[] };

export type Board = Edit & { docs: Doc[]; history: Edit[] };

export type Action =
  | { type: "docsAdded"; docs: { id: string; name: string }[] }
  | { type: "docOpened"; docId: string; sizes: PageSize[] }
  | { type: "docFailed"; docId: string; error: EngineError }
  | { type: "docReopening"; docId: string }
  | { type: "docRemoved"; docId: string }
  | { type: "pageMoved"; pageId: string; toIndex: number }
  | { type: "pageRotated"; pageId: string }
  | { type: "allRotated" }
  | { type: "pageRemoved"; pageId: string }
  | { type: "selectionToggled"; pageId: string }
  | { type: "cutToggled"; afterPageId: string }
  | { type: "cutEvery"; pageCount: number }
  | { type: "undone" }
  | { type: "cleared" };


export const emptyBoard: Board = { docs: [], pages: [], selected: [], cuts: [], history: [] };

const historyLimit = 50;
const opening: DocStatus = { kind: "opening" };
const nextRotation: Record<Rotation, Rotation> = { 0: 90, 90: 180, 180: 270, 270: 0 };

export function reduce(board: Board, action: Action): Board {
  switch (action.type) {
    case "docsAdded":
      return { ...board, docs: [...board.docs, ...action.docs.map((doc) => ({ ...doc, status: opening }))] };
    case "docOpened":
      return openDoc(board, action.docId, action.sizes);
    case "docFailed":
      return setStatus(board, action.docId, { kind: "failed", error: action.error });
    case "docReopening":
      return setStatus(board, action.docId, opening);
    case "docRemoved": {
      // The engine closes a removed file: no step of the history may bring its pages back.
      const without = (edit: Edit): Edit => {
        const pages = edit.pages.filter((page) => page.docId !== action.docId);
        const kept = new Set(pages.map((page) => page.id));
        return { pages, selected: edit.selected.filter((id) => kept.has(id)), cuts: edit.cuts.filter((id) => kept.has(id)) };
      };
      return { ...board, ...without(board), docs: board.docs.filter((doc) => doc.id !== action.docId), history: board.history.map(without) };
    }
    case "pageMoved": {
      const page = board.pages.find((p) => p.id === action.pageId);
      if (!page) return board;
      const pages = board.pages.filter((p) => p.id !== action.pageId);
      pages.splice(action.toIndex, 0, page);
      return edit(board, { pages });
    }
    case "pageRotated":
      return edit(board, {
        pages: board.pages.map((p) => (p.id === action.pageId ? { ...p, rotation: nextRotation[p.rotation] } : p)),
      });
    case "allRotated":
      return edit(board, { pages: board.pages.map((p) => ({ ...p, rotation: nextRotation[p.rotation] })) });
    case "pageRemoved":
      return edit(board, {
        pages: board.pages.filter((p) => p.id !== action.pageId),
        selected: board.selected.filter((id) => id !== action.pageId),
        cuts: board.cuts.filter((id) => id !== action.pageId),
      });
    case "selectionToggled":
      return edit(board, { selected: toggle(board.selected, action.pageId) });
    case "cutToggled":
      return edit(board, { cuts: toggle(board.cuts, action.afterPageId) });
    case "cutEvery":
      return edit(board, {
        cuts: board.pages
          .filter((_, i) => (i + 1) % action.pageCount === 0 && i < board.pages.length - 1)
          .map((p) => p.id),
      });
    case "cleared":
      return emptyBoard;
    case "undone": {
      const previous = board.history.at(-1);
      if (!previous) return board;
      return { ...board, ...previous, history: board.history.slice(0, -1) };
    }
  }
}

function edit(board: Board, change: Partial<Edit>): Board {
  const before: Edit = { pages: board.pages, selected: board.selected, cuts: board.cuts };
  return { ...board, ...change, history: [...board.history.slice(1 - historyLimit), before] };
}

function setStatus(board: Board, docId: string, status: DocStatus): Board {
  return { ...board, docs: board.docs.map((doc) => (doc.id === docId ? { ...doc, status } : doc)) };
}

/**
 * A file's pages go after the pages of the files added before it, even if it finishes opening last.
 * Undo steps get them too: undoing an older edit must not drop a file that opened since.
 */
function openDoc(board: Board, docId: string, sizes: PageSize[]): Board {
  const order = board.docs.findIndex((doc) => doc.id === docId);
  if (order === -1) return board;
  const docOrder = new Map(board.docs.map((doc, i) => [doc.id, i]));
  const newPages: PageRef[] = sizes.map((_, index) => ({ id: `${docId}:${index}`, docId, index, rotation: 0 }));
  const insert = (pages: PageRef[]) => {
    const after = pages.findIndex((page) => (docOrder.get(page.docId) ?? -1) > order);
    const cut = after === -1 ? pages.length : after;
    return [...pages.slice(0, cut), ...newPages, ...pages.slice(cut)];
  };
  const withStatus = setStatus(board, docId, { kind: "ready", pageCount: sizes.length, sizes });
  return { ...withStatus, pages: insert(board.pages), history: board.history.map((step) => ({ ...step, pages: insert(step.pages) })) };
}

function toggle(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id];
}
