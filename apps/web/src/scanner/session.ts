import type { PageEdits } from "../scan/pipeline";
import type { ScanFailure, ScanResult } from "../scan/protocol";
import type { PageFormat } from "../scan/sizing";
import type { TextLine } from "../scan/suggest";

export type Edits = PageEdits & { format: PageFormat };
export type PageStatus = { kind: "waiting" } | { kind: "ready"; result: ScanResult } | { kind: "failed"; error: ScanFailure };
/**
 * `autoTurns`: the quarter turns the reading found, used while the visitor sets none. `text`: the lines read on the
 * drawing `of`; a new drawing is read again. `captureDay`: from the photo's EXIF.
 */
export type Page = {
  id: string; file: File; edits: Edits; status: PageStatus;
  autoTurns?: number | undefined; text?: { lines: TextLine[]; of: Blob } | "unread" | undefined; captureDay?: string | undefined;
};
/** `reason`: why the reading suggested this document, shown under its name. */
export type Doc = { id: string; name: string; pageIds: string[]; reason?: string | undefined };
export type Session = { pages: Record<string, Page>; documents: Doc[] };

/** A change the visitor can undo; applying one returns its inverse. */
export type Op =
  | { kind: "removePage"; pageId: string }
  | { kind: "insertPage"; pageId: string; docId: string; index: number; doc?: { name: string; index: number } }
  | { kind: "removeDocument"; docId: string }
  | { kind: "insertDocument"; doc: Doc; index: number }
  | { kind: "rename"; docId: string; name: string }
  | { kind: "edit"; pageId: string; edits: Edits }
  | { kind: "batch"; ops: Op[] };

export const emptySession: Session = { pages: {}, documents: [] };
export const defaultEdits: Edits = { erase: [], format: "auto" };

const isoDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** The photos of one import form one document, named like the Mac's: `AAAA-MM-JJ_Document-N`. */
export function imported(session: Session, files: File[], newId: () => string, today = new Date()): Session {
  if (files.length === 0) return session;
  const pages = files.map((file): Page => ({ id: newId(), file, edits: defaultEdits, status: { kind: "waiting" } }));
  const doc: Doc = { id: newId(), name: `${isoDay(today)}_Document-${session.documents.length + 1}`, pageIds: pages.map((page) => page.id) };
  return { pages: { ...session.pages, ...Object.fromEntries(pages.map((page) => [page.id, page])) }, documents: [...session.documents, doc] };
}

export function patched(session: Session, pageId: string, patch: Partial<Page>): Session {
  const page = session.pages[pageId];
  return page ? { ...session, pages: { ...session.pages, [pageId]: { ...page, ...patch } } } : session;
}

