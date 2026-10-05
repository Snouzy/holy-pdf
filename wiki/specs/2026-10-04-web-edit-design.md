# Web: Edit a PDF

_Written on 4 October 2026. Status: shipped in `apps/web/` on 4 October 2026, with the second version, the zoom, the forms, the stamps, the shortcuts and the text box. Scope chosen on 4 October: add only, additions written into the page. The Mac app did not have this tool when this spec was written. It got step A the same day ([Mac spec](2026-10-04-mac-edit-design.md)); the Swift app was removed on 5 October 2026._

Brother Scribe (`/fr/modifier-pdf`, `/en/edit-pdf`) adds text, images, shapes, freehand strokes and highlighting to the pages of a PDF, then saves the copy.

## Goal

The spec succeeds when:

- you can add to the displayed page: text, image, rectangle, ellipse, line, arrow, pen, highlighter;
- you can select an addition, move it, resize it, change its color or size, bring it to the front or send it to the back, delete it;
- undo and redo cover every change;
- the copy shows the additions at the same place as the preview, rotated page included, and added text stays text;
- nothing else changes in the file.

## Decisions

| Topic | Decision | Reason |
|---|---|---|
| Scope | Add only. The original text does not change | Author's choice. Editing the original text runs into embedded fonts reduced to the letters already used |
| Writing | Additions become page content (`engine/edit.ts`): PDFium text, image and path objects | Author's choice. Same rendering in all readers, like Sign and Watermark |
| Coordinates | Points of the page as the reader sees it, from its top-left corner. The engine goes through the axes of `displayed()` | A rotated page is handled as in the other tools; the SVG preview uses the same numbers |
| Text | Standard PDF fonts: Helvetica, Times, Courier, regular or bold; size 8 to 96 pt; several lines. All of WinAnsi works (Latin-1, plus "œ", "€", typographic apostrophe and quotes, dashes, ellipsis); any other letter is flagged and blocks saving | No font to embed. macOS and iOS type the typographic apostrophe on their own: refusing it blocked « l'été » |
| Input | The text is typed in a field placed on the page, positioned so that its baseline falls on the PDF baseline. The field is activated during the gesture itself | Without this calculation, the text jumped by about 0.2 em when it left the field. iOS opens its keyboard only for a field activated during the gesture |
| Image | JPEG, PNG or WebP. The browser decodes it (EXIF orientation included) and scales it down to 2,400 px at most; JPEG without transparency, RGBA pixels otherwise | A phone photo does not bloat the file and arrives the right way up |
| Shapes | Rectangle and ellipse (outline, fill or both), line, arrow, pen: thin, medium or thick stroke. Shift while drawing gives a square or a circle, and keeps the proportions during a resize by the corners | The ellipse is made of four Bézier curves. Shift: requested by the author on 4 October |
| Highlighter | Rectangle dragged with the mouse, color in "Multiply" blend mode | The text stays readable under the color |
| Colors | Black, blue, red, green, yellow, white | Six colors are enough; white serves as a visual cover (it removes nothing, Redact does) |
| Tools | After a text, an image or a shape, the Select tool comes back. Pen and highlighter stay active | You adjust right away what you just placed; you draw several strokes in a row |
| Undo | Editor history, `Ctrl/⌘+Z` and `Shift+Ctrl/⌘+Z`, inactive during saving. One typing session counts as a single step, and as none if nothing changed | An editor without undo is a burden; a stray click with the Text tool must not clear "Redo" |
| Saving | Offered from the first addition; an empty text disappears when you leave it; a pen touch without a stroke leaves nothing. Only the images still placed go to the engine, and their previews are released with the document | |
| Signed PDF | Refused (`alreadySigned`) | Any rewrite invalidates the signature |
| Protected PDF | Opened with its password; the copy keeps it | Like Bookmarks |
| Monk | "Brother Scribe" (« Frère Scribe »), the quill, joyful, Edit category | The scribe writes on the page and adorns it. First name, "Brother Illuminator" (« Frère Enlumineur »), shipped on 4 October then changed: PDF to JPG already had it |

