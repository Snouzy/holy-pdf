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

test.describe("on a touch screen", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test("turns the preview's pages with a swipe, not with a vertical drag", async ({ page, browserName }) => {
    test.skip(browserName === "firefox", "Firefox does not build touch events from Playwright");
    await page.goto("/en/merge-pdf");
    await chooseFiles(page, [await pdfFile("a.pdf", ["A1", "A2"])]);
    await expectThumbnails(page, 2);
    await page.getByRole("button", { name: "Page 1", exact: true }).click();
    const preview = page.getByRole("dialog", { name: "Preview" });
    await expect(preview).toContainText("Page 1 of 2");
    const sheet = preview.locator(".preview-sheet");
    const drag = async (from: [number, number], to: [number, number]) => {
      const touch = (x: number, y: number) => [{ identifier: 1, clientX: x, clientY: y }];
      await sheet.dispatchEvent("touchstart", { touches: touch(...from), changedTouches: touch(...from) });
      await sheet.dispatchEvent("touchmove", { touches: touch(...to), changedTouches: touch(...to) });
      await sheet.dispatchEvent("touchend", { touches: [], changedTouches: touch(...to) });
    };
    await drag([300, 400], [100, 410]);
    await expect(preview).toContainText("Page 2 of 2");
    await drag([200, 300], [210, 600]);
    await expect(preview).toContainText("Page 2 of 2");
    await drag([100, 400], [300, 395]);
    await expect(preview).toContainText("Page 1 of 2");
  });
});

test("opens a page on click, walks it with the arrows and closes with Escape", async ({ page }) => {
  await page.goto("/en/merge-pdf");
  await chooseFiles(page, [await pdfFile("a.pdf", ["A1", "A2"])]);
  await expectThumbnails(page, 2);
  await page.getByRole("button", { name: "Page 1", exact: true }).click();
  const preview = page.getByRole("dialog", { name: "Preview" });
  await expect(preview).toContainText("Page 1 of 2");
  await expect(preview.locator("img")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(preview).toContainText("Page 2 of 2");
  await expect(preview.getByRole("button", { name: "Next page" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(preview).toBeHidden();
  await page.getByRole("button", { name: "Page 2", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(preview).toContainText("Page 2 of 2");
  await page.getByRole("button", { name: "Previous page" }).click();
  await expect(preview).toContainText("Page 1 of 2");
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(preview).toContainText("Page 2 of 2");
  // Chromium moves the focus to the body when the button it gave it to turns disabled: the arrows must still work.
  await page.keyboard.press("ArrowLeft");
  await expect(preview).toContainText("Page 1 of 2");
  await page.keyboard.press("Escape");
  await expect(preview).toBeHidden();
  await page.getByRole("button", { name: "Rotate 90°, Page 1" }).click();
  await page.getByRole("button", { name: "Page 1", exact: true }).click();
  await expect(preview.locator("img")).toBeVisible();
  // A sideways page lays out taller than its frame: what is drawn must still fit inside it.
  const frame = await preview.locator(".preview-frame").boundingBox();
  const drawn = await preview.locator("img").boundingBox();
  expect(frame && drawn && drawn.x >= frame.x - 1 && drawn.y >= frame.y - 1 && drawn.x + drawn.width <= frame.x + frame.width + 1 && drawn.y + drawn.height <= frame.y + frame.height + 1).toBe(true);
  expect(drawn && drawn.width > drawn.height).toBe(true);
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

test("views the result in the page, then downloads it", async ({ page }) => {
  await page.goto("/en/merge-pdf");
  await chooseFiles(page, [await pdfFile("a.pdf", ["A1", "A2"]), await pdfFile("b.pdf", ["B1"])]);
  await expectThumbnails(page, 3);
  await page.getByRole("button", { name: "Merge the PDFs", exact: true }).click();
  await page.getByRole("button", { name: "View", exact: true }).click();
  const preview = page.getByRole("dialog", { name: "Preview" });
  await expect(preview).toContainText("Page 1 of 3");
  await expect(preview.locator("img")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(preview).toContainText("Page 3 of 3");
  await page.keyboard.press("Escape");
  await expect(preview).toBeHidden();
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
  // The preview walks the files of the zip, one after the other.
  await page.getByRole("button", { name: "View", exact: true }).click();
  const preview = page.getByRole("dialog", { name: "Preview" });
  await expect(preview).toContainText("Page 1 of 2");
  await expect(preview.locator(".preview-title")).toHaveText(/\.pdf, page 1$/);
  await page.keyboard.press("Escape");
  await expect(preview).toBeHidden();
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
