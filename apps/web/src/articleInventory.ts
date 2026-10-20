import { articlePath, pagePath, type Section } from "./sitePages";
import { type Lang, languages } from "./tools";

export type LocalePaths = Partial<Record<Lang, string>>;

type ArticleInventoryEntry = {
  id: string;
  data: { lang: Lang; section: Section; slug: string };
};

const fileName = (id: string) => id.slice(id.indexOf("/") + 1);

/** Articles with the same content filename are equivalent locale siblings. */
export function articleAlternates(entries: ArticleInventoryEntry[], entry: ArticleInventoryEntry): LocalePaths {
  return Object.fromEntries(
    entries
      .filter((other) => fileName(other.id) === fileName(entry.id))
      .map((sibling) => [sibling.data.lang, articlePath(sibling.data.section, sibling.data.slug, sibling.data.lang)]),
  );
}

/** Where the language switch leads: the sibling when it exists, otherwise the section's list in that language. */
export function articleSwitches(entries: ArticleInventoryEntry[], entry: ArticleInventoryEntry): Record<Lang, string> {
  const alternates = articleAlternates(entries, entry);
  return Object.fromEntries(languages.map((lang) => [lang, alternates[lang] ?? pagePath(entry.data.section, lang)])) as Record<Lang, string>;
}
