# Web: Add bookmarks

_Written and shipped on 3 October 2026. Follows [the bookmarks on Mac](2026-10-02-mac-bookmarks-design.md): same flat list, same rules for position and level._

Brother Ribbon (`/fr/signets-pdf`, `/en/pdf-bookmarks`) reads the bookmarks of a PDF, adds some on the displayed page, renames them, arranges them and removes them, then saves the copy.

## Decisions

| Topic | Decision | Reason |
|---|---|---|
| Engine | `engine/bookmarks.ts`: `listBookmarks` reads the outline as a flat list (title, page, level, view). `writeBookmarks` clears it (`EPDFBookmark_Clear`) and writes the list (`EPDFBookmark_AppendChild`, `EPDFBookmark_SetDest`) | Probe of 3 October: pdf.js reads back the written tree, accented titles and levels included |
| Destination | A bookmark that is read keeps its view as is: `XYZ` with its values left empty, `Fit`, `FitH`… with their parameters. A bookmark read through a GoTo action or a named destination is rewritten as a direct destination. A `FitH` or `FitBH` without a height leads to the top of the page. A view that PDFium cannot rebuild does too | PDFium gives the whole view, where PDFKit gives only a point. It tells an empty parameter from a zero only in a complete `XYZ`: elsewhere an empty value reads as 0, and a height of 0 would lead to the foot of the page |
| New bookmark | `XYZ` at the top-left corner of the page as the reader sees it, zoom left empty. It goes after the bookmarks of its page and of the pages before it, at the deeper level of its two neighbors | As on Mac |
| Bookmark without a page | Left out and counted if it leads to an address, to another file or to nothing, or if its title is empty. Its children take its place | As on Mac. A loop in the outline stops at the bookmark already seen |
| Reading | `bookmarks` request of the worker, loaded with the editor. The screen waits for both | The outline on screen is always the one of the open document |
| Screen | The preview and its arrows on the left. The title, "Add a bookmark to page N" and the list in the panel. Each row: editable title, "p. N" that shows the page, two level arrows, trash | On Mac, the levels went through a context menu. A site shows them |
| Removal | The children of the removed bookmark move up one level, in its place | On Mac, they went under the previous bookmark: removing "Part I" put "Chapter 2" under "Chapter 1" |
| Save | Offered from the first change, refused while a title is empty (red border) | As on Mac |
| Signed PDF | Refused (`alreadySigned`) | Any rewrite invalidates the signature |
| Protected PDF | Opened with its password. The copy keeps this password | PDFium rewrites the original encryption |
| Monk | "Brother Ribbon" (« Frère Signet »), the book, joyful pose, Organize category | The name and the pose from the Mac |
| Search | `signets`, `sommaire`, `chapitres`, `plan du document`, `marque-page`… Without « table des matières » | Search would then match it for « tableur » (spreadsheet) |
| Shared preview | `signature/pagePreview.ts`: the loading of the page preview, shared by Redact and Bookmarks, and by Crop since 4 October | One code path for waiting, failure and retry |

## Known limits

- No drag and drop to reorder, and no choice of the destination point in the page.
- An existing bookmark loses its open or closed state, its color and its bold or italic style: viewers show bookmarks that have children as closed.
- In an outline that does not follow the page order, a new bookmark goes after the last bookmark of an earlier page.
- Only one PDF at a time.

## Tests

- Engine (`tests/engine/bookmarks.test.ts`): reading in order with levels, bookmarks left out and counted, children in their place, GoTo action and named destination; incomplete `XYZ` and `FitH` without a height; loop stopped; views kept on rewrite, title with its spaces; three levels in various alphabets; replacement and removal of all bookmarks; top of page for the four rotations on a box that does not start at zero; level clamped; impossible page or title refused; signed PDF refused, protected PDF that stays protected. Read back by pdf.js.
- List (`tests/unit/bookmarksOutline.test.ts`): position and level of a new bookmark, levels clamped, children of a removed bookmark moved up, save offered.
- Browser (`tests/e2e/bookmarks.spec.ts`): two bookmarks added, default title, one placed under the other; the bookmarks of the PDF listed, "p. 2", empty title refused, bookmark removed.
