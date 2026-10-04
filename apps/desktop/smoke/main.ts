import { invoke } from "@tauri-apps/api/core";
import { createEngine } from "../../web/src/engine/client";
import type { PageSize } from "../../web/src/engine/types";

type Step = { name: string; ok: boolean; detail: string };

const log = document.getElementById("log")!;
const steps: Step[] = [];

function record(name: string, ok: boolean, detail: string) {
  steps.push({ name, ok, detail });
  log.textContent = steps.map((step) => `${step.ok ? "ok " : "KO "} ${step.name}: ${step.detail}`).join("\n");
}

function rawPdf(bodies: string[]): Uint8Array<ArrayBuffer> {
  let text = "%PDF-1.7\n";
  const offsets = [0];
  for (const [index, body] of bodies.entries()) {
    offsets.push(text.length);
    text += `${index + 1} 0 obj\n${body}\nendobj\n`;
  }
  const xref = text.length;
  text += `xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}`;
  text += `trailer\n<</Size ${offsets.length}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`;
  return Uint8Array.from(text, (char) => char.charCodeAt(0));
}

const pdf = rawPdf([
  "<</Type/Catalog/Pages 2 0 R>>",
  "<</Type/Pages/Kids[3 0 R 4 0 R]/Count 2>>",
  "<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 100]>>",
  "<</Type/Page/Parent 2 0 R/MediaBox[0 0 100 200]>>",
]);

const sameSizes = (actual: PageSize[], expected: PageSize[]) =>
  actual.length === expected.length && actual.every((size, index) => size.width === expected[index]!.width && size.height === expected[index]!.height);

const describe = (sizes: PageSize[]) => sizes.map((size) => `${size.width}×${size.height}`).join(", ");

async function run() {
  const engine = createEngine(() => new Worker(new URL("../../web/src/engine/worker.ts", import.meta.url), { type: "module" }));
  const file = new File([pdf], "smoke.pdf", { type: "application/pdf" });

  const opened = await engine.open("doc", file, "pdf");
  if (!opened.ok) {
    record("open with PDFium", false, JSON.stringify(opened.error));
    return;
  }
  record("open with PDFium", sameSizes(opened.value, [{ width: 200, height: 100 }, { width: 100, height: 200 }]), describe(opened.value));

  const thumbnail = await engine.thumbnail("doc", 0, 120);
  record("render a page", thumbnail.ok && thumbnail.value.size > 0, thumbnail.ok ? `${thumbnail.value.type}, ${thumbnail.value.size} bytes` : JSON.stringify(thumbnail.error));

  const repaired = await engine.open("repaired", file, "pdf", undefined, true);
  record("repair with qpdf", repaired.ok && repaired.value.length === 2, repaired.ok ? describe(repaired.value) : JSON.stringify(repaired.error));

  // compress has no PDFium fallback: it fails unless the nested qpdf worker runs.
  const compressed = await engine.compress(["doc"], "low", ["smoke-compressed"]);
  const compressedBytes = compressed.ok ? (compressed.value[0]?.bytes.length ?? 0) : 0;
  record("compress through the nested qpdf worker", compressed.ok && compressedBytes > 0, compressed.ok ? `${compressedBytes} bytes` : JSON.stringify(compressed.error));

  const exported = await engine.export([[{ docId: "doc", index: 0, rotation: 90 }, { docId: "doc", index: 1, rotation: 0 }]], ["smoke-rotated"]);
  const rotatedBytes = exported.ok ? exported.value[0]?.bytes : undefined;
  if (!rotatedBytes) {
    record("rotate a page and reopen the copy", false, exported.ok ? "no bytes" : JSON.stringify(exported.error));
  } else {
    const reopened = await engine.open("rotated", new File([rotatedBytes], "rotated.pdf", { type: "application/pdf" }), "pdf");
    record(
      "rotate a page and reopen the copy",
      reopened.ok && sameSizes(reopened.value, [{ width: 100, height: 200 }, { width: 100, height: 200 }]),
      reopened.ok ? `${rotatedBytes.length} bytes, pages ${describe(reopened.value)}` : JSON.stringify(reopened.error),
    );
    engine.close("rotated");
  }

  engine.close("doc");
  engine.close("repaired");
}

const started = performance.now();
const deadline = setTimeout(() => {
  record("deadline", false, "no verdict after 90 s");
  void invoke("smoke_report", { report: JSON.stringify({ ok: false, steps }) });
}, 90_000);
window.addEventListener("unhandledrejection", (event) => record("unhandled rejection", false, String(event.reason)));
try {
  await run();
} catch (error) {
  record("unexpected error", false, String(error));
}
clearTimeout(deadline);
const report = {
  ok: steps.length === 5 && steps.every((step) => step.ok),
  ms: Math.round(performance.now() - started),
  origin: location.origin,
  userAgent: navigator.userAgent,
  steps,
};
log.textContent += `\n\n${JSON.stringify(report, null, 2)}`;
await invoke("smoke_report", { report: JSON.stringify(report) });
