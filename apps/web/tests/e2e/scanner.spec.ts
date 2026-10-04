import { expect, test } from "@playwright/test";
import { readWithPdfjs } from "../engine/support";
import { chooseFiles, deskPhotoFile, sidewaysPageFile } from "./support";

test("turns a photo of a page into a straight A4 PDF", async ({ page }) => {
  test.slow();
  await page.goto("/en/scanner");
  await chooseFiles(page, [await deskPhotoFile("desk.jpg")]);
  await expect(page.locator(".planche-open img")).toBeVisible({ timeout: 60_000 });
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download all" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^\d{4}-\d{2}-\d{2}_Document-1\.pdf$/);
  const bytes = new Uint8Array(await (await import("node:fs/promises")).readFile(await download.path()));
  expect((await readWithPdfjs(bytes)).map(({ width, height }) => [width, height])).toEqual([[595, 842]]);
});

test("corrects a corner by hand, and undoes it", async ({ page }) => {
  test.slow();
  await page.goto("/fr/scanner");
  await chooseFiles(page, [await deskPhotoFile("bureau.jpg")]);
  await expect(page.locator(".planche-open img")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".planche-reading")).toBeHidden({ timeout: 60_000 });
  await page.locator(".planche-open img").click();
  const corner = page.getByRole("button", { name: "Coins 1" });
  await expect(corner).toBeVisible({ timeout: 60_000 });
  // Reading the page upright, as it lies, must not draw it again.
  await expect(page.locator(".correction-updating")).toBeHidden();
  const box = (await corner.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 20, { steps: 4 });
  await page.mouse.up();
  await expect(page.locator(".correction-status")).toContainText("Coins posés à la main.");
  await page.getByRole("button", { name: "Annuler" }).first().click();
  await expect(page.locator(".correction-status")).not.toContainText("Coins posés à la main.");
});

test("reads a sideways page: turns it upright, names its document after it, and makes its text searchable", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/en/scanner");
  await chooseFiles(page, [await sidewaysPageFile("certificate.jpg", ["CERTIFICAT", "Eliberat la data 16.06.2026", "Camera de comert"])]);
  await expect(page.getByRole("textbox", { name: "Document name" })).toHaveValue(/^2026-06-16_Certificat$/, { timeout: 150_000 });
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download all" }).click();
  const bytes = new Uint8Array(await (await import("node:fs/promises")).readFile(await (await downloading).path()));
  const [read] = await readWithPdfjs(bytes);
  expect([read?.width, read?.height]).toEqual([595, 842]);
  expect(read?.text).toMatch(/CERTIFICAT/);
});
