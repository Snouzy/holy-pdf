import { describe, expect, it } from "vitest";
import { acceptsKind, languages, toolList, tools } from "../../src/tools";

describe("tools", () => {
  it("has a unique slug per language", () => {
    for (const lang of languages) {
      const slugs = toolList.map((tool) => tool.slug[lang]);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  it("uses URL-safe slugs", () => {
    for (const tool of toolList) {
      for (const lang of languages) expect(tool.slug[lang]).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("accepts PDFs on PDF tools and images on the image tool", () => {
    expect(acceptsKind(tools.merge, "pdf")).toBe(true);
    expect(acceptsKind(tools.merge, "jpeg")).toBe(false);
    expect(acceptsKind(tools["jpg-to-pdf"], "png")).toBe(true);
    expect(acceptsKind(tools["jpg-to-pdf"], "pdf")).toBe(false);
  });

  it("links only to other existing tools", () => {
    for (const tool of toolList) {
      expect(tool.related).not.toContain(tool.id);
      for (const id of tool.related) expect(tools[id]).toBeDefined();
    }
  });
});
