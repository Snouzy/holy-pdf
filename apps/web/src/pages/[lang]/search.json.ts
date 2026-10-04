import type { APIRoute, GetStaticPaths } from "astro";
import { upcomingIds } from "../../cast";
import type { SearchIndex } from "../../home/search";
import { dictionaries, searchTexts } from "../../i18n";
import { type Lang, languages, toolIds } from "../../tools";

export const getStaticPaths = (() => languages.map((lang) => ({ params: { lang }, props: { lang } }))) satisfies GetStaticPaths;

export const GET: APIRoute<{ lang: Lang }> = ({ props: { lang } }) => {
  const t = dictionaries[lang];
  const search = searchTexts[lang];
  const index: SearchIndex = [
    ...toolIds.map((id) => ({ id, ready: true, names: [t.toolNames[id], t.toolShort[id], t.monks[id].name], terms: search.terms[id], label: t.toolShort[id] })),
    ...upcomingIds.map((id) => ({ id, ready: false, names: [t.upcoming[id]], terms: search.terms[id], label: t.upcoming[id] })),
  ];
  return new Response(JSON.stringify(index));
};
