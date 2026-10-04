import { expect, test } from "@playwright/test";
import { chooseFiles, expectThumbnails, pdfFile, photoPdfFile } from "./support";

test("fills the screen with the workshop once files are chosen", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en/compress-pdf");
  await chooseFiles(page, [await photoPdfFile("report.pdf", ["P1"]), await pdfFile("notes.pdf", ["N1"])]);
  await expect(page.locator(".file-card img")).toHaveCount(2);
  const panel = await page.locator(".panel").boundingBox();
  const bar = await page.locator(".site-header").boundingBox();
  expect(panel && bar).toBeTruthy();
  if (!panel || !bar) return;
  expect(Math.abs(panel.x + panel.width - 1440)).toBeLessThan(2);
  expect(Math.abs(panel.y - (bar.y + bar.height))).toBeLessThan(2);
  expect(Math.abs(panel.y + panel.height - 900)).toBeLessThan(2);
  await expect(page.getByRole("button", { name: "Compress the PDF", exact: true })).toBeInViewport();
  const title = await page.locator("h1").boundingBox();
  expect(title && title.x + title.width < panel.x).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1440);
});

test("keeps the verb button in view down a long board", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/en/merge-pdf");
  await chooseFiles(page, [await pdfFile("long.pdf", Array.from({ length: 16 }, (_, i) => `L${i + 1}`))]);
  // Not the thumbnails: WebKit skips the pages under the fold (content-visibility: auto), so it draws them only once scrolled to.
  await expect(page.locator(".pages li.page")).toHaveCount(16);
  await page.mouse.wheel(0, 900);
  await expect(page.getByRole("button", { name: "Merge the PDFs", exact: true })).toBeInViewport();
});

test("opens a question of the FAQ in its card", async ({ page }) => {
  await page.goto("/en/merge-pdf");
  const question = page.locator(".faq details").first();
  await expect(question).not.toHaveAttribute("open");
  await question.locator("summary").click();
  await expect(question).toHaveAttribute("open");
  await expect(question.locator("p")).toBeVisible();
});

test("leads from the workshop to the sections below", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en/merge-pdf");
  await expect(page.locator(".below")).toBeHidden();
  await chooseFiles(page, [await pdfFile("a.pdf", ["A1"])]);
  await expectThumbnails(page, 1);
  await page.locator(".below").click();
  await expect(page.locator("#how-to")).toBeInViewport();
});

test("aligns the title and the pages card on one left edge", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en/merge-pdf");
  await chooseFiles(page, [await pdfFile("a.pdf", ["A1"]), await pdfFile("b.pdf", ["B1"])]);
  await expectThumbnails(page, 2);
  const title = await page.locator("h1").boundingBox();
  const pages = await page.locator(".pages").boundingBox();
  expect(title && pages).toBeTruthy();
  if (!title || !pages) return;
  expect(Math.abs(title.x - pages.x)).toBeLessThan(2);
});

test("rounds the focus ring of a FAQ question", async ({ page }) => {
  await page.goto("/en/merge-pdf");
  const summary = page.locator(".faq summary").first();
  await page.keyboard.press("Tab");
  await summary.focus();
  await expect(summary).toBeFocused();
  const radius = await summary.evaluate((el) => Number.parseFloat(getComputedStyle(el).borderTopLeftRadius));
  expect(radius).toBeGreaterThan(0);
});
