# Web version: keywords

_Created on 30 September 2026. Volumes not verified: no volume source was available that day. The URLs stay those of the spec. Redo before the public launch, with a keyword research tool._

_5 October 2026: not redone yet, and the site is not online. The table covers only the first seven tools. Update, 6 October 2026: the site is online at holy-pdf.com, open to search engines since the same day._

| Tool | Language | Kept URL | Candidates to compare | Volume |
|---|---|---|---|---|
| merge | fr | `/fr/fusionner-pdf` | fusionner pdf, fusionner des pdf, combiner pdf, assembler pdf | not verified |
| merge | en | `/en/merge-pdf` | merge pdf, combine pdf, merge pdf files | not verified |
| split | fr | `/fr/diviser-pdf` | diviser pdf, séparer pdf, couper pdf, scinder pdf | not verified |
| split | en | `/en/split-pdf` | split pdf, separate pdf pages | not verified |
| organize | fr | `/fr/organiser-pdf` | organiser pdf, réorganiser pages pdf, déplacer pages pdf | not verified |
| organize | en | `/en/organize-pdf` | organize pdf, rearrange pdf pages, reorder pdf pages | not verified |
| delete-pages | fr | `/fr/supprimer-pages-pdf` | supprimer pages pdf, supprimer une page pdf | not verified |
| delete-pages | en | `/en/delete-pdf-pages` | delete pages from pdf, remove pages from pdf, delete pdf pages | not verified |
| extract-pages | fr | `/fr/extraire-pages-pdf` | extraire pages pdf, extraire une page d'un pdf | not verified |
| extract-pages | en | `/en/extract-pdf-pages` | extract pdf pages, extract pages from pdf | not verified |
| rotate | fr | `/fr/pivoter-pdf` | pivoter pdf, rotation pdf, tourner pdf | not verified |
| rotate | en | `/en/rotate-pdf` | rotate pdf | not verified |
| jpg-to-pdf | fr | `/fr/jpg-en-pdf` | jpg en pdf, convertir jpg en pdf, image en pdf | not verified |
| jpg-to-pdf | en | `/en/jpg-to-pdf` | jpg to pdf, convert jpg to pdf, image to pdf | not verified |

To change a URL: `apps/web/src/tools.ts` (`slug`), then the `title` and the `h1` of the tool's text in `apps/web/src/content/tools/`.

## Searchable scanned PDFs (2 November 2026)

The OCR tool remains the owner of the transactional `OCR PDF` intent. Its French and English title and H1 lead with that transactional phrase. The paired guide file `searchable-pdf.md` owns the diagnostic workflow: confirm that a scan has no text, run OCR, then verify search and copied text in the downloaded file.

| Market | Tool owner | Guide | Evidence used for the guide |
|---|---|---|---|
| France | `/fr/ocr-pdf` | `/fr/guides/rendre-un-pdf-scanne-recherchable` | 26 October DataForSEO: `ocr pdf`, 3,600 monthly searches, KD 0; the 2 November mobile long-tail SERP mixed explainers and OCR tools |
| United States | `/en/ocr-pdf` | `/en/guides/how-to-make-a-pdf-searchable` | 26 October DataForSEO: `make pdf searchable`, 1,900 monthly searches, KD 9; `searchable pdf`, 2,400, KD 8; the 2 November US and UK mobile SERPs mixed how-to pages and OCR tools |
| Brazil | `/pt-br/ocr-pdf` | `/pt-br/guias/como-tornar-pdf-pesquisavel` | 26 October DataForSEO: `tornar pdf pesquisável`, 1,900 monthly searches, KD 0; the 2 November mobile SERP mixed tools and explanatory results |

Finalized GSC for 3–30 October records 43 impressions, no clicks and average position 65.9 for `/pt-br/ocr-pdf`; this is an early demand signal, not established traffic. No FR or EN OCR owner row was returned. GA4 returned no Organic Search landing-page rows for 5 October–1 November.

Do not add a Spanish sibling until the product has a complete `/es` locale and verified Spanish OCR behavior. The 2 November repository check still found no Spanish route owner. The Mexico SERP was mixed, while the Spain refresh failed at the provider and therefore remains unconfirmed for this run.

## Tool pages: wording decisions

### 24 October 2026 — pt-BR "cortar" and "recortar"

In Brazil, "cortar" names two different actions. Live Google results in Brazil (DataForSEO through treg, 24 October 2026) show split tools for `cortar pdf` (33,100/month, KD 99) and `cortar página de pdf`: Sejda, Lumin and Smallpdf split pages lead, and crop pages appear only at positions 7 and 9. Crop pages fill the results for `recortar pdf` (8,100/month, KD 92, ten crop pages out of ten), `cortar pdf grátis` (70/month) and `cortador de pdf gratuito` (`cortador de pdf` 260/month). Volumes: SE Ranking, Brazilian database, same day.

