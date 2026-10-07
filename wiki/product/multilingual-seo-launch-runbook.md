# Multilingual SEO launch runbook

Holy PDF is **one multilingual website**, not a group of separate sites. Each locale lives under its own path (`/fr/`, `/en/`, `/pt-br/`) and shares the same product, codebase and brand. SEO research and editorial decisions are nevertheless made independently for each language and market.

## Principles

- Do not translate a keyword map or editorial calendar mechanically.
- Research queries, volumes, intent, SERPs and competitors for each target market.
- A topic may exist in several languages only when demand and intent justify it in each market.
- Connect equivalent pages with reciprocal `hreflang` only when they satisfy the same intent.
- Keep one self-referencing canonical per localized URL. Do not canonicalize localized pages to another language.
- Do not advertise a language until its routes, interface, content, fonts and tests are complete.

## 1. Publication gate for a locale

A locale becomes indexable only when all of the following are true:

- its routes and slugs resolve without redirects or 404s;
- the interface and component-local strings are complete;
- titles, descriptions, headings and internal links are localized;
- canonical, reciprocal `hreflang` and `x-default` are correct;
- the sitemap contains only publishable URLs;
- the shipped font subsets cover every character used by the locale;
- content schemas, type checking, unit tests, build and rendered SEO checks pass;
- representative tool and content pages have been checked on desktop and mobile.

A partially integrated locale stays out of navigation, alternates and sitemaps.

## 2. Keyword ownership by market

Maintain one keyword map per language and country. For every candidate query, record:

1. measured demand and source;
2. current SERP intent and dominant result type;
3. the single Holy PDF URL that owns the intent;
4. useful variants and entities;
5. supporting internal links;
6. the expected conversion action;
7. the date of the evidence.

If the SERP is dominated by tools, strengthen the tool page instead of publishing a generic article. Avoid two Holy PDF pages competing for the same intent in one locale.

The initial researched pt-BR transaction priorities are:

1. `juntar PDF`;
2. `comprimir PDF`;
3. `PDF para Word`;
4. `JPG para PDF`;
5. `editar PDF`;
6. `assinar PDF`;
7. `OCR PDF`;
8. `digitalizar para PDF`.

This ordering does not automatically apply to French or English.

## 3. Launch content

Lead with transactional tool pages. Each localized tool page needs:

- a market-native title, description and H1;
- short copy that explains the exact operation and its limits;
- exact interface labels;
- useful FAQs without unsupported legal, performance or absolute claims;
- links to the next likely tools;
- an immediate path to processing the file.

Do not fill the blog for appearance. Launch with zero to four high-confidence guides per market, only after validating the SERP and identifying the tool page they support.

## 4. Editorial workflow

For every proposed article:

1. research the target locale independently;
2. confirm that no existing page owns the intent;
3. inspect the current SERP and choose the matching format;
4. define the primary tool page and conversion path;
5. write natively for that market rather than translating another article;
6. add incoming and outgoing internal links;
7. run native-language and rendered-page QA;
8. publish only after human review.

Articles in different languages may share a concept or source material, but their query target, structure, examples, terminology, evidence and metadata may differ.

## 5. Internal-link clusters

Build one cluster per locale. A guide should lead to the relevant transaction page and then to adjacent tools. For example in pt-BR:

```text
digitalizar várias páginas
  → digitalizar para PDF
  → JPG para PDF
  → juntar PDF
  → comprimir PDF
```

Do not send a localized article to another locale's content URL.

## 6. Measurement from day one

Measure by locale and landing page:

- file import started;
- processing started and completed;
- download completed;
- movement to another tool;
- organic clicks, impressions, CTR and average position;
- conversion and failure rates by tool.

Submit and monitor the localized sitemap in Search Console. Segment reporting by language path so growth in one market does not hide weakness in another.

## 7. Post-launch cadence

Do not lock a long editorial calendar before search data exists. After the first three to six weeks:

1. prioritize queries already ranking in positions 5–20;
2. improve visible pages with impressions but weak CTR;
3. strengthen transaction pages before adding broad informational content;
4. fix internal-link gaps and cannibalization;
5. create new pages only when demand, intent and ownership are clear.

Recheck the SERP before every material rewrite. A shared product roadmap does not imply a shared keyword priority or publishing order across locales.
