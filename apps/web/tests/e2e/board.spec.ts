import { expect, test } from "@playwright/test";
import { chooseFiles, expectThumbnails, pdfFile } from "./support";

test("removes a file and its pages from its tab", async ({ page }) => {
  await page.goto("/en/merge-pdf");
  await chooseFiles(page, [await pdfFile("a.pdf", ["A1", "A2"]), await pdfFile("b.pdf", ["B1"])]);
  await expectThumbnails(page, 3);
  await page.getByRole("button", { name: "Remove this file, a.pdf" }).click();
  await expect(page.getByRole("dialog")).toContainText("All the pages of a.pdf will be removed from the preview.");
  await page.getByRole("button", { name: "Keep", exact: true }).click();
  await expectThumbnails(page, 3);
  await page.getByRole("button", { name: "Remove this file, a.pdf" }).click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expectThumbnails(page, 1);
  await expect(page.locator(".file-tab")).toHaveCount(0);
});

test("adds a PDF from the tile after the pages", async ({ page }) => {
  await page.goto("/en/merge-pdf");
  await chooseFiles(page, [await pdfFile("a.pdf", ["A1"])]);
  await expectThumbnails(page, 1);
  await page.locator(".add-tile").getByLabel("Add a PDF").setInputFiles([await pdfFile("b.pdf", ["B1"])]);
  await expectThumbnails(page, 2);
});

test("adds a PDF from the panel, above the verb; a phone keeps the bar for the verb alone", async ({ page }) => {
  await page.goto("/en/merge-pdf");
  await chooseFiles(page, [await pdfFile("a.pdf", ["A1"])]);
  await expectThumbnails(page, 1);
  await page.locator(".go").getByLabel("Add a PDF").setInputFiles([await pdfFile("b.pdf", ["B1"])]);
  await expectThumbnails(page, 2);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".go .add")).toBeHidden();
});

test("views the result in a new browser tab, then downloads it", async ({ page }) => {
  await page.goto("/en/merge-pdf");
  await chooseFiles(page, [await pdfFile("a.pdf", ["A1"])]);
  await expectThumbnails(page, 1);
  await page.getByRole("button", { name: "Merge the PDFs", exact: true }).click();
  // Headless browsers have no PDF viewer: record the address the page opens.
  await page.evaluate(() => Object.assign(window, { open: (url: string) => Reflect.set(window, "viewed", url) }));
  await page.getByRole("button", { name: "View", exact: true }).click();
  const viewed = String(await page.evaluate(() => Reflect.get(window, "viewed")));
  expect(viewed).toMatch(/^blob:/);
  const start = await page.evaluate(async (url) => new TextDecoder().decode((await (await fetch(url)).arrayBuffer()).slice(0, 5)), viewed);
  expect(start).toBe("%PDF-");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download the PDF" }).click();
  expect((await downloading).suggestedFilename()).toBe("a-merged.pdf");
});

test("puts each tool's own options in the panel", async ({ page }) => {
  await page.goto("/en/merge-pdf");
  await chooseFiles(page, [await pdfFile("a.pdf", ["A1"])]);
  await expectThumbnails(page, 1);
  await expect(page.locator(".options")).toBeHidden();
  await page.goto("/en/split-pdf");
  await chooseFiles(page, [await pdfFile("a.pdf", ["A1", "A2"])]);
  await expectThumbnails(page, 2);
  await expect(page.locator(".options").getByLabel("Split every")).toBeVisible();
  await page.getByRole("button", { name: "Split after this page, Page 1" }).click();
  await page.getByRole("button", { name: "Split the PDF", exact: true }).click();
  await expect(page.getByRole("button", { name: "Download the 2 PDFs" })).toBeVisible();
  await expect(page.getByRole("button", { name: "View", exact: true })).toHaveCount(0);
  await expect(page.getByText("They come in a .zip folder: open it to see the files.")).toBeVisible();
  await page.goto("/en/rotate-pdf");
  await chooseFiles(page, [await pdfFile("a.pdf", ["A1"])]);
  await expectThumbnails(page, 1);
  await expect(page.locator(".options").getByRole("button", { name: "Rotate all" })).toBeVisible();
});

test("shows the file tabs and colour marks only when several files share the board", async ({ page }) => {
  await page.goto("/en/merge-pdf");
  await chooseFiles(page, [await pdfFile("a.pdf", ["A1"])]);
  await expectThumbnails(page, 1);
  await expect(page.locator(".file-tabs")).toHaveCount(0);
  const mark = () => page.locator(".page-sheet").first().evaluate((sheet) => getComputedStyle(sheet, "::before").display);
  expect(await mark()).toBe("none");
  await page.locator(".add-tile").getByLabel("Add a PDF").setInputFiles([await pdfFile("b.pdf", ["B1"])]);
  await expectThumbnails(page, 2);
  await expect(page.locator(".file-tab")).toHaveCount(2);
  expect(await mark()).not.toBe("none");
});

test("undoes the last change from the button next to the tabs", async ({ page }) => {
  await page.goto("/en/organize-pdf");
  await chooseFiles(page, [await pdfFile("a.pdf", ["A1", "A2"])]);
  await expectThumbnails(page, 2);
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  await expect(undo).toBeDisabled();
  await page.getByRole("button", { name: "Delete page, Page 1" }).click();
  await expectThumbnails(page, 1);
  await undo.click();
  await expectThumbnails(page, 2);
});

test("shows a long file name in full on hover", async ({ page }) => {
  const name = `${"a-long-invoice-name-".repeat(3)}.pdf`;
  await page.goto("/en/merge-pdf");
  await chooseFiles(page, [await pdfFile(name, ["A1"]), await pdfFile("b.pdf", ["B1"])]);
  await expectThumbnails(page, 2);
  await expect(page.locator(".file-tab .file-name").first()).toHaveAttribute("title", name);
  await page.locator(".page .caption").first().hover();
  await expect(page.locator(".page .caption-tip").first()).toHaveText(`${name}, page 1`);
});

test("keeps the file tabs on one row, scrollable, with the undo button in view", async ({ page }) => {
  await page.goto("/en/merge-pdf");
  const files = await Promise.all(Array.from({ length: 5 }, (_, i) => pdfFile(`a-rather-long-plan-name-${i + 1}.pdf`, [`P${i + 1}`])));
  await chooseFiles(page, files);
  await expectThumbnails(page, 5);
  const tabs = page.locator(".file-tab");
  await expect(tabs).toHaveCount(5);
  const tops = await tabs.evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);
  const row = page.locator(".file-tabs");
  await expect(row).toHaveClass(/\bmore\b/);
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeInViewport();
  await row.evaluate((list) => list.scrollTo({ left: list.scrollWidth }));
  await expect(row).not.toHaveClass(/\bmore\b/);
});

test("shows the fade when a tab grows by itself", async ({ page }) => {
  await page.goto("/en/merge-pdf");
  await chooseFiles(page, [await pdfFile("a.pdf", ["A1"]), await pdfFile("b.pdf", ["B1"])]);
  await expectThumbnails(page, 2);
  const row = page.locator(".file-tabs");
  await expect(row).not.toHaveClass(/\bmore\b/);
  await page.locator(".file-tab").first().evaluate((tab) => {
    tab.style.width = "3000px";
  });
  await expect(row).toHaveClass(/\bmore\b/);
});
