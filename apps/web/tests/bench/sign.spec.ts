import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { gradientJpeg, loadTestPdfium, photoPdf } from "../engine/support";

// Informational local measurements, without a universal pass/fail timing threshold.
test.setTimeout(300_000);

test("measures signing a synthetic twenty-page photo PDF", async ({ page, browser }) => {
  const output = resolve("../../fixtures-private/sign");
  const sha256 = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
  const assets = await Promise.all((await readdir("dist/_astro")).filter((name) => /\.(js|wasm)$/.test(name)).sort().map(async (name) => {
    const content = await readFile(resolve("dist/_astro", name));
    return { name, bytes: content.length, sha256: sha256(content) };
  }));
  await mkdir(output, { recursive: true });
  const bytes = photoPdf(await loadTestPdfium(), Array.from({ length: 20 }, (_, index) => `Page ${index + 1}`), { width: 900, height: 1200, seed: 7 });
  const input = resolve(output, "source-20-pages.pdf");
  await writeFile(input, bytes);
  const samples: { repetition: number; openMs: number; importMs: number; setupMs: number; exportMs: number; outputBytes: number; outputSha256: string; asset: { width: number; height: number }; drag: { mutationMs: number[]; p95Ms: number; previewRequests: number; moves: number } }[] = [];
  await page.addInitScript(() => {
    const state = { thumbnails: 0 };
    Object.assign(window, { signatureBench: state });
    const original = Worker.prototype.postMessage;
    Object.defineProperty(Worker.prototype, "postMessage", { value: function (this: Worker, message: { request?: { type?: string } }, ...rest: unknown[]) {
      if (message.request?.type === "thumbnail") state.thumbnails++;
      return Reflect.apply(original, this, [message, ...rest]);
    } });
  });
  for (let repetition = 1; repetition <= 3; repetition++) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/en/sign-pdf");
    const opened = performance.now();
    await page.locator("input[type=file]").first().setInputFiles(input);
    await expect(page.getByAltText(/^PDF page preview/)).toBeVisible({ timeout: 60_000 });
    const openMs = performance.now() - opened;
    // Enlarge a synthetic JPEG in the browser so this exercises the 1 Mpx normalization limit.
    const jpeg = await page.evaluate(async (encoded) => {
      const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0))], { type: "image/jpeg" }));
      const canvas = document.createElement("canvas"); canvas.width = 2560; canvas.height = 1600;
      try {
        canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob>((done, fail) => canvas.toBlob((blob) => blob ? done(blob) : fail(new Error("no JPEG")), "image/jpeg", 0.9));
        return Array.from(new Uint8Array(await blob.arrayBuffer()));
      } finally { bitmap.close(); canvas.width = 0; canvas.height = 0; }
    }, Buffer.from(gradientJpeg).toString("base64"));
    await page.getByRole("button", { name: "Import an image", exact: true }).click();
    const importing = performance.now();
    await page.getByLabel("Choose a PNG, JPG or JPEG", { exact: true }).setInputFiles({ name: "signature.jpg", mimeType: "image/jpeg", buffer: Buffer.from(jpeg) });
    await expect(page.getByRole("button", { name: "Add to this page", exact: true })).toBeEnabled();
    const importMs = performance.now() - importing;
    const setup = performance.now();
    for (let index = 0; index < 20; index++) {
      await page.getByRole("combobox", { name: "Page", exact: true }).selectOption({ value: String(index) });
      await expect(page.getByAltText(`PDF page preview ${index + 1}`, { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Add to this page", exact: true }).click();
      await expect(page.getByRole("button", { name: "Signature", exact: true })).toBeFocused();
    }
    const setupMs = performance.now() - setup;
    await expect.poll(() => page.locator(".signature-move img").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    const asset = await page.locator(".signature-move img").evaluate((image: HTMLImageElement) => ({ width: image.naturalWidth, height: image.naturalHeight }));
    expect(Math.max(asset.width, asset.height)).toBeLessThanOrEqual(1600);
    expect(asset.width * asset.height).toBeLessThanOrEqual(1_000_000);
    const move = page.getByRole("button", { name: "Signature", exact: true });
    await move.scrollIntoViewIfNeeded();
    const box = await move.boundingBox();
    if (!box) throw new Error("no placement");
    // Start a real pointer gesture so setPointerCapture is valid; measure DOM commits separately from Playwright transport.
    await page.mouse.move(box.x + 10, box.y + 10); await page.mouse.down();
    const drag = await page.evaluate(async ({ x, y }) => {
      const before = (window as unknown as { signatureBench: { thumbnails: number } }).signatureBench.thumbnails;
      const button = document.querySelector<HTMLButtonElement>(".signature-move")!;
      const placement = button.parentElement!;
      const mutationMs: number[] = [];
      for (let index = 0; index < 60; index++) {
        await new Promise<void>((done, fail) => {
          const timeout = setTimeout(() => { observer.disconnect(); fail(new Error("placement did not move")); }, 1000);
          const observer = new MutationObserver(() => { observer.disconnect(); clearTimeout(timeout); mutationMs.push(performance.now() - start); requestAnimationFrame(() => done()); });
          observer.observe(placement, { attributes: true, attributeFilter: ["style"] });
          const start = performance.now();
          button.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, buttons: 1, bubbles: true, clientX: x + 5 + index * 2, clientY: y + 5 + index / 2 }));
        });
      }
      const sorted = [...mutationMs].sort((a, b) => a - b);
      return { mutationMs, p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1]!, previewRequests: (window as unknown as { signatureBench: { thumbnails: number } }).signatureBench.thumbnails - before, moves: mutationMs.length };
    }, { x: box.x + 10, y: box.y + 10 });
    await page.mouse.up();
    expect(drag.previewRequests).toBe(0);
    const start = performance.now();
    await page.getByRole("button", { name: "Sign the PDF", exact: true }).click();
    await expect(page.getByRole("button", { name: "Download the PDF", exact: true })).toBeVisible({ timeout: 120_000 });
    const exportMs = performance.now() - start;
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download the PDF", exact: true }).click();
    const download = await downloading;
    const result = await readFile(await download.path());
    await writeFile(resolve(output, `signed-${repetition}.pdf`), result);
    samples.push({ repetition, openMs, importMs, setupMs, exportMs, outputBytes: result.length, outputSha256: sha256(result), asset, drag });
    console.log(JSON.stringify({ repetition, openMs, importMs, exportMs, dragP95Ms: drag.p95Ms, dragPreviewRequests: drag.previewRequests }));
  }
  await writeFile(resolve(output, "benchmark.json"), JSON.stringify({
    createdAt: new Date().toISOString(), browser: browser.version(), node: process.version,
    assets, harnessSha256: sha256(await readFile("tests/bench/sign.spec.ts")), sourceSha256: sha256(bytes),
    sourceBytes: bytes.length, sourcePages: 20, sourcePhotos: { width: 900, height: 1200, repeatedSyntheticSeed: 7 },
    placements: 20, samples,
    limits: "One Chromium desktop, 3 repetitions, synthetic photos. Open/export times include UI waits and browser scheduling. Drag p95 measures event-to-style-mutation latency, not paint/GPU latency. Worker instrumentation counts thumbnail requests; it is not a memory or CPU profile.",
  }, null, 2));
  // The screenshots use a drawn signature, while the measured export uses the normalized synthetic JPG.
  await page.getByRole("button", { name: "Back to the pages", exact: true }).click();
  await page.getByRole("button", { name: "Draw", exact: true }).click();
  const canvas = page.getByLabel("Draw your signature", { exact: true });
  await canvas.scrollIntoViewIfNeeded();
  const drawing = await canvas.boundingBox();
  if (!drawing) throw new Error("no drawing canvas");
  await page.mouse.move(drawing.x + drawing.width * 0.1, drawing.y + drawing.height * 0.7); await page.mouse.down();
  for (const [x, y] of [[0.3, 0.2], [0.25, 0.7], [0.5, 0.35], [0.65, 0.65], [0.85, 0.3]]) {
    await page.mouse.move(drawing.x + drawing.width * x!, drawing.y + drawing.height * y!, { steps: 6 });
  }
  await page.mouse.up();
  await page.getByRole("button", { name: "Add to this page", exact: true }).click();
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    await page.setViewportSize({ width: width!, height: height! });
    for (const theme of ["light", "dark"]) {
      const current = await page.locator("html").getAttribute("data-theme");
      if (current !== theme) await page.locator(".site-header .theme-toggle").click();
      await page.getByRole("button", { name: "Signature", exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: resolve(output, `editor-${width}-${theme}.png`), animations: "disabled" });
    }
  }
});
