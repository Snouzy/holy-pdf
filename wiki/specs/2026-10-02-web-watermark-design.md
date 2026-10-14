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

## Tiled, burned, previewed (14 October 2026)

Asked by the author to protect an identity card, as [FiligraneFacile](https://filigrane.beta.gouv.fr/) does. That State service sends the files to its server and keeps the result until the first download, or one day. Its code (`BOPdfDocumentTemplate` in `MTES-MCT/dossierfacile-backend`) turns every page into a picture. It repeats the text on about ten rows at −25°, with an opacity drawn between 52 and 60 %. Its spacing, colours and a wave are random, and a blurred copy of the text lies under it. The only setting is the text.

| Topic | Decision | Reason |
|---|---|---|
| Layout | « Une fois » (the version above) or « En mosaïque ». Tiled: rows of the text repeated with blanks between copies, at the chosen angle, every other row shifted by half a copy; each row is long enough to cross the page's diagonal from any shift, and the rows reach past the page's edges. Size: 2 to 10 % of the page's shorter side (4 % at the start). Spacing: tight, medium or loose (1, 2 or 4 em between copies; 2, 3.5 or 6 em from row to row) | A mark at the centre is cropped off a card in one move. One text object per row, not per copy: a small text would make a thousand objects a page |
| Geometry | One function, `markLines` in `engine/markLayout.ts`, gives the lines: text, size, advance width and the left end of the baseline, in points of the page as the reader sees it. The engine writes them; the preview draws them. Widths are Helvetica-Bold's advances (`standardWidths.ts`); the mark is centred on the capitals (0.718 em). The width setting now measures the advance width, not the ink box | The preview shows the file. The ink box made the text slightly wider than the advance |
| Burn | « Incruster dans la page »: the marked pages become 200 ppi JPEG pictures (`burnMark`, after the watermark, through Pixelize's renderer); the other pages are copied as they are. Checked when « En mosaïque » is chosen, unchecked for « Une fois » | Written as text, the mark is one object to delete in any PDF editor, our Edit tool included. 200 ppi keeps the small print of a card on an A4 page readable; 300 doubled the file for nothing seen |
| Preview | Above the file cards, which drop their first page: the page as it will come out, rendered by PDFium at the screen's density, the mark drawn over it in SVG from `markLines`. The SVG text takes the PDF advance width (`textLength`). Arrows go through every page of every file; a page outside the range shows without a mark. The module loads with the first file | The author asked to see the result before running. Live, without a worker round trip: the page image stays, only the SVG changes |
| Photos | JPG and PNG are accepted, each made into an A4 page once the visitor agrees, as Merge does. A document opened from a photo has no bytes of its own: the engine's copy of it now comes from its saved bytes | An identity card is usually a phone photo |
| Hint | In « En mosaïque », under the text: write who it goes to, why, and the date | A leaked copy then tells where it came from, and cannot serve another file |

Not done: FiligraneFacile's random spacing, colours, wave and blur. Once the page is a picture, a tiled text is already hard to paint out, and without chance the preview stays the file.

## Limits

- Text only: no image and no mouse placement in this version.
- Helvetica, the standard PDFium font, writes only Latin-1. A text with an emoji or a non-Latin alphabet is flagged, and the button stays grayed out.
- A burned page loses its text, its links and its form fields, as with Pixelize. The document's bookmarks and metadata do not follow either.

## Tests

- Engine (`tests/engine/watermark.test.ts`): text on the range only, angle read back from the text matrix by pdf.js, transparency measured on the rendered pixels (red at 30% on white, no pixel of opaque red), width read back by pdf.js; tiled rows over all 16 cells of a 4 × 4 grid, where a single mark leaves some empty; burned pages with no text left and the others kept; a photo made into a page marked.
- Layout (`tests/unit/markLayout.test.ts`): a single mark centred and as wide as asked; rows a pitch apart, from edge to edge, longer than the diagonal, shifted by half a copy; more rows when the spacing tightens.
- Browser (`tests/e2e/watermark.spec.ts`): accented text read back by pdf.js, emoji refused, default text when the field is empty; a PNG made into a page, the preview with one line then many, burn checked in « En mosaïque », the copy with no text and the mark's red on the page.
