import { describe, expect, it } from "vitest";
import { formatDate } from "../../src/i18n/pages";
import { articlePath, pageIds, pagePath, sitePages } from "../../src/sitePages";
import { languages, toolList } from "../../src/tools";

describe("site pages", () => {
  it("uses URL-safe slugs", () => {
    for (const id of pageIds) for (const lang of languages) expect(sitePages[id].slug[lang]).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("gives each page its own address, apart from the tools and the search data", () => {
    for (const lang of languages) {
      const taken = [...pageIds.map((id) => sitePages[id].slug[lang]), ...toolList.map((tool) => tool.slug[lang]), "search.json"];
      expect(new Set(taken).size).toBe(taken.length);
    }
  });

  it("builds addresses under the language", () => {
    expect(pagePath("privacy", "fr")).toBe("/fr/confidentialite");
    expect(pagePath("notice", "en")).toBe("/en/legal-notice");
    expect(articlePath("blog", "your-pdfs-stay-on-your-device", "en")).toBe("/en/blog/your-pdfs-stay-on-your-device");
  });
});

describe("page dates", () => {
  it("shows the day written in the file, west of UTC too", () => {
    const zone = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    try {
      expect(formatDate(new Date("2026-10-02"), "fr")).toBe("2 octobre 2026");
      expect(formatDate(new Date("2026-10-02"), "en")).toBe("October 2, 2026");
      expect(formatDate(new Date("2026-10-02"), "pt-br")).toBe("2 de outubro de 2026");
    } finally {
      if (zone === undefined) delete process.env.TZ;
      else process.env.TZ = zone;
    }
  });
});
