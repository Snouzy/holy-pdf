# Web: footer pages, design

_Written on 2 October 2026. Status: shipped in `apps/web/`. Model: the "About", "Privacy" and "Terms" pages of workout.cool (`content/<page>/<language>.mdx`, centered template, text in `prose`), adapted to the Astro site._

## Context

The footer has five columns of links (see the [design system spec](2026-09-30-web-design-system-design.md)). Thirteen links point to `#`, because their pages do not exist yet (choice of 1 October 2026): What's new, FAQ, Blog, PDF guides, Mac app, iPhone app, Privacy, Terms of use, Legal notice, Cookies, About, Contact, Press.

On 2 October, the decision was to make all these pages, as on workout.cool, and to reuse its elements: the publisher, the host, the contact address, the outline of the "About" page.

What Holy PDF does not take from workout.cool: the accounts, the payment, the terms of sale, the Ezoic advertising and its cookies. Holy PDF has none of these. The site sets no cookie and loads no analytics tool; it keeps only two keys in `localStorage` (`theme`, `view`).

## Goal and success criteria

Each footer link, apart from the social networks, leads to a real page, in French and in English.

The spec succeeds when:

- the 12 pages and the first 2 articles exist in both languages;
- the footer has no `#` any more, except on the social network icons;
- to add a page, an article or a language, you only touch the files described in the "Add content" section;
- these pages load no JavaScript beyond the JavaScript of `Base.astro`;
- the tests of the Tests section pass.

## Scope

**In the spec:** the 12 pages, the 2 articles, the template, the two collections, the two routes, the footer links, the tests and the wiki.

**Out of the spec:** the social network links (accounts to create), a contact or sign-up form (no server), an RSS feed, other articles, search in these pages, the purchase of the domain and the e-mail routing.

## Decisions

| Topic | Decision | Reason |
|---|---|---|
| Format | Markdown with frontmatter, Astro collections | Same model as `content/tools`. MDX would add `@astrojs/mdx` with no need: no page puts a component in its text. |
| Slugs | In `src/sitePages.ts`, like `tools.ts` | The links are typed: `pagePath("privacy", lang)` does not compile for an unknown page. One more language forces a slug for each page. |
| Mac and iPhone | A single "Apps" page, sections `#mac` and `#iphone` | Two "soon" pages would be two thin pages. |
| Missing content | A real minimal content everywhere | Choice of the author: no empty "in meditation" page. |
| E-mail address | `hello@holy-pdf.com` | Like `hello@workout.cool`. It works once the domain is bought and Cloudflare Email Routing is set up. |
| Publisher | Snouzylabs S.R.L., a company under Romanian law that also publishes workout.cool, Mathias BRADICEANU as publication director (decision of 5 October 2026) | LCEN, art. 6-III-1: a professional publisher gives its company name, its registered office, its phone number, its share capital, its registration (CUI) and the name of the publication director. Registered office, phone number, capital and CUI are to be added as soon as the author sends them |
| Template labels | `src/i18n/pages.ts`, separate from `fr.ts` and `en.ts` | `Board.tsx` imports the whole dictionaries: these labels have no place in the JavaScript of the tool pages (same trap as `frSearch`). |

## Addresses

`src/sitePages.ts` exports `pageIds`, the `sitePages` table (slug per language, emoji) and `pagePath(id, lang)`.

| Page | Id | FR | EN | Emoji |
|---|---|---|---|---|
| What's new | `news` | `/fr/nouveautes` | `/en/whats-new` | 🔔 |
| FAQ | `faq` | `/fr/faq` | `/en/faq` | 🙋 |
| Blog | `blog` | `/fr/blog` | `/en/blog` | ✍️ |
| PDF guides | `guides` | `/fr/guides` | `/en/guides` | 🧭 |
| Apps | `apps` | `/fr/applis` | `/en/apps` | 🕯️ |
| Privacy | `privacy` | `/fr/confidentialite` | `/en/privacy` | 🤫 |
| Terms of use | `terms` | `/fr/conditions-utilisation` | `/en/terms` | 📜 |
| Legal notice | `notice` | `/fr/mentions-legales` | `/en/legal-notice` | ⚖️ |
| Cookies | `cookies` | `/fr/cookies` | `/en/cookies` | 🍪 |
| About | `about` | `/fr/a-propos` | `/en/about` | 🙏 |
| Contact | `contact` | `/fr/contact` | `/en/contact` | ✉️ |
| Press | `press` | `/fr/presse` | `/en/press` | 📰 |

