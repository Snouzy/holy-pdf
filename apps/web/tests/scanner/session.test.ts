import { describe, expect, it } from "vitest";
import { emptyHistory, emptySession, imported, movePage, perform, redo, type Session, undo } from "../../src/scanner/session";

const ids = () => {
  let next = 0;
  return () => `id${++next}`;
};
const file = (name: string) => new File([], name);
const layout = (session: Session) => session.documents.map((doc) => `${doc.name}:${doc.pageIds.join(",")}`);

describe("scanner session", () => {
  it("makes one document of the photos of one import, named after the day", () => {
    const newId = ids();
    const session = imported(imported(emptySession, [file("a.heic"), file("b.heic")], newId, new Date(2026, 9, 3)), [file("c.jpg")], newId, new Date(2026, 9, 3));
    expect(layout(session)).toEqual(["2026-10-03_Document-1:id1,id2", "2026-10-03_Document-2:id4"]);
  });

  it("undoes a page removal, even the last page of a document, and keeps a photo imported meanwhile", () => {
    const newId = ids();
    let state = { session: imported(emptySession, [file("a"), file("b")], newId, new Date(2026, 9, 3)), history: emptyHistory };
    state = perform(state, { kind: "removePage", pageId: "id1" });
    state = perform(state, { kind: "removePage", pageId: "id2" });
    expect(layout(state.session)).toEqual([]);
    state = { ...state, session: imported(state.session, [file("c")], newId, new Date(2026, 9, 3)) };
    state = undo(undo(state));
    expect(layout(state.session)).toEqual(["2026-10-03_Document-1:id1,id2", "2026-10-03_Document-1:id4"]);
    state = redo(state);
    expect(layout(state.session)).toEqual(["2026-10-03_Document-1:id2", "2026-10-03_Document-1:id4"]);
  });

  it("moves a page within its document, to another one, or to a new one, and undoes each move", () => {
    const newId = ids();
    const start = { session: imported(imported(emptySession, [file("a"), file("b"), file("c")], newId, new Date(2026, 9, 3)), [file("d")], newId, new Date(2026, 9, 3)), history: emptyHistory };
    const within = perform(start, movePage(start.session, "id1", { docId: "id4", index: 3 }));
    expect(layout(within.session)).toEqual(["2026-10-03_Document-1:id2,id3,id1", "2026-10-03_Document-2:id5"]);
    const across = perform(within, movePage(within.session, "id5", { docId: "id4", index: 0 }));
    expect(layout(across.session)).toEqual(["2026-10-03_Document-1:id5,id2,id3,id1"]);
    const apart = perform(across, movePage(across.session, "id2", { newDocAfter: "id4", docId: "new", name: "Split" }));
    expect(layout(apart.session)).toEqual(["2026-10-03_Document-1:id5,id3,id1", "Split:id2"]);
    expect(layout(undo(undo(undo(apart))).session)).toEqual(layout(start.session));
  });

  it("undoes a rename, a document removal and a page edit", () => {
    const newId = ids();
    let state = { session: imported(emptySession, [file("a")], newId, new Date(2026, 9, 3)), history: emptyHistory };
    state = perform(state, { kind: "rename", docId: "id2", name: "Contract" });
    state = perform(state, { kind: "edit", pageId: "id1", edits: { erase: [], format: "a5", quarterTurns: 1 } });
    state = perform(state, { kind: "removeDocument", docId: "id2" });
    expect(layout(state.session)).toEqual([]);
    state = undo(undo(state));
    expect([layout(state.session), state.session.pages.id1?.edits.format]).toEqual([["Contract:id1"], "auto"]);
  });
});
