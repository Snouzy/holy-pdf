import { malloc, type Pdfium } from "./pdfium";

/** FPDF_FORMFILLINFO version 2 with every callback empty: PDFium checks each one before it calls it. */
const infoSize = 512;
type Environment = { form: number; info: number };
/** Per PDFium instance: two instances can hand out the same document address. */
const instances = new WeakMap<object, Map<number, Environment>>();

function environmentsOf(p: Pdfium): Map<number, Environment> {
  let environments = instances.get(p.pdfium);
  if (!environments) instances.set(p.pdfium, (environments = new Map()));
  return environments;
}

/**
 * The form-fill environment of a document, opened at first use and closed with the document. PDFium draws a form's
 * fields only through it (`FPDF_FFLDraw`), and reads or writes their values only with it. 0 when PDFium refuses one.
 */
export function formOf(p: Pdfium, handle: number): number {
  const environments = environmentsOf(p);
  const known = environments.get(handle);
  if (known) return known.form;
  const info = malloc(p, infoSize);
  p.pdfium.HEAPU8.fill(0, info, info + infoSize);
  p.pdfium.setValue(info, 2, "i32");
  const form = p.FPDFDOC_InitFormFillEnvironment(handle, info);
  if (form === 0) {
    p.pdfium._free(info);
    return 0;
  }
  environments.set(handle, { form, info });
  return form;
}

export function closeForm(p: Pdfium, handle: number): void {
  const environments = environmentsOf(p);
  const known = environments.get(handle);
  if (!known) return;
  environments.delete(handle);
  p.FPDFDOC_ExitFormFillEnvironment(known.form);
  p.pdfium._free(known.info);
}
