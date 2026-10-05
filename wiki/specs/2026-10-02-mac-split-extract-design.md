# Mac: Split a PDF and Extract pages

_Written on 2 October 2026. Status: Swift app removed on 5 October 2026 (tag `mac-final`); at the time, shipped in `apps/mac`._

## Goal

Two more tools in Holy PDF for Mac, on the Organize pages engine, with no new engine or dependency:

- **Split** (Brother Scissors): cut a PDF into several files, wherever you want;
- **Extract** (Brother Lens): keep only the chosen pages, in a new PDF.

The spec succeeds when:

- each part of a split PDF contains its pages, in order, with their selectable text;
- the extracted PDF contains the chosen pages, in document order;
- no existing file is overwritten, and the original file is never modified;
- the package, app and string tests pass, with no compiler warning.

## Decisions

| Topic | Decision | Reason |
|---|---|---|
| Two tools, one screen | Two cards on the home screen. One screen and one session, with a "split" or "extract" mode | The author's choice: one monk per tool, like the site. The two tools differ only in what you mark (a cut or a page) and in how they save |
| Cuts | Scissors between two pages add or remove a cut. "Pages per file" sets the cuts in one go | The author's choice. Covers regular and irregular parts |
| Split files | In a chosen folder: `nom-1.pdf`, `nom-2.pdf`… A file already there keeps its place: the new one is called `nom-1-2.pdf` | The author's choice. Nothing is overwritten, so the original is not either |
| Extract | A single PDF, `nom-extrait.pdf`, through the save panel | The author's choice. For one file per page, use Split |
| Engine | `PDFOrganizingDocument.organizedData`, called once per part | It already writes a subset of pages, removes links to missing pages and keeps the valid bookmarks |
| Loading | The session contains an `OrganizingSession`, which opens the PDF, asks for the password and renders the thumbnails | No second loader. `OrganizingSession` receives only the function that words its messages, and a method that copies pages |
| Refusals | Like Organize pages: digitally signed PDF, attachments, layers, dynamic forms | Same engine, same limits |

## Flow

1. **Open** or drop a PDF. A protected file asks for its password.
2. **Mark**, on the page grid:
   - *Split*: a scissors button between two pages adds a cut; a second click removes it. Each page says which file it will go to ("File 2"), and the files alternate between two tints. "Pages per file" and "Apply" set the regular cuts; "Remove cuts" removes them. A click on a page enlarges it.
   - *Extract*: a click on a page checks or unchecks it. An eye button enlarges it. "Select all" and "Deselect all".
3. **Save**:
   - *Split*: "Split into N PDFs…" opens a folder chooser, then writes one file per part. The screen says how many files were written and offers "Show in Finder".
   - *Extract*: "Save selection…" opens the save panel.

⌘O opens, ⌘E saves, ⌘Z undoes the last cut or selection. Opening another PDF or quitting with unsaved marks asks for confirmation.

## Known limits

- Those of PDFKit, described in the Watermark spec: slow writes and heavier files on some PDFs.
- Each part reads the original PDF again: splitting into 100 files makes 100 reads. Measured on 100 synthetic pages: 100 files in 0.18 s.
- If the write fails in the middle of a split, the files already written stay, and the screen says after which file it stopped. A file is written in full or not at all: each part goes through a temporary file, then moves into place.
- While the save or folder panel is open, the marks do not change: what is saved is what was on screen.

## Tests

| Level | What | Where |
|---|---|---|
| Session | Extract: the chosen pages in document order, the original intact, nothing without a selection, undo. Split: the parts according to the cuts, "pages per file", one file per part, no file overwritten, undo. A new PDF clears the marks | `PagePickingSessionTests` |
| Brand | Brother Scissors and Brother Lens in the catalog, in light and in dark, up to date with the site | `MonkAssetTests`, `export-monk-assets.mjs` |
| Home | Split and Extract are no longer in "Soon" | `BrandTests` |
| Screens | Captures of both tools, in light and in dark | `PagePickingSnapshots` |
| Strings | All translated, never the informal « tu » | `check-strings.py` |
| By hand | The steps in `wiki/development/tests.md` | |
