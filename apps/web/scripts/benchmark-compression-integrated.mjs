#!/usr/bin/env node
/**
 * Run against the built app already served on localhost:8787. Uses the real upload, Compress and Download UI.
 * cd apps/web && node scripts/benchmark-compression-integrated.mjs
 * Options: --browsers chromium,firefox,webkit --files 02-report-photos.pdf --repeats 1 --memory true
 * --origin http://localhost:8787 --input ../../fixtures-private/compress --output ../../fixtures-private/compress/runs/compression-integrated
 * No server is started, no product files are changed, and only same-origin HTTP/blob requests are allowed.
 */
import { createHash } from "node:crypto";
import { execFile, execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { cpus, platform, release, totalmem } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { chromium, firefox, webkit, expect } from "@playwright/test";

const web = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`Missing --${name} value`);
  return args[index + 1];
};
const origin = new URL(option("origin", "http://localhost:8787")).origin;
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname)) throw new Error("Only a loopback app origin is allowed");
const input = resolve(web, option("input", "../../fixtures-private/compress"));
const output = resolve(web, option("output", "../../fixtures-private/compress/runs/compression-integrated"));
const repeats = Number(option("repeats", "1"));
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 20) throw new Error("repeats must be between 1 and 20");
const measureMemory = option("memory", "true") === "true";
const launchers = { chromium, firefox, webkit };
const browsers = option("browsers", "chromium,firefox,webkit").split(",");
if (browsers.some((name) => !(name in launchers))) throw new Error("Unknown browser");
const available = (await readdir(input)).filter((name) => /^\d{2}-.*\.pdf$/i.test(name)).sort();
const selected = option("files", "") ? option("files", "").split(",") : available;
if (selected.some((name) => !available.includes(name))) throw new Error("Unknown input file");
await mkdir(output, { recursive: true });
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const assets = [];
for (const name of (await readdir(join(web, "dist/_astro"))).filter((name) => /\.(js|wasm)$/.test(name)).sort()) {
  const bytes = await readFile(join(web, "dist/_astro", name));
  assets.push({ name, bytes: bytes.length, sha256: sha256(bytes) });
}
const report = {
  environment: {
    startedAt: new Date().toISOString(), node: process.version, playwright: require("@playwright/test/package.json").version,
    platform: `${platform()} ${release()} ${process.arch}`, cpu: cpus()[0]?.model, logicalCpus: cpus().length, totalMemoryBytes: totalmem(),
    gitHead: execFileSync("git", ["rev-parse", "HEAD"], { cwd: web, encoding: "utf8" }).trim(),
    scriptSha256: sha256(await readFile(fileURLToPath(import.meta.url))), assets,
    origin, settings: { level: "recommended", repeats, freshContextPerRun: true, measureMemory, memorySamplingIntervalMs: 200 },
    limitations: [
      "Delivered files come from the production UI and include its original-file fallback; candidate-only baselines are separate.",
      "Action-to-result includes lazy loading and UI updates, but excludes uploading/opening the PDF. Download time is separate.",
      "Headless desktop measurements on this machine; sampling/debugger attachment adds overhead and these are not mobile measurements.",
      "Largest renderer RSS is process memory, not Worker memory. Total renderer RSS may include the page, workers and other browser overhead.",
      "CDP Runtime.getHeapUsage is sampled where accessible. Used JS heap plus backing storage excludes other native/canvas allocations and can miss short-lived workers or peaks.",
      "The 400MB Worker budget is not proven by renderer RSS or partial CDP samples; coverage and raw fields are recorded explicitly.",
    ],
  },
  browsers: [],
};
const flush = () => writeFile(join(output, "measurements.json"), JSON.stringify(report, null, 2));
await flush();
// The small coordinator may be bundled statically; QPDF code, its worker and WASM must remain lazy.
const qpdfUrl = (url) => /qpdf[^/]*\.(?:js|wasm)(?:\?|$)/i.test(url);

const exec = promisify(execFile);
async function rendererRss(browserPid) {
  const { stdout } = await exec("ps", ["-A", "-o", "pid=,ppid=,rss=,command="]);
  const rows = stdout.split("\n").flatMap((line) => {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/);
    return match ? [{ pid: +match[1], ppid: +match[2], rssBytes: +match[3] * 1024, command: match[4] }] : [];
  });
  const tree = new Set([browserPid]);
  for (let changed = true; changed;) {
    changed = false;
    for (const row of rows) if (tree.has(row.ppid) && !tree.has(row.pid)) { tree.add(row.pid); changed = true; }
  }
  const renderers = rows.filter((row) => tree.has(row.pid) && row.command.includes("--type=renderer"));
  return { largestRendererRssBytes: Math.max(0, ...renderers.map((row) => row.rssBytes)), totalRendererRssBytes: renderers.reduce((sum, row) => sum + row.rssBytes, 0) };
}

