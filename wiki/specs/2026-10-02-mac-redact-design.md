# Mac: Redact

_Written on 2 October 2026. Status: Swift app removed on 5 October 2026 (tag `mac-final`); at the time, shipped in `apps/mac`. Last of the six tools ordered on 2 October (before: [Page numbers](2026-10-02-mac-page-numbers-design.md), [Protect and Unlock](2026-10-02-mac-protect-unlock-design.md), [Compress](2026-10-02-mac-compress-design.md), [OCR](2026-10-02-mac-ocr-design.md))._

## Goal

Hide part of a PDF for good in Holy PDF for Mac: the user covers in black what must disappear, then saves a copy where this content no longer exists. PDFKit only, with no new engine.

Author's choice (2 October): a page that carries a black area becomes an image at 200 dpi. Rejected: rectangles drawn on top of a text that stays in the file.

The spec succeeds when:

- nothing that a redacted page carried stays in the file: not its text, not the value of a covered field, not a note, not the address of a link;
- the redacted page keeps the look and the size that the reader sees, with the area in black;
- the other pages do not change, and the bookmarks and the links that led to the redacted page still lead to it;
- the original file is never modified;
- the package, app and text tests pass, with no compiler warning.

## Decisions

| Topic | Decision | Reason |
|---|---|---|
| Engine | `PDFRedaction.redacted` renders each marked page as the reader sees it, at 200 dpi, with the areas painted black on whole pixels and without smoothing, then replaces it with a page made of this image in JPEG (quality 0.8, written by the Scanner's `PDFWriter`) | What is not in the image is no longer in the file. Probe of 2 October: none of the four secrets of a test page stays, even in the decompressed streams |
| Annotations | The annotations of the redacted page go with it: fields, notes, links | A note or a field can carry the secret |
| What spills onto the other pages | The popup of a note placed on another page is removed: PDFKit copies the text of the note into it. A form field that an area covers is also removed from the other pages where it appears: its value would stay there, visible or hidden | Two leaks proven by the review of 2 October. PDFKit cannot empty a field for good: the default value and the appearance keep the text. A field that no area covers stays on the other pages: the image of the page shows it anyway |
| Memory | Each redacted page waits to be written as JPEG, not as pixels | Measured on 2 October, outside the suites (in the test process, the other tests distort the measurement): 168 MB for 32 small pages before, less than 60 MB after |
| Bookmarks and links | Those that pointed to the page are sent to its image, at the same place as the reader sees it and at the same zoom | The document stays navigable |
| Large pages | The longest side of the image is capped at 6,000 pixels | A poster at 200 dpi would need gigabytes |
| Areas | Black rectangles, normalized to the page as the reader sees it. Drawn by dragging; a cross on each area removes it; a button removes those of the page. "Undo" (button and ⌘Z, since the evening of 2 October) takes back one change at a time, on any page | The most direct gesture. The history keeps a hundred steps, like the Watermark |
| Mouse tracking | An AppKit view under the areas, not a SwiftUI gesture | A test can then drive the drag; a SwiftUI gesture does not respond to the events of a test |
| Changes | The areas count as unsaved changes: opening another PDF or quitting asks for confirmation. With no area, there is nothing to lose and nothing is asked | Areas drawn on several pages are quickly lost |
| After saving | The areas stay on screen; the screen asks the user to look at the copy before sharing it | The user can add more areas and save again |
| Monk | "Brother Inkpot", the site's eraser, a focused look | The monk who applies the black ink |

## What changes in the shared building blocks

- `CopyToolView` and `PagePreviewPane` receive `onPage`: a view placed on the page, at its size, where the tool lets the user work on the page.

## Flow

1. Open or drop a PDF. A protected file asks for its password.
2. Drag on the page to cover what must disappear; go to another page and do it again.
3. "Save the redacted copy…" suggests `name-redacted.pdf`.

## Known limits

- "Undo" cannot be reversed: there is no "Redo".
- The whole redacted page becomes an image: its other text can no longer be selected or searched (the OCR tool can read it again), and its form fields disappear.
- A redacted page weighs about 0.9 MB in Letter size: 14 redacted pages take a PDF from 1 to 13 MB.
- The title of the document, its bookmarks and its metadata (including the XMP block) are not checked: a secret written in a bookmark or in the title stays there. The screen says so.
- A form field that an area covers also disappears from the other pages where it appears.
- A text that goes past the area stays readable: the image is what counts, and the preview shows what will be covered.
- The limits of PDFKit when it writes apply to the other pages (Watermark spec, Protect spec for page labels).
- The copy of a protected PDF opens without a password, and the screen says so.

## Tests

| Level | What | Where |
|---|---|---|
| Engine | The five secrets of a page (text, field, note whose popup is on another page, link, field shared with another page) absent from the bytes and from the decompressed streams of the copy, written in plain text, in UTF-16 or in hexadecimal; a field that is not covered kept on the other page; a bookmark put back in place after rotation, zoom kept; bookmark and link followed up to the image; black area and rest of the page kept; image of 833 × 1,111 pixels for 300 × 400 points, in JPEG, without a mask; look and size kept under the four rotations; other pages unchanged; empty areas or areas outside the page refused, signed PDF refused, protected PDF opened | `PDFRedactionTests` |
| Tool | Areas per page, clipped at the edge of the page, removed one by one or per page; redacted copy saved, original intact, areas kept; another PDF clears the areas | `RedactSessionTests` |
| Screens | Start, areas in light mode, in dark mode and in English, copy saved; a drag draws an area at the expected place, a click does not draw one | `RedactSnapshots` |
| Real files | Six PDFs from `fixtures-private/pdfs`: text of the redacted pages gone, sizes kept, bookmarks kept; 14 pages in 0.7 s | Probe of 2 October, not kept |
| Texts | All translated, never the informal « tu » | `check-strings.py` |
