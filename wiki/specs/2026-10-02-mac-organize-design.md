# Mac: Organize pages

_Swift app removed on 5 October 2026: this spec is an archive, the code is at tag `mac-final`._

## Flow

Fourth native tool, Brother Binder. Open or drop a PDF, and show its pages in an adaptive grid. Each card offers an enlarged preview, a move to previous/next, a clockwise rotation and a deletion. Dragging moves a page before/after a card or to the end of the grid. During the drag, an insertion bar shows where the page will land: to the left of the hovered card if the pointer is on its left half, to the right otherwise. The drop zones also cover the space between the cards. A change of order (drag, arrows, undo) is animated. The positions shown are those of the copy; the source page number stays identifiable. The last page cannot be deleted. Undo (⌘Z) restores the order, the deleted pages and the rotations. The original stays intact; saving uses the macOS panel and creates a copy.

One document at a time, local passwords, explicit errors, and a confirmation to discard only when unsaved work would be lost. The session survives when the window closes. Opening another file or quitting respects unsaved changes. The ⌘O, ⌘E and ⌘Z commands follow the active tool. French/English, system colors, buttons with hover, Brother Binder in the home grid.

## Engine and performance

`PDFOrganizingDocument` in PDFCore owns the original data and the reading document, in an actor. The editing state is limited to the page indexes and their rotations; moving or rotating a card requests no new render. The export starts again from a fresh document, keeps vector and selectable content, and does not rasterize the pages. Link/bookmark targets that were removed are cleaned up, and incompatible structures and certificates are refused explicitly. The preservation limits must be documented and visible before the export.

256 MiB at most at opening, reading off the main actor; thumbnails on demand limited to 240 pixels, cache of 32 images. Cards that leave the screen release their images. The enlarged preview renders only one page, at 1,600 pixels. These caps are not a guarantee on the internal memory of PDFKit. History of 100 actions, with no copy of the pixels. No new dependency or network permission. A destination that is the source, or a symbolic or hard link to it, is refused.

## Verification

Synthetic fixtures: order/export, rotations, deletion, undo, protected files, preservation of text/annotations/links/bookmarks, cancellation and intact sources. Measurement on 100 pages; check of the drag gesture in a real window and at both ends. Light/dark captures at the minimum size, types/compilation, Swift tests and string catalog. No private document added.
