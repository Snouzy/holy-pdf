import { describe, expect, it } from "vitest";
import { boundsOf, canSave, composedCrop, created, croppedPicture, edited, emptyEdit, fieldKey, fieldName, fieldsValid, filled, parseFieldKey, rekinded, flippedPicture, fractionsIn, hit, moved, originalKey, parseOriginalKey, picked, quadsOf, redone, reordered, resized, restyled, revised, rotatedPicture, styleOf, turnedBox, type EditDraft, type Style, undone, validLink } from "../../src/edit/model";
import { type EditItem, type EditText, type OriginalEdit, type PageWord, plainPicture } from "../../src/engine/types";

const style: Style = { color: [0, 0, 0], fill: false, lineWidth: 3, font: "Helvetica", bold: false, size: 20, stamp: "APPROUVÉ", field: "text" };
const measure = (item: EditText) => Math.max(...item.text.split("\n").map((line) => line.length)) * item.size * 0.5;
const rectangle = (id: string, x = 0): EditItem => ({ id, pageIndex: 0, kind: "rectangle", box: { x, y: 0, width: 100, height: 50 }, stroke: [0, 0, 0], fill: null, lineWidth: 3 });

describe("edit model", () => {
  it("creates a shape from a drag in any direction, and a default one from a click", () => {
    expect(created("rectangle", "a", 0, { x: 200, y: 150 }, { x: 100, y: 100 }, style)).toMatchObject({ kind: "rectangle", box: { x: 100, y: 100, width: 100, height: 50 }, stroke: [0, 0, 0], fill: null, lineWidth: 3 });
    expect(created("ellipse", "a", 0, { x: 100, y: 100 }, { x: 101, y: 100 }, { ...style, fill: true })).toMatchObject({ box: { x: 100, y: 100, width: 120, height: 80 }, stroke: null, fill: [0, 0, 0] });
    expect(created("arrow", "a", 0, { x: 10, y: 10 }, { x: 10, y: 11 }, style)).toMatchObject({ from: { x: 10, y: 10 }, to: { x: 130, y: 10 } });
    expect(created("text", "a", 2, { x: 30, y: 40 }, { x: 30, y: 40 }, style)).toMatchObject({ pageIndex: 2, kind: "text", at: { x: 30, y: 40 }, text: "", font: "Helvetica", size: 20 });
  });

  it("draws a square or a circle with Shift, from any corner, and keeps a box's proportions when resizing with it", () => {
    expect(created("ellipse", "c", 0, { x: 100, y: 100 }, { x: 160, y: 120 }, style, true)).toMatchObject({ box: { x: 100, y: 100, width: 60, height: 60 } });
    expect(created("rectangle", "s", 0, { x: 100, y: 100 }, { x: 60, y: 190 }, style, true)).toMatchObject({ box: { x: 10, y: 100, width: 90, height: 90 } });
    expect(created("line", "l", 0, { x: 0, y: 0 }, { x: 60, y: 20 }, style, true)).toMatchObject({ to: { x: 60, y: 20 } });
    expect(resized(rectangle("a"), "se", { x: 200, y: 200 }, undefined, true)).toMatchObject({ box: { x: 0, y: 0, width: 200, height: 100 } });
  });

  it("moves an item, and resizes a box by a corner past the opposite one", () => {
    expect(moved(rectangle("a"), 5, -5)).toMatchObject({ box: { x: 5, y: -5, width: 100, height: 50 } });
    expect(moved({ id: "l", pageIndex: 0, kind: "ink", points: [{ x: 1, y: 1 }], color: [0, 0, 0], lineWidth: 1 }, 2, 3)).toMatchObject({ points: [{ x: 3, y: 4 }] });
    expect(resized(rectangle("a"), "se", { x: 150, y: 80 })).toMatchObject({ box: { x: 0, y: 0, width: 150, height: 80 } });
    expect(resized(rectangle("a"), "se", { x: -20, y: -10 })).toMatchObject({ box: { x: -20, y: -10, width: 20, height: 10 } });
    const line: EditItem = { id: "l", pageIndex: 0, kind: "line", from: { x: 0, y: 0 }, to: { x: 10, y: 0 }, color: [0, 0, 0], lineWidth: 2 };
    expect(resized(line, "to", { x: 20, y: 5 })).toMatchObject({ from: { x: 0, y: 0 }, to: { x: 20, y: 5 } });
  });

  it("finds the topmost item under a point, a line by its distance, a text by its measured box", () => {
    const items = [rectangle("under"), rectangle("over", 50), { id: "t", pageIndex: 0, kind: "text", at: { x: 300, y: 300 }, text: "Hello", font: "Helvetica", bold: false, size: 20, color: [0, 0, 0] } satisfies EditItem];
    expect(hit(items, 0, { x: 60, y: 10 }, measure, 2)?.id).toBe("over");
    expect(hit(items, 0, { x: 20, y: 10 }, measure, 2)?.id).toBe("under");
    expect(hit(items, 1, { x: 20, y: 10 }, measure, 2)).toBeUndefined();
    expect(hit(items, 0, { x: 340, y: 310 }, measure, 2)?.id).toBe("t");
    expect(boundsOf(items[2]!, measure)).toEqual({ x: 300, y: 300, width: 50, height: 24 });
    const line: EditItem = { id: "l", pageIndex: 0, kind: "line", from: { x: 0, y: 0 }, to: { x: 100, y: 100 }, color: [0, 0, 0], lineWidth: 2 };
    expect([hit([line], 0, { x: 52, y: 50 }, measure, 3)?.id, hit([line], 0, { x: 80, y: 20 }, measure, 3)]).toEqual(["l", undefined]);
  });

  it("puts an item in front or behind the others, undoes and redoes each change", () => {
    let draft: EditDraft = edited(emptyEdit("doc"), [rectangle("a"), rectangle("b")]);
    draft = reordered(draft, "a", true);
    expect(draft.items.map((item) => item.id)).toEqual(["b", "a"]);
    draft = reordered(draft, "a", false);
    expect(draft.items.map((item) => item.id)).toEqual(["a", "b"]);
    draft = edited(draft, [rectangle("a")]);
    draft = undone(draft);
    expect(draft.items.map((item) => item.id)).toEqual(["a", "b"]);
    draft = undone(undone(undone(draft)));
    expect(draft.items).toEqual([]);
    expect(undone(draft)).toBe(draft);
    expect(redone(redone(draft)).items.map((item) => item.id)).toEqual(["b", "a"]);
    const typed = edited({ ...emptyEdit("doc"), items: [rectangle("a"), rectangle("b")] }, [rectangle("a"), rectangle("b"), rectangle("c")], [rectangle("a")]);
    expect(undone(typed).items.map((item) => item.id)).toEqual(["a"]);
  });

  it("restyles an item with what applies to it, and reads its style back", () => {
    const outlined = restyled(rectangle("a"), { color: [255, 0, 0], lineWidth: 6, size: 40 });
    expect(outlined).toMatchObject({ stroke: [255, 0, 0], fill: null, lineWidth: 6 });
    expect(restyled(outlined, { fill: true })).toMatchObject({ stroke: null, fill: [255, 0, 0] });
    const text: EditItem = { id: "t", pageIndex: 0, kind: "text", at: { x: 0, y: 0 }, text: "a", font: "Times", bold: false, size: 12, color: [0, 0, 0] };
    expect(restyled(text, { font: "Courier", bold: true, size: 30, lineWidth: 6 })).toMatchObject({ font: "Courier", bold: true, size: 30 });
    expect(styleOf(restyled(outlined, { fill: true }), style)).toMatchObject({ color: [255, 0, 0], fill: true, lineWidth: 6 });
    expect(styleOf(text, style)).toMatchObject({ color: [0, 0, 0], font: "Times", size: 12, lineWidth: 3 });
  });

  it("keeps one retouch per original object, in the same history as the additions", () => {
    const box = { x: 10, y: 10, width: 50, height: 20 };
    const move: OriginalEdit = { pageIndex: 0, index: 2, box };
    let draft = revised(emptyEdit("doc"), move);
    draft = revised(draft, { pageIndex: 0, index: 2, text: "Hollo" });
    draft = revised(draft, { pageIndex: 1, index: 0, deleted: true });
    expect(draft.edits).toEqual([{ pageIndex: 0, index: 2, box, text: "Hollo" }, { pageIndex: 1, index: 0, deleted: true }]);
    draft = edited(draft, [rectangle("a")]);
    draft = undone(draft);
    expect([draft.items, draft.edits.length]).toEqual([[], 2]);
    draft = undone(draft);
    expect(draft.edits).toEqual([{ pageIndex: 0, index: 2, box, text: "Hollo" }]);
    draft = redone(redone(draft));
    expect([draft.items.length, draft.edits.length]).toEqual([1, 2]);
    expect(revised(emptyEdit("doc"), { pageIndex: 0, index: 2, box }).past).toHaveLength(1);
  });

  it("names an original object in the selection, and reads the name back", () => {
    expect(originalKey(3, 12)).toBe("o:3:12");
    expect(parseOriginalKey("o:3:12")).toEqual({ pageIndex: 3, index: 12 });
    expect(parseOriginalKey("8b2c-uuid")).toBeNull();
    expect(canSave(revised(emptyEdit("doc"), { pageIndex: 0, index: 0, deleted: true }))).toBe(true);
  });

  it("covers the words a rectangle touches, one quad per line, and nothing when it touches no word", () => {
    const word = (text: string, x: number, y: number, line: number): PageWord => ({ text, line, box: { x, y, width: 40, height: 12 } });
    const words = [word("Hello", 10, 100, 0), word("big", 60, 100, 0), word("world", 110, 100, 0), word("Second", 10, 130, 1), word("line", 60, 130, 1)];
    expect(quadsOf(words, { x: 55, y: 95, width: 20, height: 40 })).toEqual([{ x: 60, y: 100, width: 40, height: 12 }, { x: 60, y: 130, width: 40, height: 12 }]);
    expect(quadsOf(words, { x: 0, y: 90, width: 200, height: 30 })).toEqual([{ x: 10, y: 100, width: 140, height: 12 }]);
    expect(quadsOf(words, { x: 300, y: 300, width: 10, height: 10 })).toEqual([]);
  });

  it("places a note under the click, a link from a drag, and knows a sound link", () => {
    expect(created("note", "n", 0, { x: 100, y: 100 }, { x: 100, y: 100 }, style)).toMatchObject({ kind: "note", at: { x: 90, y: 90 }, text: "", author: "" });
    const link = created("link", "l", 0, { x: 10, y: 10 }, { x: 110, y: 40 }, style);
    expect(link).toMatchObject({ kind: "link", box: { x: 10, y: 10, width: 100, height: 30 }, target: { url: "" } });
    if (link.kind !== "link") throw new Error("not a link");
    expect([validLink(link), validLink({ ...link, target: { url: "https://holy.pdf/" } }), validLink({ ...link, target: { url: "holy.pdf" } }), validLink({ ...link, target: { page: 2 } })]).toEqual([false, true, false, true]);
    expect(canSave(edited(emptyEdit("doc"), [link]))).toBe(false);
    expect(boundsOf({ id: "m", pageIndex: 0, kind: "markup", style: "underline", color: [0, 0, 0], quads: [{ x: 10, y: 10, width: 50, height: 10 }, { x: 10, y: 30, width: 80, height: 10 }] }, measure)).toEqual({ x: 10, y: 10, width: 80, height: 30 });
    expect(moved({ id: "n", pageIndex: 0, kind: "note", at: { x: 1, y: 1 }, text: "", author: "", color: [0, 0, 0] }, 2, 3)).toMatchObject({ at: { x: 3, y: 4 } });
  });

  it("turns, mirrors and crops a picture, undoing the turn to find the pixels a rectangle shows", () => {
    expect(rotatedPicture(plainPicture, 1).rotate).toBe(90);
    expect(rotatedPicture({ ...plainPicture, rotate: 270 }, 1).rotate).toBe(0);
    expect(rotatedPicture(plainPicture, -1).rotate).toBe(270);
    expect(rotatedPicture({ ...plainPicture, flipX: true }, 1).rotate).toBe(270);
    expect(rotatedPicture({ ...plainPicture, flipX: true, flipY: true }, 1).rotate).toBe(90);
    expect(flippedPicture(plainPicture, "x")).toMatchObject({ flipX: true, flipY: false });
    expect(turnedBox({ x: 100, y: 100, width: 200, height: 100 })).toEqual({ x: 150, y: 50, width: 100, height: 200 });
    const box = { x: 0, y: 0, width: 200, height: 100 };
    // The top-right quarter of a picture turned clockwise once shows the top-left quarter of its pixels.
    expect(croppedPicture({ ...plainPicture, rotate: 90 }, box, { x: 100, y: 0, width: 100, height: 50 }).crop).toEqual({ x: 0, y: 0, width: 0.5, height: 0.5 });
    expect(croppedPicture(plainPicture, box, { x: 100, y: 0, width: 100, height: 50 }).crop).toEqual({ x: 0.5, y: 0, width: 0.5, height: 0.5 });
    expect(croppedPicture({ ...plainPicture, flipX: true }, box, { x: 100, y: 0, width: 100, height: 50 }).crop).toEqual({ x: 0, y: 0, width: 0.5, height: 0.5 });
    expect(croppedPicture({ ...plainPicture, rotate: 180 }, box, { x: 0, y: 0, width: 100, height: 50 }).crop).toEqual({ x: 0.5, y: 0.5, width: 0.5, height: 0.5 });
    expect(croppedPicture({ ...plainPicture, rotate: 270 }, box, { x: 100, y: 0, width: 100, height: 50 }).crop).toEqual({ x: 0.5, y: 0.5, width: 0.5, height: 0.5 });
    expect(composedCrop({ x: 0.5, y: 0, width: 0.5, height: 0.5 }, { x: 0, y: 0, width: 0.5, height: 1 })).toEqual({ x: 0.5, y: 0, width: 0.25, height: 0.5 });
    const corners = { topLeft: { x: 300, y: 100 }, topRight: { x: 300, y: 300 }, bottomLeft: { x: 100, y: 100 } };
    expect(fractionsIn(corners, { x: 200, y: 100, width: 100, height: 100 })).toEqual({ x: 0, y: 0, width: 0.5, height: 0.5 });
    expect(fractionsIn(corners, { x: 500, y: 500, width: 10, height: 10 })).toBeNull();
  });

  it("draws a text box from a drag, wraps its bounds, and widens it by a side handle", () => {
    const box = created("text", "t", 0, { x: 10, y: 10 }, { x: 130, y: 60 }, { ...style, font: "Courier", size: 10 });
    expect(box).toMatchObject({ kind: "text", at: { x: 10, y: 10 }, width: 120 });
    if (box.kind !== "text") throw new Error("not a text");
    const filled = { ...box, text: "The quick brown fox jumps over the lazy dog" };
    expect(boundsOf(filled, measure)).toEqual({ x: 10, y: 10, width: 120, height: 36 });
    expect(resized(filled, "e", { x: 250, y: 0 })).toMatchObject({ width: 240 });
    expect(resized(filled, "w", { x: 70, y: 0 })).toMatchObject({ at: { x: 70, y: 10 }, width: 60 });
    expect(resized(filled, "w", { x: 200, y: 0 })).toMatchObject({ at: { x: 110, y: 10 }, width: 20 });
    const free: EditItem = { id: "f", pageIndex: 0, kind: "text", at: { x: 0, y: 0 }, text: "Hello", font: "Courier", bold: false, size: 10, color: [0, 0, 0] };
    expect(resized(free, "e", { x: 100, y: 0 }, measure)).toMatchObject({ width: 100 });
  });

  it("stamps the chosen word in a frame of a usable size, centred on a click", () => {
    expect(created("stamp", "s", 0, { x: 200, y: 100 }, { x: 200, y: 100 }, { ...style, stamp: "PAYÉ" })).toMatchObject({ kind: "stamp", box: { x: 120, y: 75, width: 160, height: 50 }, text: "PAYÉ", date: null });
    expect(created("stamp", "s", 0, { x: 10, y: 10 }, { x: 110, y: 40 }, style)).toMatchObject({ box: { x: 10, y: 10, width: 100, height: 30 }, text: "APPROUVÉ" });
    expect(canSave(edited(emptyEdit("doc"), [{ id: "s", pageIndex: 0, kind: "stamp", box: { x: 0, y: 0, width: 10, height: 5 }, text: "Iași", date: null, color: [0, 0, 0] }]))).toBe(false);
    expect(created("stamp", "s", 0, { x: 200, y: 100 }, { x: 230, y: 103 }, style)).toMatchObject({ box: { x: 120, y: 75, width: 160, height: 50 } });
    expect([emptyEdit("doc").style.stamp, emptyEdit("doc", "en").style.stamp]).toEqual(["APPROUVÉ", "APPROVED"]);
    expect(picked({ ...emptyEdit("doc"), style }, "stamp").style.color).toEqual([220, 38, 38]);
    expect(picked({ ...emptyEdit("doc"), style: { ...style, color: [37, 99, 235] } }, "stamp").style.color).toEqual([37, 99, 235]);
  });

  it("saves once something is added, and never with a letter the fonts cannot write", () => {
    const text = (value: string): EditItem => ({ id: "t", pageIndex: 0, kind: "text", at: { x: 0, y: 0 }, text: value, font: "Times", bold: false, size: 12, color: [0, 0, 0] });
    expect(canSave(emptyEdit("doc"))).toBe(false);
    expect(canSave(edited(emptyEdit("doc"), [text("Été")]))).toBe(true);
    expect(canSave(edited(emptyEdit("doc"), [text("Iași")]))).toBe(false);
  });

  it("fills a form field, one value per widget, one undo step each", () => {
    let draft = filled(emptyEdit("doc"), { pageIndex: 0, index: 2, value: "Jean" });
    draft = filled(draft, { pageIndex: 0, index: 2, value: "Marie" });
    expect(draft.fields).toEqual([{ pageIndex: 0, index: 2, value: "Marie" }]);
    const group = filled(filled(filled(emptyEdit("doc"), { pageIndex: 0, index: 4, value: "B" }), { pageIndex: 0, index: 3, value: "A" }), { pageIndex: 0, index: 4, value: "B" });
    expect(group.fields.map((field) => field.index)).toEqual([3, 4]);
    expect([canSave(draft), draft.past.length]).toEqual([true, 2]);
    expect(undone(draft).fields).toEqual([{ pageIndex: 0, index: 2, value: "Jean" }]);
    expect(redone(undone(draft)).fields).toEqual(draft.fields);
    expect([fieldKey(1, 2), parseFieldKey("f:1:2"), parseFieldKey("o:1:2")]).toEqual(["f:1:2", { pageIndex: 1, index: 2 }, null]);
  });

  it("draws a form field of the chosen kind, square for a box, named in a series, each name its own", () => {
    expect(created("field", "f", 0, { x: 200, y: 100 }, { x: 200, y: 100 }, style)).toMatchObject({ kind: "field", field: "text", box: { x: 120, y: 88, width: 160, height: 24 }, name: "", multiline: false, options: [] });
    expect(created("field", "f", 0, { x: 10, y: 10 }, { x: 110, y: 50 }, { ...style, field: "checkbox" })).toMatchObject({ field: "checkbox", box: { x: 10, y: 10, width: 40, height: 40 } });
    expect(created("field", "f", 0, { x: 50, y: 50 }, { x: 38, y: 38 }, { ...style, field: "checkbox" })).toMatchObject({ box: { x: 38, y: 38, width: 12, height: 12 } });
    expect(created("field", "f", 0, { x: 10, y: 10 }, { x: 210, y: 25 }, style)).toMatchObject({ box: { x: 10, y: 10, width: 200, height: 15 } });
    expect(created("field", "f", 0, { x: 10, y: 10 }, { x: 110, y: 50 }, { ...style, field: "combo" })).toMatchObject({ field: "combo", box: { x: 10, y: 10, width: 100, height: 40 } });
    const named = (name: string, fields = {}) => ({ ...created("field", name, 0, { x: 0, y: 0 }, { x: 0, y: 0 }, style), name, ...fields }) as ReturnType<typeof created> & { kind: "field" };
    expect([fieldName("Champ", [named("Champ 1"), named("Champ 3")]), fieldName("Champ", [], ["Champ 1"])]).toEqual(["Champ 2", "Champ 2"]);
    expect([fieldsValid([named("a"), named("b")]), fieldsValid([named("a"), named("a")]), fieldsValid([named(" ")]), fieldsValid([named("a.b")]), fieldsValid([named("a")], ["a"]), fieldsValid([named("a")], ["a.b"])]).toEqual([true, false, false, false, false, false]);
    expect(canSave(edited({ ...emptyEdit("doc"), taken: ["a"] }, [named("a")]))).toBe(false);
    expect([fieldsValid([named("l", { field: "combo", options: [" "] })]), fieldsValid([named("l", { field: "combo", options: ["Paris"] })])]).toEqual([false, true]);
    expect(canSave(edited(emptyEdit("doc"), [named("a"), named("a")]))).toBe(false);
    expect(rekinded(named("a"), "checkbox").box).toMatchObject({ width: 24, height: 24 });
    expect(rekinded(rekinded(named("a"), "checkbox"), "text").box).toMatchObject({ width: 160, height: 24 });
  });
});
