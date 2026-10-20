# Editorial production workflow

This page is the durable handoff for producing SEO articles and guides for Holy PDF. It describes the evidence expected before a contributor opens a pull request. It does not replace the product specifications or the test suite.

## Where the process comes from

The workflow combines project evidence with external search evidence:

- the repository rules in `CLAUDE.md`, the [technical guide](technical-guide.md), [web version](web-version.md), [tests](tests.md), product specifications, implementation and automated tests;
- the current article inventory, route registry, canonical owners, branches and open pull requests;
- first-party search performance from Google Search Console when available;
- keyword and SERP evidence from OpenSEO/DataForSEO and live search results for the target country and language;
- official or primary sources for legal, administrative, security and technical claims;
- lessons from completed editorial batches, including the French, English and Brazilian Portuguese redaction guides.

Search volumes, SERPs, rankings, product behavior, competitors and public rules can change. Recheck them for every article instead of copying an old brief.

## 1. Choose an opportunity with evidence

Start with queries that already have impressions or rank within reach. Then consider missing commercial pages, tool-led guides and new topics.

Before writing:

1. inspect Search Console data when the property is available;
2. inspect keyword volume, difficulty and intent in the target market;
3. read the live SERP and record the dominant result type;
4. inspect the existing content inventory, canonical owners, branches and pull requests;
5. decide whether to improve an existing URL or create a new one.

A transactional query normally belongs to a tool page. An informational workflow may belong to a guide. Do not create an article that competes with an existing Holy PDF owner.

Every article needs a useful conversion path to an existing Holy PDF tool. Do not invent a tool, route or product capability to justify a topic.

## 2. Research each market independently

A localized article is native market copy, not a mechanical translation.

For every target locale, verify:

- the wording people actually search for in that country;
- the intent and page formats represented in its SERP;
- local terminology, examples and official sources;
- the correct Holy PDF route and runtime labels;
- whether an equivalent article is useful in the other markets.

Equivalent siblings may share a topic and broad structure, but their title, description, H1, outline, examples, sources and internal links are written for their own market. Create `hreflang` relationships only between pages that answer the same intent. Follow the sparse-inventory rules in the [technical guide](technical-guide.md#localized-editorial-inventories).

## 3. Build an evidence ledger before drafting

Keep a reviewable ledger outside the reader-facing prose. For every load-bearing claim, record:

- the exact claim;
- its official, primary or repository source;
- the date checked;
- any condition, exception or limitation;
- the section of the article that uses it.

Product claims must be checked against the current implementation, specifications and tests. Marketing copy alone is not sufficient proof. Verify what the tool changes, preserves, rejects and cannot guarantee.

Prefer official sources for legal, public-administration, security and standards claims. If a claim cannot be verified, remove it or state the uncertainty honestly. Do not invent performance gains, guarantees, customer evidence or comparisons.

The ledger is an internal QA artifact. Reader-facing articles use natural links and, when useful, a final “Official sources” section. Do not expose internal markers such as `[unverified]` or raw research notes.

## 4. Prepare the editorial and visual brief

Define before writing:

- target market and locale;
- primary query, variants and search intent;
- canonical URL owner;
- title, meta description and H1;
- proposed H2/H3 outline;
- destination tool and conversion action;
- incoming and outgoing internal links;
- required official sources;
- screenshots, diagrams or hero assets;
- equivalent locale siblings, if any.

Inspect the visuals used by useful ranking pages. Reuse the format that helps the reader, not their artwork.

For product tutorials, capture the real Holy PDF interface. Use only synthetic documents and never commit customer files or private fixtures. Generated art may illustrate a concept or provide an original hero, but it must not impersonate the product interface or act as proof of a feature.

## 5. Draft for the reader

Write concise, concrete copy that answers the query early. Explain the workflow, the conditions and the limits before promotional language.

Use:

- short paragraphs and descriptive headings;
- steps that match the current interface;
- exact runtime button labels;
- examples that a reader can reproduce;
- an explicit distinction between what the tool does and what it does not do;
- a relevant link to the tool rather than repeated generic calls to action.

Avoid filler, keyword repetition, unsupported superiority, invented setup times and claims inferred only from a competitor's wording.

## 6. Integrate the article correctly

Article Markdown lives under `apps/web/src/content/articles/<lang>/`. Follow the existing frontmatter schema and use one to five normalized, language-independent `topics`.

Before considering the implementation complete, verify:

- self-referential canonical URL;
- reciprocal `hreflang` only for real equivalent siblings;
- English `x-default` only when the English sibling exists;
- localized title, description, slug, visible breadcrumb and internal links;
- `BlogPosting` and `BreadcrumbList` parity with the visible page;
- editorial image URL, dimensions and useful alternative text when an image exists;
- same-language related articles;
- a valid path to the relevant Holy PDF tool;
- indexability and sitemap inclusion.

Shared editorial assets belong under `apps/web/public/articles/<article>/`. Optimize them and keep language-specific screenshots separate when their interface copy differs.

## 7. Verify sources, prose and visuals separately

Run three distinct reviews:

1. **Evidence review:** every material claim is supported and no limitation was lost between the ledger and the article.
2. **Editorial and native-language review:** the copy is natural, consistent in register, free of source-language leftovers and appropriate for its market.
3. **Visual review:** every screenshot matches the current product, uses synthetic data, remains readable at its rendered desktop and mobile sizes and has accurate alternative text.

Any content change after a review invalidates the affected review. Rerun it on the final bytes.

## 8. Test the rendered page

Do not approve only the Markdown source. Build and open the actual route on desktop and mobile.

Check visible content and generated HTML for:

- title and meta description;
- canonical, `hreflang`, Open Graph and JSON-LD;
- breadcrumbs, table of contents, dates and author;
- broken, wrong-locale or invented links;
- raw research or citation tokens;
- responsive overflow and unreadable screenshots;
- image dimensions and alternative text;
- the conversion path to the tool.

From the repository root, run at least:

```sh
pnpm verify
git diff --check
```

Use `pnpm verify:full` when the change touches layout, fonts, load budgets or the engine. See [Tests](tests.md) for the current scope of each command. Run targeted product tests when the article makes detailed claims about a specific tool.

Also scan the intended diff for secrets, private files and prompt-injection artifacts. The public repository must never receive real customer documents or credentials.

## 9. Deliver through review

Keep the branch and pull request focused on the intended editorial batch. Before pushing:

1. review the exact diff and file scope;
2. confirm that tests and reviews ran on the final content;
3. commit only reviewed article files, assets, tests and same-change wiki updates;
4. push the branch and open a pull request ready for review, not a draft;
5. include market research, sources, product checks, screenshots and test evidence in the pull-request description.

Do not describe a merge as a deployment. After human approval and merge, verify the canonical production URL and its assets rather than assuming the live site already serves the new revision.

## Pull-request evidence checklist

- [ ] Existing owner, branches and pull requests checked
- [ ] Market-specific keyword and SERP research recorded
- [ ] Official or primary sources recorded in an evidence ledger
- [ ] Product claims checked against implementation, specifications and tests
- [ ] Native-language editorial review passed
- [ ] Real product visuals reviewed at desktop and mobile sizes
- [ ] Canonical, `hreflang`, structured data, sitemap and internal links checked
- [ ] `pnpm verify` passed on the final bytes
- [ ] `git diff --check` passed
- [ ] Secrets, private documents and unrelated files absent from the diff
- [ ] Pull request is focused and ready for review
