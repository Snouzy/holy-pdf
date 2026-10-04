import type { Section } from "../sitePages";
import type { Lang } from "../tools";

const fr = {
  updated: (date: string) => `Mis à jour le ${date}`,
  back: { blog: "Tous les articles du blog", guides: "Tous les guides" } satisfies Record<Section, string>,
  toolQuestions: "Les questions sur chaque outil",
};

export type PageTexts = typeof fr;

const en: PageTexts = {
  updated: (date) => `Updated ${date}`,
  back: { blog: "All blog posts", guides: "All guides" },
  toolQuestions: "Questions about each tool",
};

export const pageTexts: Record<Lang, PageTexts> = { fr, en };

export function formatDate(date: Date, lang: Lang): string {
  // Frontmatter dates are UTC midnight: the local time zone would show the day before west of UTC.
  return new Intl.DateTimeFormat(lang, { dateStyle: "long", timeZone: "UTC" }).format(date);
}
