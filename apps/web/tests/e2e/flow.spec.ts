import { expect, test } from "@playwright/test";
import { chooseFiles, dragFiles, expectThumbnails, hoverFiles, pdfFile } from "./support";

test("folds the page head away once a file is chosen, and keeps the title", async ({ page }) => {
  await page.goto("/en/merge-pdf");
  await expect(page.locator(".tool-head .intro")).toBeVisible();
  await chooseFiles(page, [await pdfFile("a.pdf", ["A1"])]);
  await expectThumbnails(page, 1);
  await expect(page.locator(".tool-head .intro")).toBeHidden();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("shows what was made, then starts over", async ({ page }) => {
  await page.goto("/en/merge-pdf");
  await chooseFiles(page, [await pdfFile("a.pdf", ["A1"])]);
  await expectThumbnails(page, 1);
  await page.getByRole("button", { name: "Merge the PDFs", exact: true }).click();
  await expect(page.locator(".result h2")).toHaveText("Your PDFs are joined");
  await expect(page.locator(".result-monk .bubble")).toContainText("Hallelujah, it's done");
  await expect(page.locator(".result-meta")).toHaveText(/^a-merged\.pdf · 1 page · \d+\sKB$/);
  await page.getByRole("button", { name: "Merge other PDFs" }).click();
  await expect(page.getByText("Choose PDF files")).toBeVisible();
});

test("leaves the result when a file is dropped on the page", async ({ page }) => {
  await page.goto("/en/merge-pdf");
  await chooseFiles(page, [await pdfFile("a.pdf", ["A1"])]);
  await expectThumbnails(page, 1);
  await page.getByRole("button", { name: "Merge the PDFs", exact: true }).click();
  await expect(page.locator(".result h2")).toBeVisible();
  const files = [await pdfFile("b.pdf", ["B1"])];
  await hoverFiles(page, "footer", files);
  await dragFiles(page, "footer", files, ["dragover", "drop"]);
  await expectThumbnails(page, 2);
  await expect(page.locator(".result")).toHaveCount(0);
});

test("keeps the verb button within reach on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/organize-pdf");
  await chooseFiles(page, [await pdfFile("long.pdf", Array.from({ length: 12 }, (_, i) => `P${i + 1}`))]);
  await expect(page.locator(".pages li.page")).toHaveCount(12);
  await expect(page.getByRole("button", { name: "Tidy up the pages", exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});

test("paints the fill of the progress bar", async ({ page }) => {
  await page.goto("/en/merge-pdf");
  await chooseFiles(page, [await pdfFile("a.pdf", ["A1"])]);
  await expectThumbnails(page, 1);
  const bar = await page.evaluate(() => {
    const el = document.createElement("div");
    el.className = "verb progress";
    el.style.setProperty("--done", "50%");
    document.querySelector(".board .panel .go")?.append(el);
    return getComputedStyle(el).backgroundImage;
  });
  expect(bar).toContain("linear-gradient");
});
