import { expect, test } from "@playwright/test";
import { chooseFiles, pdfFile } from "./support";

for (const width of [1280, 390]) {
  test(`signature page controls stay reachable while scrolling at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 720 });
    await page.goto("/en/sign-pdf");
    await chooseFiles(page, [await pdfFile("contract.pdf", ["Page one", "Page two", "Page three"])]);
    await expect(page.getByAltText("PDF page preview 1", { exact: true })).toBeVisible();
    await expect(page.locator(".file-tabs")).toHaveCount(0);
    const nav = page.locator(".signature-pagination");
    const sheet = page.locator(".signature-sheet");
    const originalWidth = (await sheet.boundingBox())!.width;
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await expect(page.getByRole("button", { name: "Reset zoom to 100%", exact: true })).toHaveText("125%");
    expect((await sheet.boundingBox())!.width).toBeCloseTo(originalWidth * 1.25, 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.getByRole("button", { name: "Reset zoom to 100%", exact: true }).click();
    expect((await sheet.boundingBox())!.width).toBeCloseTo(originalWidth, 0);
    for (const offset of [0, 180]) {
      await sheet.evaluate((element, offset) => window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top - 110 + offset), offset);
      await expect(nav).toBeInViewport({ ratio: 1 });
      const next = page.getByRole("button", { name: "Next page", exact: true });
      const box = await next.boundingBox();
      if (!box) throw new Error("page navigation missing");
      expect(await next.evaluate((element) => {
        const r = element.getBoundingClientRect();
        return element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      })).toBe(true);
      // Coordinates avoid Playwright scrolling a hidden control into view for us.
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await expect(page.getByAltText(`PDF page preview ${offset ? 3 : 2}`, { exact: true })).toBeVisible();
    }
    await page.screenshot({ path: test.info().outputPath(`navigation-${width}.png`), animations: "disabled" });
    await page.locator(".faq").scrollIntoViewIfNeeded();
    await expect(nav).not.toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}