An article lives under the page of its section: `/{lang}/{blog or guides slug}/{article slug}`.

| Article | Section | FR | EN |
|---|---|---|---|
| `local-processing` | blog | `/fr/blog/vos-pdf-restent-sur-votre-appareil` | `/en/blog/your-pdfs-stay-on-your-device` |
| `paperwork` | guides | `/fr/guides/preparer-un-dossier-administratif-en-pdf` | `/en/guides/prepare-paperwork-as-one-pdf` |

No page slug may be equal to a tool slug or to `search.json`: a test checks it.

## Collections

`src/content.config.ts` adds two collections to `tools`.

**`pages`**: `src/content/pages/{fr,en}/<id>.md`.

| Field | Type | Role |
|---|---|---|
| `page` | `z.enum(pageIds)` | the page |
| `lang` | `z.enum(languages)` | the language |
| `title` | string, 60 characters at most | `<title>` |
| `description` | string, from 70 to 160 characters | `<meta name="description">` |
| `h1` | string | the visible title, without emoji |
| `lead` | string | the subtitle under the title |
| `updated` | date, optional | "Updated …", on the legal pages |

**`articles`**: `src/content/articles/{fr,en}/<id>.md`. The two languages of an article have the same file name: this is how they pair up for the language switch.

| Field | Type | Role |
|---|---|---|
| `section` | `"blog"` or `"guides"` | the list that shows it |
| `lang` | `z.enum(languages)` | the language |
| `slug` | string of lowercase letters, digits and hyphens | the end of the address |
| `title`, `description`, `h1`, `lead` | as in `pages` | |
| `published` | date | the date of the article |
| `updated` | date, optional | the date of the last edit |

## Routes

- `src/pages/[lang]/[page].astro` builds the 24 pages. Astro 7 keeps the two routes `[lang]/[tool]` and `[lang]/[page]`: each one builds the paths of its `getStaticPaths`, and the development server goes to the next one when the first one does not know the path (`matchAllRoutes`). For `blog` and `guides`, the page adds under its text the list of the articles of its section and its language, from the newest to the oldest.
- `src/pages/[lang]/[section]/[article].astro` builds the articles.

The language switch (`paths` of `Base.astro`) leads to the same page in the other language; for an article, to its counterpart.

## Template

`src/layouts/ContentPage.astro`, on top of `Base.astro`. The top bar, the footer, the theme and the language stay those of the site.

- **Centered header**, as on workout.cool: the `h1`, with the emoji of the page attached to the last word (brand rule); the `lead` under it, in `--ink-soft`, at the size of the tool intro; on the legal pages, "Updated October 2, 2026".
- **The text**: a `.prose` column of 48 rem, centered, as under the tools; `h2` on the left; links in `--accent`, underlined; simple tables.
- **The monks**: on "About", a happy monk, without a halo (the halo is reserved for the logo); on "Apps", the sleeping monk and the "Soon" stamp of the upcoming tools. The other pages have no monk.
- **Blog and Guides**: each article as a card (title, date, `lead`), and the whole card is a link.
- **Article**: under the title, "October 2, 2026 · Mathias Bradiceanu"; at the end, a link to its list.
- **Dates**: formatted at build time by `Intl.DateTimeFormat(lang, { dateStyle: "long" })`.

The template loads no Preact island and no script beyond those of `Base.astro`.

## Structured data

