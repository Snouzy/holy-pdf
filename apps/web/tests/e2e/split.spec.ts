import { unzipSync } from "fflate";
import { expect, test } from "@playwright/test";
import { readWithPdfjs } from "../engine/support";
import { chooseFiles, expectThumbnails, exportWith, pdfFile } from "./support";

test("splits after the chosen page into a ZIP of PDFs", async ({ page }) => {
  await page.goto("/en/split-pdf");
  await chooseFiles(page, [await pdfFile("doc.pdf", ["P1", "P2", "P3", "P4"])]);
  await expectThumbnails(page, 4);
  await page.getByRole("button", { name: "Split after this page, Page 2" }).click();
  const { name, bytes } = await exportWith(page, "Split the PDF");
  expect(name).toBe("doc-split.zip");
  const parts = unzipSync(bytes);
  expect(Object.keys(parts)).toEqual(["doc-1.pdf", "doc-2.pdf"]);
  expect((await readWithPdfjs(parts["doc-1.pdf"] ?? new Uint8Array())).map((p) => p.text)).toEqual(["P1", "P2"]);
  expect((await readWithPdfjs(parts["doc-2.pdf"] ?? new Uint8Array())).map((p) => p.text)).toEqual(["P3", "P4"]);
});

test("keeps the split button off until there is a cut", async ({ page }) => {
  await page.goto("/en/split-pdf");
  await chooseFiles(page, [await pdfFile("doc.pdf", ["P1", "P2"])]);
  await expectThumbnails(page, 2);
  await expect(page.getByRole("button", { name: "Split the PDF", exact: true })).toBeDisabled();
});

for (const width of [1280, 390, 320]) {
  test(`keeps the scissors visible and clickable beyond the page cell at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/en/split-pdf");
    await chooseFiles(page, [await pdfFile("doc.pdf", ["P1", "P2", "P3", "P4"])]);
    await expectThumbnails(page, 4);
    for (const cut of await page.locator(".cut").all()) {
      await cut.scrollIntoViewIfNeeded();
      const icon = await cut.locator("svg").boundingBox();
      expect(icon?.width ?? 0).toBeGreaterThanOrEqual(20);
      const hit = await cut.evaluate((button) => {
        const rect = button.getBoundingClientRect();
        const x = rect.right - 6;
        const y = rect.top + rect.height / 2;
        return { x, y, width: rect.width, height: rect.height, reachable: button.contains(document.elementFromPoint(x, y)) };
      });
      expect(hit.width).toBeGreaterThanOrEqual(44);
      expect(hit.height).toBeGreaterThanOrEqual(44);
      expect(hit.reachable).toBe(true);
      await page.mouse.click(hit.x, hit.y);
      await expect(cut).toHaveAttribute("aria-pressed", "true");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await page.screenshot({ path: testInfo.outputPath("scissors.png"), animations: "disabled" });
  });
}
