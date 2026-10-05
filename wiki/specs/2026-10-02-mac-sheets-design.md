# Mac: Pages per sheet, Split pages in half, Pixelize

_Written on 2 October 2026. Status: Swift app removed on 5 October 2026 (tag `mac-final`); at the time, shipped in `apps/mac`. Requested by the author on 2 October, after [Flatten](2026-10-02-mac-flatten-design.md): the site has had the three tools since the same day ([pages per sheet](2026-10-02-web-pages-per-sheet-design.md), [split in half](2026-10-02-web-split-in-half-design.md), [pixelize](2026-10-02-web-pixelize-design.md))._

## Goal

Three tools with a single setting each in Holy PDF for Mac, with the site's rules and PDFKit only:

- **Pages per sheet** arranges 2, 4, 6, 9 or 16 pages on each A4 sheet, in reading order;
- **Split pages in half** makes each page into two pages that follow each other: left then right, or top then bottom;
- **Pixelize** turns each page into an image, at 150 or 300 dots per inch: the text can no longer be selected.

The spec succeeds when:

- the sheets are A4, in landscape for 2 and 6 pages, and the text of the pages stays text on them;
- the cut follows the page as the reader sees it, even when rotated, and a link stays on the half that shows it;
- the pixelized copy has no text left, and each page keeps its displayed size;
- a long job can be cancelled without writing anything, and it shows the current page when the engine knows it (sheets, pixelize);
- the original file is never modified;
- the package, app and text tests pass, with no compiler warning.

## Decisions

| Topic | Decision | Reason |
|---|---|---|
| Sheets | `PDFSheets.arranged` draws each page in its cell, through a PDF context: the page is fitted and centered, never cropped | Probe of 2 October: the text stays text, 15 pages in 0.2 s, size unchanged |
| Sheet orientation | Landscape for 2 and 6 (2 × 1, 3 × 2), portrait for 4, 9 and 16 | The site's rule: a page in portrait keeps a cell in portrait |
| Cut | `PDFPageHalves.halved` copies each page and gives each copy half of the visible area, computed in the reader's coordinate space, then brought back into the page's coordinate space | The document stays the same: the bookmarks stay, the text stays text. The site, by contrast, builds a new document and loses annotations and fields |
| Cut links and fields | An annotation stays on the half that it touches; if it crosses the cut, it stays on both. The popup of a comment follows its comment, wherever the popup is placed | Without this sorting, each link would exist twice, once outside the page |
| Signed PDF | Refused by Split in half (the copy keeps the signature field, which would no longer be valid). Accepted by Pages per sheet and Pixelize: the new document has no signature field | Same reason as on the site for the last two |
| Pixelize | `PDFPixelizing.pixelized` reuses the rendering of PDF to images (150 dpi, or 300 dpi), and puts each JPEG on a new page of the displayed size, without rotation | Only one renderer to maintain. At 300 dpi, the JPEG quality is the one of PDF to images (0.92) and not the site's 0.85: 5% more weight on the probe |
| Writing | The sheets and the pixelized copy are written to a temporary file, which is read back without loading it in memory | Probe: 142 pages at 300 dpi give 312 MB; the memory peak goes from 930 to 520 MB |
| Progress and cancellation | Saving goes through `saveCopy(to:reporting:)` of the shared session: the screen says "Page 3 of 142…" and offers "Cancel". A copy that is finished after the cancellation is not written | The three tools can last minutes. The text reading and PDF to images reuse the same building block, which replaces their two copies of the same code |
| Preview | Split in half draws the cut as a dotted line on the page. Pages per sheet shows the sheet and its numbered cells | The direction of the cut and the order of the cells are visible before saving |
| Monks | Brother Mosaic (sheet), Brother Trimmer (scissors), Brother Glass (frame): the site's names and props, with a different face when a monk on the home screen already has the same pose | On the site, each tool has its own page; on the Mac home screen, two cards side by side must not look the same |

## Flow

1. Open or drop a PDF. A protected file asks for its password.
2. Choose: the number of pages per sheet, the direction of the cut, or the resolution.
3. Save: `name-per-sheet.pdf`, `name-halves.pdf` or `name-pixelized.pdf`. A change to the setting after saving clears the "saved" message.

## Known limits

- A4 sheet only, with no margin and no rule between the cells.
- On the sheets, the links and the bookmarks do not follow; the fields and the annotations are drawn on them, and can no longer be edited.
- Split in half: a bookmark or a link that pointed to a page leads to its first half.
- Split in half does not show the current page: nearly all the time goes into the writing by PDFKit, which does not report progress. "Cancel" stays available.
- Each half keeps the whole content of the page, hidden by its box: another reader can still find the text of the other half in it. The site does the same.
- On the sheets, text that a box hid (cropped page, half of a split page) is drawn out of view, but it can still be found and selected: PDFKit does not remove what goes past a box. Review of 2 October.
- Pixelize is not a protection: text recognition software can read an image again. The screen says so.
- An image is not more than 6,000 pixels on a side: above that, the resolution drops.
- A cancellation that comes while the file is written (less than one second) arrives too late: the copy is written.
- The limits of PDFKit apply (Watermark spec). Measured on 2 October: the 142-page IRS publication takes 92 s for the sheets and 197 s for the cut; the book scanned in JBIG2 goes from 17 to 468 MB through both tools. Common files take less than 2 s.
- The copy of a protected PDF opens without a password, and the screen says so.

## Tests

| Level | What | Where |
|---|---|---|
| Engine | Sheets: number and orientation for the five choices, reading order checked on the pixels, text kept, rotated page, progress, cancellation, signed PDF accepted. Cut: size and words of each half for both directions, rotated pages compared on the pixels, link on the right half, popup of a comment kept with it, bookmark kept, cut line, signed PDF refused. Pixelize: no text, sizes kept, 150 dpi, same look, signed PDF accepted | `PDFSheetsTests`, `PDFPageHalvesTests`, `PDFPixelizingTests` |
| Shared session | Steps shown, then copy written; original never replaced; cancelled copy never written | `PDFCopySessionTests` |
| Tools | Copy saved, original intact, a changed setting clears "saved", cut shown on the preview | `SheetsSessionTests`, `HalvesSessionTests`, `PixelizeSessionTests` |
| Screens | For each tool: start, ready in light mode, in dark mode and in English, copy saved; six pages per sheet; top and bottom cut | `SheetToolsSnapshots` |
| Real files | Five PDFs from `fixtures-private/pdfs`: sheets of 2 and of 9, halves, copy pixelized at 300 dpi, with durations, sizes and memory peak | Probe of 2 October, not kept |
| Texts | All translated, never the informal « tu » | `check-strings.py` |
