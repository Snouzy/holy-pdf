import type { Lang } from "./tools";

export const pageIds = ["news", "faq", "blog", "guides", "apps", "privacy", "terms", "notice", "cookies", "about", "contact", "press"] as const;
export type PageId = (typeof pageIds)[number];

export const sections = ["blog", "guides"] as const satisfies readonly PageId[];
export type Section = (typeof sections)[number];

export const sitePages: Record<PageId, { slug: Record<Lang, string>; emoji: string }> = {
  news: { slug: { fr: "nouveautes", en: "whats-new" }, emoji: "🔔" },
  faq: { slug: { fr: "faq", en: "faq" }, emoji: "🙋" },
  blog: { slug: { fr: "blog", en: "blog" }, emoji: "✍️" },
  guides: { slug: { fr: "guides", en: "guides" }, emoji: "🧭" },
  apps: { slug: { fr: "applis", en: "apps" }, emoji: "🕯️" },
  privacy: { slug: { fr: "confidentialite", en: "privacy" }, emoji: "🤫" },
  terms: { slug: { fr: "conditions-utilisation", en: "terms" }, emoji: "📜" },
  notice: { slug: { fr: "mentions-legales", en: "legal-notice" }, emoji: "⚖️" },
  cookies: { slug: { fr: "cookies", en: "cookies" }, emoji: "🍪" },
  about: { slug: { fr: "a-propos", en: "about" }, emoji: "🙏" },
  contact: { slug: { fr: "contact", en: "contact" }, emoji: "✉️" },
  press: { slug: { fr: "presse", en: "press" }, emoji: "📰" },
};

export function pagePath(id: PageId, lang: Lang): string {
  return `/${lang}/${sitePages[id].slug[lang]}`;
}

export function articlePath(section: Section, slug: string, lang: Lang): string {
  return `${pagePath(section, lang)}/${slug}`;
}
