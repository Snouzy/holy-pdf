import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { gzipSync, brotliCompressSync } from "node:zlib";
import { chromium, firefox, webkit } from "@playwright/test";

// Install the pinned benchmark package outside the application; see the research report.
const engine = process.env.ENGINE ?? "qpdf";
const profile = process.env.QPDF_PROFILE ?? "default";
const runtime = resolve(process.env.QPDF_RUNTIME ?? (engine === "cantoo" ? "/tmp/holy-pdf-compression-research/cantoo/package/dist" : "/tmp/holy-pdf-compression-research/zoo/package"));
const corpus = resolve(process.env.MEASURE_DIR ?? "../../fixtures-private/compress");
const input = resolve(process.env.CANDIDATE_DIR ?? join(corpus, "runs/browser-baseline/chromium"));
const output = resolve(process.env.BENCH_OUTPUT ?? join(corpus, `runs/browser-${engine === "cantoo" ? "cantoo" : `qpdf-${profile}`}`));
const repeats = Number(process.env.REPEATS ?? 3);
const browserName = process.env.BROWSER ?? "chromium";
const selection = process.env.PDF_IDS?.split(",").map(Number);
const variants = (process.env.VARIANTS ?? "candidate").split(",");
if (!["qpdf", "cantoo"].includes(engine) || !["recompress", "default", "preserve"].includes(profile)) throw new Error("Unknown engine/profile");
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 20) throw new Error("Invalid repeats");
if (!["chromium", "firefox", "webkit"].includes(browserName)) throw new Error("Unknown browser");
if (variants.some((v) => !["original", "candidate"].includes(v))) throw new Error("Unknown variant");
const names = readdirSync(corpus).filter((name) => name.endsWith(".pdf")).sort();
const routes = new Map();
for (const name of readdirSync(runtime)) {
  if (engine === "cantoo" ? name === "pdf-lib.min.js" : /\.(?:js|mjs|wasm)$/.test(name)) routes.set(`/runtime/${name}`, join(runtime, name));
}
for (let i = 0; i < names.length; i++) {
  routes.set(`/input/original/${i}`, join(corpus, names[i]));
  routes.set(`/input/candidate/${i}`, join(input, names[i]));
}
mkdirSync(output, { recursive: true });
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, "http://localhost").pathname;
    if (req.method === "POST" && /^\/result\/(original|candidate)\/\d+$/.test(path)) {
      const [, , variant, id] = path.split("/");
      if (!names[Number(id)]) throw new Error("Unknown document");
      const parts = [];
      for await (const part of req) parts.push(part);
      const folder = join(output, `${browserName}-${variant}`);
      mkdirSync(folder, { recursive: true });
      writeFileSync(join(folder, names[Number(id)]), Buffer.concat(parts));
      res.end("ok");
      return;
    }
    if (path === "/") {
      res.setHeader("Content-Type", "text/html");
      res.end('<!doctype html><title>Local QPDF benchmark</title>');
      return;
    }
    const file = routes.get(path);
    if (!file) { res.writeHead(404); res.end(); return; }
    res.setHeader("Content-Type", file.endsWith(".wasm") ? "application/wasm" : /\.m?js$/.test(file) ? "text/javascript" : "application/pdf");
    res.end(readFileSync(file));
  } catch (error) {
    res.writeHead(500);
    res.end(String(error));
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const browser = await ({ chromium, firefox, webkit })[browserName].launch();
const page = await browser.newPage();
const rows = process.env.RESUME ? JSON.parse(readFileSync(join(output, `${browserName}.json`))).rows : [];
// Keep warnings in the report: the corpus includes malformed xrefs that QPDF repairs.
const streamArgs = profile === "preserve" ? ["--stream-data=preserve"] : profile === "default" ? ["--compress-streams=y"] : ["--compress-streams=y", "--recompress-flate", "--compression-level=9", "--decode-level=generalized"];
const args = ["/input.pdf", "/output.pdf", "--warning-exit-0", "--object-streams=generate", ...streamArgs];
const assets = [...routes].filter(([url]) => url.startsWith("/runtime/")).map(([url, file]) => {
  const bytes = readFileSync(file);
  return { url, bytes: bytes.length, gzip: gzipSync(bytes, { level: 9 }).length, brotli: brotliCompressSync(bytes).length };
});
const report = { browser: browserName, browserVersion: browser.version(), package: engine === "cantoo" ? "@cantoo/pdf-lib@2.11.1" : "@wasm-zoo/qpdf@0.1.1", profile, args: engine === "cantoo" ? { updateMetadata: false, preserveXFA: true, useObjectStreams: true, updateFieldAppearances: false, addDefaultPage: false } : args, repeats, assets, rows,
  createdAt: new Date().toISOString(), corpus, candidateDirectory: input,
  timing: "exec wall time including worker creation, module initialization, input/output memory copies; excludes file fetch and writing results; local uncompressed runtime fetch; no CPU throttling",
  memory: "Not measured: no claim about full worker peak or 400 MB budget",
};
if (process.env.RESUME) {
  const previous = JSON.parse(readFileSync(join(output, `${browserName}.json`)));
  if (previous.package !== report.package || previous.profile !== profile || previous.candidateDirectory !== input || previous.repeats !== repeats) throw new Error("Cannot resume a different benchmark");
}
try {
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  report.runtime = await page.evaluate(async (engine) => {
    const start = performance.now();
    if (engine === "cantoo") {
      const script = new URL("/runtime/pdf-lib.min.js", location.href).href;
      window.qpdf = {
        exec: async (_args, options) => {
          const source = `importScripts(${JSON.stringify(script)}); onmessage = async ({data}) => {
            try {
              const doc = await PDFLib.PDFDocument.load(data, {updateMetadata:false,preserveXFA:true});
              const bytes = await doc.save({useObjectStreams:true,updateFieldAppearances:false,addDefaultPage:false});
              postMessage({bytes}, [bytes.buffer]);
            } catch (error) { postMessage({error:String(error)}); }
          };`;
          const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
          const worker = new Worker(url);
          try {
            return await new Promise((resolve, reject) => {
              const timer = setTimeout(() => { worker.terminate(); reject(new Error("pdf-lib timed out")); }, options.timeoutMs);
              worker.onerror = (event) => { clearTimeout(timer); reject(new Error(event.message)); };
              worker.onmessage = ({data}) => {
                clearTimeout(timer);
                if (data.error) reject(new Error(data.error));
                else resolve({ files:[{ name:"/output.pdf", data:data.bytes }], stderr:"" });
              };
              const bytes = options.files[0].data.slice();
              worker.postMessage(bytes, [bytes.buffer]);
            });
          } finally { worker.terminate(); URL.revokeObjectURL(url); }
        },
      };
      return { version: "@cantoo/pdf-lib@2.11.1", initializationMs: performance.now() - start, crossOriginIsolated };
    }
    const { load } = await import("/runtime/index.mjs");
    window.qpdf = await load();
    const version = await window.qpdf.exec(["--version"], { timeoutMs: 30_000 });
    return { version: version.stdout.trim(), initializationMs: performance.now() - start, crossOriginIsolated };
  }, engine);
  for (let id = 0; id < names.length; id++) {
    if (selection && !selection.includes(id + 1)) continue;
    for (const variant of variants) {
      if (rows.some((row) => row.pdf === id + 1 && row.variant === variant)) continue;
      let row;
      try {
        row = await page.evaluate(async ({ id, variant, args, repeats }) => {
        const bytes = new Uint8Array(await (await fetch(`/input/${variant}/${id}`)).arrayBuffer());
        const times = [];
        let result;
        for (let trial = 0; trial < repeats; trial++) {
          const start = performance.now();
          result = await window.qpdf.exec(args, { files: [{ name: "/input.pdf", data: bytes }], outputs: ["/output.pdf"], timeoutMs: 120_000 });
          times.push(performance.now() - start);
        }
        const file = result.files.find((file) => file.name === "/output.pdf");
        if (!file) throw new Error("Missing QPDF output");
        const saved = await fetch(`/result/${variant}/${id}`, { method: "POST", body: file.data });
        if (!saved.ok) throw new Error("Failed to save result");
        return { pdf: id + 1, variant, inputBytes: bytes.length, outputBytes: file.data.length, timesMs: times, medianMs: [...times].sort((a, b) => a - b)[Math.floor(times.length / 2)], stderr: result.stderr };
        }, { id, variant, args, repeats });
      } catch (error) {
        row = { pdf: id + 1, variant, error: String(error) };
      }
      row.originalBytes = readFileSync(join(corpus, names[id])).length;
      row.name = names[id];
      row.inputSha256 = createHash("sha256").update(readFileSync(join(variant === "original" ? corpus : input, names[id]))).digest("hex");
      if (!row.error) {
        row.candidateGain = 100 * (1 - row.outputBytes / row.originalBytes);
        row.deliveredGain = row.candidateGain >= 1 ? row.candidateGain : 0;
      }
      rows.push(row);
      writeFileSync(join(output, `${browserName}.json`), JSON.stringify(report, null, 2));
      console.log(row.error ? `PDF ${id + 1} ${variant}: ${row.error}` : `PDF ${id + 1} ${variant}: ${row.deliveredGain.toFixed(2)}% delivered; ${row.medianMs.toFixed(0)}ms`);
    }
  }
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
if (rows.some((row) => row.error)) process.exitCode = 1;
