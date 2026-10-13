import { expect, type Page, test } from "@playwright/test";
import { chooseFiles, pdfFile } from "./support";

const editors = [
  { route: "/en/edit-pdf", picture: ".edit-sheet > img" },
  { route: "/en/sign-pdf", picture: ".signature-page-image" },
  { route: "/en/redact-pdf", picture: ".redact-sheet > img" },
] as const;

async function density(page: Page, picture: string) {
  await page.waitForFunction((selector) => (document.querySelector(selector) as HTMLImageElement | null)?.naturalWidth, picture);
  return page.locator(picture).evaluate((image: HTMLImageElement) => image.naturalWidth / (image.getBoundingClientRect().width * devicePixelRatio));
}

for (const screen of [{ name: "2x desktop", viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 }, { name: "3x phone", viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 }]) {
  test.describe(screen.name, () => {
    test.use({ viewport: screen.viewport, deviceScaleFactor: screen.deviceScaleFactor });
    for (const { route, picture } of editors) {
      test(`${route} draws one picture pixel per screen pixel`, async ({ page }) => {
        await page.goto(route);
        await chooseFiles(page, [await pdfFile("letter.pdf", ["Sharp text"])]);
        // Above 1.1, a phone renders pixels it never shows.
        const ratio = await density(page, picture);
        expect(ratio).toBeGreaterThan(0.98);
        expect(ratio).toBeLessThan(1.1);
      });
    }
  });
}

for (const { route, picture } of editors.slice(0, 2)) {
  test(`${route} draws a zoomed page at the zoomed size`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto(route);
    await chooseFiles(page, [await pdfFile("letter.pdf", ["Sharp text"])]);
    await page.waitForFunction((selector) => (document.querySelector(selector) as HTMLImageElement | null)?.naturalWidth, picture);
    const natural = () => page.locator(picture).evaluate((image: HTMLImageElement) => image.naturalWidth);
    const before = await natural();
    for (let step = 0; step < 4; step++) await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await expect.poll(natural).toBeGreaterThan(before * 1.9);
  });
}
