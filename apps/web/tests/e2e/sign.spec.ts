import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { gradientJpeg, readWithPdfjs } from "../engine/support";
import { chooseFiles, dragFiles, hoverFiles, pdfFile, solidPng } from "./support";

async function openPdf(page: Page, labels = ["Page one", "Page two"]) {
  await page.goto("/en/sign-pdf");
  await chooseFiles(page, [await pdfFile("contract.pdf", labels)]);
  await expect(page.getByAltText(/^PDF page preview/)).toBeVisible();
}

async function draw(page: Page) {
  const canvas = page.getByLabel("Draw your signature", { exact: true });
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("drawing surface missing");
  await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.65);
  await page.mouse.down();
  for (const [x, y] of [[0.35, 0.25], [0.3, 0.7], [0.65, 0.4], [0.8, 0.6]]) {
    await page.mouse.move(box.x + box.width * x!, box.y + box.height * y!, { steps: 8 });
  }
  await page.mouse.up();
  await page.getByRole("button", { name: "Add to this page", exact: true }).click();
}

async function downloadSigned(page: Page) {
  await page.getByRole("button", { name: "Sign the PDF", exact: true }).click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download the PDF", exact: true }).click();
  const file = await pending;
  expect(file.suggestedFilename()).toBe("contract-signed.pdf");
  return new Uint8Array(await readFile(await file.path()));
}

async function imageCounts(bytes: Uint8Array) {
  const loading = getDocument({ data: bytes.slice(), useSystemFonts: true });
  const doc = await loading.promise;
  try {
    const counts: number[] = [];
    for (let index = 1; index <= doc.numPages; index++) {
      const page = await doc.getPage(index);
      const operators = await page.getOperatorList();
      counts.push(operators.fnArray.filter((op) => op === OPS.paintImageXObject || op === OPS.paintInlineImageXObject).length);
    }
    return counts;
  } finally { await loading.destroy(); }
}

