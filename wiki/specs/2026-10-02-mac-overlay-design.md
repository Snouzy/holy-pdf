# Mac: Overlay two PDFs

_Written on 2 October 2026. Status: Swift app removed on 5 October 2026 (tag `mac-final`); at the time, shipped in `apps/mac`. Last tool on the list the author approved on 2 October, after [bookmarks](2026-10-02-mac-bookmarks-design.md). The site does not have this tool._

## Goal

Place the pages of one PDF on the pages of another in Holy PDF for Mac, then save the copy: a letterhead under a letter, a form background, a one-page stamp on a whole document. PDFKit only.

The spec succeeds when:

- page 1 of the placed PDF goes on page 1, page 2 on page 2, and its last page on all the remaining pages;
- it goes over the pages or under them, as the user chooses;
- the text of both PDFs stays text, and the bookmarks and links of the receiving PDF stay;
- the preview shows the result before saving, for both positions;
- the original file is never modified;
- the package, app and string tests pass, with no compiler warning.

## Decisions

| Topic | Decision | Reason |
|---|---|---|
| Engine | `PDFOverlay.overlaid` goes through `PageOverlay.write`, the Watermark building block: PDFKit draws each page, and the page of the other PDF before or after it | Probe of 2 October: 15 pages in 0.4 s, both texts kept, bookmarks and fields of the receiving PDF kept |
| Under | `PageOverlay.write(under:)` draws first, then the page. The placed PDF shows where the page painted nothing | A PDF page does not paint its paper: this is what makes a letterhead possible |
| Size | The placed page is fitted to the receiving page and centered, without distortion, as the reader sees both (rotation and box included) | An A4 page on a Letter page must not overflow or stretch |
| Drawing the placed PDF | With Core Graphics (`drawPDFPage`), with the rotation and box of its page, for the copy and for the preview | Review of 2 October: during a write, `PDFPage.draw` ignores the rotation; a placed page rotated by a quarter turn disappeared from the copy. It also drew the annotations of the placed PDF, but only on screen |
| Missing pages | The last page of the placed PDF repeats on the remaining pages | A one-page letterhead serves a whole document; a two-page letterhead (first page, following pages) does too |
| Placed PDF | Read only: a signed one is accepted. A protected one is refused with the steps to follow (unlock it first). It stays selected from one document to the next | The same letterhead serves several letters. A second password prompt would complicate the screen for a rare case |
| Receiving PDF | A signed one is refused: its copy would keep a signature that would no longer be valid | Like the other tools that rewrite the document |
| Choosing the placed PDF | A macOS open panel (`chooseFile`), not a second `fileImporter`. The session is busy from the panel until the read ends | Review of 2 October: of two nested `fileImporter`, SwiftUI presents only the outer one, and "Choose a PDF…" did nothing. The Watermark tool had the same defect for its image: fixed the same way |
| Preview | `PDFCopySession.underlay` and `preview(underlay:)` draw under the page, on the white paper; `overlay` draws on top | A color blend on top would have shown the placed PDF over the flat color areas, where the copy hides it |
| Monk | "Brother Layer" (« Frère Calque » in French), the stamp, joyful | The site does not have the tool: the author must confirm the name and the pose |
| Search | Its own words (`Tool.ownWords`): « superposer », « calque », « papier à en-tête », « arrière-plan » | The site has none for it |

## Flow

1. Open or drop the receiving PDF. A protected file asks for its password.
2. "Choose the PDF to place on top…": its name and page count appear, and the preview shows it.
3. Choose "Over the pages" or "Under the pages".
4. "Save the overlaid copy…" suggests `nom-superpose.pdf`.

## Known limits

- No setting for size, position or opacity, and no page selection.
- The annotations, fields and links of the placed PDF do not follow: only its drawing is placed.
- Over the pages, the annotations and fields of the receiving PDF stay above the placed PDF in the copy, but the preview covers them.
- Under the pages, the placed PDF stays hidden wherever the page paints a background, even a white one (a scan, a page exported with a background).
- A protected placed PDF must first go through Unlock.
- The PDFKit write limits apply (Watermark spec).
- The copy of a protected PDF opens without a password, and the screen says so.

## Tests

| Level | What | Where |
|---|---|---|
| Engine | Page for page and last page repeated, both texts kept; over covers, under lets the page show; fitted and centered, rotated receiving page; rotated placed page, at positions written by hand; preview of both positions; bookmarks and links kept; signed receiving PDF refused, signed placed PDF accepted; passwords | `PDFOverlayTests` |
| Tool | Nothing to save without a placed PDF; preview changed; copy saved, original intact; a position change clears "saved"; placed PDF kept for the next document; protected or unreadable placed PDF refused with its message | `OverlaySessionTests` |
| Screens | Start, ready, PDF chosen in light, in dark and in English, under, copy saved | `OverlaySnapshots` |
| Real files | A 15-page article and a 6-page form, one on the other, over and under | Probe of 2 October, not kept |
| Strings | All translated, never the informal « tu » | `check-strings.py` |
