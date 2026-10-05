# Mac: Watermark

_Written 2 October 2026. Status: Swift app removed on 5 October 2026 (tag `mac-final`); at the time, shipped in `apps/mac`._

## Goal

Put a watermark on a PDF in Holy PDF for Mac: a text ("Confidential", "Draft") or an image (a logo), with its opacity, its angle and the pages it covers, then save a copy. No server, no account, no new engine: PDFKit, Core Graphics, Core Text and ImageIO.

The spec succeeds when:

- the watermark appears on the chosen pages, at the position, size, angle and opacity seen on screen, including on a rotated or cropped page;
- it is part of the page content: a PDF reader does not offer it as an annotation to delete;
- the original text stays selectable, and the form fields, links and bookmarks stay;
- the original file is never modified;
- the package, app and string tests pass, with no compiler warning.

## Scope

**In the spec:** one watermark per document, text or image; text color; opacity; angle; position and size with the mouse; all pages or a range; saving a copy; Brother Stamp on the home screen and on the start screen; French and English strings.

**Out of the spec:** tiling (a watermark repeated on the page), several watermarks at once, font choice, a watermark under the content, a free list of pages ("1, 3, 5-8"), removal of an existing watermark, page numbers.

## Decisions

| Topic | Decision | Reason |
|---|---|---|
| Technique | A subclass of `PDFPage` draws the watermark after the page content. PDFKit writes it into the content on export | Test of 2 October: the watermark is no longer an annotation, and 23 fields of 23, 113 links of 113 and the bookmarks stay. This is the technique of Apple's samples |
| Rejected | An annotation, like the signature | Any reader can select and delete it: that is not a watermark |
| Rejected | The write option `burnInAnnotationsOption` | It flattens all annotations: the form fields of the document disappear (test: 24 annotations, then 0) |
| Placement | With the mouse, like the signature: move it, drag the corner. The same position, as a proportion of the visible page, applies to all chosen pages | Author's choice. Reuses the Sign gesture |
| Several watermarks (3 October 2026) | "Place another one" adds a watermark like the selected watermark, in the middle of the page, and selects it; a click on a watermark of the page selects it, and the panel edits that one (text, color, opacity, angle, pages). "Remove from the page" removes the selected watermark, never the last one. A watermark emptied of its text goes away by itself when another one is selected, and while it is selected nothing is saved. The copy of a watermark placed on some pages extends its range to the displayed page; a change of page selects a watermark of that page. Fifty at most. One undo step restores the whole layout | Author's request on 3 October: several "CONFIDENTIAL" on one page, placed freely like the signatures on the web. Each watermark is independent: a change to the text of one does not change the others |
| Pages | All, or a range "from page … to page …" | Author's choice. Two fields, no syntax to explain. Since the evening of 2 October, you can type each field or set it with the arrows (`NumberField`, shared with Page numbers): on 300 pages, 200 clicks on an arrow is not a setting |
| Text | Bold system font, one line, 80 characters at most. It becomes real text in the page | Simple, readable, and search finds it |
| Image | PNG or JPEG, same limits as the signature (10 MiB, 16 Mpx, reduced to 1 Mpx). The transparency of a PNG is kept | Reuses `SignatureImage`. Test: an image on 14 pages is written only once in the file (+257 KB for a 309 KB logo) |
| Preview | Each watermark is rendered once as an image by the same code as the export, then placed on the page preview; two watermarks with the same look share their image, and a watermark keeps its last drawing while a slider moves faster than the drawing (review of 3 October). On export, an image placed fifty times is decoded once. No PDF computation during a gesture | What you see is what you export, and the gesture stays smooth |
| Monk | "Brother Stamp" (« Frère Tampon » in French), stamp accessory, Edit category, exported from the site drawing: one more line in `export-monk-assets.mjs` and in `MonkAssetTests` | The site already plans this prop for the `watermark` tool |
| Engine | PDFKit, like Sign, Merge and Organize | Author's choice: no new engine |

## Flow

