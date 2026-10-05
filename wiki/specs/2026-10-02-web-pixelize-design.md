# Web: Pixelize a PDF

_Written and shipped on 2 October 2026._

Brother Glass (`/fr/pixelliser-pdf`, `/en/pixelize-pdf`) turns each page of one or more PDFs into a JPEG image, at 150 ppi (normal) or 300 ppi (high). The text can no longer be selected or copied. This is not a protection: text recognition software still reads an image, and the FAQ says so.

## Engine

`engine/pixelize.ts`, called by the `transform` request: each page is rendered as the reader sees it (`renderPage`), encoded as JPEG (quality 0.85) by the Worker's encoder, then placed on a new page of the same size, with no rotation. Because the encoding is asynchronous, this operation does not go through `transformPdf`, which stays synchronous.

## Tests

- Engine (`tests/engine/pixelize.test.ts`): no text line, one image per page, displayed sizes kept (a rotated page comes out in landscape, with no rotation).
- Browser (`tests/e2e/pixelize.spec.ts`): copy with no text, in A4 format.
