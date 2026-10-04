import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getDocument, type PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import { expect, it } from "vitest";
import { keepsOriginal } from "../../src/board/flow";
import { compressPdf } from "../../src/engine/compress";
import { closeDoc, openPdf, savePdf } from "../../src/engine/documents";
import { encodeTestJpeg, loadTestPdfium } from "./support";

/** On demand, never in CI: `MEASURE_DIR=../../fixtures-private/compress pnpm vitest run tests/engine/measure.test.ts --silent=false`. */
const folder = process.env.MEASURE_DIR ?? "";

it.skipIf(folder === "")("measures the gain of each level on real PDFs", { timeout: 1_800_000 }, async () => {
  const p = await loadTestPdfium();
  const megabytes = (bytes: number) => (bytes / 1_000_000).toFixed(1);
  const rows = ["| File | Pages | Size (MB) | Save only | Extreme | Recommended | Low |", "|---|---|---|---|---|---|---|"];
  const measurements = [];
  const output = join(folder, "runs", "preserve-structure");
  mkdirSync(output, { recursive: true });
  for (const [number, name] of readdirSync(folder).filter((file) => file.toLowerCase().endsWith(".pdf")).sort().entries()) {
    const original = readFileSync(join(folder, name));
    const doc = openPdf(p, original);
    try {
      const baselineBytes = savePdf(p, doc.handle).length;
      const before = await structure(original);
      const levels = [];
      const cells: string[] = [];
      for (const level of ["extreme", "recommended", "low"] as const) {
        const start = performance.now();
        const bytes = await compressPdf(p, doc, level, encodeTestJpeg, () => {});
        const seconds = (performance.now() - start) / 1000;
        const deliveredBytes = keepsOriginal(original.length, bytes.length) ? original.length : bytes.length;
        const gain = (1 - deliveredBytes / original.length) * 100;
        cells.push(`${change(original.length, bytes.length)} (${seconds.toFixed(1)} s; delivered −${gain.toFixed(1)} %)`);
        levels.push({ level, bytes: bytes.length, deliveredBytes, gain, seconds });
        if (level === "recommended") {
          const after = await structure(bytes);
          expect.soft(after, `${name}: document structure`).toEqual(before);
          writeFileSync(join(output, name), bytes);
          writeFileSync(join(output, `${name}.structure.json`), JSON.stringify({ before, after }, null, 2));
        }
      }
      const row = `| PDF ${number + 1} | ${doc.sizes.length} | ${megabytes(original.length)} | ${change(original.length, baselineBytes)} | ${cells.join(" | ")} |`;
      rows.push(row);
      console.log(row);
      measurements.push({ name, originalBytes: original.length, baselineBytes, levels });
      writeFileSync(join(output, "measurements.json"), JSON.stringify(measurements, null, 2));
    } finally {
      closeDoc(p, doc);
    }
  }
  const gains = measurements.slice(0, 5).map((row) => row.levels.find((level) => level.level === "recommended")?.gain ?? 0).sort((a, b) => a - b);
  console.log(`Recommended median, first five PDFs (delivered): ${gains[Math.floor(gains.length / 2)]?.toFixed(2)} %`);
  console.log(rows.join("\n"));
  writeFileSync(join(output, "measurements.md"), rows.join("\n"));
  expect(rows.length).toBeGreaterThan(2);
});

function change(before: number, after: number): string {
  const percent = (after / before - 1) * 100;
  return `${percent > 0 ? "+" : ""}${percent.toFixed(1)} %`;
}

/** Independent checks on the candidate, even when delivery would fall back to the original. */
async function structure(bytes: Uint8Array) {
  const task = getDocument({ data: new Uint8Array(bytes), verbosity: 0 });
  try {
    const doc = await task.promise;
    const metadata = await doc.getMetadata();
    const outline = await doc.getOutline();
    const fields = await doc.getFieldObjects();
    const attachments = await doc.getAttachments();
    const attachmentContents = [];
    for (const [key, value] of attachments ?? []) {
      const content = await doc.getAttachmentContent(key);
      attachmentContents.push({ name: value.filename, content: content ? Buffer.from(content).toString("base64") : null });
    }
    const links = [];
    const taggedPages = [];
    for (let number = 1; number <= doc.numPages; number++) {
      const page = await doc.getPage(number);
      const annotations = await page.getAnnotations();
      for (const annotation of annotations) {
        if (annotation.subtype === "Link") links.push({ page: number, dest: destination(annotation.dest), url: annotation.url });
      }
      if (await page.getStructTree()) taggedPages.push(number);
      page.cleanup();
    }
    return {
      pages: doc.numPages,
      outline: outlines(outline),
      links,
      title: (metadata.info as Record<string, unknown>).Title ?? null,
      xmp: metadata.metadata?.getRaw() ?? null,
      fields: fields ? [...fields] : null,
      attachments: attachmentContents,
      markInfo: await doc.getMarkInfo(),
      taggedPages,
    };
  } finally {
    await task.destroy();
  }
}

/** PDFium writes destination coordinates as float32: ignore differences below a millionth of a point. */
function destination(value: unknown): unknown {
  return Array.isArray(value) ? value.map((item) => typeof item === "number" ? Number(item.toFixed(6)) : item) : value;
}

function outlines(nodes: Awaited<ReturnType<PDFDocumentProxy["getOutline"]>> | null): unknown {
  return nodes?.map((node) => ({ ...node, dest: destination(node.dest), items: outlines(node.items) })) ?? null;
}
