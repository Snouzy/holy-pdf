import { expect, type Locator, test } from "@playwright/test";

const centre = async (locator: Locator) => {
  const box = await locator.boundingBox();
  return box ? box.x + box.width / 2 : Number.NaN;
};

test("centres one action on an empty tool page, with one monk", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en/merge-pdf");
  await expect(page.locator(".tool-head .monk")).toHaveCount(0);
  await expect(page.locator(".dropzone .monk")).toHaveCount(1);
  const button = page.getByText("Choose PDF files");
  await expect(button).toBeInViewport();
  await expect(page.getByText("or drop them here")).toBeVisible();
  await expect(page.getByText("No file leaves your device, from import to download.", { exact: true })).toBeVisible();
  expect(Math.abs((await centre(page.locator("h1"))) - (await centre(button)))).toBeLessThan(2);
});

test("asks for one PDF when the tool takes one", async ({ page }) => {
  await page.goto("/en/split-pdf");
  await expect(page.getByText("Choose a PDF file")).toBeVisible();
  await expect(page.getByText("or drop it here")).toBeVisible();
});

for (const width of [320, 390]) {
  test(`fits the empty tool page in a ${width} px wide phone, with a full-width button`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/fr/compresser-pdf");
    const button = page.getByText("Choisir des PDF");
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(width - 90);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(56);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}

test("opens the question named in the address", async ({ page }) => {
  await page.goto("/fr/fusionner-pdf#combien-de-pdf-puis-je-fusionner");
  const question = page.locator("#combien-de-pdf-puis-je-fusionner");
  await expect(question).toHaveAttribute("open", "");
  await expect(question).toBeInViewport();
  await expect(page.locator("details[open]")).toHaveCount(1);
});
