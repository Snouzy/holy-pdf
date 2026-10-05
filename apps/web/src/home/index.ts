import { upcomingIds } from "../cast";
import { dictionaries, searchTexts } from "../i18n";
import { type Lang, toolIds } from "../tools";
import type { SearchIndex } from "./search";

/** Every tool with its names and search words, ready ones first: what `search.json` serves and what the desktop app keeps in memory. */
export function searchIndex(lang: Lang): SearchIndex {
  const t = dictionaries[lang];
  const search = searchTexts[lang];
  return [
    ...toolIds.map((id) => ({ id, ready: true, names: [t.toolNames[id], t.toolShort[id], t.monks[id].name], terms: search.terms[id], label: t.toolShort[id] })),
    ...upcomingIds.map((id) => ({ id, ready: false, names: [t.upcoming[id]], terms: search.terms[id], label: t.upcoming[id] })),
  ];
}
