import { beforeAll, describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { closeDoc, openPdf } from "../../src/engine/documents";
import { pageObjects } from "../../src/engine/pageObjects";
import type { Pdfium } from "../../src/engine/pdfium";
import { renderPage } from "../../src/engine/render";
import { transformPdf } from "../../src/engine/transform";
import type { EditItem, FieldEdit } from "../../src/engine/types";
import { formPdf, loadTestPdfium, rawPdf, textPdf } from "./support";

/** A combo whose options carry an export value apart from their label. */
const pairsPdf = () => rawPdf([
  "<</Type/Catalog/Pages 2 0 R/AcroForm<</Fields[4 0 R]/DA(/Helv 0 Tf 0 g)/DR<</Font<</Helv 5 0 R>>>>>>>>",
  "<</Type/Pages/Kids[3 0 R]/Count 1>>",
  "<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Annots[4 0 R]>>",
  "<</Type/Annot/Subtype/Widget/FT/Ch/Ff 131072/T(country)/V(FR)/Opt[[(FR)(France)][(DE)(Germany)]]/Rect[100 400 300 430]/F 4/DA(/Helv 12 Tf 0 g)>>",
  "<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>",
]);

let p: Pdfium;
beforeAll(async () => {
  p = await loadTestPdfium();
});

async function readFields(bytes: Uint8Array): Promise<Record<string, unknown>> {
  return Object.fromEntries((await readAnnotations(bytes)).map((annotation) => [annotation.fieldName, annotation.fieldValue]));
}

async function readAnnotations(bytes: Uint8Array): Promise<{ fieldName: string; fieldValue: unknown; annotationFlags: number }[]> {
  const task = getDocument({ data: bytes.slice(), verbosity: 0 });
  try {
    return await (await (await task.promise).getPage(1)).getAnnotations() as { fieldName: string; fieldValue: unknown; annotationFlags: number }[];
  } finally {
    await task.destroy();
  }
}

function fieldsOf(bytes: Uint8Array, edits: FieldEdit[] = [], index = 0, password = "") {
  const doc = openPdf(p, bytes, password);
  try {
    return pageObjects(p, doc, index, [], new Map(), edits).fields;
  } finally {
    closeDoc(p, doc);
  }
}

function filled(bytes: Uint8Array, fields: FieldEdit[], items: EditItem[] = [], password = ""): Uint8Array {
  const doc = openPdf(p, bytes, password);
  try {
    return transformPdf(p, doc, { kind: "edit", items, images: {}, edits: [], fields });
  } finally {
    closeDoc(p, doc);
  }
}

const blank = (rotate = 0) => rawPdf(["<</Type/Catalog/Pages 2 0 R>>", "<</Type/Pages/Kids[3 0 R]/Count 1>>", `<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Rotate ${rotate}>>`]);
const field = (id: string, fields: Partial<Extract<EditItem, { kind: "field" }>>): EditItem => ({ id, pageIndex: 0, kind: "field", field: "text", name: id, multiline: false, options: [], box: { x: 100, y: 100, width: 200, height: 24 }, ...fields });

const colour = ({ pixels, width }: { pixels: Uint8ClampedArray; width: number }, x: number, y: number): [number, number, number] => [pixels[(y * width + x) * 4]!, pixels[(y * width + x) * 4 + 1]!, pixels[(y * width + x) * 4 + 2]!];

describe("forms", () => {
  it("draws a form's fields in a page's render, as readers do, document after document", () => {
    for (let round = 0; round < 3; round++) {
      const doc = openPdf(p, formPdf());
      try {
        for (const render of [renderPage(p, doc, 0, 600), renderPage(p, doc, 0, 600)]) {
          expect([colour(render, 200, 180), colour(render, 120, 280), colour(render, 50, 50)]).toEqual([[255, 0, 0], [0, 0, 255], [255, 255, 255]]);
        }
      } finally {
        closeDoc(p, doc);
      }
    }
  });

  it("lists a page's fields as the reader sees them, on an upright page and a turned one", () => {
    expect(fieldsOf(formPdf())).toMatchObject([
      { index: 0, kind: "text", name: "name", value: "Jean", box: { x: 100, y: 160, width: 200, height: 40 }, size: 12, maxLength: null, readOnly: false, multiline: false, options: [] },
      { index: 1, kind: "checkbox", name: "ok", checked: true, exportValue: "Yes" },
      { index: 2, kind: "combo", name: "city", value: "Lyon", options: ["Paris", "Lyon"], selected: 1 },
      { index: 3, kind: "text", name: "code", value: "", maxLength: 5 },
      { index: 4, kind: "radio", name: "choice", checked: false, exportValue: "A" },
      { index: 5, kind: "radio", name: "choice", checked: true, exportValue: "B" },
    ]);
    expect(fieldsOf(formPdf(90))[0]!.box).toMatchObject({ width: 40, height: 200 });
  });

  it("fills the fields, lists the new values, and readers show them", async () => {
    const edits: FieldEdit[] = [{ pageIndex: 0, index: 0, value: "Marie Curie" }, { pageIndex: 0, index: 1, value: "Off" }, { pageIndex: 0, index: 2, value: "Paris" }, { pageIndex: 0, index: 4, value: "A" }];
    expect(fieldsOf(formPdf(), edits).map((field) => [field.value, field.checked])).toEqual([["Marie Curie", false], ["Off", false], ["Paris", false], ["", false], ["A", true], ["A", false]]);
    const bytes = filled(formPdf(), edits);
    expect(await readFields(bytes)).toEqual({ name: "Marie Curie", ok: "Off", city: ["Paris"], code: "", choice: "A" });
    const doc = openPdf(p, bytes);
    try {
      const render = renderPage(p, doc, 0, 600);
      const inked: number[] = [];
      for (let x = 100; x < 300; x++) for (let y = 165; y < 195; y++) if (colour(render, x, y).every((value) => value < 100)) inked.push(x);
      expect([inked.length > 20, Math.min(...inked) >= 100, Math.max(...inked) < 220]).toEqual([true, true, true]);
      expect(fieldsOf(bytes)[1]!.checked).toBe(false);
    } finally {
      closeDoc(p, doc);
    }
    expect(fieldsOf(pairsPdf())[0]).toMatchObject({ value: "France", selected: 0, options: ["France", "Germany"] });
    const chosen = filled(pairsPdf(), [{ pageIndex: 0, index: 0, value: "Germany", option: 1 }]);
    expect([fieldsOf(chosen)[0]!.value, fieldsOf(chosen)[0]!.selected, (await readFields(chosen)).country]).toEqual(["Germany", 1, ["DE"]]);
    expect(() => filled(formPdf(), [{ pageIndex: 0, index: 7, value: "x" }])).toThrow("damaged");
    expect(() => filled(formPdf(), [{ pageIndex: 3, index: 0, value: "x" }])).toThrow("damaged");
  });

  it("adds a text field, a box and a list to a page, as widgets a reader fills and prints, and refuses a turned page and a taken name", async () => {
    const items = [
      field("Prénom", {}),
      field("ok", { field: "checkbox", box: { x: 100, y: 140, width: 16, height: 16 } }),
      field("ville", { field: "combo", options: ["Évry", "Lyon"], box: { x: 100, y: 170, width: 200, height: 24 } }),
      field("avis", { multiline: true, box: { x: 100, y: 210, width: 200, height: 60 } }),
    ];
    {
      const bytes = filled(blank(), [], items);
      const fields = fieldsOf(bytes);
      expect(fields).toMatchObject([{ kind: "text", name: "Prénom", multiline: false, size: 0 }, { kind: "checkbox", name: "ok", checked: false }, { kind: "combo", name: "ville", options: ["Évry", "Lyon"], size: 0 }, { kind: "text", name: "avis", multiline: true }]);
      expect((await readAnnotations(bytes)).map((annotation) => annotation.annotationFlags & 4)).toEqual([4, 4, 4, 4]);
      for (const [index, item] of items.entries()) for (const key of ["x", "y", "width", "height"] as const) expect(fields[index]!.box[key]).toBeCloseTo((item as Extract<EditItem, { kind: "field" }>).box[key], 0);
      expect(await readFields(bytes)).toEqual({ Prénom: "", ok: "Off", ville: [], avis: "" });
      expect(await readFields(filled(bytes, [{ pageIndex: 0, index: 0, value: "Élodie" }, { pageIndex: 0, index: 1, value: "Yes" }, { pageIndex: 0, index: 2, value: "Évry", option: 0 }]))).toEqual({ Prénom: "Élodie", ok: "Yes", ville: ["Évry"], avis: "" });
    }
    expect(() => filled(blank(), [], [field("a", {}), field("b", { name: "a" })])).toThrow("damaged");
    expect(() => filled(blank(), [], [field("a", { name: " " })])).toThrow("damaged");
    expect(() => filled(blank(90), [], [field("a", {})])).toThrow("damaged");
    expect(() => filled(formPdf(), [], [field("name", {})])).toThrow("fieldNameTaken");
    // Filled and added in one pass: the values land on the old widgets, the new one comes after them.
    const both = filled(formPdf(), [{ pageIndex: 0, index: 0, value: "Marie" }], [field("extra", {})]);
    expect(await readFields(both)).toMatchObject({ name: "Marie", extra: "" });
    expect(fieldsOf(both)[6]).toMatchObject({ index: 6, name: "extra", kind: "text" });
    expect(() => filled(formPdf(), [], [field("a.b", {})])).toThrow("damaged");
    // A note added on the same page comes before the new widget; a second page gets its own.
    const note: EditItem = { id: "n", pageIndex: 0, kind: "note", at: { x: 10, y: 10 }, text: "x", author: "", color: [250, 204, 21] };
    const spread = filled(textPdf(p, ["One", "Two"]), [], [note, field("first", {}), { ...field("second", {}), pageIndex: 1 }]);
    expect([fieldsOf(spread).map((each) => [each.index, each.name]), fieldsOf(spread, [], 1).map((each) => [each.index, each.name])]).toEqual([[[1, "first"]], [[0, "second"]]]);
    // A protected document stays protected, and gets its field all the same.
    const locked = filled(textPdf(p, ["Hello"], {}, "1234"), [], [field("code", {})], "1234");
    expect(() => openPdf(p, locked)).toThrow("passwordRequired");
    expect(fieldsOf(locked, [], 0, "1234")).toMatchObject([{ name: "code", kind: "text" }]);
  });
});
