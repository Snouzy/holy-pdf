#!/usr/bin/env node
/**
 * Browser/worker baseline using the production PDFium compressor and OffscreenCanvas JPEG encoder.
 * Run from Web: node scripts/benchmark-browser-baseline.mjs
 * Defaults: Chromium on all 11 private PDFs, Firefox/WebKit on 02 and 05, three runs per file.
 * Overrides: --browsers chromium,firefox,webkit --files 02-report-photos.pdf --repeats 3
 * Diagnostics only: --diagnostics true captures JPEG conversion/read stages without changing product code.
 * --input ../../fixtures-private/compress --output ../../fixtures-private/compress/runs/browser-baseline
 * No external requests, new runtime dependencies or changes to the product build.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { cpus, platform, release, totalmem } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { chromium, firefox, webkit } from "@playwright/test";

const web = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const astroRequire = createRequire(require.resolve("astro"));
const viteRequire = createRequire(astroRequire.resolve("vite"));
const esbuild = viteRequire("esbuild");
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`Missing --${name} value`);
  return args[index + 1];
};
const input = resolve(web, option("input", "../../fixtures-private/compress"));
const output = resolve(web, option("output", "../../fixtures-private/compress/runs/browser-baseline"));
const repeats = Number(option("repeats", "3"));
const diagnostics = option("diagnostics", "false") === "true";
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 20) throw new Error("repeats must be between 1 and 20");
const browsers = option("browsers", "chromium,firefox,webkit").split(",");
const launchers = { chromium, firefox, webkit };
if (browsers.some((name) => !(name in launchers))) throw new Error("Unknown browser");
const names = (await readdir(input)).filter((name) => /^\d{2}-.*\.pdf$/i.test(name)).sort();
const requested = option("files", "");
const selected = requested ? requested.split(",") : names;
if (selected.some((name) => !names.includes(name))) throw new Error("Unknown input file");
await mkdir(output, { recursive: true });
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const workerSource = `
const diagnostics = ${JSON.stringify(diagnostics)};
let diagnostic = {};
if (diagnostics) {
  const convert = OffscreenCanvas.prototype.convertToBlob;
  OffscreenCanvas.prototype.convertToBlob = async function(...args) {
    diagnostic.stage = 'canvas.convertToBlob';
    diagnostic.canvas = {width: this.width, height: this.height};
    const blob = await convert.apply(this, args);
    diagnostic.blob = {type: blob.type, size: blob.size};
    diagnostic.stage = 'canvas.convertToBlob:done';
    return blob;
  };
  const arrayBuffer = Blob.prototype.arrayBuffer;
  Blob.prototype.arrayBuffer = async function(...args) {
    diagnostic.stage = 'blob.arrayBuffer';
    diagnostic.blob = {type: this.type, size: this.size};
    const bytes = await arrayBuffer.apply(this, args);
    diagnostic.stage = 'blob.arrayBuffer:done';
    return bytes;
  };
}
import { loadPdfium } from './src/engine/pdfium.ts';
import { openPdf, closeDoc } from './src/engine/documents.ts';
import { compressPdf } from './src/engine/compress.ts';
import { encodeJpeg } from './src/engine/jpeg.ts';
const started = performance.now();
const p = await loadPdfium({url: '/pdfium.wasm'});
// Check the harness permits the browser's internal Blob reads before attributing any failure to the compressor.
const probe = new Uint8Array(55_001).fill(127);
let probeRead;
try { probeRead = new Uint8Array(await new Blob([probe]).arrayBuffer()); }
catch (error) { throw new Error('Harness Blob read probe failed before compression: ' + error); }
if (probeRead.length !== probe.length || probeRead[0] !== 127 || probeRead[probe.length - 1] !== 127) {
  throw new Error('Harness Blob read probe returned invalid bytes');
}
self.postMessage({ready: true, initializeMs: performance.now() - started, blobReadProbeBytes: probeRead.length});
self.onmessage = async ({data}) => {
  let doc;
  const started = performance.now();
  diagnostic = {stage: 'openPdf'};
  try {
    const bytes = new Uint8Array(data.bytes);
    const heapBefore = p.pdfium.HEAPU8.byteLength;
    doc = openPdf(p, bytes);
    const loadMs = performance.now() - started;
    let encodedImages = 0;
    let encodeMs = 0;
    let maxInputPixels = 0;
    const encode = async (pixels, width, height, quality) => {
      const at = performance.now();
      diagnostic.image = {width: pixels.width, height: pixels.height, outWidth: width, outHeight: height, quality, index: encodedImages};
      diagnostic.stage = 'encodeJpeg';
      maxInputPixels = Math.max(maxInputPixels, pixels.width * pixels.height);
      try { return await encodeJpeg(pixels, width, height, quality); }
      finally { encodedImages++; encodeMs += performance.now() - at; }
    };
    const compressAt = performance.now();
    const result = await compressPdf(p, doc, 'recommended', encode, () => {});
    const compressMs = performance.now() - compressAt;
    const stats = {pages: doc.sizes.length, loadMs, compressMs, encodeMs, encodedImages, maxInputPixels,
      wasmHeapBefore: heapBefore, wasmHeapAfter: p.pdfium.HEAPU8.byteLength, inputBytes: bytes.byteLength,
      candidateBytes: result.byteLength, ...(diagnostics ? {diagnostic} : {})};
    self.postMessage({bytes: result.buffer, stats}, [result.buffer]);
  } catch (error) {
    self.postMessage({error: {name: error?.name, message: error?.message, kind: error?.error?.kind, stack: error?.stack, diagnostic}});
  } finally {
    if (doc) closeDoc(p, doc);
  }
};
`;
const bundle = await esbuild.build({ stdin: { contents: workerSource, resolveDir: web, sourcefile: "browser-baseline-worker.ts" },
  bundle: true, write: false, format: "esm", platform: "browser", target: "es2022", logLevel: "silent" });
const worker = bundle.outputFiles[0].contents;
const wasm = await readFile(require.resolve("@embedpdf/pdfium/pdfium.wasm"));
const sources = {};
for (const name of ["compress.ts", "imageStreams.ts", "imageObjects.ts", "jpeg.ts", "documents.ts", "pdfium.ts"]) {
  sources[name] = sha256(await readFile(join(web, "src/engine", name)));
}
const environment = {
  startedAt: new Date().toISOString(), node: process.version,
  platform: `${platform()} ${release()} ${process.arch}`, cpu: cpus()[0]?.model, logicalCpus: cpus().length, totalMemoryBytes: totalmem(),
  gitHead: execFileSync("git", ["rev-parse", "HEAD"], { cwd: web, encoding: "utf8" }).trim(),
  sourceSha256: sources, workerSha256: sha256(worker), wasmSha256: sha256(wasm), esbuild: esbuild.version,
  pdfium: JSON.parse(await readFile(join(dirname(require.resolve("@embedpdf/pdfium/pdfium.wasm")), "../package.json"), "utf8")).version,
  playwright: require("@playwright/test/package.json").version,
  scriptSha256: sha256(await readFile(fileURLToPath(import.meta.url))),
  settings: { level: "recommended", ppi: 150, jpegQuality: 0.6, encoder: "production OffscreenCanvas", repeats, diagnostics },
  scope: "Compressor time excludes HTTP input/output transfer, PDFium worker initialization and opening the input PDF. Original fallback matches >=1% reduction policy. No quality score or structure verification in this runner.",
  limitations: [
    "Headless desktop measurements on this machine; not mobile measurements.",
    "WASM heap values are committed heap sizes, not peak memory or total worker/process memory.",
    "One new worker per input; repetitions share its initialized PDFium instance and may benefit from warm caches.",
    "Native browser JPEG encoders and resizing may differ across engines; equal quality parameters do not imply equal visual quality.",
    "Candidate PDFs are saved before the original-file fallback, so independent structure checks must use these candidates.",
  ],
};
const report = { environment, browsers: [] };
const flush = () => writeFile(join(output, "measurements.json"), JSON.stringify(report, null, 2));
await flush();

const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, "http://localhost").pathname;
    if (request.method === "GET" && path === "/") {
      response.setHeader("Content-Type", "text/html");
      response.end("<!doctype html><meta charset=utf-8><title>Local compression baseline</title>");
    } else if (request.method === "GET" && path === "/worker.js") {
      response.setHeader("Content-Type", "text/javascript"); response.end(worker);
    } else if (request.method === "GET" && path === "/pdfium.wasm") {
      response.setHeader("Content-Type", "application/wasm"); response.end(wasm);
    } else if (request.method === "GET" && path.startsWith("/input/")) {
      const name = decodeURIComponent(path.slice(7));
      if (!selected.includes(name)) throw new Error("Unknown input");
      response.setHeader("Content-Type", "application/pdf"); response.end(await readFile(join(input, name)));
    } else if (request.method === "POST" && path.startsWith("/output/")) {
      const segments = path.split("/");
      const browser = segments[2];
      const name = decodeURIComponent(segments[3] ?? "");
      if (segments.length !== 4 || !browsers.includes(browser) || !selected.includes(name) || basename(name) !== name) throw new Error("Unknown output");
      const parts = []; let length = 0;
      for await (const chunk of request) {
        length += chunk.length;
        if (length > 512_000_000) throw new Error("Candidate exceeds 512MB transfer limit");
        parts.push(chunk);
      }
      const bytes = Buffer.concat(parts);
      if (new URL(request.url, "http://localhost").searchParams.get("save") === "1") await writeFile(join(output, browser, name), bytes);
      response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify({ bytes: bytes.length, sha256: sha256(bytes) }));
    } else { response.statusCode = 404; response.end(); }
  } catch (error) { response.statusCode = 500; response.end(String(error)); }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

try {
  for (const browserName of browsers) {
    await mkdir(join(output, browserName), { recursive: true });
    const browser = await launchers[browserName].launch({ headless: true });
    const browserReport = { name: browserName, version: browser.version(), headless: true, files: [] };
    report.browsers.push(browserReport);
    try {
      const context = await browser.newContext();
      await context.route("**/*", (route) => {
        const url = route.request().url();
        // WebKit reads local Blob bytes through blob: requests; blocking these falsifies JPEG failures.
        if (url.startsWith(`${origin}/`) || url.startsWith(`blob:${origin}/`)) return route.continue();
        console.error(`Blocked request: ${url}`);
        return route.abort();
      });
      const page = await context.newPage();
      await page.goto(origin);
      browserReport.userAgent = await page.evaluate(() => navigator.userAgent);
      const files = requested || browserName === "chromium" ? selected : selected.filter((name) => /^(02|05)-/.test(name));
      for (const name of files) {
        const original = await readFile(join(input, name));
        const row = { name, inputBytes: original.length, inputSha256: sha256(original), runs: [] };
        browserReport.files.push(row);
        try {
          const init = await page.evaluate(async () => {
            globalThis.baselineWorker = new Worker("/worker.js", { type: "module" });
            return await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => reject(new Error("Worker initialization timeout")), 60_000);
              baselineWorker.onmessage = ({ data }) => { clearTimeout(timeout); resolve(data); };
              baselineWorker.onerror = (event) => { clearTimeout(timeout); reject(new Error(event.message)); };
            });
          });
          row.workerInitializeMs = init.initializeMs;
          row.workerBlobReadProbeBytes = init.blobReadProbeBytes;
          if (!init.ready) throw new Error(`Worker failed: ${JSON.stringify(init)}`);
          for (let run = 0; run < repeats; run++) {
            const result = await page.evaluate(async ({ name, browserName, save }) => {
              const bytes = await (await fetch(`/input/${encodeURIComponent(name)}`)).arrayBuffer();
              const started = performance.now();
              const result = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error("Compression timeout (180s)")), 180_000);
                baselineWorker.onmessage = ({ data }) => { clearTimeout(timeout); resolve(data); };
                baselineWorker.onerror = (event) => { clearTimeout(timeout); reject(new Error(event.message)); };
                baselineWorker.postMessage({ bytes }, [bytes]);
              });
              const roundTripMs = performance.now() - started;
              if (result.error) return { error: result.error, roundTripMs };
              const response = await fetch(`/output/${browserName}/${encodeURIComponent(name)}?save=${save ? 1 : 0}`, { method: "POST", body: result.bytes });
              if (!response.ok) throw new Error(await response.text());
              return { ...result.stats, roundTripMs, output: await response.json() };
            }, { name, browserName, save: run === 0 });
            row.runs.push(result);
            if (result.error) break;
            await flush();
          }
          const successes = row.runs.filter((run) => !run.error);
          if (successes.length) {
            row.medianCompressMs = median(successes.map((run) => run.compressMs));
            row.candidateBytes = successes[0].candidateBytes;
            row.candidateGainPercent = (1 - row.candidateBytes / row.inputBytes) * 100;
            row.deliveredBytes = row.candidateBytes <= row.inputBytes * 0.99 ? row.candidateBytes : row.inputBytes;
            row.deliveredGainPercent = (1 - row.deliveredBytes / row.inputBytes) * 100;
            row.byteIdenticalAcrossRuns = new Set(successes.map((run) => run.output.sha256)).size === 1;
          }
          console.log(`${browserName} ${name}: ${row.candidateBytes ?? "ERROR"} bytes, ${row.deliveredGainPercent?.toFixed(2) ?? "?"}% delivered gain, ${row.medianCompressMs?.toFixed(0) ?? "?"}ms median`);
        } catch (error) {
          row.error = String(error);
          console.error(`${browserName} ${name}: ${error}`);
        } finally {
          await page.evaluate(() => globalThis.baselineWorker?.terminate()).catch(() => {});
          await flush();
        }
      }
      const cohort = browserReport.files.filter((row) => /^(01|02|03|04|05)-/.test(row.name));
      if (cohort.length === 5 && cohort.every((row) => Number.isFinite(row.deliveredGainPercent))) {
        browserReport.firstFiveMedianDeliveredGainPercent = median(cohort.map((row) => row.deliveredGainPercent));
      }
      await context.close();
    } finally {
      await browser.close();
      await flush();
    }
  }
} finally {
  environment.finishedAt = new Date().toISOString();
  await flush();
  await new Promise((done) => server.close(done));
}
const rows = ["| Browser | PDF | Original bytes | Candidate bytes | Delivered gain | Median compression ms |", "|---|---|---:|---:|---:|---:|"];
for (const browser of report.browsers) {
  for (const file of browser.files) rows.push(`| ${browser.name} | ${file.name} | ${file.inputBytes} | ${file.candidateBytes ?? "ERROR"} | ${file.deliveredGainPercent?.toFixed(2) ?? "?"}% | ${file.medianCompressMs?.toFixed(0) ?? "?"} |`);
}
await writeFile(join(output, "measurements.md"), `${rows.join("\n")}\n`);
if (report.browsers.some((browser) => browser.files.some((row) => row.error || row.runs.some((run) => run.error)))) process.exitCode = 1;
