import type { Lang } from "../tools";
import { en, enSearch } from "./en";
import { enSite } from "./enSite";
import { type Dictionary, fr, frSearch, type SearchTexts } from "./fr";
import { frSite, type SiteDictionary } from "./frSite";
import { ptBR, ptBRSearch } from "./ptBR";
import { ptBRSite } from "./ptBRSite";

export const dictionaries: Record<Lang, Dictionary & SiteDictionary> = {
  fr: { ...frSite, ...fr },
  en: { ...enSite, ...en },
  "pt-br": { ...ptBRSite, ...ptBR },
};
export const searchTexts: Record<Lang, SearchTexts> = { fr: frSearch, en: enSearch, "pt-br": ptBRSearch };
