import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { decode } from "jpeg-js";
import { chooseFiles, photoPdfFile } from "./support";

test("the production worker delivers a large readable JPEG with the photo's colours", async ({ page }) => {
  const workers: string[] = [];
  page.on("worker", (worker) => workers.push(worker.url()));
  await page.goto("/en/pdf-to-jpg");
  await chooseFiles(page, [await photoPdfFile("photo.pdf", ["Sample"])]);
  await expect(page.locator(".file-card img")).toHaveCount(1);
  await page.getByRole("button", { name: "Convert to JPG", exact: true }).click();
  await expect(page.locator(".result h2")).toBeVisible();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download the image", exact: true }).click();
  const download = await downloading;
  const bytes = await readFile(await download.path());
  expect(download.suggestedFilename()).toBe("photo-1.jpg");
  expect(bytes.byteLength).toBeGreaterThan(55_000);
  expect(workers.length).toBeGreaterThan(0);

  const { data, width, height } = decode(bytes, { useTArray: true });
  expect([width, height]).toEqual([1240, 1754]);
  const left = (Math.floor(height / 2) * width + Math.floor(width / 4)) * 4;
  const right = (Math.floor(height / 2) * width + Math.floor(width * 3 / 4)) * 4;
  expect((data[right] ?? 0) - (data[left] ?? 0)).toBeGreaterThan(70);
  expect(data[left + 2]).toBeGreaterThan(100);
  expect(data[right + 2]).toBeGreaterThan(100);
});