- Each page: `BreadcrumbList` (Holy PDF › the page).
- Each article: `BreadcrumbList` (Holy PDF › Blog or Guides › the article) and `BlogPosting` (`headline`, `description`, `datePublished`, `dateModified`, `author` of type `Person`, `inLanguage`, `url`).
- No `FAQPage`: the general FAQ does not have one, and neither do the tool pages. Replaced the same day by the [home page spec](2026-10-02-web-landing-design.md): each tool page and the FAQ page carry a `FAQPage` (`src/faq.ts`).

The pages go into the sitemap. They do not go into the tool search of the home page.

## Footer

`SiteFooter.astro` keeps `later` for the social network icons only. The other links call `pagePath`; "Mac app (soon)" and "iPhone app (soon)" lead to `pagePath("apps", lang)` followed by `#mac` and `#iphone`. Since 5 October 2026, "Mac app (soon)" reads "Desktop app (soon)", and a "Source code" link leads to the GitHub repository.

## Content

Each page exists in French and in English. The facts come from the wiki. No invented figure: no number of users, no launch date, no development time. No number of tools in the texts: it would change with each tool shipped.

The legal texts are a serious base, not the opinion of a lawyer: they stay in "Texts to review" of the [brand](../product/brand.md).

### Legal

- **Legal notice**: publisher Snouzylabs S.R.L., publication director Mathias BRADICEANU; contact `hello@holy-pdf.com`; host Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, United States; intellectual property: the texts, the code and the illustration files under AGPL-3.0-or-later, the name, the logo and the monk reserved ([BRAND.md](../../BRAND.md)); credits: Bricolage Grotesque and Figtree (SIL Open Font License), Simple Icons (CC0), PDFium and qpdf, with a link to `/licenses/`. On 5 October 2026, the credits also name @embedpdf/pdfium, Tesseract, OpenCV, libheif, Caveat, Feather and Lucide, each with a link to its licence file.
- **Privacy**: data controller Snouzylabs S.R.L., represented by Mathias BRADICEANU; the files are processed in the browser and the site never receives them; no account, no analytics tool; Cloudflare processes the technical data of the requests (IP address, browser, requested page) to serve the site and protect it, and transfers this data to the United States under the Data Privacy Framework, to which it is certified; the e-mails received serve only to reply, then they are deleted; rights of access, rectification, erasure and objection; complaint to the CNIL.
- **Terms of use**: free service, without an account, provided "as is", with no guarantee of availability; the user keeps their rights on their documents and stays responsible for them (lawful use, rights on the content); Sign puts a signature image, which is neither an advanced electronic signature nor a qualified signature in the sense of the eIDAS regulation, because there is no certificate; keep your originals; the monks, the texts and the code belong to the project, the third-party components follow their license; the terms can change, with the date at the top; French law.
- **Cookies**: no cookie; a table of the two `localStorage` keys (`theme`: the chosen theme; `view`: the compact view of the home page), which stay on the device and are never sent; how to clear them from the browser.

### Holy PDF

- **About**, on the outline of workout.cool: why Holy PDF; the story, taken from the [story of Holy PDF](../product/story.md) and its guidelines; the principle of local processing; who is behind it, Mathias Bradiceanu, also the creator of Workout.cool; write to the monastery.
- **Contact**: the address; for a bug, the browser, the tool and the steps; **never attach a personal document**; a pointer to Press.
- **Press**: Holy PDF in one paragraph; the facts (free, local processing, no account, the tool families); the founder and a link to "About"; the logo to download (`/favicon.svg`); the contact, with "Press" as the subject.

### Product