test("loads the editor on demand, signs two pages and keeps repeat exports independent", async ({ page }) => {
  const scripts: string[] = [];
  page.on("request", (request) => scripts.push(request.url()));
  await page.goto("/en/sign-pdf");
  await expect(page.locator(".dropzone")).toBeVisible();
  expect(scripts.some((url) => /SignatureEditor.*\.js/.test(url))).toBe(false);
  await chooseFiles(page, [await pdfFile("contract.pdf", ["Page one", "Page two"])]);
  await expect(page.getByAltText(/^PDF page preview/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign the PDF", exact: true })).toBeDisabled();
  await draw(page);
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await page.getByRole("button", { name: "Add to this page", exact: true }).click();
  const first = await downloadSigned(page);
  expect((await readWithPdfjs(first)).map((p) => p.text)).toEqual(["Page one", "Page two"]);
  expect(await imageCounts(first)).toEqual([1, 1]);
  await page.getByRole("button", { name: "Back to the pages", exact: true }).click();
  const second = await downloadSigned(page);
  expect(await imageCounts(second)).toEqual([1, 1]);
  expect(scripts.some((url) => /qpdf.*\.wasm/.test(url))).toBe(false);
});

for (const extension of ["jpg", "jpeg"]) {
  test(`imports a ${extension}, moves and resizes it with the keyboard, then removes it`, async ({ page }) => {
    await openPdf(page, ["Contract"]);
    await page.getByRole("button", { name: "Import an image", exact: true }).click();
    await page.getByLabel("Choose a PNG, JPG or JPEG", { exact: true }).setInputFiles({ name: `signature.${extension}`, mimeType: "image/jpeg", buffer: Buffer.from(gradientJpeg) });
    await page.getByRole("button", { name: "Add to this page", exact: true }).click();
    const placement = page.locator(".signature-placement").first();
    await placement.getByRole("button", { name: "Signature", exact: true }).focus();
    const before = await placement.boundingBox();
    await placement.getByRole("button", { name: "Signature", exact: true }).press("ArrowRight");
    const moved = (await placement.boundingBox())!;
    expect(moved.x).toBeGreaterThan(before?.x ?? 0);
    await placement.getByRole("button", { name: "Signature", exact: true }).press("+");
    const after = (await placement.boundingBox())!;
    expect(after.x + after.width / 2).toBeCloseTo(moved.x + moved.width / 2, 0);
    expect(after.width).toBeGreaterThan(moved.width);
    const output = await downloadSigned(page);
    expect(await imageCounts(output)).toEqual([1]);
    await page.getByRole("button", { name: "Back to the pages", exact: true }).click();
    await placement.getByRole("button", { name: "Signature", exact: true }).click();
    await page.locator(".signature-actions").getByRole("button", { name: "Remove this signature", exact: true }).click();
    await expect(page.getByRole("button", { name: "Sign the PDF", exact: true })).toBeDisabled();
  });
}

test("preserves transparent and translucent PNG pixels in the exported PDF", async ({ page }) => {
  await openPdf(page, ["Contract"]);
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 60; canvas.height = 20;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "red"; context.fillRect(0, 0, 20, 20);
    context.fillStyle = "rgba(0, 0, 255, 0.5)"; context.fillRect(20, 0, 20, 20);
    return canvas.toDataURL("image/png").split(",")[1]!;
  });
  await page.getByRole("button", { name: "Import an image", exact: true }).click();
  await page.getByLabel("Choose a PNG, JPG or JPEG", { exact: true }).setInputFiles({ name: "signature.PNG", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
  await page.getByRole("button", { name: "Add to this page", exact: true }).click();
  const output = await downloadSigned(page);
  const loading = getDocument({ data: output, useSystemFonts: true });
  const doc = await loading.promise;
  try {
    const pdfPage = await doc.getPage(1);
    const operators = await pdfPage.getOperatorList();
    const index = operators.fnArray.indexOf(OPS.paintImageXObject);
    expect(index).toBeGreaterThanOrEqual(0);
    const image = await new Promise<{ width: number; height: number; data: Uint8ClampedArray }>((resolve) => pdfPage.objs.get(operators.argsArray[index]![0], resolve));
    expect([image.width, image.height, image.data.length]).toEqual([60, 20, 60 * 20 * 4]);
    const pixel = (x: number) => [...image.data.slice((10 * image.width + x) * 4, (10 * image.width + x + 1) * 4)];
    expect(pixel(10)).toEqual([255, 0, 0, 255]);
    expect(pixel(30).slice(0, 3)).toEqual([0, 0, 255]);
    expect(pixel(30)[3]).toBeGreaterThanOrEqual(127);
    expect(pixel(30)[3]).toBeLessThanOrEqual(128);
    expect(pixel(50)[3]).toBe(0);
  } finally { await loading.destroy(); }
});

test("rejects renamed images and oversized PNG or JPEG headers before decoding", async ({ page }) => {
  await openPdf(page);
  await page.getByRole("button", { name: "Import an image", exact: true }).click();
  const input = page.getByLabel("Choose a PNG, JPG or JPEG", { exact: true });
  await page.evaluate(() => {
    window.createImageBitmap = (() => { throw new Error("Decoder must not run for rejected files"); }) as typeof createImageBitmap;
  });
  await input.setInputFiles({ name: "fake.jpg", mimeType: "image/jpeg", buffer: solidPng(10, 10, [0, 0, 0]) });
  await expect(page.getByRole("alert")).toContainText("Choose a valid PNG, JPG or JPEG file.");
  const oversized = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0, 11, 8, 0x13, 0x88, 0x13, 0x88, 1, 1, 0x11, 0, 0xff, 0xd9]);
  await input.setInputFiles({ name: "huge.jpeg", mimeType: "image/jpeg", buffer: oversized });
  await expect(page.getByRole("alert")).toContainText("exceeds 16 megapixels");
  const hugePng = solidPng(10, 10, [0, 0, 0]);
  hugePng.writeUInt32BE(5000, 16); hugePng.writeUInt32BE(5000, 20);
  await input.setInputFiles({ name: "huge.png", mimeType: "image/png", buffer: hugePng });
  await expect(page.getByRole("alert")).toContainText("exceeds 16 megapixels");
  for (const file of [
    { name: "fake.png", mimeType: "image/png", buffer: Buffer.from(gradientJpeg) },
    { name: "signature.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") },
    { name: "broken.png", mimeType: "image/png", buffer: hugePng.subarray(0, 24) },
  ]) {
    await input.setInputFiles(file);
    await expect(page.getByRole("alert")).toContainText("Choose a valid PNG, JPG or JPEG file.");
  }
  await input.setInputFiles({ name: "large.png", mimeType: "image/png", buffer: Buffer.alloc(10 * 1024 * 1024 + 1) });
  await expect(page.getByRole("alert")).toContainText("exceeds 10 MB");
  await expect(page.getByRole("button", { name: "Sign the PDF", exact: true })).toBeDisabled();
});

test("keeps drawing and placement usable on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPdf(page, ["Mobile"]);
  await draw(page);
  const placement = page.locator(".signature-placement").first();
  await expect(placement.getByRole("button", { name: "Signature", exact: true })).toBeFocused();
  await expect(placement).toBeInViewport();
  const before = await placement.boundingBox();
  if (!before) throw new Error("signature placement missing");
  await page.mouse.move(before.x + 10, before.y + 10);
  await page.mouse.down();
  await page.mouse.move(before.x + 70, before.y - 30, { steps: 8 });
  await page.mouse.up();
  expect((await placement.boundingBox())?.x).toBeGreaterThan(before.x);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  const output = await downloadSigned(page);
  expect(await imageCounts(output)).toEqual([1]);
});

