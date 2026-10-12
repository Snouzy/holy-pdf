import { articlePath, type Section } from "./sitePages";
import type { Lang } from "./tools";

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