/** Browser-target CDP sessions cover nested workers when the browser exposes them; no debugger pause is requested. */
async function chromiumMemory(browser, started) {
  const cdp = await browser.newBrowserCDPSession();
  const { processInfo } = await cdp.send("SystemInfo.getProcessInfo");
  const browserPid = processInfo.find((entry) => entry.type === "browser")?.id;
  if (!browserPid) throw new Error("Browser PID unavailable");
  const workers = new Map();
  const pending = new Map();
  const samples = [];
  const errors = [];
  let requestId = 0;
  let busy;
  let interval;
  let stopped = false;
  const at = () => performance.now() - started;
  cdp.on("Target.receivedMessageFromTarget", ({ message }) => {
    const reply = JSON.parse(message);
    const request = pending.get(reply.id);
    if (!request) return;
    pending.delete(reply.id);
    clearTimeout(request.timeout);
    if (reply.error) request.reject(new Error(reply.error.message));
    else request.resolve(reply.result);
  });
  cdp.on("Target.targetInfoChanged", ({ targetInfo }) => {
    const worker = workers.get(targetInfo.targetId);
    if (worker) worker.url = targetInfo.url;
  });
  cdp.on("Target.targetDestroyed", ({ targetId }) => {
    const worker = workers.get(targetId);
    if (worker) worker.closedAtMs = at();
  });
  const heap = (worker) => new Promise((resolve, reject) => {
    const id = ++requestId;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error("Worker heap query timeout")); }, 1000);
    pending.set(id, { resolve, reject, timeout });
    cdp.send("Target.sendMessageToTarget", { sessionId: worker.sessionId, message: JSON.stringify({ id, method: "Runtime.getHeapUsage" }) }).catch((error) => {
      clearTimeout(timeout); pending.delete(id); reject(error);
    });
  });
  const track = async (targetInfo) => {
    if (stopped || targetInfo.type !== "worker" || workers.has(targetInfo.targetId)) return;
    const worker = { targetId: targetInfo.targetId, url: targetInfo.url, createdAtMs: at(), samples: 0 };
    workers.set(worker.targetId, worker);
    try {
      const { sessionId } = await cdp.send("Target.attachToTarget", { targetId: worker.targetId, flatten: false });
      worker.sessionId = sessionId;
      // QPDF may finish between periodic samples; request one sample as soon as its target is observable.
      try {
        const usage = await heap(worker);
        worker.samples++;
        worker.backingStorageSizeAvailable = typeof usage.backingStorageSize === "number";
        samples.push({
          atMs: at(), reason: "worker-attached", workers: [{ targetId: worker.targetId, url: worker.url, ...usage }],
          workerUsedPlusBackingBytes: (usage.usedSize ?? 0) + (usage.backingStorageSize ?? 0), completeWorkerSample: false,
        });
      } catch (error) { worker.lastSampleError = String(error); }
    } catch (error) { worker.attachError = String(error); }
  };
  cdp.on("Target.targetCreated", ({ targetInfo }) => { void track(targetInfo); });
  await cdp.send("Target.setDiscoverTargets", { discover: true });
  for (const targetInfo of (await cdp.send("Target.getTargets")).targetInfos) await track(targetInfo);
  const sample = async () => {
    const record = { atMs: at(), workers: [] };
    try { Object.assign(record, await rendererRss(browserPid)); } catch (error) { errors.push(String(error)); }
    const active = [...workers.values()].filter((worker) => worker.sessionId && worker.closedAtMs === undefined);
    await Promise.all(active.map(async (worker) => {
      try {
        const usage = await heap(worker);
        worker.samples++;
        worker.backingStorageSizeAvailable = typeof usage.backingStorageSize === "number";
        record.workers.push({ targetId: worker.targetId, url: worker.url, ...usage });
      } catch (error) { worker.lastSampleError = String(error); }
    }));
    record.workerUsedPlusBackingBytes = record.workers.reduce((sum, worker) => sum + (worker.usedSize ?? 0) + (worker.backingStorageSize ?? 0), 0);
    record.completeWorkerSample = active.length > 0 && active.length === record.workers.length && record.workers.every((worker) => typeof worker.backingStorageSize === "number");
    samples.push(record);
  };
  const controller = {
    async start() {
      await sample();
      interval = setInterval(() => {
        if (busy) return;
        busy = sample().finally(() => { busy = undefined; });
      }, 200);
    },
    async stop() {
      stopped = true;
      clearInterval(interval);
      if (busy) await busy;
      await sample();
      await cdp.detach();
      const observed = [...workers.values()].map(({ sessionId, ...worker }) => worker);
      return {
        browserPid, samples, workers: observed, errors,
        rendererRssBeforeBytes: samples.find((sample) => sample.largestRendererRssBytes !== undefined)?.largestRendererRssBytes,
        peakLargestRendererRssBytes: Math.max(0, ...samples.map((sample) => sample.largestRendererRssBytes ?? 0)),
        peakTotalRendererRssBytes: Math.max(0, ...samples.map((sample) => sample.totalRendererRssBytes ?? 0)),
        peakSampledWorkerUsedPlusBackingBytes: Math.max(0, ...samples.map((sample) => sample.workerUsedPlusBackingBytes)),
        workerSamplingCoverage: {
          observedWorkers: observed.length,
          sampledWorkers: observed.filter((worker) => worker.samples > 0).length,
          workersWithBackingStorageSize: observed.filter((worker) => worker.backingStorageSizeAvailable).length,
        },
        worker400MbBudgetProven: false,
      };
    },
  };
  return controller;
}

