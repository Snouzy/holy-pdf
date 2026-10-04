import { apply, type Axes, fromDisplayed, invert } from "./affine";
import { EngineFailure } from "./failure";
import { formOf } from "./forms";
import { malloc, type Pdfium } from "./pdfium";
import type { Box, EditField, EditItem, FieldEdit, FieldKind, FormField, Point, Rgb } from "./types";

const widget = 20;
const kinds: Record<number, FormField["kind"]> = { 2: "checkbox", 3: "radio", 4: "combo", 5: "list", 6: "text" };
const [readOnly, multiline] = [1 << 0, 1 << 12];
const [hidden, noView] = [1 << 1, 1 << 5];
const comboFlag = 1 << 17;
const fieldTypes: Record<FieldKind, number> = { text: 6, checkbox: 2, combo: 4 };
/** `EPDFAnnot_SetDefaultAppearance` ranks the standard fonts: Courier 0 to 3, Helvetica 4 to 7, Times 8 to 11. */
const helvetica = 4;
const [solidBorder, blackBorder] = [0, 0];
const printable = 4;

export const isField = (item: EditItem): item is EditItem & EditField => item.kind === "field";

/** The form fields of a loaded page, boxed as the reader sees them. None when PDFium opens no form environment. */
export function fieldsOf(p: Pdfium, handle: number, page: number, axes: Axes): FormField[] {
  const form = formOf(p, handle);
  if (form === 0) return [];
  const toShown = invert(fromDisplayed(axes));
  const numbers = malloc(p, 16);
  const fields: FormField[] = [];
  // PDFium answers about a widget's state and look only once the page has its view.
  p.FORM_OnAfterLoadPage(page, form);
  try {
    for (let index = 0; index < p.FPDFPage_GetAnnotCount(page); index++) {
      const annot = p.FPDFPage_GetAnnot(page, index);
      if (annot === 0) continue;
      try {
        if (p.FPDFAnnot_GetSubtype(annot) !== widget || (p.FPDFAnnot_GetFlags(annot) & (hidden | noView)) !== 0) continue;
        const kind = kinds[p.FPDFAnnot_GetFormFieldType(form, annot)] ?? "other";
        const flags = p.FPDFAnnot_GetFormFieldFlags(form, annot);
        const options = kind === "combo" || kind === "list" ? Array.from({ length: Math.max(0, p.FPDFAnnot_GetOptionCount(form, annot)) }, (_, option) => wide(p, (buffer, length) => p.FPDFAnnot_GetOptionLabel(form, annot, option, buffer, length))) : [];
        const selected = options.length > 0 ? options.findIndex((_, option) => p.FPDFAnnot_IsOptionSelected(form, annot, option)) : null;
        fields.push({
          index, kind, box: shownRect(p, annot, numbers, toShown),
          name: wide(p, (buffer, length) => p.FPDFAnnot_GetFormFieldName(form, annot, buffer, length)),
          value: selected !== null && selected >= 0 ? options[selected]! : wide(p, (buffer, length) => p.FPDFAnnot_GetFormFieldValue(form, annot, buffer, length)),
          options, selected,
          checked: kind === "checkbox" || kind === "radio" ? p.FPDFAnnot_IsChecked(form, annot) : false,
          exportValue: kind === "checkbox" || kind === "radio" ? wide(p, (buffer, length) => p.FPDFAnnot_GetFormFieldExportValue(form, annot, buffer, length)) : "",
          readOnly: (flags & readOnly) !== 0 || kind === "other", multiline: kind === "text" && (flags & multiline) !== 0,
          maxLength: maxLengthOf(p, annot, numbers), size: fontSizeOf(p, form, annot, numbers), color: fontColorOf(p, form, annot, numbers),
        });
      } finally {
        p.FPDFPage_CloseAnnot(annot);
      }
    }
    return fields;
  } finally {
    p.FORM_OnBeforeClosePage(page, form);
    p.pdfium._free(numbers);
  }
}

/**
 * Sets each value on its widget and regenerates the widget's appearance, so that readers show it as PDFium does. An
 * option goes through PDFium's form filler, which knows the option's export value; a plain value is set as given.
 */
