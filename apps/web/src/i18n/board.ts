import type { Lang } from "../tools";
import { en } from "./en";
import { type BoardTexts, fr } from "./fr";

/** The board's texts only: importing the whole of `dictionaries` would bundle every page's texts into each tool page. */
export const boardTexts: Record<Lang, BoardTexts> = { fr, en };
