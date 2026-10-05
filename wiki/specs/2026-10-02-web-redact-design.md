# Web: Redact a PDF

_Written and shipped on 2 October 2026. Same rule as [Redact on the Mac](2026-10-02-mac-redact-design.md), chosen by the author: a page that carries a black zone becomes an image at 200 dpi._

Brother Inkpot (`/fr/noircir-pdf`, `/en/redact-pdf`) covers in black what the visitor draws on the pages of a PDF, then gives a copy where this content no longer exists.

## Decisions

| Topic | Decision | Reason |
|---|---|---|
| Engine | `engine/redact.ts` renders each marked page as the reader sees it, at 200 dpi, paints the zones black on whole pixels, encodes the image as JPEG (quality 0.8), then empties the page in place and puts the image on it | What the image does not show leaves the file |
| Empty in place | The page keeps its object: its content objects and its annotations go, the image takes their place, rotation and boxes are kept | Probe of 2 October: PDFium does not write the original objects that nothing reaches any more, and the bookmarks and links to the page still point at it. Deleting then re-creating the page broke the bookmark |
| Annotations | Before it leaves the page, each annotation is emptied: value and default value, text, link address, appearance | A removed annotation stays reachable through the tag tree (`OBJR`), through a popup or through its field |
| Fields | The value of a field goes through the PDFium form API (`EPDFAnnot_SetFormFieldValue`), which writes where the field keeps it, sometimes in a parent without `/Type /Annot` | `FPDFAnnot_GetLinkedAnnot` does not go up to that parent |
| Other pages | A popup or a reply linked to a removed annotation, and another widget of a removed field, are emptied and removed from their page | Three leaks proven by the probe, as on the Mac |
| Form | The form environment is opened without `FORM_OnAfterLoadPage` | With it, PDFium generates an appearance for each annotation that has none, before the annotation is emptied, and PDFium always writes the objects created during the session |
| Refusal | A signed PDF (`alreadySigned`); an XFA form (`xfaForm`, new error) | XFA keeps its values in an XML stream that no page reaches and that PDFium cannot modify |
| Large pages | The long side of the image is capped at 6,000 pixels | A poster at 200 dpi would need gigabytes |
| Editor | `redact/RedactEditor.tsx`, loaded with the first file, like the signature editor. A drag draws a zone, a click does not; a cross removes a zone; a handle at the opposite corner moves it, by drag or with the arrow keys (Shift: faster), and does not let it leave the page (since 3 October, like the signature). Cross and handle are 22 px, their target 44 px; "Clear this page" removes the zones of the page; the page list marks with a ■ the pages that have zones | No weight on the first display. No zoom and no undo (⌘Z) in this milestone |
| Touch screen | The sheet fits in the height of the screen | A finger on the page draws instead of scrolling: there must be space around the page to scroll |
| Monk | "Brother Inkpot" (« Frère Encrier »), the eraser, the focused look | The name from the Mac |

## Known limits

- The whole redacted page becomes an image: its other text can no longer be selected, and its form fields disappear.
- The document title, its bookmarks, its metadata and the replacement texts of the tag tree (`/Alt`, `/ActualText`) are not checked. The screen says so for the title, the bookmarks and the metadata.
- The default value (`/DV`) of a field whose widgets are children stays in the file: no PDFium function reaches this parent to write it. It is a value set by the author of the form, not user input.
- A page thumbnail (`/Thumb`) stays in the file.
- A field of the redacted page also disappears from the other pages where it appears.
- A redacted page weighs about 1 MB in A4 format.

## Tests

- Engine (`tests/engine/redact.test.ts`): six secrets of a page (text, form object, note with a popup and a reply on the other page, link reached through the tag tree, field, field shared with the other page) are absent from the bytes and from the decompressed streams; other page, bookmark and link kept; image of 833 × 1,111 pixels for 300 × 400 points, black zone; zone and displayed size kept under the four rotations; cap of 6,000 pixels; empty or off-page zones ignored; signed PDF and XFA form refused.
- Browser (`tests/e2e/redact.spec.ts`): copy without the text of the redacted page, the other page kept; a click does not draw a zone; removal of a zone and of a page; zone moved by its handle and with the arrow keys, kept in the page; cross and handle of 22 px at most, hit at 18 px from their center.
