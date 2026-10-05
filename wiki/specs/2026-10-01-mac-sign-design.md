# Mac: Sign a PDF

_Swift app removed on 5 October 2026: this spec is an archive, and the code is at the tag `mac-final`._

## Goal

Add a visual signature, drawn or imported, to a PDF in Holy PDF for Mac, then save a new copy. The Scanner stays available. No server, no account and no new engine: PDFKit, Core Graphics and ImageIO are enough.

## Identity and flow

Brother Quill joins the monastery as the second tool. The monk is exported from the official drawing; Bricolage stays reserved for large titles, and the other texts and controls stay native. System backgrounds, blue accent, light and dark modes, the formal « vous » and a French/English catalog.

1. Open or drop a PDF. A locked file asks for its password. A digitally signed PDF is explicitly refused, to preserve its certificate. A form that carries only Adobe usage rights (`/UR`, `/UR3`, like the forms of the US tax authority) is accepted: nobody signed it. The copy loses these usage rights. The check is shared by Sign, Merge, Organize and Watermark.
2. Create a signature in a native sheet: drawing with the mouse or the trackpad, or PNG/JPEG import. The transparent background of a PNG is kept; a JPEG keeps its background.
3. Show one page at a time, go to the previous or next page, add the signature, move it and change its size proportionally. Several placements of the same signature are possible, and several different marks since 3 October. Deleting a placement and undoing an edit are available.
4. Save a copy with the macOS dialog. The source PDF stays unchanged. The result shows the saved file and lets the user show it in the Finder.

Work layout: page centered on a system background on the left; signature panel and save button on the right. The signature moves above the preview, without computing a new PDF render. The window keeps its current minimum dimensions, 960 × 640. Disabled controls explain the next action. The monks stay at startup and on the card, in line with the native design.

## Several marks (3 October 2026)

At the author's request, the screen takes over what Sign does on the web ([site spec](2026-10-01-web-sign-design.md)): several different marks exist side by side, and each one can be placed as many times as wanted.

| Topic | Decision | Reason |
|---|---|---|
| Marks | A "Your marks" list in the panel: drawn signatures, imported images, typed lines. Twenty at most, and the screen says so at the twenty-first. Creating a mark does not erase the others, nor a mark that is still decoding; the new one becomes the current mark and is placed at once | A contract asks for a signature, initials and a date. Review of 3 October: a second addition cancelled the first one without a word |
| Text | One line of 120 characters at most (the field stops there, and keeps its line after the addition), in Handwritten (Bradley Hand, shipped with macOS) or in Plain (Helvetica), rendered as a transparent image by Core Text, as wide as its glyphs, then treated like a signature. Placed 24 points high, whatever its length | The site's rule, with a Mac font instead of Caveat: no file to embed. Review of 3 October: placed at 28% of the page width, "AL" took a third of the height |
| Placement | "Place on this page" places the current mark at the center; a click on the page places it at that spot, within the limits of the page. The first click only deselects the selected mark | Like on the site ("Add here") |
| Removal | The trash button of a mark removes it with all its places; "Remove from the page" removes the selected place. Both can be undone | |
| Engine | `PDFSigningDocument.signedData(marks:placements:)`: each place names its mark; each image is decoded once | Each PDFKit stamp carries its own appearance: a mark placed three times is written three times (the site shares a single object) |

Outside this milestone, and offered by the site: the rotation of a mark, the zoom of the page and the rotation of the page.

## Preservation

A `PDFSigningDocument` actor in `PDFCore` owns the PDFKit document and its data. It imports neither AppKit nor UIKit. The export opens a copy of the original data and adds stamp annotations with a persistent appearance; no rebuild of the pages, no rasterization of the document and no global flattening of the annotations.

The placements are stored as normalized rectangles, with the origin at the top left of the visible page. A single central conversion takes CropBox and rotation into account. Successive exports always start again from the original: no hidden accumulation. Remove the default annotation author that PDFKit supplies, so that the identity of the Mac account is not embedded.

The imported file never changes. The signatures and the password stay only in the in-memory session. The exported copy of a protected PDF opens without a password, with a note in the interface. PDFKit can keep an encryption dictionary with an empty password: do not present this copy as decrypted. Closing the window keeps the session; quitting warns if placements were not saved.

## Performance

- No OCR and no WebAssembly engine for Sign; opening and export off the main actor.
- Preview limited to a single page, with a longest side of 1,600 pixels at most and a bounded area. Release the old preview when the document changes, and limit stale renders during fast navigation.
- Moving by overlay, without rendering the page or exporting the PDF during the gesture. Aim for less than 16 ms of update work; do not treat a geometry measurement as a measurement of the smoothness of the whole screen.
- PDF opened in the app: 256 MiB at most before reading. At most 100 placements and 100 undoable operations per session.
- Imported signature: 10 MiB and 16 Mpx at most before decoding, normalized to 1,600 pixels per side and 1 Mpx. Image metadata not copied.
- Measure a preview and an export on a synthetic 20-page PDF: reference values of 1 s for the preview and 3 s for the export on this machine, without making them a universal guarantee.

## Validation

The engine must prove persistence after reopening, transparency, placements under the four rotations with cropping, selectable text, links, fields, the title, the intact original and no accumulation. Also check passwords, invalid files, existing digital signatures and image limits.

The app must cover creation, placement, deletion, undo and export; check the localizations and light and dark screenshots. `swift test`, the Xcode tests and `check-strings.py` stay the reference commands. The structure and rendering checks have explicit bounds: no certification of all PDF profiles or of dynamic forms.
