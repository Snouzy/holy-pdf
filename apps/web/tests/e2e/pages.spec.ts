import { expect, type Page, test } from "@playwright/test";
import { pageIds, pagePath } from "../../src/sitePages";
import { languages } from "../../src/tools";
import { overflowing } from "./support";

const articles = { fr: "/fr/blog/vos-pdf-restent-sur-votre-appareil", en: "/en/blog/your-pdfs-stay-on-your-device", "pt-br": "/pt-br/blog/seus-pdfs-ficam-no-seu-dispositivo" };

async function hrefs(page: Page, scope: string): Promise<string[]> {
  const all = await page.locator(`${scope} a[href^="/"]`).evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
  return all.map((href) => href.split("#")[0] ?? href);
}

for (const lang of languages) {
  test(`links the footer to every page in ${lang}, and every link of those pages leads somewhere`, async ({ page, request }) => {
    await page.goto(`/${lang}`);
    const footer = await hrefs(page, ".footer-links");
    for (const id of pageIds) expect(footer, id).toContain(pagePath(id, lang));
    await expect(page.locator('.footer-links a[href="#"]')).toHaveCount(0);

    const lists = [pagePath("blog", lang), pagePath("guides", lang)];
    const queue = pageIds.map((id) => pagePath(id, lang));
    const seen = new Set(queue);
    const elsewhere = new Set<string>();
    for (const path of queue) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      await expect(page.locator("h1")).toHaveCount(1);
      for (const href of await hrefs(page, "main")) {
        if (seen.has(href)) continue;
        if (lists.some((list) => href.startsWith(`${list}/`))) {
          seen.add(href);
          queue.push(href);
        } else elsewhere.add(href);
      }
    }
    for (const href of elsewhere) expect((await request.get(href)).status(), href).toBe(200);
  });
}

test("switches a page and an article to the other language", async ({ page }) => {
  await page.goto("/fr/confidentialite");
  await page.locator('.site-footer a[hreflang="en"]').click();
  await expect(page).toHaveURL(/\/en\/privacy$/);
  await page.goto(articles.fr);
  await page.locator('.site-footer a[hreflang="en"]').click();
  await expect(page).toHaveURL(new RegExp(`${articles.en}$`));
});

test("shows the apps asleep, one anchor per app", async ({ page }) => {
  await page.goto("/fr/applis");
  await expect(page.locator("#mac")).toHaveCount(1);
  await expect(page.locator("#iphone")).toHaveCount(1);
  await expect(page.locator(".page-head .stamp")).toHaveText("Bientôt");
});

test("leads from the blog to its article and back", async ({ page }) => {
  await page.goto("/en/blog");
  await page.locator(".articles a").first().click();
  await expect(page).toHaveURL(new RegExp(`${articles.en}$`));
  await page.locator(".back a").click();
  await expect(page).toHaveURL(/\/en\/blog$/);
});

test("tracks article reading progress and the current section", async ({ page }) => {
  await page.goto(articles.en);
  const progress = page.locator(".reading-progress");
  await expect(progress).toHaveAttribute("max", "100");
  await expect(page.locator(".article-toc a[aria-current='location']")).toHaveCount(1);
  const initial = Number(await progress.getAttribute("value"));
  await page.evaluate(() => {
    scrollTo(0, document.documentElement.scrollHeight);
    dispatchEvent(new Event("scroll"));
  });
  await expect.poll(async () => Number(await progress.getAttribute("value"))).toBeGreaterThan(initial);
  await expect.poll(async () => Number(await progress.getAttribute("value"))).toBeGreaterThanOrEqual(99);
});

for (const width of [320, 390]) {
  test(`fits every content page in a ${width} px wide screen, even with fallback fonts`, async ({ page }) => {
    await page.route(/\.woff2$/, (route) => route.abort());
    await page.setViewportSize({ width, height: 700 });
    for (const path of [...languages.flatMap((lang) => pageIds.map((id) => pagePath(id, lang))), ...Object.values(articles)]) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${path}: ${await overflowing(page)}`).toBe(width);
    }
  });
}
