import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lastModified } from "../../src/lastmod";
import { pageIds, pagePath } from "../../src/sitePages";
import { languages, toolIds } from "../../src/tools";

const content = join(import.meta.dirname, "../../src/content");
const dates = lastModified(content);

describe("lastmod", () => {
  it("dates every tool, page and article, and nothing else", () => {
    const articles = languages.reduce((count, lang) => count + readdirSync(join(content, "articles", lang)).length, 0);
    expect(dates.size).toBe(languages.length * (toolIds.length + pageIds.length) + articles);
    for (const date of dates.values()) expect(date).toMatch(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}\.\d{3}Z)?$/);
    expect(dates.get("/fr/blog/vos-pdf-restent-sur-votre-appareil")).toBeDefined();
    expect(dates.has("/fr")).toBe(false);
  });

  it("prefers the date the content declares", () => {
    const declared = /^updated: (\S+)$/m.exec(readFileSync(join(content, "pages/fr/privacy.md"), "utf8"))?.[1];
    expect(declared).toBeDefined();
    expect(dates.get(pagePath("privacy", "fr"))).toBe(declared);
  });

  it("falls back to the last commit of the Markdown", () => {
    const commit = execFileSync("git", ["log", "-1", "--format=%cI", "--", "tools/fr/merge.md"], { cwd: content, encoding: "utf8" }).trim();
    expect(commit).not.toBe("");
    expect(dates.get("/fr/fusionner-pdf")).toBe(new Date(commit).toISOString());
  });
});
