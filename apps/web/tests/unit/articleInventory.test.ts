import { describe, expect, it } from "vitest";
import { articleAlternates, articleSwitches } from "../../src/articleInventory";

const articles = [
  { id: "fr/redaction", data: { lang: "fr" as const, section: "guides" as const, slug: "comment-caviarder-un-pdf" } },
  { id: "en/redaction", data: { lang: "en" as const, section: "guides" as const, slug: "how-to-redact-a-pdf" } },
  { id: "pt-br/only-here", data: { lang: "pt-br" as const, section: "blog" as const, slug: "somente-aqui" } },
];

describe("article locale inventory", () => {
  it("links only real equivalent siblings", () => {
    expect(articleAlternates(articles, articles[0]!)).toEqual({
      fr: "/fr/guides/comment-caviarder-un-pdf",
      en: "/en/guides/how-to-redact-a-pdf",
    });
  });

  it("keeps a single-market article self-referential without invented siblings", () => {
    expect(articleAlternates(articles, articles[2]!)).toEqual({ "pt-br": "/pt-br/blog/somente-aqui" });
  });

  it("switches to the sibling when it exists, otherwise to the section's list in that language", () => {
    expect(articleSwitches(articles, articles[0]!)).toEqual({
      fr: "/fr/guides/comment-caviarder-un-pdf",
      en: "/en/guides/how-to-redact-a-pdf",
      "pt-br": "/pt-br/guias",
    });
    expect(articleSwitches(articles, articles[2]!)).toEqual({ fr: "/fr/blog", en: "/en/blog", "pt-br": "/pt-br/blog/somente-aqui" });
  });
});