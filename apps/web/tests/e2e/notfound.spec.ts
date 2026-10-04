import { expect, test } from "@playwright/test";
import { overflowing } from "./support";

test("answers an unknown French address in French, and leads to a tool", async ({ page }) => {
  const response = await page.goto("/fr/cette-page-n-existe-pas");
  expect(response?.status()).toBe(404);
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.locator("h1")).toContainText("Frère Loupe a cherché partout");
  await page.getByRole("combobox", { name: "Ce que vous voulez faire" }).click();
  await page.getByRole("option", { name: /signer/ }).click();
  await page.getByRole("link", { name: "C'est parti →" }).click();
  await expect(page).toHaveURL(/\/fr\/signer-pdf$/);
});

for (const path of ["/en/no-such-page", "/no-such-page"]) {
  test(`answers ${path} in English`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("h1")).toContainText("Brother Lens searched everywhere");
  });
}

for (const width of [320, 390]) {
  test(`fits the page not found in a ${width} px wide screen, even with fallback fonts`, async ({ page }) => {
    await page.route(/\.woff2$/, (route) => route.abort());
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/fr/introuvable");
    expect(await page.evaluate(() => document.documentElement.scrollWidth), await overflowing(page)).toBe(width);
  });
}
