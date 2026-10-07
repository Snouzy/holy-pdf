import { expect, test } from "@playwright/test";

test("puts the bar on a surface once the page scrolls, without moving the page", async ({ page }) => {
  await page.goto("/en");
  const root = page.locator("html");
  const top = () => page.locator("h1").evaluate((h1) => h1.getBoundingClientRect().top + scrollY);
  const before = await top();
  await expect(root).not.toHaveAttribute("data-scrolled");
  await page.evaluate(() => scrollTo(0, 600));
  await expect(root).toHaveAttribute("data-scrolled");
  await expect(page.locator(".site-header .brand")).toBeInViewport();
  expect(await top()).toBe(before);
  await page.evaluate(() => scrollTo(0, 0));
  await expect(root).not.toHaveAttribute("data-scrolled");
});

test("opens Convert PDF, then closes it with Escape or a click elsewhere", async ({ page }) => {
  await page.goto("/en/merge-pdf");
  const menu = page.locator(".convert-menu");
  const summary = menu.locator("summary");
  await summary.click();
  await expect(menu.getByRole("link", { name: "JPG to PDF" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "PDF to JPG" })).toBeVisible();
  await expect(menu.locator(".soon")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(menu).not.toHaveAttribute("open");
  await expect(summary).toBeFocused();
  await summary.click();
  await page.locator("main").click({ position: { x: 5, y: 5 } });
  await expect(menu).not.toHaveAttribute("open");
});

test("opens the language menu, then closes it with Escape or a click elsewhere", async ({ page }) => {
  await page.goto("/en/merge-pdf");
  const menu = page.locator(".language-menu");
  const summary = menu.locator("summary");
  await expect(summary).toHaveAccessibleName("Language: English");
  await summary.click();
  await expect(menu.getByRole("link", { name: "Français" })).toHaveAttribute("href", "/fr/fusionner-pdf");
  await expect(menu.getByRole("link", { name: "Português" })).toHaveAttribute("href", "/pt-br/juntar-pdf");
  await page.keyboard.press("Escape");
  await expect(menu).not.toHaveAttribute("open");
  await expect(summary).toBeFocused();
  await summary.click();
  await page.locator("main").click({ position: { x: 5, y: 5 } });
  await expect(menu).not.toHaveAttribute("open");
});

test("keeps one menu open at a time", async ({ page }) => {
  await page.goto("/en");
  await page.locator(".convert-menu summary").click();
  await page.locator(".tools-menu summary").click();
  await expect(page.locator(".tools-menu")).toHaveAttribute("open");
  await expect(page.locator(".convert-menu")).not.toHaveAttribute("open");
});

test("folds the menu behind a button on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en");
  const burger = page.getByRole("button", { name: "Menu" });
  const drawer = page.locator(".site-nav");
  await expect(drawer).toBeHidden();
  await burger.click();
  await expect(burger).toHaveAttribute("aria-expanded", "true");
  await expect(drawer.getByRole("link", { name: "Merge PDF" })).toBeVisible();
  await expect(drawer.getByRole("link", { name: "Français" })).toBeVisible();
  await page.locator(".tools-menu summary").click();
  await expect(page.locator(".tools-menu .mega").getByRole("link")).toHaveCount(27);
  await expect(page.locator(".tools-menu .soon").first()).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(burger).toHaveAttribute("aria-expanded", "false");
  await expect(burger).toBeFocused();
  await expect(drawer).toBeHidden();
});

test("keeps the keyboard out of the page behind the open drawer", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/en/merge-pdf");
  const burger = page.getByRole("button", { name: "Menu" });
  await burger.focus();
  await page.keyboard.press("Enter");
  await expect(burger).toHaveAttribute("aria-expanded", "true");
  for (let step = 0; step < 6; step++) {
    await page.keyboard.press("Tab");
    const behind = await page.evaluate(() => (document.activeElement?.closest("main, .site-footer") ? document.activeElement.outerHTML.slice(0, 80) : null));
    expect(behind, `Tab ${step + 1}`).toBeNull();
  }
  await page.keyboard.press("Escape");
  await expect(page.locator("main")).not.toHaveAttribute("inert");
});

