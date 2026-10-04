import { existsSync, readdirSync } from "node:fs";
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
});
