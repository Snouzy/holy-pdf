import type { Lang, Tool } from "./tools";

export const siteName = "Holy PDF";
export const sourceUrl = "https://github.com/Snouzy/holy-pdf";

export function toolPath(tool: Tool, lang: Lang): string {
  return `/${lang}/${tool.slug[lang]}`;
}

export function homePath(lang: Lang): string {
  return `/${lang}`;
}

export function alternates(pathFor: (lang: Lang) => string): Record<Lang, string> {
  return { fr: pathFor("fr"), en: pathFor("en") };
}