export function applyFieldEdits(p: Pdfium, handle: number, page: number, edits: FieldEdit[]): void {
  if (edits.length === 0) return;
  const form = formOf(p, handle);
  if (form === 0) throw new EngineFailure({ kind: "damaged" });
  p.FORM_OnAfterLoadPage(page, form);
  try {
    for (const edit of edits) {
      const annot = p.FPDFPage_GetAnnot(page, edit.index);
      if (annot === 0) throw new EngineFailure({ kind: "damaged" });
      try {
        if (p.FPDFAnnot_GetSubtype(annot) !== widget) throw new EngineFailure({ kind: "damaged" });
        if (edit.option !== undefined) {
          const chosen = p.FORM_SetFocusedAnnot(form, annot) && p.FORM_SetIndexSelected(form, page, edit.option, true);
          p.FORM_ForceToKillFocus(form);
          if (!chosen) throw new EngineFailure({ kind: "damaged" });
        } else if (!withWide(p, edit.value, (pointer) => p.EPDFAnnot_SetFormFieldValue(form, annot, pointer))) {
          throw new EngineFailure({ kind: "damaged" });
        }
        if (!p.EPDFAnnot_GenerateFormFieldAP(annot)) throw new EngineFailure({ kind: "damaged" });
      } finally {
        p.FPDFPage_CloseAnnot(annot);
      }
    }
  } finally {
    p.FORM_OnBeforeClosePage(page, form);
  }
}

/**
 * Appends the fields drawn on the page as widgets, after the page's own widgets. Created nameless: `EPDFPage_CreateFormField`
 * stores a name as raw UTF-8, which readers take for PDFDocEncoding (« Prénom » comes out as « PrÃ©nom »); the widget
 * gets the name as a PDF text string instead, and the parent field, without one, adds nothing to the full name. PDFium
 * knows a field only by the name it was created with: the flags, the look and the options wait for `finishFields`,
 * on the document saved and reopened.
 */
export function createFields(p: Pdfium, handle: number, page: number, axes: Axes, items: EditField[]): void {
  if (items.length === 0) return;
  // PDFium lays a field's text along the page's own axis: on a turned page it would run sideways, and no API sets the widget's /MK /R.
  if (p.FPDFPage_GetRotation(page) !== 0) throw new EngineFailure({ kind: "damaged" });
  const form = formOf(p, handle);
  if (form === 0) throw new EngineFailure({ kind: "damaged" });
  const back = fromDisplayed(axes);
  const numbers = malloc(p, 16);
  p.FORM_OnAfterLoadPage(page, form);
  try {
    for (const item of items) {
      const annot = withWide(p, "", (name) => p.EPDFPage_CreateFormField(page, form, fieldTypes[item.field], name));
      if (annot === 0) throw new EngineFailure({ kind: "damaged" });
      try {
        if (!withWide(p, item.name.trim(), (pointer) => p.FPDFAnnot_SetStringValue(annot, "T", pointer))) throw new EngineFailure({ kind: "damaged" });
        setRect(p, annot, item.box, back, numbers);
        if (!p.FPDFAnnot_SetFlags(annot, printable)) throw new EngineFailure({ kind: "damaged" });
      } finally {
        p.FPDFPage_CloseAnnot(annot);
      }
    }
  } finally {
    p.FORM_OnBeforeClosePage(page, form);
    p.pdfium._free(numbers);
  }
}

/** The full names of the document's form fields, page by page; one entry per widget. */
export function fieldNamesOf(p: Pdfium, handle: number): string[] {
  const form = formOf(p, handle);
  if (form === 0) return [];
  const names: string[] = [];
  for (let pageIndex = 0; pageIndex < p.FPDF_GetPageCount(handle); pageIndex++) {
    const page = p.FPDF_LoadPage(handle, pageIndex);
    if (page === 0) continue;
    p.FORM_OnAfterLoadPage(page, form);
    try {
      for (let index = 0; index < p.FPDFPage_GetAnnotCount(page); index++) {
        const annot = p.FPDFPage_GetAnnot(page, index);
        if (annot === 0) continue;
        try {
          if (p.FPDFAnnot_GetSubtype(annot) === widget) names.push(wide(p, (buffer, length) => p.FPDFAnnot_GetFormFieldName(form, annot, buffer, length)));
        } finally {
          p.FPDFPage_CloseAnnot(annot);
        }
      }
    } finally {
      p.FORM_OnBeforeClosePage(page, form);
      p.FPDF_ClosePage(page);
    }
  }
  return names;
}