## Flow

1. Drop a PDF: the first page shows, the tool palette is in the panel.
2. Choose a tool, then click or drag on the page. The text is typed directly on the page.
3. Select an addition to move it, resize it by its handles, change its color or size, bring it to the front or send it to the back, delete it.
4. "Save the changes" offers `name-edited.pdf`.

## Known limits

- ~~No editing or deletion of the original content.~~ Lifted by the second version (4 October 2026).
- No free rotation of an addition, ~~no zoom~~. The zoom came on 4 October 2026; an added image turns by quarter turns only.
- Text is limited to the Latin alphabets of WinAnsi: no "ș", no emoji, no non-Latin alphabet.
- ~~The same image placed twice is stored twice.~~ Stored once since the second version (4 October 2026).

## Tests

- Engine (`tests/engine/edit.test.ts`): text read back by pdf.js at its place, on four page rotations; all WinAnsi letters; text box broken at the same words as `wrapped`; image, shapes, arrow, pen and highlighter read back as pixels; front/back order; letter outside WinAnsi, unknown page or image refused; signed PDF refused, protected PDF that stays protected.
- Model (`tests/unit/editModel.test.ts`): creation by drag, move, handles, selection on click, order, undo and redo, text box and width handles. Metrics (`tests/unit/editMetrics.test.ts`): advance widths, WinAnsi codes, line breaking.
- Browser (`tests/e2e/edit.spec.ts`): text typed on the page, rectangle dragged, stroke undone, copy read back; letter refused; one typing session undone in one step, a lost click without a step.

## Second version (4 October 2026): the document itself

_Requested on 4 October: a user must have no reason to prefer Acrobat. Five workstreams: the original text, the original objects, annotations, links, images. Shipped in three PRs._

### Goal

- You can correct a text of the PDF on the page, in place, in its font when the font allows it.
- You can move and delete an object of the PDF (text, image, path, form XObject); you can resize, crop, rotate and flip an image.
- A note, a highlight, an underline and a strikethrough go on the text and reopen in Acrobat or Preview.
- A link to a web address or to a page goes on an area.
- You can crop, rotate and flip an added image; the same image placed twice is stored once.

### Decisions

