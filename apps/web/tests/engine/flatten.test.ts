import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { beforeAll, describe, expect, it } from "vitest";
import { closeDoc, openPdf } from "../../src/engine/documents";
import type { Pdfium } from "../../src/engine/pdfium";
import { transformPdf } from "../../src/engine/transform";
import { loadTestPdfium, rawPdf } from "./support";

let p: Pdfium;
beforeAll(async () => {
  p = await loadTestPdfium();
});

/** One page, one filled text field whose appearance draws « Ada ». */
function formPdf(): Uint8Array {
  const appearance = "BT /F1 12 Tf 2 5 Td (Ada) Tj ET";
  const bodies = [
    "<</Type/Catalog/Pages 2 0 R/AcroForm<</Fields[5 0 R]>>>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 400]/Contents 4 0 R/Annots[5 0 R]>>",
    "<</Length 0>>stream\n\nendstream",
    "<</Type/Annot/Subtype/Widget/FT/Tx/T(Name)/V(Ada)/Rect[40 300 140 320]/P 3 0 R/F 4/AP<</N 6 0 R>>>>",
    `<</Type/XObject/Subtype/Form/BBox[0 0 100 20]/Resources<</Font<</F1 7 0 R>>>>/Length ${appearance.length}>>stream\n${appearance}\nendstream`,
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
  ];
  return rawPdf(bodies);
}

async function page(bytes: Uint8Array) {
  const task = getDocument({ data: bytes.slice(), verbosity: 0 });
  const first = await (await task.promise).getPage(1);
  const annotations = (await first.getAnnotations()).map((annotation) => annotation.subtype);
  const text = (await first.getTextContent()).items.map((item) => ("str" in item ? item.str : "")).join("");
  await task.destroy();
  return { annotations, text };
}

describe("flatten", () => {
  it("draws a filled form field into the page and removes the field", async () => {
    const source = formPdf();
    expect(await page(source)).toEqual({ annotations: ["Widget"], text: "" });
    const doc = openPdf(p, source);
    const flat = transformPdf(p, doc, { kind: "flatten" });
    closeDoc(p, doc);
    expect(await page(flat)).toEqual({ annotations: [], text: "Ada" });
  });
});