test("preserves the signature while switching language and clears it on reload", async ({ page }) => {
  await openPdf(page, ["Contract"]);
  await draw(page);
  await page.getByRole("banner").getByRole("link", { name: "Français", exact: true }).click();
  await expect(page).toHaveURL(/\/fr\/signer-pdf$/);
  await expect(page.getByRole("button", { name: "Signer le PDF", exact: true })).toBeEnabled();
  await expect(page.locator(".signature-placement")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".dropzone")).toBeVisible();
  await expect(page.locator(".signature-placement")).toHaveCount(0);
});

test("consumes a JPG dropped on its importer and closes the global drop veil", async ({ page }) => {
  await openPdf(page, ["Contract"]);
  await page.getByRole("button", { name: "Import an image", exact: true }).click();
  const jpeg = { name: "signature.jpg", mimeType: "image/jpeg", buffer: Buffer.from(gradientJpeg) };
  await hoverFiles(page, ".signature-import", [jpeg]);
  await dragFiles(page, ".signature-import", [jpeg], ["dragover", "drop"]);
  await expect(page.locator("html")).not.toHaveAttribute("data-dropping");
  await expect(page.getByAltText(/^PDF page preview/)).toBeVisible();
  await page.getByRole("button", { name: "Add to this page", exact: true }).click();
  await expect(page.locator(".signature-placement")).toHaveCount(1);
});

test("blocks export while a replacement JPEG decodes and translates errors after a language switch", async ({ page }) => {
  await openPdf(page, ["Contract"]);
  await draw(page);
  await page.evaluate(() => {
    const original = window.createImageBitmap.bind(window);
    const state = window as typeof window & { releaseSignatureDecode?: () => void };
    window.createImageBitmap = ((...args: Parameters<typeof createImageBitmap>) => new Promise<ImageBitmap>((resolve, reject) => {
      state.releaseSignatureDecode = () => { original(...args).then(resolve, reject); };
    })) as typeof createImageBitmap;
  });
  await page.getByRole("button", { name: "Import an image", exact: true }).click();
  const input = page.getByLabel("Choose a PNG, JPG or JPEG", { exact: true });
  await input.setInputFiles({ name: "replacement.jpg", mimeType: "image/jpeg", buffer: Buffer.from(gradientJpeg) });
  await expect(page.getByText("Preparing the image…")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign the PDF", exact: true })).toBeDisabled();
  await expect.poll(() => page.evaluate(() => Boolean((window as typeof window & { releaseSignatureDecode?: () => void }).releaseSignatureDecode))).toBe(true);
  await page.evaluate(() => (window as typeof window & { releaseSignatureDecode?: () => void }).releaseSignatureDecode?.());
  await expect(page.getByText("Preparing the image…")).toBeHidden();
  await expect(page.locator(".signature-placement")).toHaveCount(1);
  await input.setInputFiles({ name: "fake.jpg", mimeType: "image/jpeg", buffer: Buffer.from("not jpeg") });
  await expect(page.getByRole("alert")).toContainText("Choose a valid PNG, JPG or JPEG file.");
  await page.getByRole("banner").getByRole("link", { name: "Français", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Choisissez un fichier PNG, JPG ou JPEG valide.");
});

test("requires a visible signature preview and recovers after PNG preview failure", async ({ page }) => {
  await openPdf(page);
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      HTMLCanvasElement.prototype.toBlob = original;
      if (type === "image/png") callback(null);
      else original.call(this, callback, type, quality);
    };
  });
  const canvas = page.getByLabel("Draw your signature", { exact: true });
  await canvas.click();
  await expect(page.getByRole("alert")).toContainText("could not be displayed");
  await expect(page.getByRole("button", { name: "Add to this page", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Sign the PDF", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Retry preview", exact: true }).click();
  await page.getByRole("button", { name: "Add to this page", exact: true }).click();
  expect(await imageCounts(await downloadSigned(page))).toEqual([1, 0]);
});

test("keeps placements but blocks export if a new page preview fails, then retries", async ({ page }) => {
  await openPdf(page);
  await draw(page);
  await page.evaluate(() => {
    const original = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (message: { id: number; request?: { type: string } }, ...rest: unknown[]) {
      if (message.request?.type === "thumbnail") {
        Worker.prototype.postMessage = original;
        this.dispatchEvent(new MessageEvent("message", { data: { id: message.id, result: { ok: false, error: { kind: "outOfMemory" } }, fatal: false } }));
        return;
      }
      Reflect.apply(original, this, [message, ...rest]);
    };
  });
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("could not be displayed");
  await expect(page.getByRole("button", { name: "Add to this page", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Sign the PDF", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Retry preview", exact: true }).click();
  await page.getByRole("button", { name: "Add to this page", exact: true }).click();
  expect(await imageCounts(await downloadSigned(page))).toEqual([1, 1]);
});
