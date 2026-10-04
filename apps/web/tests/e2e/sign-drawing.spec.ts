import { readFile } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { chooseFiles, pdfFile } from "./support";

async function openDrawing(page: Page) {
  await page.goto("/en/sign-pdf");
  await chooseFiles(page, [await pdfFile("drawing.pdf", ["Draw here"])]);
  await expect(page.getByAltText("PDF page preview 1")).toBeVisible();
  return page.getByLabel("Draw your signature", { exact: true });
}
async function stroke(page: Page, canvas: Locator, offset: number) {
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * .1, box.y + box.height * offset);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .4, box.y + box.height * (offset - .1), { steps: 8 });
  await page.mouse.move(box.x + box.width * .7, box.y + box.height * offset, { steps: 8 });
  await page.mouse.up();
}
const snapshot = (canvas: Locator) => canvas.evaluate((element) => (element as HTMLCanvasElement).toDataURL());

test("enlarges the drawing, undoes only the last stroke, restores focus and exports transparent ink", async ({ page }) => {
  const inline = await openDrawing(page);
  await stroke(page, inline, .4);
  const first = await snapshot(inline);
  const enlarge = page.getByRole("button", { name: "Enlarge drawing area" });
  await enlarge.click();
  const dialog = page.getByRole("dialog"), large = dialog.getByLabel("Draw your signature in the large area");
  await expect(dialog).toBeVisible();
  expect((await large.boundingBox())!.width).toBeGreaterThan((await inline.boundingBox())!.width);
  expect(await snapshot(large)).toBe(first);
  await stroke(page, large, .75);
  expect(await snapshot(large)).not.toBe(first);
  await dialog.getByRole("button", { name: "Undo last stroke" }).click();
  expect(await snapshot(large)).toBe(first);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden(); await expect(enlarge).toBeFocused();
  expect(await snapshot(inline)).toBe(first);
  await enlarge.click();
  await dialog.getByRole("button", { name: "Add to this page" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(".signature-placement")).toHaveCount(1);
  await page.getByRole("button", { name: "Sign the PDF", exact: true }).click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download the PDF", exact: true }).click();
  const download = await pending;
  const task = getDocument({ data: new Uint8Array(await readFile(await download.path())), useSystemFonts: true });
  try {
    const doc = await task.promise, pdfPage = await doc.getPage(1), operators = await pdfPage.getOperatorList();
    const index = operators.fnArray.indexOf(OPS.paintImageXObject);
    expect(index).toBeGreaterThanOrEqual(0);
    const image = await new Promise<{ data: Uint8ClampedArray; width: number; height: number }>((resolve) => pdfPage.objs.get(operators.argsArray[index]![0], resolve));
    expect(image.data.length).toBe(image.width * image.height * 4);
    expect(image.data[3]).toBe(0);
    expect(image.data.some((value, index) => index % 4 === 3 && value > 0)).toBe(true);
  } finally { await task.destroy(); }
});

test("processes coalesced samples, falls back to pointer events, and keeps long-stroke work incremental", async ({ page }, testInfo) => {
  const canvas = await openDrawing(page);
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await canvas.evaluate((element) => element.addEventListener("pointerdown", (event) => {
    (element as HTMLElement).dataset.testPointerId = String((event as PointerEvent).pointerId);
  }, { once: true }));
  await page.mouse.move(box.x + 20, box.y + 20); await page.mouse.down();
  const metrics = await canvas.evaluate((element) => {
    const canvas = element as HTMLCanvasElement, box = canvas.getBoundingClientRect(), ctx = canvas.getContext("2d")!;
    const original = ctx.quadraticCurveTo.bind(ctx); let curves = 0;
    ctx.quadraticCurveTo = (...args) => { curves++; original(...args); };
    const point = (index: number) => new PointerEvent("pointermove", { bubbles: true, pointerId: Number(canvas.dataset.testPointerId), pointerType: "mouse", isPrimary: true,
      clientX: box.x + 20 + (index % 200) * .7, clientY: box.y + 20 + Math.sin(index * .1) * 10 });
    const event = point(3);
    Object.defineProperty(event, "getCoalescedEvents", { value: () => [point(1), point(2), point(3)] });
    canvas.dispatchEvent(event);
    const coalescedCurves = curves, durations: number[] = [];
    for (let index = 4; index < 5004; index++) {
      const sample = point(index);
      Object.defineProperty(sample, "getCoalescedEvents", { value: undefined });
      const start = performance.now(); canvas.dispatchEvent(sample); durations.push(performance.now() - start);
    }
    durations.sort((a, b) => a - b);
    return { coalescedCurves, curves, samples: 5000, p95Ms: durations[Math.floor(durations.length * .95)], maxMs: durations.at(-1) };
  });
  await page.mouse.up();
  expect(metrics.coalescedCurves).toBe(3); expect(metrics.curves).toBe(5003);
  await testInfo.attach("drawing-dispatch-timings", { body: JSON.stringify({ ...metrics, note: "Synchronous pointer dispatch and canvas commands; excludes GPU paint and display latency." }), contentType: "application/json" });
  await page.getByRole("button", { name: "Add to this page", exact: true }).click();
  await expect(page.locator(".signature-placement")).toHaveCount(1);
});

test("keeps enlarged drawing and undo usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDrawing(page);
  await page.getByRole("button", { name: "Enlarge drawing area" }).click();
  const dialog = page.getByRole("dialog"), canvas = dialog.getByLabel("Draw your signature in the large area");
  await stroke(page, canvas, .5);
  await dialog.getByRole("button", { name: "Undo last stroke" }).click();
  await expect(dialog.getByRole("button", { name: "Add to this page" })).toBeDisabled();
  await stroke(page, canvas, .6);
  await dialog.getByRole("button", { name: "Add to this page" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(".signature-placement")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});
