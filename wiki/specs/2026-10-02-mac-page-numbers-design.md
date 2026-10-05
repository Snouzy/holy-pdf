# Mac: Page numbers

_Written on 2 October 2026. Status: Swift app removed on 5 October 2026 (tag `mac-final`); at the time, shipped in `apps/mac`. First of the six tools ordered on 2 October (next: Protect and Unlock, Compress, OCR, Redact)._

## Goal

Write a number on the pages of a PDF in Holy PDF for Mac, then save a copy. PDFKit, Core Graphics and Core Text, with no new engine.

The spec succeeds when:

- the number appears at the chosen position, as the reader sees the page, also on a rotated or cropped page;
- it is part of the page content, not an annotation;
- the original text, links, form fields and bookmarks stay;
- the original file is never modified;
- the package, app and string tests pass, with no compiler warning.

## Decisions

| Topic | Decision | Reason |
|---|---|---|
| Technique | The Watermark technique: PDFKit draws the page, then the number, and writes both into the content | Proven on 2 October. The `PageOverlay` building block is now shared by Watermark and page numbers |
| Settings | Format ("1", "1 / 12", "Page 1"), position (six: top or bottom, left, center or right), first number, size from 6 to 36 points, all pages or a range | The settings announced to the user. "All except the cover" is done with the range. The first number and the range are typed on the keyboard or set with the arrows: resuming at 237 does not take 236 clicks |
| Numbering | The first page of the range gets the first number. In "1 / 12", the total is the last number written | A range from page 2 to page 12 gives "1 / 11" to "11 / 11" |
| Look | System font, black, 24 points from the edge | Readable and neutral. No font or color choice in this milestone |
| Preview | The same function as the export draws the number on the page preview | What you see is what you save |
| Kept settings | The settings stay from one PDF to the next; the range is clamped to the pages of the open document | People often number several documents the same way |
| Monk | "Brother Folio" (« Frère Folio » in French), sheet accessory, a focused look so that he does not duplicate Brother Binder, exported from the site's drawing | Folio is the printers' word for a page number |

## Building blocks shared by the six tools

These six tools all do the same thing around their setting: open a PDF, ask for its password, show its pages, save a copy. Two new building blocks do this once for all; the existing tools do not change.

- **`PDFOpenedDocument`** (`PDFCore`): the open PDF, its pages as the reader sees them, and the preview of a page, on which the tool can draw. It refuses a digitally signed PDF.
- **`PDFCopySession`** (app): opening, the password, the page on screen and its preview, then saving the copy through the macOS panel. The session is busy while the panel is open. It refuses to write over the original file. The tool gives it the function that makes the copy. For a copy that takes minutes, `saveCopy(to:reporting:)` shows the current step (`step`) and cancels without writing anything ([pages-per-sheet spec](2026-10-02-mac-sheets-design.md)). `survey` reads what the tool needs from the document being opened, and keeps it in `findings` ([bookmarks spec](2026-10-02-mac-bookmarks-design.md)). `underlay` draws under the page of the preview, as `overlay` draws on top ([overlay spec](2026-10-02-mac-overlay-design.md)). `showCopy` shows in the preview the copy that a tool is about to save, instead of the document (Compress). `CopyToolView(undo:)` connects "Undo" in the Edit menu (Redact).
- **`CopyToolView`** (app): the screen. The page and the page switcher on the left; on the right, the file name, the tool settings, then the save button and its result. It also holds the start screen with the monk, the password, the file drop, the confirmation before discarding settings, and the ⌘O and ⌘E menus.

A tool then comes down to its function in `PDFCore`, its settings and its panel.

## Flow

1. Open or drop a PDF. A protected file asks for its password.
2. Set the format, the position, the first number, the size and the pages. The preview updates, and you can change the page to check.
3. "Save a numbered copy…" suggests `nom-numéroté.pdf`.

## Known limits

- Those of PDFKit, described in the Watermark spec: slow writes and heavier files on some PDFs.
- The number can cover content that is already at that place: the preview shows it before saving.
- The copy of a protected PDF opens without a password, and the screen says so.
- No undo of settings (⌘Z) in this tool: you reset each setting by hand.

## Tests

| Level | What | Where |
|---|---|---|
| Engine | The text of each format, the first number and the range; the number in the content of the range pages only; annotations and bookmarks kept; the position under the four rotations and with a crop; settings outside the document and signed PDF refused; copy of a protected PDF | `PDFPageNumberingTests` |
| Open document | Page sizes, preview, drawing on top, password, refusal | `PDFOpenedDocumentTests` |
| Shared session | Opening, password, preview of the page on screen, tool drawing, copy and refusal of the original, failed copy, wait during the panel, new document | `PDFCopySessionTests` |
| Tool | Default settings, bounds, numbered copy, range clamped to a shorter document, number on the preview | `PageNumberSessionTests` |
| Screens | Start and workshop, in light, in dark and in English | `PageNumberSnapshots` |
| Strings | All translated, never the informal « tu » | `check-strings.py` |