/** `taken` holds a name, or a hierarchy under it: a new field « a » beside « a.b » would be both a field and a parent. */
export const nameTaken = (name: string, taken: string[]) => taken.some((each) => each === name || each.startsWith(`${name}.`));

/**
 * Refuses the names the document's own fields carry, and two added fields of one name: readers merge fields of one name,
 * and PDFium would hang the new widget on the old field. Names are compared trimmed, as they are written. An XFA form
 * draws itself from its XML: a widget added to it would stay unseen.
 */
export function checkFieldNames(p: Pdfium, handle: number, items: EditField[]): void {
  const names = items.map((item) => item.name.trim());
  if (names.some((name) => name === "" || name.includes(".")) || new Set(names).size !== names.length) throw new EngineFailure({ kind: "damaged" });
  if (p.FPDF_GetFormType(handle) >= 2) throw new EngineFailure({ kind: "xfaForm" });
  const taken = fieldNamesOf(p, handle);
  if (names.some((name) => nameTaken(name, taken))) throw new EngineFailure({ kind: "fieldNameTaken" });
}

/** The second pass of `createFields`: the new widgets are the last ones of each page, in the order they were drawn. */
export function finishFields(p: Pdfium, handle: number, items: (EditField & { pageIndex: number })[]): void {
  const form = formOf(p, handle);
  if (form === 0) throw new EngineFailure({ kind: "damaged" });
  for (const pageIndex of new Set(items.map((item) => item.pageIndex))) {
    const own = items.filter((item) => item.pageIndex === pageIndex);
    const page = p.FPDF_LoadPage(handle, pageIndex);
    if (page === 0) throw new EngineFailure({ kind: "damaged" });
    p.FORM_OnAfterLoadPage(page, form);
    try {
      const first = p.FPDFPage_GetAnnotCount(page) - own.length;
      for (const [offset, item] of own.entries()) {
        const annot = p.FPDFPage_GetAnnot(page, first + offset);
        if (annot === 0) throw new EngineFailure({ kind: "damaged" });
        try {
          if (wide(p, (buffer, length) => p.FPDFAnnot_GetFormFieldName(form, annot, buffer, length)) !== item.name.trim()) throw new EngineFailure({ kind: "damaged" });
          const flags = (item.field === "text" && item.multiline ? multiline : 0) | (item.field === "combo" ? comboFlag : 0);
          if (flags !== 0 && !p.FPDFAnnot_SetFormFieldFlags(form, annot, flags)) throw new EngineFailure({ kind: "damaged" });
          if (item.field !== "checkbox") setAutoSizedAppearance(p, annot);
          if (!p.EPDFAnnot_SetMKColor(annot, blackBorder, 0, 0, 0) || !p.EPDFAnnot_SetBorderStyle(annot, solidBorder, 1)) throw new EngineFailure({ kind: "damaged" });
          const options = item.options.map((option) => option.trim()).filter((option) => option !== "");
          if (item.field === "combo" && options.length > 0) setOptions(p, form, annot, options);
          if (!p.EPDFAnnot_GenerateFormFieldAP(annot)) throw new EngineFailure({ kind: "damaged" });
        } finally {
          p.FPDFPage_CloseAnnot(annot);
        }
      }
    } finally {
      p.FORM_OnBeforeClosePage(page, form);
      p.FPDF_ClosePage(page);
    }
  }
}

/**
 * Helvetica at the size that fits the field. `EPDFAnnot_SetDefaultAppearance` registers the font in the form's resources,
 * but at size 0 it writes a `/DA` without a font: it gets a size, and the `/DA` is then rewritten with 0.
 */
function setAutoSizedAppearance(p: Pdfium, annot: number): void {
  if (!p.EPDFAnnot_SetDefaultAppearance(annot, helvetica, 12, 0, 0, 0)) throw new EngineFailure({ kind: "damaged" });
  const sized = wide(p, (buffer, length) => p.FPDFAnnot_GetStringValue(annot, "DA", buffer, length));
  const appearance = sized.replace(/(\s)\d+(?:\.\d+)?\s+Tf\b/, "$10 Tf");
  if (appearance === sized || !withWide(p, appearance, (pointer) => p.FPDFAnnot_SetStringValue(annot, "DA", pointer))) throw new EngineFailure({ kind: "damaged" });
}

