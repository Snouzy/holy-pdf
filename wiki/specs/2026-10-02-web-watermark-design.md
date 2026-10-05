# Web: Add a watermark

_Written and shipped on 2 October 2026. First version, text only; the Mac app also did images and mouse placement, until its removal on 5 October 2026 ([Mac spec](2026-10-02-mac-watermark-design.md))._

## What the tool does

Brother Stamp (`/fr/filigrane-pdf`, `/en/watermark-pdf`) writes a text across the pages of one or more PDFs:

- text of 80 characters at most, "CONFIDENTIAL" (French: « CONFIDENTIEL ») if the field stays empty;
- color: stamp red, gray or blue;
- opacity from 10 to 100% (30% at the start), angle from −90° to 90° (45° at the start), width from 20 to 100% of the page (60% at the start);
- all pages, or a range, with the same building block as Page numbers.

The watermark is centered on the page as the reader sees it, also on a rotated page.

## Engine

Operation `watermark` of the `transform` request, in `engine/pageText.ts`, next to the page numbers: a Helvetica-Bold text in the page content, scaled to cover the chosen width, rotated in the frame of the displayed page. The opacity goes through the fill alpha (`FPDFPageObj_SetFillColor`): PDFium writes a `/ca` graphics state.

## Limits

- Text only: no image and no mouse placement in this version.
- Helvetica, the standard PDFium font, writes only Latin-1. A text with an emoji or a non-Latin alphabet is flagged, and the button stays grayed out.
- No live preview.

## Tests

- Engine (`tests/engine/watermark.test.ts`): text on the range only, angle read back from the text matrix by pdf.js, transparency measured on the rendered pixels (red at 30% on white, no pixel of opaque red), width read back by pdf.js.
- Browser (`tests/e2e/watermark.spec.ts`): accented text read back by pdf.js, emoji refused, default text when the field is empty.
