# Mac: Edit a PDF (step A: additions in the page)

_Swift app removed on 5 October 2026: this spec is an archive, the code is at tag `mac-final`._

_Written 4 October 2026. Split chosen the same day: one single "Edit a PDF" tool, delivered in three steps. A (this spec): additions written into the page, and images that you crop, rotate and flip. B: annotations (notes, underline, strikethrough, stamps, comments with an author) and links, written as annotations. C: edit the original text, move or delete the original objects, after a trial of native PDFium. The site has had the tool since 4 October ([web spec](2026-10-04-web-edit-design.md)); the Mac takes its rules and goes further on text and images._

Brother Scribe (« Frère Scribe » in French), the quill, focused, Edit category, adds text, images, shapes, freehand strokes and highlights on the pages of a PDF, then saves a copy.

## Goal

The spec succeeds when:

- you can add on the displayed page: text, image, rectangle, ellipse, line, arrow, pen, highlighter;
- you can select an addition, move it (mouse or arrow keys), resize it with its handles, change its color or its size, bring it to the front or send it to the back, delete it;
- you can crop a placed image, rotate it by a quarter turn and flip it;
- undo and redo cover each change;
- the copy shows the additions at the same place as the preview, rotated page included; the added text stays text that you can select and search, in any script;
- nothing else changes in the file: the original links, bookmarks, fields and annotations stay.

## Decisions

| Topic | Decision | Reason |
|---|---|---|
| Write | The additions become page content, with the Watermark technique: a page that draws over its content (`PageOverlay`) | Author's choice. Same rendering in all readers; links, bookmarks and fields kept, as Watermark proves |
| Coordinates | Rectangles and points normalized in the page as you see it (CropBox, rotation), origin at the top left, converted at the same place as Sign and Watermark (`PageGeometry`) | One single conversion, already tested on the four rotations |
| Text | Drawn by Core Text in the page: Quartz embeds the font as a subset, all letters pass ("ș", Greek, Cyrillic, emoji). Helvetica, Times, Courier, regular or bold; size 8 to 96 pt, in the panel or by a drag of the text corner; several lines (Return); no automatic line wrap | The Mac embeds the font: no WinAnsi limit as on the site. Same fonts and same sizes as the site |
| Text input | A native text field placed on the page, at the exact place of the final text (same baseline, same font, same size) | The text does not jump when you leave the field |
| Images | Drag from the Finder onto the page, paste (⌘V) or "Choose an image…". All that ImageIO reads (JPEG, PNG, HEIC, WebP, TIFF, GIF as its first frame). Camera orientation applied; reduced to 2,400 px on a side at most; JPEG without transparency, PNG if not. 50 MiB and 50 Mpx at most on input: a 24 Mpx iPhone photo passes, and ImageIO reduces it while it reads it | An iPhone photo does not bloat the file and arrives the right way up |
| Crop | Crop mode on the selected image, four handles. The cut pixels leave the file | A crop that hides a passage must not leave the passage in the PDF |
| Rotate, flip | Quarter turn to the right, horizontal or vertical flip, applied to the drawing | Nothing is lost, the file does not grow |
| Image placed several times | One single copy in the file when the image and its crop are the same | Removed from the limits of the site, at the author's request |
| Shapes | Rectangle and ellipse, outline or filled, in one color; line, arrow, pen; thin, medium or thick stroke (1, 2.5 and 5 pt) | Like the site |
| Highlighter | Rectangle dragged with the mouse, color in the "multiply" blend mode (Multiply) | The text stays readable below it |
| Colors | Black, blue, red, green, yellow, white | Like the site; white hides from the eye but removes nothing (Redact removes) |
| Tools | After a text, an image or a shape, the Select tool comes back. Pen and highlighter stay active. Escape goes back to Select, Delete erases the chosen addition, the arrows move it by one point (ten with Shift) | Mac habits |
| Undo | Editor history: ⌘Z, ⇧⌘Z, and the entries of the Edit menu. One typing session counts as one step, none if nothing changed | Like the site |
| Saving | "Save a copy…", available from the first addition. Name `nom-modifié.pdf` ("edited" in English). The original never changes. An empty text disappears when you leave it; a pen click without a stroke leaves nothing | Like the other Mac tools |
| Signed PDF | Refused with the message of the other tools (`rejectDigitalSignatures`) | Any rewrite breaks the signature |
| Protected PDF | Opened with its password; the copy opens without a password, and the screen says so | Like Watermark and Sign: PDFKit rewrites the file without its encryption |
| Monk | "Brother Scribe" / « Frère Scribe », the quill, focused, Edit category, drawing exported from the site | The name that the site gave to Edit on 4 October; PDF to JPG and PDF to images keep Brother Illuminator. On the Mac, the joyful quill is already the one of PDF to Word |

## Flow

1. Open or drop a PDF: the first page shows, the palette is in the panel.
2. Choose a tool, then click or drag on the page. You type text directly on the page; you drop, paste or choose an image.
3. Select an addition to move it, resize it, change its style, bring it to the front or send it to the back, or delete it; crop, rotate or flip an image.
4. "Save a copy…" suggests `nom-modifié.pdf`.

## Screen

Same layout as Sign: the page on the left with its page stepper, the panel on the right (320 pt). The panel shows, from top to bottom:

- the palette: Select, Text, Image (opens the image picker), Rectangle, Ellipse, Line, Arrow, Pen, Highlighter;
- the settings of the tool or of the chosen addition: color, thickness, outline or filled, font, bold, size;
- for an image: Crop, Rotate, Flip;
- Bring to front, Send to back, Delete;
- "Save a copy…", with the save status of the other tools.

Start screen, password, refusal and "Show in Finder": the same as in the other tools.

## Engine

In `Packages/Core` (`PDFCore`), without AppKit:

- an addition model (`EditItem`): text, image, shape, stroke, highlight; page, normalized geometry, style, order;
- a write function that always starts from the original bytes, draws the additions of each page over its content in the chosen order, and returns the bytes of the copy;
- a preview render of a page with its additions, made by the same code as the write, so that the preview and the copy do not diverge.

## Known limits (step A)

- The original content does not change (step C).
- No annotation, comment, stamp or link (step B).
- No free rotation of an addition, no zoom, no automatic line wrap, no alignment, no color per word.
- Three fonts and six colors.
- A PDFKit rewrite can be slow or heavy on some files (known limit of Watermark).

## Tests

- Engine (`PDFCoreTests`):
  - text read back by PDFKit at its place, on the four rotations and with an offset CropBox;
  - non-Latin text ("ș", "Ω", "Ж", an emoji) present in the copy and searchable;
  - image, shapes, arrow, pen and highlighter checked in pixels;
  - crop: the cut pixels absent from the file; rotate and flip checked in pixels;
  - same image placed twice: one single image stream in the copy;
  - front and back order;
  - original links, bookmarks, fields and annotations kept;
  - signed PDF refused, protected PDF opened and copy without a password.
- Session (`EditSessionTests`): styles, typing counted as one step, move, order, images, crop, undo and redo.
- Canvas (`EditCanvasTests`): drag, handles, page edge, arrows, Delete, Escape, text input on the page, paste.
- Snapshots (`EditSnapshots`): start, workshop and crop, in light, in dark and in English.
- `check-strings.py`, the monk list of `MonkAssetTests`, the monk export script, and the site tests that keep the Mac copies up to date (`macAssets`, `macSearch`).