| Topic | Decision | Reason |
|---|---|---|
| Preview | The displayed page is a render of the edited PDF: the engine reopens the file, applies the edits to the original objects of the page, renders the page. The additions are still drawn in SVG on top | Only PDFium renders the original fonts reliably; the additions stay smooth under the finger |
| During a gesture | An original object that you move shows as a ghost: the cutout of the preview at its old place, translated. The previous preview stays on screen until the new render | No render on each pointer move, no blank screen between two renders |
| Objects | An object = a PDFium content object (`FPDFPage_GetObject`), identified by its index in the original page, even after deletions. A text is a line or a fragment, as the file wrote it. But a file that writes its lines glyph by glyph (Chrome, invoices printed from a browser: at least six text objects in ten no wider than a letter) gets its glyphs grouped into lines: same font, size and color, same baseline within 0.5 pt, gap of less than three quarters of an em. A space goes where the pen position jumps more than one fifth of an em past the glyph advance, read in its font (`FPDFFont_GetGlyphWidth`); a measurement between glyph boxes put a space after each "l". The lines are those of the original page, collected by the engine before any edit: lines collected on the edited copy would have merged a moved line with its neighbor. The line carries the index of its leftmost glyph. A move, a correction or a deletion of the line reaches all its glyphs, and the correction replaces them with one object. A page written word by word (justified LibreOffice) keeps its objects separate. Form XObjects move and are deleted as one block, without scaling. Shadings cannot be selected | PDFium does not group paragraphs; a grouping of our own misleads about what will move. The extent of a shading is its clip: a move of it shows nothing |
| Clip | The clip of an object follows its transformation (`FPDFPageObj_TransformClipPath`) | An image cropped by InDesign or Word would leave its window and disappear |
| List after edit | The list of the objects of a page is collected on an edited copy: boxes and texts are those after correction, indexes those of the original | After a longer correction, the selection and the ghost follow the new text |
| Invisible text | A text in invisible render mode (OCR) cannot be selected | A correction of it would change nothing visible, and it gets in the way of the selection of the scan below |
| Picture page | When the selected image covers at least 90% of the page in width and in height, the panel says that the page is a picture, that its text can be covered but not corrected, and points to Redact | A ticket whose background is a rasterized image (4 October): the user tried to correct a text that is not text |
| Text correction | When all the letters are in the text that the document already writes with this font, the font stays (`FPDFText_SetText`), WinAnsi or not. Otherwise, the text switches to the closest standard font: Times if the font has serifs or a known serif name, Courier if it is fixed-pitch, Helvetica otherwise; bold and italic carry over; letters outside WinAnsi are then refused and the correction is not kept. A non-embedded font accepts all of WinAnsi, except a symbolic font. A font without a name, or a name that both an embedded font and a non-embedded font carry, is never kept. The position, size, color and render mode are kept, and the baseline too. Enter ends the input: a text object is one line | An embedded font often has only the glyphs in use: a new letter would come out blank. The set of letters used in the whole document with the font is the largest safe set. Two subsets with the same name, from a merge, do not have the same glyphs |
| Warning | During input, the screen says when the text will change font, and when some letters cannot be written. The letters of the fonts (`fonts`) are collected only at the first input | The user chooses with full knowledge. A collection of all pages at opening delayed the first selection on a large document |
| Move, size | In points of the displayed page, like the additions. A text or a group carries a cumulative offset (`move`), applied after the text correction. An image or a path carries its final box (`box`) and is resized by its corners, with a scale from the opposite corner. The engine converts the transformation into a page matrix through the axes of `displayed()` | A scaled text would have distorted glyphs. A box for a text would be ambiguous: "ace" and "Ace" do not have the same top, and a move followed by a correction shifted the baseline |
| Read-back after correction | After `FPDFText_SetText`, the text is read back; if it differs, the object switches to a standard font | Two subsets with the same name, from a merge, pool their letters in the list: a letter missing from this subset would come out blank |
| Deletion | `FPDFPage_RemoveObject`. A deleted object disappears from the file: it is not a cover | Redact stays the tool to remove a passage and leave a visible mark where it was |
| History | Edits of original objects go into the same history as the additions: a single undo stack. One edit per object, overwritten by the next one | Two stacks would confuse the user |
| Annotations | Note (`/Text`), highlight, underline and strikethrough (`/Highlight`, `/Underline`, `/StrikeOut`) are written as annotations, not in the page content, without appearance: each reader draws its own, and PDFium too when it renders. A note carries its text and an optional author; its icon is the one of the reader, as for an Acrobat note | "Annotate" means that Acrobat and Preview reopen the note. The freehand highlighter, on the other hand, stays in the page. `FPDFAnnot_SetAP` refuses our streams and the appearance generated for a note is empty |
| Text selection | The words of the page (`FPDFText_*`, boxes in displayed points) are listed with the objects. A drag with an annotation tool selects the words that the rectangle touches, grouped into one quadrilateral per line | A rectangle selection is enough on a page; it avoids the reading order, which is often wrong |
| Links | `/Link` annotation without border, on a dragged area. Target: a web address (`/URI`, `http`, `https` or `mailto` only, written in ASCII: host in punycode, path encoded) or a page of the document (`/GoTo` to the top of the page). A link without an address blocks saving, and the panel says on which page it waits | What Acrobat does; the visible border is a relic. A `/URI` is 7-bit; `javascript:` has no place in a PDF |
| Note and rotation | The note carries `NoRotate` on an upright page only | With `NoRotate`, Acrobat turns the icon around the corner of the `Rect` in unrotated space: on a turned page, it landed one icon away |
| Panel fields | The text and the author of a note, and the address of a link, make one undo step per visit to the field. A gesture on the page first removes the focus from the field | Otherwise the step of the field and the step of the gesture got mixed |
| Added images | An image placed several times is a single XObject, placed by form objects, like signatures. Quarter-turn rotation and flips are matrices around the center of the box. The crop is cut in the browser and becomes a new image (JPEG at 0.9 if it was opaque, PNG otherwise) | A light file. The `BBox` of a form would have cropped without a change to the pixels, but PDFium computes the bounds of a form without it: the cropped image looked whole on read-back |
| Original images | Rotation and flip: matrix only, around the center of the image as displayed. Crop: the pixels are read back as the page shows them, transparency included, at their size (16 Mpx at most), cut and written into a new image object. This object takes the index of the old one and covers the cropped part of its placement. A form made of a single image is listed as an image and can be resized; only a true image object placed upright or by a quarter turn can be cropped | No API puts a clip on an existing object, and the bounds of a form ignore its `BBox`. The stream of the original image can be drawn elsewhere (a logo on each page): a write into it would have cropped it everywhere. An upright frame on a skewed image would distort it |
| Turn and mirror | The turn is drawn before the mirrors. With a single mirror active, "Turn right" records a left turn, so that the image does turn right on screen | Composition of transformations |
| Frame | A corner dragged beyond the image stops at its edge. The frame clears as soon as the selection changes, through a gesture, a key, an undo or a new image. "Crop" and "Apply the crop" wait until the object list is up to date | Otherwise the frame slid, stayed stuck without a button, or worked on old corners |
| Crop frame | You drag the frame by its corners inside the image box. "Apply the crop" converts it into fractions of the pixels (rotation and mirrors undone for an added image, projection onto the pixel corners for a document image), composed with the crop already done | A second crop applies to pixels already cropped |
| File size | An original image is rewritten only if you crop it; a cropped JPEG then becomes a compressed pixel stream, which is heavier | Limit written in the spec; PDFium does not cut the bytes of a JPEG |

