import type { Lang } from "../tools";
import type { BoardTexts } from "./fr";

/** One chunk per language, the island and its texts together: a tool page ships its own, the board fetches another on a language switch. */
export const loadBoardTexts: Record<Lang, () => Promise<BoardTexts>> = {
  fr: () => import("../board/BoardFr").then((module) => module.texts),
  en: () => import("../board/BoardEn").then((module) => module.texts),
  "pt-br": () => import("../board/BoardPtBr").then((module) => module.texts),
};
