import { expect, test } from "@playwright/test";
import { overflowing } from "./support";

test("lists every tool in the menu and follows a link", async ({ page }) => {
  await page.goto("/en");
  await page.locator(".tools-menu summary").click();
  const menu = page.locator(".tools-menu .mega");
  await expect(menu.getByRole("link")).toHaveCount(27);
  await expect(menu.locator(".soon")).toHaveCount(1);
  await menu.getByRole("link", { name: "Split", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/split-pdf$/);
});

test("opens the tools menu with the keyboard", async ({ page }) => {
  await page.goto("/fr");
  await page.locator(".tools-menu summary").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".tools-menu .mega")).toBeVisible();
  await page.locator(".tools-menu .mega a").first().focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/fr\/fusionner-pdf$/);
});

test("names the site Holy PDF in its header", async ({ page }) => {
  await page.goto("/en");
  await expect(page.locator(".site-header .brand")).toHaveText("Holy PDF");
});

for (const width of [320, 390, 768, 1024]) {
  test(`fits the home page in a ${width} px wide screen, even with fallback fonts`, async ({ page }) => {
    await page.route(/\.woff2$/, (route) => route.abort());
    await page.setViewportSize({ width, height: 700 });
    await page.goto("/fr");
    expect(await page.evaluate(() => document.documentElement.scrollWidth), await overflowing(page)).toBe(width);
  });
}
