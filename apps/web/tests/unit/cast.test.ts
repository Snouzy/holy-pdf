import { describe, expect, it } from "vitest";
import { byCategory } from "../../src/cast";
import { dictionaries } from "../../src/i18n";

const { fr, en } = dictionaries;

describe("cast", () => {
  it("groups the ready and the sleeping monks by category, in the order of the home page", () => {
    expect(byCategory().map(({ category, ready, sleeping }) => [category, ready.length, sleeping.length])).toEqual([
      ["organize", 9, 0],
      ["convert", 4, 1],
      ["edit", 7, 0],
      ["optimize", 5, 0],
      ["security", 2, 0],
    ]);
  });

  it("gives each monk its own name, in each language", () => {
    for (const dictionary of [fr, en]) {
      const names = Object.values(dictionary.monks).map((monk) => monk.name);
      expect(names.filter((name, index) => names.indexOf(name) !== index)).toEqual([]);
    }
  });
});

describe("the category counts", () => {
  it("counts ready and sleeping monks in French", () => {
    expect([[6, 0], [1, 0], [1, 3], [2, 1], [0, 4]].map(([ready, soon]) => fr.home.categoryCount(ready ?? 0, soon ?? 0))).toEqual([
      "6 outils prêts",
      "1 outil prêt",
      "1 prêt, 3 bientôt",
      "2 prêts, 1 bientôt",
      "4 bientôt",
    ]);
  });

  it("counts ready and sleeping monks in English", () => {
    expect([[6, 0], [1, 0], [1, 3], [0, 4]].map(([ready, soon]) => en.home.categoryCount(ready ?? 0, soon ?? 0))).toEqual([
      "6 tools ready",
      "1 tool ready",
      "1 ready, 3 soon",
      "4 soon",
    ]);
  });
});

describe("the monk's counts", () => {
  it("says one file and several pages in French", () => {
    expect(fr.bubble.counts(1, 7)).toBe("1 fichier, 7 pages.");
  });

  it("says several files and one page in French", () => {
    expect(fr.bubble.counts(3, 1)).toBe("3 fichiers, 1 page.");
  });

  it("counts in English", () => {
    expect(en.bubble.counts(1, 1)).toBe("1 file, 1 page.");
    expect(en.bubble.counts(3, 7)).toBe("3 files, 7 pages.");
  });
});