Decision:

- Crop leads with "Recortar": short name, tool name, title and H1 of `/pt-br/cortar-pdf`. "cortar" stays in its title for the crop long tail. The slug does not change: the page is the site's most-shown URL in Search Console, and "cortar" is a correct crop word that Adobe, pdf24 and Xodo use for their Brazilian crop pages.
- Split carries "cortar" in its description and in an FAQ entry that tells the two actions apart. Each page links to the other in its body text.

Review with Search Console 60 days after deployment: impressions of `/pt-br/cortar-pdf` on the `recortar` queries, and of `/pt-br/dividir-pdf` on the `cortar` queries.

### 7 November 2026 — pt-BR OCR says "em português"

Since 22 October 2026 the Brazilian OCR page reads Brazilian Portuguese and English (`readLanguages` in `src/ocr/reader.ts`), but its title, description and H1 did not say so, and the Brazilian form-filling guide still said the opposite. Demand in Brazil: `ocr pdf` 10,800/month, KD 100 (SE Ranking) and 12,100/month, KD 46 (Serpstat), stable since March 2026; `converter pdf em ocr` 30 (SE Ranking) and 1,900 (Serpstat); `ocr pdf online` 720 (Serpstat); volumes through treg, 7 November 2026, not summed. Search Console, 9 October to 5 November 2026 (`dataState: all`): `/pt-br/ocr-pdf` had 43 impressions, no click and an average position of 65.9; by query, 21 rows and 37 impressions, led by `pdf ocr` and `pdf ocr gratuito` (4 each), `ocr online pdf`, `ocr pdf`, `ocr pdf online` and `pdf para ocr` (3 each); six queries say "grátis", "gratuito" or "free" (10 impressions), five say "converter", "para", "transformar" or "passar" (7 impressions). The Brazilian results for `ocr pdf` (google.com.br, desktop, 7 November 2026) are eight online OCR tools, a Microsoft Store app and a Google Cloud page: the query stays on the tool page, no guide.

Decision:

- The title becomes "OCR PDF em português online grátis" and the H1 "OCR PDF em português: tornar o texto pesquisável"; the description names the two languages and says the file is not uploaded. None of the three competitor pages read that day puts the language forward.
- The body answers in its first sentence (Portuguese and English, invisible text layer, appearance unchanged), keeps the 50-character rule and links to the Scanner and to the Brazilian scanning guide. Two FAQ entries answer "converter um PDF em OCR" and "grátis".
- The Brazilian form-filling guide now says the OCR reads Portuguese and English.

Review with Search Console 60 days after deployment: impressions and position of `/pt-br/ocr-pdf` on the "português", "grátis" and "converter" variants.

## Guides: researched queries

_SE Ranking volumes through treg, live Google results through treg (crawl4ai), on the date given. A guide owns an informational query; the tool page keeps the transactional one._

| Guide | Market | Primary query | Volume, difficulty (date) | Variants kept in the text | Owner of the transactional query |
|---|---|---|---|---|---|
| `fill-pdf-form` | US | how to fill out a pdf form | 920/month, KD 7 (20 October 2026) | how to fill out a pdf form on mac 480, KD 8; xfa form 480, KD 14; how to fill out a pdf form and save it 10, KD 19 | `/en/edit-pdf` |
| `fill-pdf-form` | FR | remplir un formulaire pdf | 480/month, KD 10 (20 October 2026) | comment remplir un formulaire pdf 170, KD 19; comment remplir un cerfa en ligne 70, KD 0; comment remplir un pdf sur mac 50, KD 9 | `/fr/modifier-pdf` (« remplir un pdf », 1,900, KD 98, is a tool query) |
| `fill-pdf-form` | BR | como preencher um formulário em pdf | 590/month, KD 8 (20 October 2026) | preencher formulario pdf 390, KD 7; como preencher pdf no celular 170, KD 10; como preencher um pdf no celular 140, KD 19 | `/pt-br/editar-pdf` ("preencher pdf", 5,700, KD 86, and "escrever em pdf", 4,400, KD 85, are tool queries) |
| `password-protect-pdf` | BR | como colocar senha em pdf | 480/month, KD 10 SE Ranking and 480/month, KD 16 Serpstat (2 November 2026) | none kept: "colocar senha em pdf" diverges between the two tools (10 and 720) and is not used | `/pt-br/proteger-pdf` ("proteger pdf com senha", 210/month in both tools, stays on the tool page) |
| `unlock-pdf` | BR | como tirar senha de pdf | 810/month, KD 11 SE Ranking (4 November 2026); no row in Serpstat (3 November 2026) | none kept: "como remover senha de pdf" 880 and "como desbloquear pdf" 260 (Serpstat) are close variants, not summed | `/pt-br/desbloquear-pdf` ("tirar senha de pdf", 6,600 SE Ranking and 8,100 Serpstat, 3 November 2026, stays on the tool page) |
| `combine-photos` | US | how to combine photos into one pdf | 590/month, KD 17 SE Ranking and 590/month, KD 37 Serpstat (6 November 2026), stable since March 2026 | none summed: "how to combine pictures into one pdf" 390 (both tools) is a close variant | `/en/jpg-to-pdf` (the tool page keeps the transactional "jpg to pdf" intent) |

