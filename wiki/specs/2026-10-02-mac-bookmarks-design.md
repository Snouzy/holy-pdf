# Mac: Add bookmarks

_Written on 2 October 2026. Status: Swift app removed on 5 October 2026 (tag `mac-final`); at the time, shipped in `apps/mac`. Next item of the list that the author approved on 2 October, after [the sheets, the cut and Pixelize](2026-10-02-mac-sheets-design.md). The site has had the tool since 3 October: [web spec](2026-10-03-web-bookmarks-design.md)._

## Goal

Add, rename and remove the bookmarks of a PDF in Holy PDF for Mac, then save the copy. Bookmarks are the table of contents that a PDF reader shows in its sidebar. PDFKit only.

The spec succeeds when:

- the screen lists the bookmarks that the PDF already has, with their levels;
- a bookmark can be added for the displayed page, renamed, removed, and moved up or down one level;
- the copy has exactly the bookmarks of the list, and nothing else changes in it;
- a bookmark that existed keeps its page, its title as it is, and the point it led to when PDFKit gives it;
- the original file is never modified;
- the package, app and text tests pass, with no compiler warning.

## Decisions

| Topic | Decision | Reason |
|---|---|---|
| Engine | `PDFBookmarks.list` reads the outline of the document as a flat list (title, page, level, destination point); `PDFBookmarks.written` replaces it with the given list | Probe of 2 October: the 22 bookmarks of an article on three levels are read back identically after rewriting, in 0.2 s, and the 113 links stay |
| Flat list | One level per bookmark instead of a tree. A level is at most one step deeper than the level of the bookmark before it; the engine and the screen apply the same rule | A list is simple to show and to edit, and says everything that a tree says |
| New bookmark | It points to the top of its page, as the reader sees it, even when rotated. It goes after the bookmarks of its page and of the pages before | The order of the bookmarks then follows the order of the pages, and the user does not have to sort them |
| Level of a new bookmark | The deeper of its two neighbors: between a bookmark and its children, it becomes a child | Otherwise it would take for itself the children that follow it |
| Bookmark without a page | A bookmark that leads to a web address, to another file or to nothing, or whose title is empty, is not listed, so it is not kept in the copy. Its children take its place, at the same level. The screen says how many bookmarks are left out | PDFKit does not give their destination; the list shows only what it can rewrite. Review of 2 October: without this rule, the children went under the bookmark before |
| Reading at opening | `PDFCopySession.survey`: what the tool reads in the document waits in `findings`, set at the same time as the document | A second load after opening would leave the screen with the wrong outline for an instant |
| Saving | Offered from the first change, refused while a title is empty. Removing all the bookmarks is a change like any other | An identical copy has no purpose; an empty title shows nowhere |
| Signed PDF | Refused: the copy would keep a signature that would no longer be valid | Like the other tools that rewrite the document |
| Monk | "Brother Ribbon" (« Frère Signet » in French), the book, joyful | The site does not have the tool: the author must confirm the name and the pose. Two other monks already hold the book, with the two other faces |
| Search | The tool brings its own words (`Tool.ownWords`), because the site has none for it. Without « table des matières » (table of contents): with it, the search would answer « tableur » (spreadsheet) | The site's test requires that « tableur » finds nothing |

## Flow

1. Open or drop a PDF: its bookmarks are shown, indented by level.
2. Show a page with the arrows, type a title (otherwise "Page 3"), "Add a bookmark to page 3".
3. Edit a title in the list; "p. 3" shows the page; the trash button removes the bookmark; the context menu moves it under the bookmark above, or moves it up one level.
4. "Save the copy with bookmarks…" suggests `name-bookmarks.pdf`.

## Known limits

- No drag and drop to reorder, and no choice of the destination point in the page.
- An existing bookmark keeps its page and its point, but not its zoom, its open or closed state, its color, or its bold or italic style.
- A bookmark set to "fit width" or to an area (FitH, FitV, FitR, FitB) arrives at the top of its page: PDFKit does not give its point.
- The copy no longer opens the bookmarks panel by itself in the reader (the `/PageMode` setting of the document, which PDFKit does not write).
- In an outline that does not follow the order of the pages, a new bookmark goes after the last bookmark of an earlier page, and nothing moves it after that.
- The levels can be changed through the context menu only.
- The limits of PDFKit when it writes apply (Watermark spec).
- The copy of a protected PDF opens without a password, and the screen says so.

## Tests

| Level | What | Where |
|---|---|---|
| Engine | Reading in order with levels; bookmark without a page or without a title left out and counted, its children in its place; title kept with its spaces; writing on three levels read back identically; replacement and removal of all bookmarks; point of a read bookmark kept; top of the page for the four rotations, on a box that does not start at zero; level clamped, impossible page or title refused; signed PDF refused, protected PDF opened | `PDFBookmarksTests` |
| Shared session | What the tool reads at opening, kept until closing; a document that the tool cannot read does not open | `PDFCopySessionTests` |
| Tool | List of the document, addition to the displayed page, default title, renaming, level, removal, copy saved, original intact; parent and children kept together on addition; empty title refused; other document, new list; count of the bookmarks left out | `BookmarksSessionTests` |
| Screens | Start, ready in light mode, in dark mode and in English, copy saved, PDF without bookmarks | `BookmarksSnapshots` |
| Real files | Four PDFs from `fixtures-private/pdfs`: 22 bookmarks read and rewritten identically, a bookmark added on the last page, rotated page | Probe of 2 October, not kept |
| Texts | All translated, never the informal « tu » | `check-strings.py` |
