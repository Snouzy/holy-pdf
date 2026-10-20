import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dictionaries } from "../../src/i18n";
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
  it("publishes equivalent redaction guides in FR, EN and pt-BR", () => {
    expect(existsSync(join(content, "articles/fr/redact-pdf.md"))).toBe(true);
    expect(existsSync(join(content, "articles/en/redact-pdf.md"))).toBe(true);
    expect(existsSync(join(content, "articles/pt-br/redact-pdf.md"))).toBe(true);
  });

  it("publishes the form-filling guide in FR, EN and pt-BR as equivalent siblings", () => {
    for (const lang of ["fr", "en", "pt-br"]) expect(existsSync(join(content, `articles/${lang}/fill-pdf-form.md`)), lang).toBe(true);
  });

  it("publishes the PDF splitting guide only in its intended pt-BR market", () => {
    expect(existsSync(join(content, "articles/pt-br/como-dividir-um-pdf.md"))).toBe(true);
    expect(existsSync(join(content, "articles/fr/como-dividir-um-pdf.md"))).toBe(false);
    expect(existsSync(join(content, "articles/en/como-dividir-um-pdf.md"))).toBe(false);
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

describe("split interval labels", () => {
  it("uses the singular and plural required by each locale", () => {
    expect(`${dictionaries.fr.board.cutEvery(1)} 1 ${dictionaries.fr.board.cutEveryUnit(1)}`).toBe("Couper par blocs de 1 page");
    expect(`${dictionaries.fr.board.cutEvery(2)} 2 ${dictionaries.fr.board.cutEveryUnit(2)}`).toBe("Couper par blocs de 2 pages");
    expect(`${dictionaries.en.board.cutEvery(1)} 1 ${dictionaries.en.board.cutEveryUnit(1)}`).toBe("Split every 1 page");
    expect(`${dictionaries["pt-br"].board.cutEvery(1)} 1 ${dictionaries["pt-br"].board.cutEveryUnit(1)}`).toBe("Dividir cada 1 página");
  });
});
