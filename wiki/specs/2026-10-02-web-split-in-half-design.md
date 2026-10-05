# Web: Split the pages in half

_Written and shipped on 2 October 2026._

Brother Trimmer (`/fr/couper-pages-en-deux`, `/en/split-pages-in-half`) cuts each page of one or more PDFs into two consecutive pages: left then right (the default, for a scanned open book), or top then bottom.

## Engine

Operation `halves` of the `transform` request (`engine/sheets.ts`): a new document imports each page twice in a single call (shared resources copied once), then each copy gets the half that belongs to it as its MediaBox and CropBox. The half is computed on the page as the reader sees it (`pageFrame`): a rotated page is cut in the reading direction. The pages stay vector; a signed PDF is accepted, as for Pages per sheet.

## Limit

The annotations and form fields of the original do not follow.

## Tests

- Engine (`tests/engine/halves.test.ts`): size of each half and a word visible in each, read back by pdf.js, for both cuts.
- Browser (`tests/e2e/split-in-half.spec.ts`): 2 pages cut top and bottom give 4 landscape pages.