1. **Open** or drop a PDF. A protected file asks for its password. A digitally signed PDF is refused: the watermark would invalidate its signature.
2. **Set**, in the right panel, from top to bottom:
   - Text or Image (toggle);
   - the text and its color, or "Choose an image…";
   - Opacity: slider from 10 to 100%, 30% at start;
   - Angle: slider from −90° to 90°, 45° at start for a text, 0° for an image;
   - Pages: "All pages" or "From page … to page …".
3. **Place**: the page shows on the left, the watermark on top of it, centered at start. Drag it to move it, and drag its corner to change its size. The previous page and next page buttons show the result on the other pages; a page outside the range shows without a watermark.
4. **Save a copy…**: the macOS panel suggests `nom-filigrane.pdf` (`nom-watermarked.pdf` in English). The screen then says which file is saved and offers "Show in Finder".

⌘O opens, ⌘E saves, ⌘Z undoes the last setting or move. When a watermark is not saved, the app asks for confirmation before it opens another PDF or quits, as in Sign.

## Engine

In `PDFCore`, without AppKit or UIKit.

- `Watermark`: the content (text and color, or image), the center and the width as a proportion of the visible page (origin at the top left), the angle, the opacity, the page range.
- `PDFWatermarkDocument`, an actor: it opens the PDF (password, refusal of digital signatures), gives the page sizes and the preview of a page, and writes the watermarked copy. Each export starts again from the original data: nothing accumulates.
- The drawing lives in a single function, used by the export and by the preview image of the watermark.
- **Coordinates**: the position is expressed in the page as it displays, after CropBox and rotation, like the placements of Sign. The conversion goes through the same geometry (`SignatureGeometry`, renamed to serve both tools).
- **Shared with the other tools**: opening, unlocking, the digital signature check, page measurement and preview rendering are the shared building blocks of `PDFCore`, pooled on 2 October for Sign, Merge and Organize. The errors are those of `PDFToolError`. On the app side, the file read, the protection of the original (`FileIdentity`), the save panel and the tool menu (`ToolMenu`) are shared too.

Copy of a protected PDF: it opens without a password, and the screen says so, as in Sign.

## Known limits

- **PDFKit is slow on some files.** The PDFKit write re-encodes some content. Measured on 1 October: a 142-page document rich in fonts takes about 2 minutes and grows from 3 to 13 MB; a book scanned in JBIG2 and JPEG 2000 grows from 17 to 468 MB. Ordinary PDFs and JPEG scans are not affected (0.1 to 0.3 s, almost the same size). The limit also applies to Sign, Merge and Organize. The screen shows progress and lets you wait; it does not promise a duration.
- The watermark is drawn over the content. A reader does not delete it with one click, but a PDF editor can always remove an element from a page: it is not a protection.
- The accessibility tags and the archiving profiles (PDF/A) of the original document are not guaranteed after the PDFKit write.

## Performance

- Opening, preview and export off the main actor.
- One page preview at a time, 1,600 px at most on the long side.
- The watermark is rendered as an image once per change of setting, never during a drag.
- PDF of 256 MiB at most, like Sign.
- Benchmarks on a synthetic 20-page PDF: preview in less than 1 s, export in less than 3 s.

## Tests

| Level | What | Where |
|---|---|---|
| Engine | The watermark lands in the right place under the four rotations and with a CropBox; the page range is respected; opacity and angle change the expected pixels; the watermark text is in the content and not in the annotations; original text, links, fields and bookmarks kept; the original intact; two exports in a row give a single watermark; an image on 20 pages weighs less than twice the image | `PDFCoreTests` |
| Session | Settings, move, size, invalid range refused, undo, export, confirmation before abandoning | `PDFToolboxTests` |
| Brand | Brother Stamp is in the catalog, in light and dark, up to date with the site drawing | `PDFToolboxTests`, export script |
| Screens | Snapshots of the start screen and the workshop, in light and dark | `PDFToolboxTests` |
| Strings | All translated, never the informal « tu » | `check-strings.py` |
| By hand | Drag and resize the watermark with the mouse; open the result in Preview and check that no annotation can be selected | `wiki/development/tests.md` |
