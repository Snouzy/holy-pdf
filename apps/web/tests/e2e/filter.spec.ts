import { expect, type Page, test } from "@playwright/test";

const cards = (page: Page) => page.locator(".cards [data-tool]:visible");
const search = (page: Page, name = "Chercher un outil") => page.getByRole("searchbox", { name });
const category = (page: Page, name: string) => page.locator(".categories").getByRole("button", { name: new RegExp(`^${name}`) });

test("filters the monks by category, and wakes the ones in meditation with the switch", async ({ page }) => {
  await page.goto("/fr");
  await expect(cards(page)).toHaveCount(27);
  await expect(page.locator(".more-soon")).toBeVisible();
  await category(page, "Convertir").click();
  await expect(category(page, "Convertir")).toHaveAttribute("aria-pressed", "true");
  await expect(category(page, "Tous les moines")).toHaveAttribute("aria-pressed", "false");
  await expect(cards(page)).toHaveCount(4);
  await expect(page.locator(".more-soon")).toBeHidden();
  await expect(page.locator(".search-status")).toHaveText("4 moines");
  const sleeping = page.getByRole("switch", { name: "Montrer les moines en méditation" });
  await expect(sleeping).toHaveAttribute("aria-checked", "false");
  await sleeping.click();
  await expect(sleeping).toHaveAttribute("aria-checked", "true");
  await expect(cards(page)).toHaveCount(5);
  await expect(cards(page).filter({ hasText: "Bientôt · en méditation" })).toHaveCount(1);
});

test("shows the two ready security monks, with nobody left in meditation", async ({ page }) => {
  await page.goto("/en");
  await category(page, "Security").click();
  await expect(cards(page)).toHaveCount(2);
  await expect(cards(page).getByRole("link")).toHaveCount(2);
  await expect(cards(page).filter({ hasText: "Soon · in meditation" })).toHaveCount(0);
});

test("puts four monks in a row on a wide screen", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/fr");
  const tops = await cards(page).evaluateAll((items) => items.slice(0, 5).map((item) => Math.round(item.getBoundingClientRect().top)));
  expect(new Set(tops.slice(0, 4)).size).toBe(1);
  expect(tops[4]).toBeGreaterThan(tops[0] ?? 0);
});

test("keeps the column in view down the page", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.goto("/fr");
  await page.getByRole("switch", { name: "Montrer les moines en méditation" }).click();
  await page.locator(".filters").evaluate((column) => column.scrollIntoView());
  await page.evaluate(() => window.scrollBy(0, 900));
  const box = await page.locator(".filters").boundingBox();
  expect(box?.y).toBeGreaterThanOrEqual(0);
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(800);
});

test("finds a monk by its name while the word lists do not load, and tries them again", async ({ page }) => {
  let blocked = true;
  await page.route("**/search.json", (route) => (blocked ? route.abort() : route.continue()));
  await page.goto("/fr");
  await search(page).fill("pivoter");
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page)).toContainText("Pivoter un PDF");
  blocked = false;
  await search(page).fill("tourner");
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page)).toContainText("Pivoter un PDF");
});

test("forgives a typo, and says which word it understood", async ({ page }) => {
  await page.goto("/fr");
  await search(page).fill("redure");
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page)).toContainText("Compresser un PDF");
  await expect(page.locator(".search-status")).toContainText("« réduire » → Compresser");
  await search(page).fill("");
  await expect(cards(page)).toHaveCount(27);
  await expect(page.locator(".search-status")).toHaveText("27 moines");
});

test("puts the best result first", async ({ page }) => {
  await page.goto("/en");
  await search(page, "Search a tool").fill("pdf to jpg");
  await expect(cards(page).first()).toContainText("Convert PDF to JPG");
  await search(page, "Search a tool").fill("jpg to pdf");
  await expect(cards(page).first()).toContainText("Convert JPG to PDF");
});

test("says when no monk does it, and brings them all back", async ({ page }) => {
  await page.goto("/fr");
  await category(page, "Organiser").click();
  await search(page).fill("excel");
  await expect(cards(page)).toHaveCount(0);
  const empty = page.locator(".no-result");
  await expect(empty).toBeVisible();
  await expect(empty).toContainText("Aucun moine ne fait ça… pour l'instant");
  await expect(page.locator(".search-status")).toHaveText("Aucun moine");
  await empty.getByRole("button", { name: "Voir tous les moines" }).click();
  await expect(empty).toBeHidden();
  await expect(search(page)).toHaveValue("");
  await expect(category(page, "Tous les moines")).toHaveAttribute("aria-pressed", "true");
  await expect(cards(page)).toHaveCount(27);
  await expect(page.locator(".more-soon")).toBeVisible();
});

test("filters the compact view too", async ({ page }) => {
  await page.goto("/fr");
  await page.getByRole("button", { name: "Vue compacte" }).click();
  await expect(page.locator(".compact-row:visible")).toHaveCount(5);
  await category(page, "Convertir").click();
  await expect(page.locator(".compact-row:visible")).toHaveCount(1);
  await expect(page.locator(".compact [data-tool]:visible")).toHaveCount(5);
  await category(page, "Tous les moines").click();
  await search(page).fill("tourner");
  await expect(page.locator(".compact [data-tool]:visible")).toHaveCount(1);
  await expect(page.locator(".compact-row:visible")).toHaveCount(1);
});

test("finds a monk again after a visit to a tool page", async ({ page }) => {
  await page.goto("/en");
  await page.locator(".tool-card").first().click();
  await expect(page).toHaveURL(/\/en\/merge-pdf$/);
  await page.goBack();
  await search(page, "Search a tool").fill("rotate");
  await expect(cards(page)).toHaveCount(1);
});

for (const width of [320, 390, 768, 1024]) {
  test(`keeps the filters inside a ${width} px wide screen`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/fr");
    await search(page).fill("image");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    if (width !== 390) return;
    const tops = await page.locator(".categories button").evaluateAll((buttons) => buttons.map((button) => Math.round(button.getBoundingClientRect().top)));
    expect(new Set(tops).size, "the categories are one row of pills").toBe(1);
    expect(await page.locator(".categories").evaluate((list) => list.scrollWidth > list.clientWidth)).toBe(true);
  });
}

test("hides the ready count while the monks in meditation show, and keeps the field free of spelling marks", async ({ page }) => {
  await page.goto("/fr");
  const note = page.locator(".section-tools p");
  await expect(note).toBeVisible();
  await expect(search(page)).toHaveAttribute("spellcheck", "false");
  await page.getByRole("switch", { name: "Montrer les moines en méditation" }).click();
  await expect(note).toBeHidden();
});

test("wakes the monks in meditation from their card", async ({ page }) => {
  await page.goto("/fr");
  await page.getByRole("button", { name: /Et un moine en méditation/ }).click();
  await expect(page.getByRole("switch", { name: "Montrer les moines en méditation" })).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".more-soon")).toBeHidden();
  await expect(cards(page).filter({ hasText: "Bientôt · en méditation" })).toHaveCount(1);
});
