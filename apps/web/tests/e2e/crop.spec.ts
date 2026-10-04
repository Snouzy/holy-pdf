import { expect, type Page, test } from "@playwright/test";
import { readWithPdfjs } from "../engine/support";
import { chooseFiles, exportWith, pdfFile } from "./support";

test.use({ viewport: { width: 1280, height: 1600 } });

async function drag(page: Page, from: [number, number], to: [number, number]) {
  const box = (await page.locator(".crop-sheet").boundingBox())!;
  await page.mouse.move(box.x + box.width * from[0], box.y + box.height * from[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * to[0], box.y + box.height * to[1], { steps: 5 });
  await page.mouse.up();
}

test("draws the area to keep and crops every page to it", async ({ page }) => {
  await page.goto("/fr/rogner-pdf");
  await chooseFiles(page, [await pdfFile("plan.pdf", ["Un", "Deux"])]);
  await expect(page.locator(".crop-zone")).toBeVisible();
  await expect(page.getByText("Page rognée : 189 × 267 mm")).toBeVisible();
  await drag(page, [0.02, 0.02], [0.52, 0.52]);
  // Browsers place the pointer on different subpixels: the size may differ by a millimetre.
  await expect(page.getByText(/^Page rognée : 10[4-6] × 14[8-9] mm$/)).toBeVisible();
  const { name, bytes } = await exportWith(page, "Rogner le PDF");
  expect(name).toBe("plan-rogne.pdf");
  const read = await readWithPdfjs(bytes);
  expect(read).toHaveLength(2);
  for (const { width, height } of read) expect([Math.abs(width - 298) < 4, Math.abs(height - 421) < 4]).toEqual([true, true]);
});

test("crops the page shown only, when asked", async ({ page }) => {
  await page.goto("/en/crop-pdf");
  await chooseFiles(page, [await pdfFile("plan.pdf", ["One", "Two"])]);
  await expect(page.locator(".crop-zone")).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).click();
  await page.getByRole("radio", { name: "Page 2 only" }).click();
  const { bytes } = await exportWith(page, "Crop the PDF");
  expect((await readWithPdfjs(bytes)).map(({ width, height }) => [width, height])).toEqual([[595, 842], [536, 758]]);
});
