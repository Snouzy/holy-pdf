import type { Lang } from "../tools";
import { en, enSearch } from "./en";
import { enSite } from "./enSite";
import { type Dictionary, fr, frSearch, type SearchTexts } from "./fr";
import { frSite, type SiteDictionary } from "./frSite";

export const dictionaries: Record<Lang, Dictionary & SiteDictionary> = { fr: { ...frSite, ...fr }, en: { ...enSite, ...en } };
export const searchTexts: Record<Lang, SearchTexts> = { fr: frSearch, en: enSearch };
