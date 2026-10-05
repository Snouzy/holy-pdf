import type { APIRoute } from "astro";

/** The sitemap's address follows `SITE_URL`, so a fork's robots.txt points at its own sitemap. */
export const GET: APIRoute = ({ site }) => new Response(`User-agent: *\nAllow: /\n\nSitemap: ${new URL("sitemap-index.xml", site)}\n`);
