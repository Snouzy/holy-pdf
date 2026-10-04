import { expect, test } from "@playwright/test";
import { chooseFiles, expectThumbnails, pdfFile } from "./support";

const pageBackground = (page: import("@playwright/test").Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test.describe("theme switch", () => {
  test.use({ colorScheme: "light" });

  test("switches to dark mode and keeps it on the next page", async ({ page }) => {
    await page.goto("/en");
    expect(await pageBackground(page)).toBe("rgb(238, 241, 246)");
    await page.locator(".site-header").getByRole("button", { name: "Dark mode" }).click();
    await expect(page.locator(".site-header").getByRole("button", { name: "Dark mode" })).toHaveAttribute("aria-pressed", "true");
    expect(await pageBackground(page)).toBe("rgb(17, 21, 39)");
    await page.goto("/fr/diviser-pdf");
    expect(await pageBackground(page)).toBe("rgb(17, 21, 39)");
    await page.locator(".site-header").getByRole("button", { name: "Mode sombre" }).click();
    expect(await pageBackground(page)).toBe("rgb(238, 241, 246)");
  });

  test("switches once after a client-side navigation", async ({ page }) => {
    await page.goto("/en");
    await page.evaluate(() => Object.assign(window, { stayed: true }));
    await page.locator(".tool-card").first().click();
    await expect(page).toHaveURL(/\/en\/merge-pdf$/);
    expect(await page.evaluate(() => "stayed" in window), "the router kept the page alive").toBe(true);
    await page.locator(".site-header").getByRole("button", { name: "Dark mode" }).click();
    expect(await pageBackground(page)).toBe("rgb(17, 21, 39)");
  });
});

test.describe("dark system", () => {
  test.use({ colorScheme: "dark" });

  test("follows the device until the visitor chooses", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator(".site-header").getByRole("button", { name: "Dark mode" })).toHaveAttribute("aria-pressed", "true");
    expect(await pageBackground(page)).toBe("rgb(17, 21, 39)");
  });
});

test.describe("dark mode", () => {
  test.use({ colorScheme: "dark" });

  test("paints the page dark and keeps PDF pages white", async ({ page }) => {
    await page.goto("/en/merge-pdf");
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(17, 21, 39)");
    await chooseFiles(page, [await pdfFile("a.pdf", ["A1"])]);
    await expectThumbnails(page, 1);
    expect(await page.locator(".page-sheet img").evaluate((img) => getComputedStyle(img).backgroundColor)).toBe("rgb(255, 255, 255)");
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("stops the loading shimmer", async ({ page }) => {
    await page.route(/\.wasm$/, () => {});
    await page.goto("/en/merge-pdf");
    await chooseFiles(page, [await pdfFile("a.pdf", ["A1"])]);
    await expect(page.locator(".pages .skeleton")).toHaveCount(1);
    const animation = await page.locator(".pages .skeleton .thumb").evaluate((element) => getComputedStyle(element, "::before").animationName);
    expect(animation).toBe("none");
  });
});
