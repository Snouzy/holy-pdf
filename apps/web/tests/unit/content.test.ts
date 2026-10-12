import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pageIds } from "../../src/sitePages";
import { languages, toolIds } from "../../src/tools";

const content = join(import.meta.dirname, "../../src/content");
const tools = languages.flatMap((lang) => toolIds.map((tool) => ({ lang, tool })));
const pages = languages.flatMap((lang) => pageIds.map((page) => ({ lang, page })));

describe("tool pages", () => {
  it.each(tools)("$lang/$tool has its Markdown text", ({ lang, tool }) => {
    expect(existsSync(join(content, "tools", lang, `${tool}.md`))).toBe(true);
  });
});

describe("site pages", () => {
  it.each(pages)("$lang/$page has its Markdown text", ({ lang, page }) => {
    expect(existsSync(join(content, "pages", lang, `${page}.md`))).toBe(true);
  });
});

describe("articles", () => {
  it("can publish the redaction guide in FR and EN without a filler pt-BR article", () => {
    expect(existsSync(join(content, "articles/fr/redact-pdf.md"))).toBe(true);
    expect(existsSync(join(content, "articles/en/redact-pdf.md"))).toBe(true);
    expect(existsSync(join(content, "articles/pt-br/redact-pdf.md"))).toBe(false);
  });

  it("allows independent locale inventories and matches topics only across real equivalents", () => {
    const names = new Set(languages.flatMap((lang) => readdirSync(join(content, "articles", lang))));
    expect(names.size).toBeGreaterThan(0);
    for (const name of names) {
      const topics = (lang: string) => {
        const markdown = readFileSync(join(content, "articles", lang, name), "utf8");
        const raw = /^topics: \[([^\]]+)\]$/m.exec(markdown)?.[1];
        expect(raw, `${lang}/${name} topics`).toBeDefined();
        const values = raw?.split(",").map((value) => value.trim()) ?? [];
        expect(values.length, `${lang}/${name} topics`).toBeGreaterThan(0);
        expect(values.length, `${lang}/${name} topics`).toBeLessThanOrEqual(5);
        expect(values, `${lang}/${name} normalized topics`).toEqual(values.map((value) => value.toLowerCase()).sort());
        return values;
      };
      const available = languages.filter((lang) => existsSync(join(content, "articles", lang, name)));
      const [firstLang, ...otherLangs] = available;
      if (!firstLang) throw new Error(`No article found for ${name}`);
      const expected = topics(firstLang);
      for (const lang of otherLangs) expect(topics(lang), `${lang}/${name} topics match`).toEqual(expected);
    }
  });
});