### Zoom (4 October 2026)

| Topic | Decision | Reason |
|---|---|---|
| Zoom | From 50 to 200% in steps of 25, buttons in the pagination bar as in Sign. The sheet overflows with a horizontal scroll. The resize observer recomputes the `unit` scale. The preview is rendered at the zoom scale (4,000 px at most). On a touch screen, the buttons are hidden: you pinch the browser | Requested by the author. You cannot correct an invoice in 7.5 pt at scale 1, and a preview stretched three times would be blurry. A zoomed sheet under `touch-action: none` could not be dragged with a finger |

### Forms (4 October 2026)

| Topic | Decision | Reason |
|---|---|---|
| Existing fields | In Edit, you fill the form widgets of the page in place. A click on a text field opens the input on top, and Enter or a click elsewhere confirms. A checkbox or a radio button toggles on click. A dropdown or a list box opens a menu. Read-only fields, buttons and signatures do not react | The gesture of a reader; no separate panel |
| Preview | The page is rendered with the current values (`FPDF_FFLDraw` on a copy that has the values set, like the original edits); the HTML input shows only during typing | What you see is what is saved, in the font and color of the field |
| Writing | `EPDFAnnot_SetFormFieldValue` then `EPDFAnnot_GenerateFormFieldAP` on each changed widget, in the form environment of the document (`engine/forms.ts`). Checkbox: "Off" or its export value. Radio button: the export value of the clicked button. List: the option by its index, set by the PDFium form filler (`FORM_SetIndexSelected`), which knows its export value when it differs from the label. Text: one line, limited by `MaxLen`. Hidden widgets (`Hidden`, `NoView`) are not offered | PDFium regenerates the appearance from `/DA` and `/MK`; readers show it without `NeedAppearances` |
| Undo | A value (`FieldEdit`: page, widget index, value) goes into the history with the additions and the edits, one step per confirmation | Same gesture as the rest |
| Out of scope | XFA forms: no field offered. Format, calculation and validation scripts: not run, because our PDFium has no JavaScript engine | Engine limit |
| Creation | A "Field" tool (key `f`) places a text field (one line or several), a checkbox or a dropdown. A click places the default size (160 × 24 pt, checkbox 14 × 14), a drag draws the frame. The panel names the field ("Field 1", "Field 2"… by default), checks "Several lines" for a text, and lists the options of a list, one per line. Two fields with the same name, or an empty name, block saving | After filling, in the order decided. The name is the `/T` of the field: it must be unique |
| Writing a field | `EPDFPage_CreateFormField(page, form, type, empty name)`, then the name as `/T` of the widget through `FPDFAnnot_SetStringValue` (the name passed at creation is written as raw UTF-8, which readers read as PDFDocEncoding: « PrÃ©nom »), `/Rect`, the flags (`Multiline`, `Combo`), `/DA` Helvetica set at 12 pt by `EPDFAnnot_SetDefaultAppearance` (which records the font in `/DR`; at 0 it writes no font) then rewritten at automatic size, black one-point border, the options, and `EPDFAnnot_GenerateFormFieldAP`. This comes after the annotations of the page, so that the indexes of the existing widgets do not move | What the EmbedPDF engine does, read in its `@embedpdf/engines` package |
| Two passes | At export, the new fields get their name, their frame and the Print flag, then the document is saved and reopened. PDFium knows a field only by the name given at its creation, and on this reopening the flags, the appearance and the options go through its form API (`finishFields`) | A field created without a name is not in the PDFium tree |
| Names | Not empty, without a period, unique to each added field and absent from the document, parents included ("a" is refused if "a.b" exists). The names of the document are read once when the tool opens (`fieldNames`); the panel and the Save button know them, and the export checks them again (`fieldNameTaken`). A list without options is not saved. XFA form: refused (`xfaForm`) | Readers merge the fields of the same name; the period separates a hierarchy; a widget added to an XFA form would stay invisible |
| Turned page | The Field tool places nothing on a turned page, and the engine refuses it | PDFium draws the text of a field along the axis of the page: the text would turn with the page, and no API writes the `/MK /R` of the widget |
| Radio buttons | Not offered: PDFium gives every new button the export value "Yes", with no way to change it, so two buttons of a group would check together. A dropdown fills this role | Engine limit |
| Added field | You fill it after saving, not in the same session: it is an addition, not yet a widget of the page | Like "Prepare Form" then "Fill & Sign" in Acrobat |