for (const browserName of browsers) {
  await mkdir(join(output, browserName), { recursive: true });
  const browser = await launchers[browserName].launch({ headless: true });
  const browserReport = { name: browserName, version: browser.version(), files: [] };
  report.browsers.push(browserReport);
  try {
    for (const name of selected) {
      const original = await readFile(join(input, name));
      const row = { name, inputBytes: original.length, inputSha256: sha256(original), runs: [] };
      browserReport.files.push(row);
      for (let repetition = 0; repetition < repeats; repetition++) {
        const run = { repetition: repetition + 1, requests: [], blockedRequests: [], workers: [], warnings: [], pageErrors: [] };
        row.runs.push(run);
        const context = await browser.newContext({ acceptDownloads: true });
        const started = performance.now();
        let memory;
        let phase = "page-load";
        try {
          await context.route("**/*", (route) => {
            const url = route.request().url();
            if (url.startsWith(`${origin}/`) || url.startsWith(`blob:${origin}/`)) return route.continue();
            run.blockedRequests.push(url);
            return route.abort();
          });
          const page = await context.newPage();
          context.on("request", (request) => {
            if (/\.(?:js|wasm)(?:\?|$)/.test(request.url())) run.requests.push({ url: request.url(), phase, atMs: performance.now() - started, qpdf: qpdfUrl(request.url()) });
          });
          page.on("worker", (worker) => {
            const record = { url: worker.url(), createdAtMs: performance.now() - started };
            run.workers.push(record);
            worker.on("close", () => { record.closedAtMs = performance.now() - started; });
          });
          page.on("console", (message) => { if (["warning", "error"].includes(message.type()) && run.warnings.length < 100) run.warnings.push(message.text()); });
          page.on("pageerror", (error) => run.pageErrors.push(String(error)));
          if (browserName === "chromium" && measureMemory) {
            try { memory = await chromiumMemory(browser, started); } catch (error) { run.memoryUnavailable = String(error); }
          }
          await page.goto(`${origin}/en/compress-pdf`, { waitUntil: "networkidle" });
          browserReport.userAgent ??= await page.evaluate(() => navigator.userAgent);
          phase = "input-open";
          const uploadAt = performance.now();
          await page.locator("input[type=file]").first().setInputFiles(join(input, name));
          await expect(page.locator(".file-card img")).toHaveCount(1, { timeout: 120_000 });
          const verb = page.getByRole("button", { name: "Compress the PDF", exact: true });
          await expect(verb).toBeEnabled({ timeout: 120_000 });
          run.uploadToReadyMs = performance.now() - uploadAt;
          run.qpdfRequestsBeforeAction = run.requests.filter((request) => request.qpdf).map((request) => request.url);
          run.qpdfLazyBeforeAction = run.qpdfRequestsBeforeAction.length === 0;
          const initialBubble = await page.locator(".bubble-text").textContent();
          if (memory) await memory.start();
          phase = "compression";
          const actionAt = performance.now();
          run.actionAtMs = actionAt - started;
          await verb.click();
          await page.waitForFunction((initial) => {
            if (document.querySelector(".result h2")) return true;
            return document.querySelector(".go button.verb") && document.querySelector(".bubble-text")?.textContent !== initial;
          }, initialBubble, { timeout: 180_000, polling: 100 });
          if (await page.locator(".result h2").count() === 0) throw new Error(`UI processing failed: ${await page.locator(".bubble-text").textContent()}`);
          run.actionToResultMs = performance.now() - actionAt;
          run.resultTitle = await page.locator(".result h2").textContent();
          phase = "result";
          const downloading = page.waitForEvent("download", { timeout: 30_000 });
          await page.getByRole("button", { name: "Download the PDF", exact: true }).click();
          const download = await downloading;
          const failed = await download.failure();
          if (failed) throw new Error(`Download failed: ${failed}`);
          const bytes = await readFile(await download.path());
          run.actionToDownloadedMs = performance.now() - actionAt;
          run.suggestedFilename = download.suggestedFilename();
          if (!bytes.subarray(0, 8).toString("latin1").startsWith("%PDF-")) throw new Error("Downloaded file has no PDF header");
          run.deliveredBytes = bytes.length;
          run.outputLargerThanInput = bytes.length > original.length;
          run.deliveredSha256 = sha256(bytes);
          run.deliveredGainPercent = (1 - bytes.length / original.length) * 100;
          if (repetition === 0) await writeFile(join(output, browserName, name), bytes);
          await page.waitForTimeout(250);
          run.qpdfWorkersAfterResult = run.workers.filter((worker) => qpdfUrl(worker.url) && worker.closedAtMs === undefined).map((worker) => worker.url);
          run.qpdfWorkerLifecycleObserved = run.workers.some((worker) => qpdfUrl(worker.url));
          if (memory) {
            run.memory = await memory.stop(); memory = undefined;
            const observedQpdf = run.memory.workers.filter((worker) => qpdfUrl(worker.url));
            run.qpdfWorkerLifecycleObserved ||= observedQpdf.length > 0;
            run.qpdfWorkersAfterResult.push(...observedQpdf.filter((worker) => worker.closedAtMs === undefined).map((worker) => worker.url));
          }
          run.qpdfWorkerTerminated = run.qpdfWorkerLifecycleObserved ? run.qpdfWorkersAfterResult.length === 0 : null;
          run.qpdfRequests = run.requests.filter((request) => request.qpdf).map((request) => request.url);
          run.qpdfLoadedAfterAction = run.qpdfRequests.length > 0;
          console.log(`${browserName} ${name} #${repetition + 1}: ${bytes.length} bytes, ${run.deliveredGainPercent.toFixed(2)}%, ${(run.actionToResultMs / 1000).toFixed(2)}s, lazy=${run.qpdfLazyBeforeAction}, qpdfClosed=${run.qpdfWorkerTerminated}`);
        } catch (error) {
          run.error = String(error);
          console.error(`${browserName} ${name} #${repetition + 1}: ${error}`);
        } finally {
          if (memory) try { run.memory = await memory.stop(); } catch (error) { run.memoryError = String(error); }
          await context.close();
          await flush();
        }
      }
      const successes = row.runs.filter((run) => !run.error);
      if (successes.length) {
        row.deliveredBytes = successes[0].deliveredBytes;
        row.deliveredGainPercent = successes[0].deliveredGainPercent;
        row.medianActionToResultMs = median(successes.map((run) => run.actionToResultMs));
        row.byteIdenticalAcrossRuns = new Set(successes.map((run) => run.deliveredSha256)).size === 1;
      }
      await flush();
    }
    const cohort = browserReport.files.filter((file) => /^(01|02|03|04|05)-/.test(file.name));
    if (cohort.length === 5 && cohort.every((file) => Number.isFinite(file.deliveredGainPercent))) browserReport.firstFiveMedianDeliveredGainPercent = median(cohort.map((file) => file.deliveredGainPercent));
  } finally {
    await browser.close();
    await flush();
  }
}
report.environment.finishedAt = new Date().toISOString();
await flush();
const rows = ["| Browser | PDF | Original bytes | Delivered bytes | Gain | Action → result ms |", "|---|---|---:|---:|---:|---:|"];
for (const browser of report.browsers) for (const file of browser.files) rows.push(`| ${browser.name} | ${file.name} | ${file.inputBytes} | ${file.deliveredBytes ?? "ERROR"} | ${file.deliveredGainPercent?.toFixed(2) ?? "?"}% | ${file.medianActionToResultMs?.toFixed(0) ?? "?"} |`);
await writeFile(join(output, "measurements.md"), `${rows.join("\n")}\n`);
if (report.browsers.some((browser) => browser.files.some((file) => file.runs.some((run) => run.error || run.outputLargerThanInput || !run.qpdfLazyBeforeAction || run.qpdfWorkerTerminated === false)))) process.exitCode = 1;