export function apply(session: Session, op: Op): { session: Session; inverse: Op } {
  switch (op.kind) {
    case "removePage": {
      const docIndex = session.documents.findIndex((doc) => doc.pageIds.includes(op.pageId));
      const doc = session.documents[docIndex];
      if (!doc) return { session, inverse: { kind: "batch", ops: [] } };
      const index = doc.pageIds.indexOf(op.pageId);
      const pageIds = doc.pageIds.filter((id) => id !== op.pageId);
      // The last page takes its document along; the undo brings both back.
      const documents = pageIds.length > 0 ? session.documents.map((each) => (each.id === doc.id ? { ...doc, pageIds } : each)) : session.documents.filter((each) => each.id !== doc.id);
      return { session: { ...session, documents }, inverse: { kind: "insertPage", pageId: op.pageId, docId: doc.id, index, ...(pageIds.length === 0 ? { doc: { name: doc.name, index: docIndex } } : {}) } };
    }
    case "insertPage": {
      const existing = session.documents.find((doc) => doc.id === op.docId);
      const documents = existing
        ? session.documents.map((doc) => (doc.id === op.docId ? { ...doc, pageIds: [...doc.pageIds.slice(0, op.index), op.pageId, ...doc.pageIds.slice(op.index)] } : doc))
        : [...session.documents.slice(0, op.doc?.index ?? session.documents.length), { id: op.docId, name: op.doc?.name ?? "", pageIds: [op.pageId] }, ...session.documents.slice(op.doc?.index ?? session.documents.length)];
      return { session: { ...session, documents }, inverse: { kind: "removePage", pageId: op.pageId } };
    }
    case "removeDocument": {
      const index = session.documents.findIndex((doc) => doc.id === op.docId);
      const doc = session.documents[index];
      if (!doc) return { session, inverse: { kind: "batch", ops: [] } };
      return { session: { ...session, documents: session.documents.filter((each) => each.id !== op.docId) }, inverse: { kind: "insertDocument", doc, index } };
    }
    case "insertDocument":
      return {
        session: { ...session, documents: [...session.documents.slice(0, op.index), op.doc, ...session.documents.slice(op.index)] },
        inverse: { kind: "removeDocument", docId: op.doc.id },
      };
    case "rename": {
      const doc = session.documents.find((each) => each.id === op.docId);
      if (!doc) return { session, inverse: { kind: "batch", ops: [] } };
      return { session: { ...session, documents: session.documents.map((each) => (each.id === op.docId ? { ...each, name: op.name } : each)) }, inverse: { kind: "rename", docId: op.docId, name: doc.name } };
    }
    case "edit": {
      const page = session.pages[op.pageId];
      if (!page) return { session, inverse: { kind: "batch", ops: [] } };
      return { session: { ...session, pages: { ...session.pages, [op.pageId]: { ...page, edits: op.edits } } }, inverse: { kind: "edit", pageId: op.pageId, edits: page.edits } };
    }
    case "batch": {
      let current = session;
      const inverses: Op[] = [];
      for (const each of op.ops) {
        const applied = apply(current, each);
        current = applied.session;
        inverses.unshift(applied.inverse);
      }
      return { session: current, inverse: { kind: "batch", ops: inverses } };
    }
  }
}

export function movePage(session: Session, pageId: string, target: { docId: string; index: number } | { newDocAfter: string; docId: string; name: string }): Op {
  if ("newDocAfter" in target) {
    const after = session.documents.findIndex((doc) => doc.id === target.newDocAfter);
    return { kind: "batch", ops: [{ kind: "removePage", pageId }, { kind: "insertPage", pageId, docId: target.docId, index: 0, doc: { name: target.name, index: after + 1 } }] };
  }
  const from = session.documents.find((doc) => doc.pageIds.includes(pageId));
  // Leaving its own document shifts the pages after it: the index is the one the page lands on.
  const index = from?.id === target.docId && from.pageIds.indexOf(pageId) < target.index ? target.index - 1 : target.index;
  return { kind: "batch", ops: [{ kind: "removePage", pageId }, { kind: "insertPage", pageId, docId: target.docId, index }] };
}

export type History = { undo: Op[]; redo: Op[] };
export const emptyHistory: History = { undo: [], redo: [] };

export function perform(state: { session: Session; history: History }, op: Op): { session: Session; history: History } {
  const { session, inverse } = apply(state.session, op);
  return { session, history: { undo: [...state.history.undo, inverse], redo: [] } };
}

export function undo(state: { session: Session; history: History }): { session: Session; history: History } {
  const last = state.history.undo.at(-1);
  if (!last) return state;
  const { session, inverse } = apply(state.session, last);
  return { session, history: { undo: state.history.undo.slice(0, -1), redo: [...state.history.redo, inverse] } };
}

export function redo(state: { session: Session; history: History }): { session: Session; history: History } {
  const last = state.history.redo.at(-1);
  if (!last) return state;
  const { session, inverse } = apply(state.session, last);
  return { session, history: { undo: [...state.history.undo, inverse], redo: state.history.redo.slice(0, -1) } };
}