- **What's new**: a dated log, from the newest to the oldest, taken from the git history: the Organize tools, then Compress and PDF to JPG, then Sign (entry added at the rebase, see Risks). Each entry links to its tools. On 5 October 2026, the log runs to that day: the code published under the AGPL.
- **FAQ**: seven general questions (free, account, files sent, browsers, phone, file size, app), plus the value of the signature at the rebase; then the list of tools, built from `toolList`. Since 5 October 2026, "Is the code open?" makes nine.
- **Apps**: `#mac` presents the Mac scanner from its [spec](2026-09-29-scanner-mac-v1-design.md) (photos of documents become clean, straightened PDFs, one PDF per document); `#iphone` says that it will come later. Both are "Soon", and invite visitors to write to be told. Replaced on 5 October 2026: `#mac` presents the desktop app for Mac and Windows, then Linux, built on the site's code; `#iphone` says that the iPhone app comes after it.

### Resources

- **Blog**, first article, « Comment Holy PDF traite vos PDF sans les envoyer » ("How Holy PDF works on your PDFs without uploading them"): PDFium compiled to WebAssembly, in a Worker; what the network loads all the same (the pages, the engine) and what it never carries (the files); how to check it yourself in the Network tab of the developer tools. It follows the guidelines of [Web version](../development/web-version.md): do not say that the site makes no request.
- **Guides**, first guide, « Préparer un dossier administratif en un seul PDF » ("Prepare your paperwork as a single PDF"): the photos of the papers with JPG to PDF, Merge, Organize, Compress under the required size, then Sign. This is the need of the founding story, and it duplicates no tool page.

## Add content

- **An article**: one `.md` file per language, with the same name, in `src/content/articles/<lang>/`. No TS file to touch.
- **A page**: an id and its slugs in `sitePages.ts`, one `.md` per language, and a link in `SiteFooter.astro` if the page appears there.
- **A language**: the language in `languages` (`tools.ts`); TypeScript then asks for a slug for each page and each tool, and a label in `i18n/pages.ts`; then one `.md` per page and per article.

## Tests

- **Unit**: `tests/unit/sitePages.test.ts` checks that the slugs are safe in an address, unique in a language, and that none is equal to a tool slug or to `search.json`; it also checks the dates, west of UTC as elsewhere. The files of each page and each article in each language are checked in `tests/unit/content.test.ts`, next to those of the tools. `tests/unit/fonts.test.ts` also covers these texts.
- **Browser** (`tests/e2e/pages.spec.ts`):
  - in French and in English, each footer link, apart from the social networks, answers 200 and shows an `h1`;
  - each internal link in the text of the pages and articles answers 200;
  - the language switch leads from `/fr/confidentialite` to `/en/privacy`, and from an article to its counterpart;
  - `/fr/applis#mac` and `#iphone` exist;
  - an article links to its list, and its list links to it;
  - at 390 px, none of these pages scrolls sideways.
- **SEO** (`tests/seo/pages.test.ts`, `pnpm test:seo`): the suite already checks each built page (title, description of at least 70 characters, a single `h1` with its emoji attached, language, `canonical`, `hreflang`, breadcrumb, sitemap). Its count adds the files of `content/pages` and `content/articles`, and a test checks that these pages hydrate no island.
- **Checks**: `pnpm check`, the build, the existing suites. No new Lighthouse budget (light cycle wanted by the author); a one-off measurement of a legal page confirms that it weighs less than the home page.

## Wiki

In the same commit as the code:

- [Web version](../development/web-version.md): a "Content pages" section, with "Add content";
- the [design system spec](2026-09-30-web-design-system-design.md): the footer has no `#` any more outside the social networks;
- the [brand](../product/brand.md): the texts of the pages and articles go into "Texts to review";
- [Tests](../development/tests.md) and the [index](../index.md).

## Risks

- **Cloudflare cookies**: the static site sets none, but a bot protection option can add `__cf_bm`. Check the `Set-Cookie` headers after the first deployment, and correct the Cookies page if needed.
- **Sign**: shipped in the site on 2 October 2026. The pages mention it: its What's new entry, its FAQ question, the Signature section of the Terms, the Press fact, and the credits of qpdf and of the third-party files.
- **E-mail address**: it receives nothing until the domain is bought. The site is not online until then.