/** `FS_RECTF` is left, top, right, bottom, in page space. */
function setRect(p: Pdfium, annot: number, { x, y, width, height }: Box, back: ReturnType<typeof fromDisplayed>, numbers: number): void {
  const corners = [{ x, y }, { x: x + width, y }, { x, y: y + height }, { x: x + width, y: y + height }].map((point: Point) => apply(back, point));
  const xs = corners.map((point) => point.x), ys = corners.map((point) => point.y);
  [Math.min(...xs), Math.max(...ys), Math.max(...xs), Math.min(...ys)].forEach((value, index) => p.pdfium.setValue(numbers + index * 4, value, "float"));
  if (!p.FPDFAnnot_SetRect(annot, numbers)) throw new EngineFailure({ kind: "damaged" });
}

function setOptions(p: Pdfium, form: number, annot: number, options: string[]): void {
  const pointers: number[] = [];
  let array = 0;
  try {
    for (const option of options) pointers.push(wideOf(p, option));
    array = malloc(p, options.length * 4);
    pointers.forEach((pointer, index) => p.pdfium.setValue(array + index * 4, pointer, "*"));
    if (!p.EPDFAnnot_SetFormFieldOptions(form, annot, array, options.length)) throw new EngineFailure({ kind: "damaged" });
  } finally {
    p.pdfium._free(array);
    for (const pointer of pointers) p.pdfium._free(pointer);
  }
}

function wideOf(p: Pdfium, value: string): number {
  const pointer = malloc(p, (value.length + 1) * 2);
  for (let index = 0; index <= value.length; index++) p.pdfium.setValue(pointer + index * 2, index < value.length ? value.charCodeAt(index) : 0, "i16");
  return pointer;
}

function withWide<T>(p: Pdfium, value: string, use: (pointer: number) => T): T {
  const pointer = wideOf(p, value);
  try {
    return use(pointer);
  } finally {
    p.pdfium._free(pointer);
  }
}

function wide(p: Pdfium, read: (buffer: number, length: number) => number): string {
  const length = read(0, 0);
  if (length <= 2) return "";
  const buffer = malloc(p, length);
  try {
    read(buffer, length);
    return p.pdfium.UTF16ToString(buffer);
  } finally {
    p.pdfium._free(buffer);
  }
}

/** `FS_RECTF` is left, top, right, bottom. */
function shownRect(p: Pdfium, annot: number, numbers: number, toShown: ReturnType<typeof invert>): Box {
  if (!p.FPDFAnnot_GetRect(annot, numbers)) throw new EngineFailure({ kind: "damaged" });
  const [left, top, right, bottom] = [0, 4, 8, 12].map((offset) => p.pdfium.getValue(numbers + offset, "float")) as [number, number, number, number];
  const corners = [{ x: left, y: top }, { x: right, y: top }, { x: left, y: bottom }, { x: right, y: bottom }].map((point) => apply(toShown, point));
  const xs = corners.map((point) => point.x), ys = corners.map((point) => point.y);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

/** `MaxLen` sits on the field, which may be the parent of its widgets. */
function maxLengthOf(p: Pdfium, annot: number, numbers: number): number | null {
  if (p.FPDFAnnot_GetNumberValue(annot, "MaxLen", numbers)) return positive(p.pdfium.getValue(numbers, "float"));
  const parent = p.FPDFAnnot_GetLinkedAnnot(annot, "Parent");
  if (parent === 0) return null;
  try {
    return p.FPDFAnnot_GetNumberValue(parent, "MaxLen", numbers) ? positive(p.pdfium.getValue(numbers, "float")) : null;
  } finally {
    p.FPDFPage_CloseAnnot(parent);
  }
}

const positive = (value: number) => (value > 0 ? Math.round(value) : null);

function fontSizeOf(p: Pdfium, form: number, annot: number, numbers: number): number {
  return p.FPDFAnnot_GetFontSize(form, annot, numbers) ? p.pdfium.getValue(numbers, "float") : 0;
}

function fontColorOf(p: Pdfium, form: number, annot: number, numbers: number): Rgb {
  if (!p.FPDFAnnot_GetFontColor(form, annot, numbers, numbers + 4, numbers + 8)) return [0, 0, 0];
  return [p.pdfium.getValue(numbers, "i32"), p.pdfium.getValue(numbers + 4, "i32"), p.pdfium.getValue(numbers + 8, "i32")];
}
