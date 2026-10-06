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
  it("exist in every language, under the same file names", () => {
    const [first, ...others] = languages.map((lang) => readdirSync(join(content, "articles", lang)).sort());
    expect(first?.length).toBeGreaterThan(0);
    for (const names of others) expect(names).toEqual(first);
  });

  it("declares the same normalized topics in every language", () => {
    const [firstLang, ...otherLangs] = languages;
    if (!firstLang) throw new Error("No language configured");
    for (const name of readdirSync(join(content, "articles", firstLang)).sort()) {
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
      const expected = topics(firstLang);
      for (const lang of otherLangs) expect(topics(lang), `${lang}/${name} topics match`).toEqual(expected);
    }
  });
});
