# Web: Add page numbers to a PDF

_Written and shipped on 2 October 2026. Same settings as the Mac app ([Mac spec](2026-10-02-mac-page-numbers-design.md))._

## What the tool does

Brother Folio (`/fr/numeroter-pdf`, `/en/page-numbers-pdf`) writes a number on the pages of a PDF, one file at a time:

- format "1", "1 / 12" or "Page 1";
- six positions, top or bottom, left, center or right, 24 points from the edge;
- first number from 0 to 9,999, size from 6 to 36 points;
- all pages, or a range. The first page of the range gets the first number; in "1 / 12", the total is the last number written.

## Engine

An operation `numbers` of the `transform` request (`engine/numbers.ts`). The number is real text in Helvetica, the standard PDFium font, added to the page content: it stays selectable, and so does the original text. Its axes follow the page as the reader sees it (`pageFrame`, shared with Sign): the number is upright and in the right corner on a rotated or cropped page. The end of the range is clamped to the last page.

## Limits

- No live preview: you see the result after the numbering, in the downloaded PDF.
- One file at a time, so that the range is set on the pages of the open document.

## Tests

- Engine (`tests/engine/numbers.test.ts`): text of each format, first number and range read by pdf.js; position read back by pdf.js in the coordinates of the displayed page, under the four rotations; range clamped to the last page.
- Browser (`tests/e2e/page-numbers.spec.ts`): format, corner and range chosen before the PDF has finished opening, then copy read back by pdf.js.