### Stamps (4 October 2026)

| Topic | Decision | Reason |
|---|---|---|
| Stamp | A word in capitals in a rounded frame, in bold Helvetica, with today's date below on request; red by default, six colors. Ten words per language (Approved, Rejected, Draft, Confidential, Urgent, Paid, Received, Copy, Void, Sign here) and a free text in capitals, WinAnsi. A click places 160 × 50 pt, centered; a drag draws the frame (a frame with a side under 20 pt counts as a click). The word and the date are sized to fit the frame (`stampLayout`, PDF advance widths); the stroke and the corners follow the shorter side. The word chosen or typed becomes the word of the next stamp | What Acrobat puts in its standard and dynamic stamps. The date is fixed in the file, like the Acrobat date |
| Writing | In the page content: a path for the frame, a text object for the word, one for the date | Like the other additions. Acrobat writes them as annotations, but nobody reopens a stamp |
| Key | `b` | The letters of « tampon » and "stamp" are taken |

### Shortcuts (4 October 2026)

| Topic | Decision | Reason |
|---|---|---|
| Keys | One letter per tool, shown on its button like a keyboard key (framed capital, thick bottom edge; a red dot read as an alert): v select, t text, r rectangle, o ellipse, l line, a arrow, p pen, h highlighter, n note, m highlight text, u underline, s strike through, k link, i image (opens the picker). Without a modifier, never during typing in a field, and only when the key targets the page or the editor. The badges are hidden on a touch screen | Requested by the author; what drawing software does. Voice dictation elsewhere on the page must not change the tool |

### Text box (4 October 2026, after the second version)

