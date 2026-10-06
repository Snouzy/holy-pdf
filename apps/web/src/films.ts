import type { Lang, ToolId } from "./tools";

/** A page shows the film only in the languages it is recorded in. */
export const films: Partial<Record<Lang, { src: string; poster: string }>> = {
  fr: { src: "/videos/holy-pdf-fr.mp4", poster: "/videos/holy-pdf-fr.webp" },
  en: { src: "/videos/holy-pdf-en.mp4", poster: "/videos/holy-pdf-en.webp" },
};

/** The vertical film of a tool, made by `scripts/tool-film.mjs`: `public/videos/tools/<id>-<lang>.mp4` and `<id>.webp`. */
export const toolFilms: Partial<Record<ToolId, { seconds: number; langs: Lang[] }>> = {
  redact: { seconds: 15, langs: ["fr", "en"] },
};

export function toolFilm(id: ToolId, lang: Lang): { src: string; thumb: string; seconds: number } | null {
  const film = toolFilms[id];
  return film?.langs.includes(lang) ? { src: `/videos/tools/${id}-${lang}.mp4`, thumb: `/videos/tools/${id}.webp`, seconds: film.seconds } : null;
}
