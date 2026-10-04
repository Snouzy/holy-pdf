import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { loadTestPdfium, photoPdf } from "../engine/support";

test.setTimeout(240_000);

const cases = [
  { tool: "Compress", path: "/en/compress-pdf", verb: "Compress the PDF", target: 10 },
  { tool: "PDF to JPG", path: "/en/pdf-to-jpg", verb: "Convert to JPG", target: 8 },
] as const;

// Resident memory (MB) of the largest renderer process under the browser. The worker's WebAssembly memory counts here, unlike in the JS heap.
function largestRendererMb(browserPid: number): number {
  const rows = execFileSync("ps", ["-A", "-o", "pid=,ppid=,rss=,command="], { encoding: "utf8" })
    .split("\n")
    .map((line) => line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/))
    .flatMap((m) => (m?.[1] && m[2] && m[3] && m[4] ? [{ pid: +m[1], ppid: +m[2], rss: +m[3], command: m[4] }] : []));
  const tree = new Set([browserPid]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const r of rows) if (tree.has(r.ppid) && !tree.has(r.pid)) (tree.add(r.pid), (grew = true));
  }
  const sizes = rows.filter((r) => tree.has(r.pid) && r.command.includes("--type=renderer")).map((r) => r.rss);
  return Math.max(0, ...sizes) / 1024;
}

for (const { tool, path, verb, target } of cases) {
  test(`${tool}, 20 pages with photos, under ${target} s`, async ({ page, browser }) => {
    const p = await loadTestPdfium();
    const labels = Array.from({ length: 20 }, (_, i) => `Page ${i + 1}`);
    const bytes = photoPdf(p, labels, { width: 1400, height: 1900 });
    // Playwright refuses an in-memory upload above 50 MB.
    const dir = mkdtempSync(join(tmpdir(), "lot1-"));
    const file = join(dir, "report.pdf");
    writeFileSync(file, bytes);
    const cdp = await browser.newBrowserCDPSession();
    const { processInfo } = await cdp.send("SystemInfo.getProcessInfo");
    const browserPid = processInfo.find((info) => info.type === "browser")?.id;
    if (browserPid === undefined) throw new Error("no browser process");
    await page.goto(path);
    await page.locator("input[type=file]").first().setInputFiles(file);
    await expect(page.locator(".file-card img")).toHaveCount(1, { timeout: 60_000 });
    const before = largestRendererMb(browserPid);
    let peak = before;
    const sampler = setInterval(() => {
      peak = Math.max(peak, largestRendererMb(browserPid));
    }, 200);
    try {
      const start = Date.now();
      await page.getByRole("button", { name: verb, exact: true }).click();
      await expect(page.locator(".result h2")).toBeVisible({ timeout: 180_000 });
      const seconds = (Date.now() - start) / 1000;
      console.log(`${tool}: ${(bytes.length / 1_000_000).toFixed(1)} MB, ${seconds.toFixed(1)} s (target ${target} s), renderer ${before.toFixed(0)} MB before, peak ${peak.toFixed(0)} MB`);
      expect(seconds).toBeLessThan(target);
    } finally {
      clearInterval(sampler);
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