The Brazilian results for "como colocar senha em pdf" (DataForSEO through treg, desktop, 2 November 2026) are three articles, one Microsoft answer, five videos and one Android app, with no tool page at the top and no AI overview: a guide owns it, market-only, with the Protect tool as its head. Search Console (3–31 October 2026) shows no impression on `/pt-br/proteger-pdf` yet, so the guide's first link comes from the tool page itself.

The Brazilian results for "como tirar senha de pdf" (DataForSEO through treg, desktop, 3 November 2026) are two tool pages, three videos, an Apple community thread, wikiHow, a blog, a Reddit thread and a video block, with no AI overview: a guide owns it, market-only, with the Unlock tool as its head. The first result promises to unlock without the password; the guide says in its first sentences that Holy PDF needs the known password, and tells a password-to-open apart from print and copy restrictions, which the tool lifts without any password. Search Console (5 October to 1 November 2026) shows no impression on `/pt-br/desbloquear-pdf` and no query containing "senha".

The US results for "how to combine photos into one pdf" (google.com, English, desktop, 6 November 2026) are an Adobe guide, two Reddit threads, a university PDF, an Apple Discussions thread, two YouTube videos and three tool pages, with an AI overview and "people also ask" questions about the iPhone: a guide owns it, English only for now, with Convert JPG to PDF as its head and Compress PDF and the Scanner as neighbours. The guide says before the tool that HEIC photos are refused and gives the conversion. Search Console (7 October to 3 November 2026) shows no impression on `/en/jpg-to-pdf` or on the query.

### 9 November 2026 — pt-BR photos to one PDF stay on the tool page

In Brazil, `como transformar várias fotos em um único arquivo pdf` has 20 monthly searches and informational intent in DataForSEO; `como juntar várias fotos em um único pdf` returned no metrics row. The mobile results for both queries are dominated by image-to-PDF tools (iLovePDF, Smallpdf, PDF24, Adobe and other converters), with some videos and how-to results, an AI overview and People also ask. A separate guide would repeat the same three-step workflow and compete with `/pt-br/jpg-para-pdf`.

Decision: the tool page remains the sole owner. Its body now answers the full multi-photo workflow, A4 fitting and white-margin behavior, JPEG/PNG quality, HEIC conversion, file-size follow-up and the alternatives for scanned documents or several photos per sheet. The scanning guide links back to this owner for photos that are not paper documents. No pt-BR article sibling is created. The French phrases checked the same day returned no keyword-metrics rows and tool-heavy results, so no French sibling is added either. Spanish remains blocked because `origin/main` still has no `/es` product journey.

The first Brazilian check of 20 October 2026 tried one wording only ("como preencher formulario pdf", no volume); the thirty-wording check later that day found the demand above, with the phone as the main variant. The live Brazilian results for the primary query are tool pages, Google Drive's help, Adobe's how-to, an Android app and videos.

## Editorial market checks

### 19 October 2026 — pt-BR redaction guide catch-up

The pt-BR guide `como-ocultar-informacoes-em-pdf` completes the redaction family already available in French and English. It owns the informational workflow; `/pt-br/ocultar-texto-pdf` remains the transactional owner.

Finalized Search Console data for 18 September–16 October returned early Brazilian impressions for the tool page on `censurar pdf` and `ocultar informações pdf`, one impression each, at average positions 79 and 64. These are discovery signals, not established rankings. DataForSEO returned no dependable volume for the long-tail how-to seeds, so no volume claim is made.

Live mobile SERPs in Brazil were checked independently for `como censurar pdf`, `como ocultar informações no pdf`, and `como tarjar texto pdf`. They mix tools, how-to guides, videos, and an AI overview. The selected guide angle answers the informational need, demonstrates the real pt-BR interface, and links to the existing tool instead of competing with its action intent.

The article uses a language-neutral shared hero and new desktop and mobile screenshots captured from the live pt-BR product with a synthetic PDF. The responsive screenshots contain two real redaction zones and no customer data; the mobile variant keeps the runtime labels readable at 390 px. The guide cites the current product specification, the MCTI tarjamento guide, PortosRio's redaction warning, and Adobe's separate sanitization guidance.

Spanish is not yet present in `languages`, the content collections, or `origin/main`; no Spanish article was added to an obsolete branch. Its catch-up remains blocked on the locale integration rather than being filled with a translation artifact.
