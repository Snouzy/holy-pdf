import { describe, expect, it } from "vitest";
import { upcomingIds } from "../../src/cast";
import { searchIndex } from "../../src/home/index";
import { languages, toolIds } from "../../src/tools";

describe("searchIndex", () => {
  it.each(languages)("lists every tool, ready ones first, each with names, words and a label (%s)", (lang) => {
    const index = searchIndex(lang);
    expect(index.map((entry) => entry.id)).toEqual([...toolIds, ...upcomingIds]);
    expect(index.filter((entry) => entry.ready).map((entry) => entry.id)).toEqual([...toolIds]);
    for (const entry of index) {
      expect(entry.names.length).toBeGreaterThan(0);
      expect(entry.terms.length).toBeGreaterThan(0);
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });
});
