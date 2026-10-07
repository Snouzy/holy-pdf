import type { Lang } from "./tools";

export const pageIds = ["news", "faq", "blog", "guides", "apps", "privacy", "terms", "notice", "cookies", "about", "contact", "press"] as const;
export type PageId = (typeof pageIds)[number];

export const sections = ["blog", "guides"] as const satisfies readonly PageId[];
export type Section = (typeof sections)[number];

export const sitePages: Record<PageId, { slug: Record<Lang, string>; emoji: string }> = {
news: { slug: { fr: "nouveautes", en: "whats-new", "pt-br": "novidades" }, emoji: "🔔" },
faq: { slug: { fr: "faq", en: "faq", "pt-br": "faq" }, emoji: "🙋" },
blog: { slug: { fr: "blog", en: "blog", "pt-br": "blog" }, emoji: "✍️" },
guides: { slug: { fr: "guides", en: "guides", "pt-br": "guias" }, emoji: "🧭" },
apps: { slug: { fr: "applis", en: "apps", "pt-br": "aplicativos" }, emoji: "🕯️" },
privacy: { slug: { fr: "confidentialite", en: "privacy", "pt-br": "privacidade" }, emoji: "🤫" },
terms: { slug: { fr: "conditions-utilisation", en: "terms", "pt-br": "termos-de-uso" }, emoji: "📜" },
notice: { slug: { fr: "mentions-legales", en: "legal-notice", "pt-br": "aviso-legal" }, emoji: "⚖️" },
cookies: { slug: { fr: "cookies", en: "cookies", "pt-br": "cookies" }, emoji: "🍪" },
about: { slug: { fr: "a-propos", en: "about", "pt-br": "sobre" }, emoji: "🙏" },
contact: { slug: { fr: "contact", en: "contact", "pt-br": "contato" }, emoji: "✉️" },
press: { slug: { fr: "presse", en: "press", "pt-br": "imprensa" }, emoji: "📰" },
};

export function pagePath(id: PageId, lang: Lang): string {
  return `/${lang}/${sitePages[id].slug[lang]}`;
}

export function articlePath(section: Section, slug: string, lang: Lang): string {
  return `${pagePath(section, lang)}/${slug}`;
}
