import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { savePdf } from "../../src/engine/documents";
import { malloc } from "../../src/engine/pdfium";
import { loadTestPdfium } from "../engine/support";

const targets = {
  mac: { firstThumbnails: 500, rotate: 16, merge: 3000 },
  phone: { firstThumbnails: 1500, rotate: 16, merge: 10000 },
};

/** A 1240 × 1754 px noisy page, encoded by the browser: about the weight of a 200 dpi scan. */
async function scanLikeJpeg(page: Page): Promise<Uint8Array> {
  const base64 = await page.evaluate(async () => {
    const canvas = new OffscreenCanvas(1240, 1754);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no 2d context");
    const image = context.createImageData(1240, 1754);
    for (let i = 0; i < image.data.length; i += 4) {
      const value = 225 + Math.floor(Math.random() * 30);
      image.data.set([value, value, value, 255], i);
    }
    context.putImageData(image, 0, 0);
    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.6 });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
  });
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

async function scanPdf(jpeg: Uint8Array, pages: number, path: string): Promise<string> {
  const p = await loadTestPdfium();
  const doc = p.FPDF_CreateNewDocument();
  for (let index = 0; index < pages; index++) {
    const page = p.FPDFPage_New(doc, index, 595.28, 841.89);
    const image = p.FPDFPageObj_NewImageObj(doc);
    const pointer = malloc(p, jpeg.length);
    p.pdfium.HEAPU8.set(jpeg, pointer);
    p.EPDFImageObj_SetJpeg(0, 0, image, pointer, jpeg.length);
    p.pdfium._free(pointer);
    p.FPDFImageObj_SetMatrix(image, 595.28, 0, 0, 841.89, 0, 0);
    p.FPDFPage_InsertObject(page, image);
    p.FPDFPage_GenerateContent(page);
    p.FPDF_ClosePage(page);
  }
  writeFileSync(path, savePdf(p, doc));
  p.FPDF_CloseDocument(doc);
  return path;
}

/** Capture the timestamp in the successful frame, without adding the Playwright round trip. */
async function elapsedWhen(page: Page, measurement: () => number | false): Promise<number> {
  const result = await page.waitForFunction(measurement, undefined, { polling: "raf", timeout: 60_000 });
  try {
    const elapsed = await result.jsonValue();
    if (elapsed === false) throw new Error("measurement did not complete");
    return Math.round(elapsed);
  } finally {
    await result.dispose();
  }
}

async function measure(page: Page, cpuSlowdown: number) {
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: cpuSlowdown });
  const folder = mkdtempSync(join(tmpdir(), "bench-"));
  try {
    return await run(page, folder);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

async function run(page: Page, folder: string) {
  await page.goto("/en/merge-pdf");
  const jpeg = await scanLikeJpeg(page);
  const big = await scanPdf(jpeg, 100, join(folder, "big.pdf"));
  const parts = await Promise.all(Array.from({ length: 10 }, (_, i) => scanPdf(jpeg, 50, join(folder, `part-${i}.pdf`))));

  await page.goto("/en/rotate-pdf");
  // Leave the empty page idle as someone would while choosing a file; the grid still loads on demand.
  await page.waitForTimeout(2000);
  await page.evaluate(() => Reflect.set(window, "benchStart", performance.now()));
  await page.locator("input[type=file]").first().setInputFiles(big);
  const opened = await elapsedWhen(page, () =>
    document.querySelectorAll(".pages li.page:not(.skeleton)").length === 100 && performance.now() - Number(Reflect.get(window, "benchStart")),
  );
  const firstThumbnails = await elapsedWhen(page, () =>
    [...document.querySelectorAll<HTMLImageElement>(".pages li.page:nth-child(-n+12) img")].filter((img) => img.complete && img.naturalWidth > 0).length === 12 &&
      performance.now() - Number(Reflect.get(window, "benchStart")),
  );

  // Time to the DOM transform update; this does not include layout or paint.
  const rotate = await page.evaluate(async () => {
    const button = [...document.querySelectorAll("button")].find((b) => b.textContent === "Rotate all");
    const image = document.querySelector(".pages .page-sheet");
    if (!button || !image) throw new Error("board not ready");
    const updated = new Promise<number>((resolve) => {
      new MutationObserver((_, observer) => {
        observer.disconnect();
        resolve(performance.now());
      }).observe(image, { attributes: true, attributeFilter: ["style"] });
    });
    const started = performance.now();
    button.click();
    return (await updated) - started;
  });

  await page.goto("/en/merge-pdf");
  await page.locator("input[type=file]").first().setInputFiles(parts);
  await expect(page.getByText("Opening…")).toHaveCount(0, { timeout: 120_000 });
  await expect(page.locator(".pages li.page:not(.skeleton)")).toHaveCount(500, { timeout: 120_000 });
  const mergeButton = page.getByRole("button", { name: "Merge the PDFs", exact: true });
  await expect(mergeButton).toBeEnabled();
  const start = Date.now();
  await mergeButton.click();
  await expect(page.locator(".result h2")).toBeVisible({ timeout: 120_000 });
  const merge = Date.now() - start;
  const downloading = page.waitForEvent("download", { timeout: 120_000 });
  await page.getByRole("button", { name: "Download the PDF", exact: true }).click();
  await downloading;

  return { pageKB: Math.round(jpeg.length / 1024), opened, firstThumbnails, rotate, merge };
}

test("processing times on this machine", async ({ page }) => {
  test.setTimeout(600_000);
  const mac = await measure(page, 1);
  console.log(`Mac ${JSON.stringify(mac)}`);
  expect(mac.firstThumbnails).toBeLessThanOrEqual(targets.mac.firstThumbnails);
  expect(mac.rotate).toBeLessThanOrEqual(targets.mac.rotate);
  expect(mac.merge).toBeLessThanOrEqual(targets.mac.merge);
});

test("processing times with the processor slowed 4×", async ({ page }) => {
  test.setTimeout(600_000);
  const phone = await measure(page, 4);
  console.log(`Phone (CPU ×4) ${JSON.stringify(phone)}`);
  expect(phone.firstThumbnails).toBeLessThanOrEqual(targets.phone.firstThumbnails);
  expect(phone.rotate).toBeLessThanOrEqual(targets.phone.rotate);
  expect(phone.merge).toBeLessThanOrEqual(targets.phone.merge);
});
