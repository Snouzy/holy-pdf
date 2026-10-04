import { type OpenDoc, savePdf } from "./documents";
import { EngineFailure } from "./failure";
import { malloc, type Pdfium } from "./pdfium";
import type { ExportPlan } from "./types";

export function buildPdf(p: Pdfium, plan: ExportPlan, docs: ReadonlyMap<string, OpenDoc>): Uint8Array<ArrayBuffer> {
  const target = p.FPDF_CreateNewDocument();
  try {
    for (const run of runsBySource(plan)) {
      const source = docs.get(run.docId);
      if (!source) throw new Error(`Document ${run.docId} is not open`);
      const indexes = malloc(p, run.indexes.length * 4);
      p.pdfium.HEAP32.set(run.indexes, indexes >> 2);
      const imported = p.FPDF_ImportPagesByIndex(target, source.handle, indexes, run.indexes.length, p.FPDF_GetPageCount(target));
      p.pdfium._free(indexes);
      if (!imported) throw new EngineFailure({ kind: "damaged" });
    }
    plan.forEach((page, index) => {
      if (page.rotation === 0) return;
      const handle = p.FPDF_LoadPage(target, index);
      p.FPDFPage_SetRotation(handle, (p.FPDFPage_GetRotation(handle) + page.rotation / 90) % 4);
      p.FPDF_ClosePage(handle);
    });
    return savePdf(p, target);
  } finally {
    p.FPDF_CloseDocument(target);
  }
}

/** Consecutive pages of one file go in one import call, so their shared fonts and images are copied once. */
function runsBySource(plan: ExportPlan): { docId: string; indexes: number[] }[] {
  const runs: { docId: string; indexes: number[] }[] = [];
  for (const page of plan) {
    const last = runs.at(-1);
    if (last?.docId === page.docId) last.indexes.push(page.index);
    else runs.push({ docId: page.docId, indexes: [page.index] });
  }
  return runs;
}
