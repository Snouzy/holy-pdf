import type { Lang } from "./tools";

/** A page shows the film only in the languages it is recorded in. */
export const films: Partial<Record<Lang, { src: string; poster: string }>> = {
  fr: { src: "/videos/holy-pdf-fr.mp4", poster: "/videos/holy-pdf-fr.webp" },
  en: { src: "/videos/holy-pdf-en.mp4", poster: "/videos/holy-pdf-en.webp" },
};