test("closes a menu when the keyboard leaves it", async ({ page }) => {
  await page.goto("/en");
  const menu = page.locator(".convert-menu");
  await menu.locator("summary").focus();
  await page.keyboard.press("Enter");
  do {
    await expect(menu).toHaveAttribute("open");
    await page.keyboard.press("Tab");
  } while (await menu.evaluate((element) => element.contains(document.activeElement)));
  await expect(menu).not.toHaveAttribute("open");
});

test("puts Sign PDF in the bar, between Merge and Compress", async ({ page }) => {
  await page.goto("/fr");
  await expect(page.locator(".nav-links > li > a")).toHaveText(["Fusionner PDF", "Signer PDF", "Compresser PDF"]);
  await expect(page.locator(".site-nav").getByRole("link", { name: "Signer PDF" })).toHaveAttribute("href", "/fr/signer-pdf");
});

test("closes the drawer after a client-side navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/merge-pdf");
  await page.evaluate(() => Object.assign(window, { stayed: true }));
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.locator("main")).toHaveAttribute("inert");
  await page.locator(".site-nav").getByRole("link", { name: "Sign PDF" }).click();
  await expect(page).toHaveURL(/\/en\/sign-pdf$/);
  expect(await page.evaluate(() => "stayed" in window), "the router kept the page alive").toBe(true);
  await expect(page.locator("html")).not.toHaveAttribute("data-menu");
  await expect(page.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("main")).not.toHaveAttribute("inert");
});

test("links the footer to the tools, and names each social network", async ({ page }) => {
  await page.goto("/en");
  const footer = page.locator(".site-footer");
  const socials = footer.getByRole("link", { name: /^Holy PDF on / });
  await expect(socials).toHaveCount(3);
  expect(await socials.evaluateAll((links) => links.map((link) => link.getAttribute("aria-label")))).toEqual(["Holy PDF on X", "Holy PDF on Instagram", "Holy PDF on TikTok"]);
  await footer.getByRole("link", { name: "Compress PDF" }).click();
  await expect(page).toHaveURL(/\/en\/compress-pdf$/);
});

test.describe("light footer", () => {
  test.use({ colorScheme: "light" });

  test("draws the focus ring in a colour the dark footer shows", async ({ page }) => {
    await page.goto("/en");
    await page.locator(".site-footer").getByRole("link", { name: "Home" }).focus();
    await page.keyboard.press("Tab");
    const ring = await page.evaluate(() => {
      const footer = document.querySelector(".site-footer");
      const focused = document.activeElement;
      if (!footer || !focused || !footer.contains(focused)) return null;
      const { outlineStyle, outlineColor } = getComputedStyle(focused);
      return { outlineStyle, outlineColor, background: getComputedStyle(footer).backgroundColor };
    });
    expect(ring?.outlineStyle).toBe("solid");
    expect(ring?.outlineColor).not.toBe(ring?.background);
  });

  test("switches the theme from the footer too", async ({ page }) => {
    await page.goto("/en");
    await page.locator(".site-footer").getByRole("button", { name: "Dark mode" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator(".site-header").getByRole("button", { name: "Dark mode" })).toHaveAttribute("aria-pressed", "true");
  });
});

test("centres the icon of each square button in the bar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/fr");
  const middle = (box: { y: number; height: number } | null) => (box ? box.y + box.height / 2 : Number.NaN);
  const bar = page.locator(".site-header");
  for (const control of [bar.getByRole("button", { name: "Mode sombre" }), bar.getByRole("button", { name: "Menu" }), bar.getByRole("link", { name: "Code source sur GitHub" })]) {
    const offset = middle(await control.locator("svg:visible").boundingBox()) - middle(await control.boundingBox());
    expect(Math.abs(offset), String(control)).toBeLessThan(1);
  }
});

test("links the source code from the bar, on a computer and on a phone", async ({ page }) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/en");
    const link = page.locator(".site-header").getByRole("link", { name: "Source code on GitHub" });
    await expect(link, `${width}px`).toBeVisible();
    await expect(link).toHaveAttribute("href", "https://github.com/Snouzy/holy-pdf");
  }
});