| Topic | Decision | Reason |
|---|---|---|
| Box | A drag with the Text tool draws a box; the added text then has a width and its lines wrap. A click gives a free text, without a width, as before. Two handles, left and right, change the width of a text; on a free text, they turn it into a box | The most visible gap compared with Acrobat |
| Measurement | Lines are broken with the advance widths of the PDF standard fonts, read once in PDFium (`engine/standardWidths.ts`, `FPDFFont_GetGlyphWidth` takes Unicode code points: the 32 signs from 0x80 to 0x9F are read by their character), on screen as in the engine; the bounds and the selection of a text use them too. Greedy breaking at whitespace, whitespace at the start of a line kept, a word that is too wide broken letter by letter, a typed line break kept | The same function on both sides: the line breaks at the same word in the SVG preview and in the file. Read by WinAnsi code, dashes, ellipses and quotes got the width of the missing glyph |
| Gesture | A drag counts as a box from 20 pt and 8 px on screen; below that, it is a click. The Text tool goes over the images and paths of the document: only a line of document text stops it | On a phone, 4 pt is 2 px: a shaky touch made a 20 pt box. You must be able to write on a scan |
| Input | The input field takes the width of the box and wraps with the browser font. If it needs one more line, it grows instead of scrolling the first line. When you leave the field, the preview shows the line breaks of the PDF. For a free text, the field takes the wider of the two measurements, PDF and browser | An editor that wraps exactly like the PDF would require us to draw the input ourselves. A letter outside WinAnsi counts as half an em in PDF advance widths: the field of a Cyrillic text would be too narrow |

### Known limits of the second version

- A corrected text loses its fine kerning (`TJ`): the spacing becomes that of the advance widths of the font.
- A text corrected in another font changes width: it can overlap what follows it.
- You cannot edit the objects of a form XObject one by one.
- A cropped original image is rewritten as pixels, JPEG included: the file can grow. It loses its clip and its blend mode; its opacity is baked into the pixels.
- You cannot resize an original text, and it does not become a box: only an added text wraps.
- During input, the browser font can break a line one word earlier or later than the PDF; the preview realigns when you leave the field.
- On a rotated page, PDFium draws an underline or a strikethrough along the bottom of the quadrilateral in page space, so it is askew; Acrobat, Preview and pdf.js follow the order of the corners. The editor draws its own annotations in SVG and is not affected; PDF to JPG can be.
- A note has no appearance: a tool that renders pages as images does not show it.

### Tests

- Engine (`tests/engine/editOriginals.test.ts`): list of the objects with text, font, size, color and displayed box on a rotated page; invisible text excluded; page written glyph by glyph grouped into lines, moved, corrected and deleted as one block; words and lines; move and deletion read back as pixels and by pdf.js; correction that keeps the embedded font for letters already written and switches to a standard font for a new letter, baseline kept; image moved and resized.
- Engine (`tests/engine/editAnnotations.test.ts`): note read back by pdf.js with its text and its author; highlight, underline, strikethrough with their quadrilaterals and an appearance; web link and page link read back; render with annotations.
- Engine (`tests/engine/editImages.test.ts`): added image as is, turned, flipped, turned after a mirror, on an upright page and on a rotated page; image placed twice stored once; original image turned and flipped, cropped in place (JPEG rewritten as pixels), cropped without a change to its other occurrence, cropped then scaled.
- Model (`tests/unit/editModel.test.ts`): edits of original objects in the history, selection key, quadrilaterals per line, crop as fractions.
- Browser (`tests/e2e/edit.spec.ts`): an original text corrected and read back; an object deleted; a note placed; a link placed; a rotated image.
- Added later on 4 October: forms (`tests/engine/forms.test.ts`: fields drawn in the render, listed, filled, added, a turned page and a taken name refused); stamps (`edit.test.ts`, `editMetrics.test.ts`, `editModel.test.ts`); in the browser, the text box, the zoom, the tool keys, the circle with Shift, the page-sized picture, the stamp, the form filled, a field name refused, fields added.
