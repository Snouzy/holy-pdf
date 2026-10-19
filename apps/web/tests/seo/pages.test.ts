import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { languages, locales } from "../../src/tools";

/** Checks the built site: run `pnpm build` first. */
const dist = join(import.meta.dirname, "../../dist");
const site = process.env.SITE_URL ?? "http://localhost:8787";

function htmlFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name === "index.html" ? [path] : [];
  });
}

const pages = htmlFiles(dist).map((file) => {
  const path = `/${relative(dist, file).replace(/\/?index\.html$/, "")}`;
  return { path, html: readFileSync(file, "utf8") };
});

const first = (html: string, pattern: RegExp) => pattern.exec(html)?.[1];
const sitemapUrls = () => [...readFileSync(join(dist, "sitemap-0.xml"), "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const homes = pages.filter(({ path }) => path.split("/").length === 2);
const emoji = /\p{Extended_Pictographic}/u;

describe("built pages", () => {
  it("has a home per language and a page per content file", () => {
    const markdown = (folder: string) =>
      readdirSync(join(import.meta.dirname, "../../src/content", folder), { recursive: true }).filter((file) => String(file).endsWith(".md")).length;
    expect(pages.length).toBe(languages.length + markdown("tools") + markdown("pages") + markdown("articles"));
  });

  it.each(pages)("$path has its title, description, H1 and language", ({ path, html }) => {
    expect(first(html, /<title>([^<]+)<\/title>/)?.length ?? 0).toBeGreaterThan(10);
    expect(first(html, /<meta name="description" content="([^"]+)"/)?.length ?? 0).toBeGreaterThanOrEqual(70);
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(first(html, /<html lang="([A-Za-z-]+)"/)?.toLowerCase()).toBe(path.split("/")[1]);
  });

  it.each(pages)("$path points to itself as canonical and only to existing locale equivalents", ({ path, html }) => {
    expect(first(html, /<link rel="canonical" href="([^"]+)"/)).toBe(`${site}${path}`);
    const alternates = new Map([...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]]));
    const article = structured(html).some((data) => data["@type"] === "BlogPosting");
    const currentLocale = locales[path.split("/")[1] as keyof typeof locales];
    if (!article) expect([...alternates.keys()].sort()).toEqual([...languages.map((lang) => locales[lang]), "x-default"].sort());
    else {
      expect(alternates.get(currentLocale)).toBe(`${site}${path}`);
      expect(alternates.has("x-default")).toBe(alternates.has(locales.en));
      if (alternates.has(locales.en)) expect(alternates.get("x-default")).toBe(alternates.get(locales.en));
    }
    for (const [alternateLocale, href] of alternates) {
      const target = new URL(href ?? "").pathname;
      const targetFile = join(dist, target, "index.html");
      expect(existsSync(targetFile), `${href} exists`).toBe(true);
      if (alternateLocale !== "x-default" && target !== path) {
        const targetHtml = readFileSync(targetFile, "utf8");
        expect(targetHtml, `${href} links back to ${path}`).toContain(`hreflang="${currentLocale}" href="${site}${path}"`);
      }
    }
  });

  it("does not invent hreflang siblings for a market-only article", () => {
    const page = pages.find(({ path }) => path === "/pt-br/guias/como-dividir-um-pdf");
    expect(page).toBeDefined();
    const alternates = [...(page?.html ?? "").matchAll(/<link rel="alternate" hreflang="([^"]+)"/g)].map((match) => match[1]);
    expect(alternates).toEqual(["pt-BR"]);
  });

  it.each(homes)("$path starts its title with Holy PDF", ({ html }) => {
    expect(first(html, /<title>([^<]+)<\/title>/)).toMatch(/^Holy PDF/);
  });

  it.each(pages)("$path keeps emojis out of its title and description", ({ html }) => {
    expect(first(html, /<title>([^<]+)<\/title>/)).not.toMatch(emoji);
    expect(first(html, /<meta name="description" content="([^"]+)"/)).not.toMatch(emoji);
  });

  it.each(pages)("$path glues its title emoji to the last word", ({ html }) => {
    expect(first(html, /<h1[^>]*>([\s\S]*?)<\/h1>/)).toMatch(/[^\s>](?:&nbsp;|\u00a0)<span class="emoji" aria-hidden="true">[^<]+<\/span>\s*$/);
  });

  it.each(pages.filter(({ path }) => path.split("/").length === 3))("$path names Holy PDF in its breadcrumb", ({ html }) => {
    expect(html).toContain('"name":"Holy PDF"');
  });

  it.each(homes)("$path hydrates no island", ({ html }) => {
    expect(html).not.toContain("<astro-island");
  });

  const toolPages = pages.filter(({ html }) => html.includes('"@type":"WebApplication"'));
  const contentPages = pages.filter(({ path, html }) => path.split("/").length > 2 && !html.includes('"@type":"WebApplication"'));
  const structured = (html: string): { "@id"?: string; "@type": string; image?: string; author?: { "@type": string; name: string }; mainEntity?: { name: string }[]; mainEntityOfPage?: { "@id": string }; publisher?: { name: string } }[] =>
    [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1] ?? "{}"));
  const faqPages = pages.filter(({ path }) => /^\/[a-z-]+\/faq$/.test(path));
  const articlePages = pages.filter(({ html }) => structured(html).some((data) => data["@type"] === "BlogPosting"));

  it.each(toolPages)("$path gives each question an anchor and marks them up as an FAQ", ({ html }) => {
    const ids = [...html.matchAll(/<details[^>]* id="([^"]+)"/g)].map((match) => match[1]);
    expect(ids.length).toBeGreaterThanOrEqual(5);
    expect(new Set(ids).size).toBe(ids.length);
    expect(structured(html).find((data) => data["@type"] === "FAQPage")?.mainEntity).toHaveLength(ids.length);
  });

  it("builds a FAQ page per language", () => {
    expect(faqPages.length).toBe(languages.length);
  });

  it.each(faqPages)("$path links every tool question to its answer, and marks up its own questions", ({ path, html }) => {
    const lang = path.split("/")[1] ?? "";
    const expected = toolPages.filter((page) => page.path.startsWith(`/${lang}/`));
    const links = [...html.matchAll(/<a href="(\/[a-z-]+\/[a-z0-9-]+)#([a-z0-9-]+)"/g)].filter(([, target]) => expected.some((page) => page.path === target));
    const questions = expected.reduce((sum, page) => sum + (page.html.match(/<details[^>]* id="/g)?.length ?? 0), 0);
    expect(links.length).toBe(questions);
    for (const [, target, id] of links) {
      expect(pages.find((page) => page.path === target)?.html, `${target}#${id}`).toContain(`id="${id}"`);
    }
    expect(structured(html).find((data) => data["@type"] === "FAQPage")?.mainEntity?.length).toBeGreaterThanOrEqual(5);
  });

  it("builds the content pages", () => {
    expect(contentPages.length).toBeGreaterThan(0);
  });

  it.each(contentPages)("$path hydrates no island", ({ html }) => {
    expect(html).not.toContain("<astro-island");
  });

  it.each(articlePages)("$path has visible article navigation and semantic metadata", ({ path, html }) => {
    expect(html).toMatch(/<article[^>]*class="article-page"/);
    expect(html).toContain('<nav class="breadcrumbs"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('<nav class="article-toc"');
    expect(html).toContain('<progress class="reading-progress"');
    expect(html).toMatch(/<time datetime="\d{4}-\d{2}-\d{2}"[^>]*>/);
    expect(html).toContain('class="reading-time"');
    expect(html).toContain('<section class="related-articles"');

    const articleHtml = html.slice(html.indexOf("<article"), html.indexOf("</article>") + "</article>".length);
    const headings = [...articleHtml.matchAll(/<h2 id="([^"]+)"/g)].map((match) => match[1]);
    const tocTargets = [...articleHtml.matchAll(/<a href="#([^"]+)" data-toc-link/g)].map((match) => match[1]);
    expect(tocTargets).toEqual(headings);

    const lang = path.split("/")[1];
    const related = [...html.matchAll(/<a class="related-card[^>]* href="(\/[^"]+)"/g)].map((match) => match[1] ?? "");
    expect(related.length).toBeGreaterThan(0);
    for (const href of related) {
      expect(href.startsWith(`/${lang}/`), href).toBe(true);
      expect(existsSync(join(dist, href, "index.html")), href).toBe(true);
    }

    expect(first(html, /<meta property="og:type" content="([^"]+)"/)).toBe("article");
    expect(first(html, /<meta property="og:url" content="([^"]+)"/)).toBe(`${site}${path}`);
    const posting = structured(html).find((data) => data["@type"] === "BlogPosting");
    expect(posting?.["@id"]).toBe(`${site}${path}#article`);
    expect(posting?.mainEntityOfPage?.["@id"]).toBe(`${site}${path}`);
    expect(posting?.publisher?.name).toBe("Holy PDF");
  });

  it("links the equivalent FR, EN and pt-BR redaction guides", () => {
    const expected = {
      fr: `${site}/fr/guides/comment-caviarder-un-pdf`,
      en: `${site}/en/guides/how-to-redact-a-pdf`,
      "pt-BR": `${site}/pt-br/guias/como-ocultar-informacoes-em-pdf`,
    };
    for (const path of Object.values(expected).map((href) => new URL(href).pathname)) {
      const html = pages.find((page) => page.path === path)?.html ?? "";
      const alternates = new Map([...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((match) => [match[1], match[2]]));
      expect(Object.fromEntries(alternates)).toEqual({ ...expected, "x-default": expected.en });
    }
  });

  const redactionPaths = ["/fr/guides/comment-caviarder-un-pdf", "/en/guides/how-to-redact-a-pdf", "/pt-br/guias/como-ocultar-informacoes-em-pdf"];
  it.each(redactionPaths)("$path exposes its editorial hero, localized product screenshot and Mathias byline", (path) => {
    const page = pages.find((candidate) => candidate.path === path);
    expect(page, path).toBeDefined();
    const html = page?.html ?? "";
    const lang = path.startsWith("/fr/") ? "fr" : path.startsWith("/en/") ? "en" : "pt-br";
    const screenshot = `/articles/redact-pdf/holy-pdf-redaction-ui-${lang}.webp`;
    const hero = "/articles/redact-pdf/holy-pdf-redaction-guide-hero.webp";
    expect(html).toContain(`src="${hero}"`);
    expect(html).toContain(`src="${screenshot}"`);
    expect(html).toContain('width="1600" height="900"');
    expect(html).toContain(lang === "pt-br" ? 'width="1320" height="700"' : 'width="1400" height="900"');
    if (lang === "pt-br") {
      expect(html).toMatch(/<figure class="article-visual">\s*<picture>\s*<source media="\(max-width: 40rem\)" srcset="\/articles\/redact-pdf\/holy-pdf-redaction-ui-pt-br-mobile\.webp" width="780" height="1468" \/>\s*<img src="\/articles\/redact-pdf\/holy-pdf-redaction-ui-pt-br\.webp"/);
    }
    expect(first(html, /<p class="meta"[^>]*>([\s\S]*?)<\/p>/)).toContain("Mathias");
    const posting = structured(html).find((data) => data["@type"] === "BlogPosting");
    expect(posting?.image).toBe(`${site}${hero}`);
    expect(posting?.author).toEqual({ "@type": "Person", name: "Mathias" });
  });

  it.each(pages.filter(({ path }) => path.includes("/guides/scan") || path.includes("/guides/scanner")))("$path exposes its reviewed hero in the page and BlogPosting data", ({ html }) => {
    const hero = "/articles/scan-multiple-pages/scan-multiple-pages-hero.webp";
    expect(html).toContain(`src="${hero}"`);
    expect(html).toContain('width="1600" height="893"');
    expect(structured(html).find((data) => data["@type"] === "BlogPosting")?.image).toBe(`${site}${hero}`);
  });

  it("points robots.txt at the sitemap of the site's own address", () => {
    expect(readFileSync(join(dist, "robots.txt"), "utf8")).toBe(`User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap-index.xml\n`);
  });

  it("lists every page in the sitemap, dated unless it is a home", () => {
    expect(sitemapUrls().sort()).toEqual(pages.map(({ path }) => `${site}${path}`).sort());
    const entries = [...readFileSync(join(dist, "sitemap-0.xml"), "utf8").matchAll(/<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?<\/url>/g)];
    expect(entries.length).toBe(pages.length);
    for (const [, loc, lastmod] of entries) {
      const home = new URL(loc ?? "").pathname.split("/").length === 2;
      expect(lastmod === undefined, loc).toBe(home);
      if (lastmod) expect(lastmod).toMatch(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}\.\d{3}Z)?$/);
    }
  });

  it("serves the IndexNow key, which the deploy script sends with every page of the sitemap", () => {
    const key = readFileSync(join(dist, "indexnow.txt"), "utf8");
    expect(key).toMatch(/^[a-f0-9]{32}$/);
    const script = join(import.meta.dirname, "../../scripts/indexnow.mjs");
    const run = (indexable: string) => execFileSync("node", [script, "--dry-run"], { env: { ...process.env, SITE_URL: site, INDEXABLE: indexable }, encoding: "utf8" });
    expect(JSON.parse(run("true"))).toEqual({ host: new URL(site).host, key, keyLocation: `${site}/indexnow.txt`, urlList: sitemapUrls() });
    expect(run("")).toContain("skipped");
  });
});

describe("audience measurement", () => {
  it("is on every page of a build with GA4_ID, and on none without", () => {
    const id = process.env.GA4_ID;
    for (const { path, html } of pages) expect(html.includes(id ? `data-measurement-id="${id}"` : "data-measurement-id"), path).toBe(Boolean(id));
  });
});
