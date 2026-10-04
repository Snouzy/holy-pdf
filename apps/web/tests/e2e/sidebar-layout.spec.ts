import { expect, test, type Page } from "@playwright/test";
import { chooseFiles, pdfFile } from "./support";

async function openReport(page: Page) {
  await page.goto("/en/compress-pdf");
  await chooseFiles(page, [await pdfFile("report.pdf", Array.from({ length: 13 }, (_, i) => `Page ${i + 1}`))]);
  await expect(page.locator(".file-card img")).toHaveCount(1);
}

for (const width of [1024, 1280]) {
  test(`keeps the sidebar beside readable instructions, FAQ and related tools at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 720 });
    await openReport(page);
    const panel = page.locator(".panel");
    const action = page.getByRole("button", { name: "Compress the PDF", exact: true });
    const sections = [
      { container: ".how-to", target: ".steps li:last-child" },
      { container: ".faq", target: ".faq summary" },
      { container: "nav[aria-labelledby=related]", target: ".related a" },
    ];
    await page.locator(".below").click();
    for (const { container, target } of sections) {
      const control = page.locator(target).first();
      await control.scrollIntoViewIfNeeded();
      await expect(panel).toBeInViewport();
      await expect(action).toBeInViewport({ ratio: 1 });
      await expect.poll(async () => {
        const sidebar = await panel.boundingBox();
        const content = await page.locator(container).boundingBox();
        return sidebar && content ? content.x + content.width <= sidebar.x : false;
      }).toBe(true);
      // Hit-testing the right edge catches content painted underneath the sidebar.
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      await control.click({ trial: true, position: { x: box!.width - 24, y: box!.height / 2 } });
      if (container === ".faq") {
        await control.click({ position: { x: box!.width - 24, y: box!.height / 2 } });
        await expect(page.locator(".faq details").first()).toHaveAttribute("open");
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}

test("scrolls every compression option above the action on short screens", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 600 });
  await openReport(page);
  const content = page.locator(".panel-content");
  await content.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  const low = page.locator(".choice").last();
  const choice = await low.boundingBox();
  const action = await page.locator(".go").boundingBox();
  const scroll = await content.boundingBox();
  expect(choice && action && scroll).toBeTruthy();
  expect(choice!.y).toBeGreaterThanOrEqual(scroll!.y);
  expect(choice!.y + choice!.height).toBeLessThanOrEqual(action!.y);
  await low.click({ position: { x: 30, y: choice!.height - 8 } });
  await expect(page.getByRole("radio", { name: /^Low/ })).toBeChecked();
  await expect(page.getByRole("button", { name: "Compress the PDF", exact: true })).toBeInViewport();
});

test("keeps the monk, file, options and action in order on phones", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openReport(page);
  const positions = await page.locator(".board").evaluate((board) =>
    [".monk-bubble", ".workspace", ".options", ".go"].map((selector) => board.querySelector(selector)!.getBoundingClientRect().top),
  );
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
  await page.getByRole("radio", { name: /^Low/ }).check();
  await expect(page.getByRole("button", { name: "Compress the PDF", exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});
