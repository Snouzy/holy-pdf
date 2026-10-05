# Web: Pages per sheet

_Written and shipped on 2 October 2026._

Brother Mosaic (`/fr/pages-par-feuille`, `/en/pages-per-sheet`) lays 2, 4, 6, 9 or 16 pages of one or more PDFs on each A4 sheet, in reading order. With 2 or 6 pages, the sheet is landscape (2 × 1, 3 × 2) so that each page keeps a portrait cell; with 4, 9 or 16, it is portrait (2 × 2, 3 × 3, 4 × 4).

## Engine

Operation `nup` of the `transform` request (`engine/sheets.ts`): `FPDF_ImportNPagesToOne` builds a new document, which is saved then closed. The pages in it are scaled-down objects, not images: the text stays selectable. The new document carries no signature field: a signed PDF is accepted, and its signature is neither invalidated nor copied.

## Limits

A4 sheet only. The annotations and form fields of the original do not carry over to the sheets.

## Tests

- Engine (`tests/engine/nup.test.ts`): 4 pages per portrait A4 sheet, 2 per landscape sheet, reading order read back by pdf.js.
- Browser (`tests/e2e/pages-per-sheet.spec.ts`): 3 pages on 2 landscape sheets.
