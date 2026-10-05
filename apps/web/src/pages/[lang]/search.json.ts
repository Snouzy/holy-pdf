import type { APIRoute, GetStaticPaths } from "astro";
import { searchIndex } from "../../home/index";
import { type Lang, languages } from "../../tools";

export const getStaticPaths = (() => languages.map((lang) => ({ params: { lang }, props: { lang } }))) satisfies GetStaticPaths;

export const GET: APIRoute<{ lang: Lang }> = ({ props: { lang } }) => new Response(JSON.stringify(searchIndex(lang)));
