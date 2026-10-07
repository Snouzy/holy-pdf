import type { Section } from "../sitePages";
import { type Lang, locales } from "../tools";

const fr = {
  updated: "Mis à jour le",
  published: "Publié le",
  readingTime: (minutes: number) => `${minutes} min de lecture estimée`,
  breadcrumbs: "Fil d’Ariane",
  contents: "Dans cet article",
  readingProgress: "Progression de la lecture",
  related: "Articles similaires",
  back: { blog: "Tous les articles du blog", guides: "Tous les guides" } satisfies Record<Section, string>,
  toolQuestions: "Les questions sur chaque outil",
};

export type PageTexts = typeof fr;

const en: PageTexts = {
  updated: "Updated",
  published: "Published",
  readingTime: (minutes) => `${minutes} min estimated read`,
  breadcrumbs: "Breadcrumb",
  contents: "In this article",
  readingProgress: "Reading progress",
  related: "Related articles",
  back: { blog: "All blog posts", guides: "All guides" },
  toolQuestions: "Questions about each tool",
};

const ptBR: PageTexts = {
  updated: "Atualizado em",
  published: "Publicado em",
  readingTime: (minutes) => `${minutes} min de leitura estimada`,
  breadcrumbs: "Trilha de navegação",
  contents: "Neste artigo",
  readingProgress: "Progresso da leitura",
  related: "Artigos relacionados",
  back: { blog: "Todos os artigos do blog", guides: "Todos os guias" },
  toolQuestions: "As perguntas sobre cada ferramenta",
};

export const pageTexts: Record<Lang, PageTexts> = { fr, en, "pt-br": ptBR };

export function formatDate(date: Date, lang: Lang): string {
  // Frontmatter dates are UTC midnight: the local time zone would show the day before west of UTC.
  return new Intl.DateTimeFormat(locales[lang], { dateStyle: "long", timeZone: "UTC" }).format(date);
}
