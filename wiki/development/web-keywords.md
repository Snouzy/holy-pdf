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

## Editorial market checks

### 19 October 2026 — pt-BR redaction guide catch-up

The pt-BR guide `como-ocultar-informacoes-em-pdf` completes the redaction family already available in French and English. It owns the informational workflow; `/pt-br/ocultar-texto-pdf` remains the transactional owner.

Finalized Search Console data for 18 September–16 October returned early Brazilian impressions for the tool page on `censurar pdf` and `ocultar informações pdf`, one impression each, at average positions 79 and 64. These are discovery signals, not established rankings. DataForSEO returned no dependable volume for the long-tail how-to seeds, so no volume claim is made.

Live mobile SERPs in Brazil were checked independently for `como censurar pdf`, `como ocultar informações no pdf`, and `como tarjar texto pdf`. They mix tools, how-to guides, videos, and an AI overview. The selected guide angle answers the informational need, demonstrates the real pt-BR interface, and links to the existing tool instead of competing with its action intent.

The article uses a language-neutral shared hero and new desktop and mobile screenshots captured from the live pt-BR product with a synthetic PDF. The responsive screenshots contain two real redaction zones and no customer data; the mobile variant keeps the runtime labels readable at 390 px. The guide cites the current product specification, the MCTI tarjamento guide, PortosRio's redaction warning, and Adobe's separate sanitization guidance.

Spanish is not yet present in `languages`, the content collections, or `origin/main`; no Spanish article was added to an obsolete branch. Its catch-up remains blocked on the locale integration rather than being filled with a translation artifact.
