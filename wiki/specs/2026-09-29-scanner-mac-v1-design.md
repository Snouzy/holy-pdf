# Scanner Mac v1: design

_Written on 29 September 2026. Status: Swift app removed on 5 October 2026 (tag `mac-final`); at the time, shipped on 1 October 2026 (PRs #2 and #7)._

## Context

`pdf-toolbox` is an app that gathers PDF tools, in the manner of iLovePDF, with an iPhone version and a Web version later on, and possibly a commercial release. The **Scanner** is its first module: it turns photos of documents taken with a phone into clean PDFs, as if they came out of a scanner.

The pipeline was first tuned by hand, in Python and OpenCV, on a real batch of 17 photos (11 administrative documents). This spec takes over its settings and its pitfalls. The reference values are in [Scanner algorithm](../development/algorithm.md).

## Goal and success criteria

Drop a batch of photos, confirm the proposed groupings, correct the flagged pages, and get one PDF per document, in a few minutes and without a script.

v1 succeeds when, on the private batch of 17 photos:

- the 11 PDFs produced are as good as those of the Python prototype (crop, white paper, shadows removed, watermark kept, covered corners cleaned);
- each page whose automatic corners are wrong is marked ⚠︎ (the prototype had 9);
- the 17 pages are turned upright without intervention (7 photos of the batch were lying on their side);
- at least 10 of the 11 groupings are right without a touch-up;
- at least 9 of the 11 proposed dates are right;
- a page is processed in less than 1 s on an M chip, and the whole batch is ready in less than 20 s;
- a PDF weighs on average less than 500 KB per page.

## Scope

**In v1:**

- macOS 15+ app, SwiftUI, in French and in English;
- import by drag and drop or picker: HEIC, JPEG, PNG;
- page detection, straightening, automatic upright rotation, cleaning (Document or Color mode);
- manual correction: 4 draggable corners with a magnifier, white eraser, quarter-turn rotation, undo;
- on-device OCR: grouping and name suggestions, invisible text layer in the PDFs;
- export: one PDF per document, real size, without location metadata.

**Outside v1**, each one with its own spec later: iPhone app, Web version, other PDF tools (merge, split, compress, OCR of an existing PDF, signature), payment and license, session restore, structured OCR of macOS 26.

## Decisions

| Topic | Decision | Reason |
|---|---|---|
| Target platforms | Apple + Web | Product choice |
| Language | Native Swift (Vision, Core Image, PDFKit / Core Graphics) | Vision detects pages and reads text better than any portable equivalent. Rust would have shared only the easy part |
| Web | Rewrite later, following `algorithm.md` and the same test photos | No shared code is possible with Vision |
| Repository | Monorepo `Snouzy/pdf-toolbox`, without a monorepo tool | The Swift packages are shared locally between Mac and iPhone; the Web will reuse the test photos |
| Documentation | Wiki in the repository (`wiki/`, compatible with Obsidian) | The docs change in the same commit as the code |
| Minimum version | macOS 15 | Recent Swift APIs of Vision, large installed base |
| Privacy | Sandbox, files chosen by the user only, **no network entitlement** | The "nothing is sent" promise can be verified, and the App Store requires it |
| Dependencies | No third-party library in v1 | Apple frameworks first |
| Session | No save in v1; confirmation before quitting with documents not exported | Batch tool, YAGNI |

## Repository structure

```
pdf-toolbox/
├── Packages/
│   └── Core/                one Swift package, several modules:
│       ├── ScanCore         scanner engine
│       ├── PDFCore          PDF writing, shared by the future tools
│       ├── ScanSession      state of a batch: pages, documents, edits, export (Mac and iPhone)
│       └── ScanCLI          command-line tool, test bench for the engine
├── apps/
│   └── mac/                 Xcode project: shell + Scanner module
├── fixtures/                test photos without personal data + expected results
├── fixtures-private/        ignored by git: the real photos, for local tests
├── wiki/
│   ├── index.md
│   ├── development/
│   │   ├── technical-guide.md
│   │   ├── algorithm.md
│   │   └── tests.md
│   ├── product/
│   │   ├── roadmap.md       all planned tools, by phase
│   │   └── brand.md         brand identity (the copyist monk)
│   └── specs/
├── tools/prototype/         the original Python prototype, for reference
├── CLAUDE.md
└── AGENTS.md
```

One package with several modules instead of several packages: the modules still enforce the import boundaries, and `swift test` runs everything at once.

`fixtures-private/` must never be committed: the real photos carry personal data. A private repository is still a third party and can become public.

## The `ScanCore` engine

Each building block takes data and returns data. No protocol and no singleton: the code calls Vision and Core Image directly, only in the blocks that need them.

### Coordinates

The model stores every position in **normalized page coordinates** (0 to 1, origin at the top left): corners, eraser areas, text boxes. The conversions to the pixels of a photo, the pixels of the render or PDF points live in a single file, `Geometry.swift`. Vision uses an origin at the bottom left: that conversion also happens there, and nowhere else.

### Building blocks

| Block | Input → output | Detail |
|---|---|---|
| `ImageLoader` | URL → oriented image + capture date | ImageIO, EXIF orientation applied, scaled down to 4,096 px on the long side |
| `PageDetector` | image → `Quad` + confidence indicators | Vision `VNDetectDocumentSegmentationRequest` (proven by the prototype), then edge refinement (see below) |
| `Rectifier` | image + `Quad` → straight page | Perspective correction (Core Image), snap to the √2 ratio, render size |
| `OrientationDetector` | straight page → number of quarter turns | Fast OCR in the 4 directions on a reduced version; the direction that reads the most text wins. 7 of the 17 photos of the real batch were lying on their side |
| `Enhancer` | page + settings → cleaned page | Document or Color mode, watermark kept or not |
| `EraseMask` | page + erased areas → final page | Areas in page coordinates, replayed at each render |
| `TextReader` | page → lines (text, box, height) | Vision `VNRecognizeTextRequest`, accurate level, languages `ro-RO`, `fr-FR`, `en-US` (Romanian is supported, checked on 29 September), language correction off |
| `DocumentSuggester` | lines of all pages, in import order → proposed documents | Deterministic rules, see below |

The errors are typed: `ScanError` (`unreadableFile`, `unsupportedFormat`, `renderFailed`, `ocrUnavailable`) in `ScanCore`, `PDFWriteError` (`emptyDocument`, `invalidImage`, `renderFailed`, `cannotWrite`) in `PDFCore`. A page where no page is detected is not an error: it comes out marked ⚠︎. The interface translates the errors through the string catalog.

### Edge refinement

Vision returns an approximate quadrilateral. It is wrong when another sheet covers a corner. So each edge is fitted again on the image scaled down to a quarter, in grayscale, blurred 5×5:

1. 80 samples along the edge, from 6% to 94% of its length;
2. for each sample, a brightness profile along the outer normal, over ±3% of the short side of the image;
3. the drop `I(s) − I(s+3)` is computed; the sample is kept if its maximum drop is more than 12;
4. the **outermost** position whose drop is more than 60% of the maximum is kept, because bold text just under the edge drops more sharply than the edge of the paper;
5. a robust line is fitted (4 passes, residuals beyond max(1.5, 2.5 × median) rejected);
6. the corners are the intersections of the neighboring lines, which also rebuilds a hidden corner.

### ⚠︎ flag

A page is marked for review if one of these cases occurs:

- the side ratio is close neither to √2 nor to a known size (gap > 6%);
- an edge keeps less than 70% of valid samples after the fit;
- a refined corner is more than 1% of the diagonal away from the corner that Vision gave.

A Vision observation with a confidence below 0.5 counts as "no page detected": whole image, page marked ⚠︎.

On the real batch, the prototype had 9 wrong pages and the Swift engine 10, all flagged. The thresholds are tuned on the test photos.

### Cleaning, Document mode

1. paper estimate: dilation (15 px disk), then Gaussian blur σ 5 (the prototype used a 21 px median, which Core Image does not have);
2. if the watermark is kept: a closing (91 px disk) of this estimate is also computed, which fills the strokes of the watermark. In the shadow areas, found relative to the local level of the lit paper (101 px dilation at quarter resolution, blur σ 40), the fine estimate is used again. Without this, the streak between two shadows stays gray;
3. division of the page by the paper estimate;
4. levels: black at 0.12, white at 0.86, gamma 1.35;
5. sharpening: 1.5 × image − 0.5 × blur σ 1.2;
6. white margin of 24 px all around.

Color mode (certificates with a security background): level stretch between the 0.5 and 99 percentiles per channel, nothing else.

**Watermark kept or not:** detected automatically, with a per-page switch to force it. Rule chosen: kept if, on the inside of the page (10% margins excluded, at quarter resolution), the gap between the closing and the fine estimate is more than 0.08 on more than 2.4% of the pixels, outside the shadow mask (< 0.5). It is right on the 16 Document-mode pages of the private batch. So the detection stays automatic.

### Format and render size

- ratio within 6% of √2: snapped to √2, long side of 2,339 px (A4 at 200 dpi);
- other ratio: measured size, short side of 1,654 px;
- long side capped at 7,016 px (about 89 cm at 200 dpi): corners dragged into a narrow strip do not ask for millions of pixels. Corners that coincide give no render;
- PDF size per page: `Auto` (A4 for √2, otherwise the size in pixels at 200 dpi), `A4`, `A5`, `Letter`. A photo does not give the physical size: the user chooses A5 for an invoice from a receipt book.

### Document suggestions

Input: the OCR lines of all pages, in import order.

**Grouping**: a page joins the previous document if their page markers follow each other. Markers recognized in the top (10%) or the bottom (12%) of the page:

- `x / n` and `x/n`;
- `Pagina x din n`, `Page x of n`, `Page x sur n`;
- a lone number centered at the bottom of the page.

Otherwise, the page starts a new document.

**Title**: the tallest line in the top 40% of the first page, among the lines of at least 3 letters, at most 4 words and an OCR confidence of at least 0.5. Lines that come back in at least max(2, ⌈documents/3⌉) documents of the batch are excluded (institution headers such as "MINISTERUL JUSTIȚIEI"). The title is converted to ASCII (ș → s) and keeps at most 6 words, separated by hyphens.

**Date**: the most recent of the dates of the document (`dd.mm.yyyy`, `dd/mm/yyyy`, `yyyy-mm-dd`) that is not later than the reference date. The reference date is the capture date of the first photo of the document, or today if it is missing. Dates before 1990 are ignored, and so are those of the validity lines (`valabil`, `valable`, `valid until`, `valid till`, `valid through`, `valid to`, `expir`). With no valid date, the reference date is used.

This simple rule gave 9 right dates out of 11 on the real batch. The two misses: an end-of-validity date ("valabilă până la data …") and the date of a certificate quoted in an extract. The validity lines, now ignored, fix the first one. The second one remains: the rule takes a date quoted in the body of the text, not the issue date. A scoring rule (issue words, position) was tried on paper: it fails on a document where the same date, quoted in the text, comes back three times.

**Name**: `YYYY-MM-DD_Title`. With no title: `YYYY-MM-DD_Document-N`. Each suggestion keeps its readable reason ("Pagina 1 din 3 · 21.09.2026"), shown on the board.

## `PDFCore`

In v1, a single responsibility: write a PDF from image pages.

- one PDF page per image, at the size of the chosen format (A4 = 595.28 × 841.89 pt, A5 = 419.53 × 595.28 pt). The image keeps its ratio on the page, centered;
- image as JPEG at quality 0.53 in ImageIO (≈ libjpeg 80 to 81, the 80 of the prototype; the 0.8 of ImageIO is ≈ libjpeg 94 and made the pages heavier), without metadata. The JPEG stream must be embedded as is, without recompression: check this from the start through the file size;
- invisible text layer: each OCR line is drawn in invisible text mode (Core Text) in its box, with the font scaled to the width;
- document title in the PDF metadata.

The future tools (merge, split, compress) will come here.

## The Mac app

### Shell

The home screen is a grid of tools by category, with search, favorites and "Recently used", on the model of PDF24 Tools. In v1, the grid shows only the available tools, so the Scanner alone; search, favorites and recent tools come with phase 1 of the [roadmap](../product/roadmap.md). To add a tool, you add a folder under `Features/` and an entry in the grid: no registry and no plug-in system. The illustrations will come from the [brand identity](../product/brand.md); until then, one SF Symbol per tool.

### Scanner screens

1. **Start**: drop zone, "Choose photos…" button, the 3 steps, the "nothing is sent" note.
2. **Board** (main view):
   - one row per document, with an editable name, the reason for the suggestion, the page count and the thumbnails;
   - a tips banner at the top of the board, which you close with "×"; it does not come back after a relaunch, except through Help → "Show tips". While it shows, the help line at the bottom is hidden;
   - a click on a page opens the correction;
   - on hover, the page lifts, a ring surrounds it, the pointer becomes a hand, and two buttons appear: "Correct" and "Delete";
   - a right-click on a page opens a menu: "Correct…" and "Delete page";
   - the deletion of a page asks for no confirmation: ⌘Z brings it back;
   - you undo each change on the board with ⌘Z and redo it with ⇧⌘Z: deletion of a page or a document, move of a page, new document, name. An undo goes back to the board; a rename is undone in one step;
   - a drag moves a page to another document; a drop in the empty slot at the end of a row creates a document. This slot appears only in a document of at least two pages: a page alone already forms its own document. The dragged image is the page alone, without the ring or the buttons;
   - an orange ⚠︎ marks the pages to check; its tooltip gives the reasons, one per line;
   - a "⚠︎ N pages to check" button filters the board. The filter turns off in two cases: when the last marked page is deleted from the board, and when you come back to a board where nothing is left to check. It stays on during a correction. With no page to check, the button disappears; "Add photos…" and "Export", aligned on the right, do not move;
   - the header of a document has a pencil button ("Rename"), a "Download…" button and a ⋯ menu: "Download the PDF…", "Rename" (puts the cursor in the name), "Delete the document…". The confirmation gives the name and the page count, and says "You can undo it with ⌘Z.". These buttons highlight on hover;
   - the download opens a save panel as a sheet, with the name already filled in. It waits only for the renders of its own document: an import of other photos does not delay it. A toast shows "Saving “Name.pdf”…" during the write, then "“Name.pdf” saved" with "Show in Finder"; it closes on its own after 4 s, and waits while the pointer is on it. An error names the file chosen in the panel and stays on screen until it is closed. A document deleted during the save gives no error;
   - you edit the name in the field. A click elsewhere on the board, on the bottom bar or in the toolbar, or "Return", confirms; "Escape" restores the old name;
   - the File menu has "Add photos…" (⌘O) and "Export…" (⌘E), active when the buttons of the board are. They are grayed out during a correction.
3. **Correction** (a click on a page):
   - the photo on the left, with the 4 corners and a magnifier on the corner you hold; the result on the right, with a small spinner next to "Result" while the render is computing;
   - Corners and Eraser tools (adjustable size, grayed out outside the eraser), Rotate (quarter turn), Undo and Redo, Download… (the document of the page, as on the board), Next page. Rotate, Undo and Redo have a tooltip; the Undo and Redo tooltips name the action, like the Edit menu ("Undo Move Corners");
   - on the last page, "Next page" becomes "Done" and goes back to the board;
   - with the Corners tool, the title of the result says to choose the eraser to erase around the page;
   - pointers: an open hand on a corner, closed during the drag, even beyond the photo; a crosshair on the result with the eraser;
   - crossed corners are refused: a 3-second message under the photo explains why, and the corner goes back to its place. A good edit, Undo or Redo clears the message;
   - with the eraser, the "Updating the page…" badge covers the result while the turned or straightened page is not ready; if this render fails, "The page could not be updated." replaces it. If the eraser can work, there is no badge: the status line reports the failure;
   - the status line explains the page: orange ⚠︎ while a reason to check remains, "Corners set by hand." without ⚠︎ if nothing else is wrong, red octagon if the render failed;
   - the save toast shows on the result, above the settings bar;
   - at the bottom: render, watermark, format, and "Restore automatic detection".
4. **Export** (sheet):
   - the list of the PDFs, with checkboxes, and the destination folder;
   - if pages marked ⚠︎ remain, a line counts them ("2 pages are still to check."), with a "Check" button that closes the sheet and opens the first one, with the filter on;
   - options: searchable text, open the folder afterwards;
   - reminder of the 200 dpi, of the real size and of the GPS position, never copied.

### State

An observable model, `ScannerSession`, on the main actor:

- `pages`: source photo (URL), status (`queued`, `processing`, `ready`, `failed(ScanError)`), automatic corners and corrected corners, settings (render, watermark, format), erased areas, OCR lines, "to check" flag;
- `documents`: name, ordered page identifiers, reason for the suggestion.

Corners, settings and eraser go through the `UndoManager` of the window, like the changes on the board. An undo on the board is the inverse operation, not a copy of the board: an import that arrived in the meantime stays. A page deleted during its import, when it was the last one in progress, comes back in a document of its own.

### Processing and performance

- a background processing queue (task group limited to the number of cores). Each page appears on the board as soon as it is ready;
- **memory**: no decoded photo is kept. A page keeps its source URL, a thumbnail and its JPEG render; the photo is read again when an edit requires it. 17 decoded 24 Mpx photos would weigh 1.6 GB;
- order of the steps per page: loading → detection → straightening → upright rotation → cleaning → eraser → JPEG encoding and OCR;
- an edit runs again only the steps downstream: an eraser stroke redoes the render and the OCR, not the detection (the OCR runs on the erased page, so an erased text never goes into the PDF); a corner or a rotation redoes the straightening, the cleaning and the OCR;
- during the drag of a corner, only the outline moves (less than 16 ms per frame); the render is computed again on release. Nothing changes size during a drag;
- the document suggestions are computed again when all pages have their OCR, and never after a manual change of the groupings.

### Findings from the engine review

Points found during the engine review, for the app. All are handled:

- with corners set by the user, do not run the Vision detection;
- check undo across two pages;
- the erased areas are in the coordinates of the upright page: a rotation of a page after an eraser stroke must rotate the areas by the same quarter turn;
- `PageSizing.renderSize` must cap the long side of the render and refuse NaN (the user drags the corners);
- an OCR failure keeps the page, without a text layer, and marks it;
- `PDFWriter.write` never replaces a file. For the "replace" choice, the app first writes the new PDF, then puts it in place of the old one with `FileManager.replaceItemAt`: the old one stays intact if the write fails;
- when `write` adds a suffix ("-2"), the PDF title keeps the requested name: the app must compute it again or choose the name before the write;
- `NameFormatting.duplicates` compares the names with case sensitivity, but APFS is not case-sensitive: "Scan" and "scan" are one file.

## Error handling

| Case | Behavior |
|---|---|
| Unreadable file or unknown format | "Unreadable" page with the reason, the batch continues |
| No page detected | Corners at the edges of the photo, page marked ⚠︎ |
| Doubtful detection | Page marked ⚠︎ (rules above) |
| No text read | Separate document, named `photo-date_Document-N` |
| Two documents with the same name | Flagged on the board, export blocked until this is resolved |
| PDF already there | Choice: replace, or suffix "-2" (no space and no parenthesis in the file names) |
| Folder not accessible, disk full | Clear message, the documents stay in the app |
| Deletion of a page | Immediate, ⌘Z brings it back |
| Deletion of a document | Confirmation with the name: "Delete “Contract” and its 3 pages?", which mentions ⌘Z |

## Tests

| Level | What | Where |
|---|---|---|
| Pure logic | `Geometry`, format snapping, `DocumentSuggester` on OCR lines written by hand (FR/RO/EN markers, dates, titles, repeated headers) | `ScanCoreTests` |
| Synthetic images | Tilted page on a gray background, generated in code, with a phone shadow, a watermark, bold text near the edge, a covered corner. Checks the corners (tolerance 0.5% of the diagonal) and the white of the paper | `ScanCoreTests` |
| Test photos | 5-6 real photos without personal data, with their expected corners in JSON. Postponed until after v1 | `fixtures/` |
| Private batch | The 17 real photos, run only if `fixtures-private/` exists (otherwise `.enabled(if:)` disables the suite) | local |
| PDF | Page count, page size, extractable text, no location metadata, file size | `PDFCoreTests` |
| Performance | Time per page on the private batch, target < 1 s, in optimized build only | `PrivateBatchTests` (`ScanCLITests`) |

The interface is checked by hand in v1: automated interface tests cost more to maintain than they bring at this stage.

## Preliminary checks

Done on 29 September during the writing of the plan:

- **Romanian is among the OCR languages** of Vision (`ro-RO`);
- **the JPEG is embedded without recompression** in a Core Graphics PDF: 408 KB of JPEG give a PDF of 418 KB, and the invisible text can be extracted;
- **Core Image is fast enough**: dilation, 91 px closing and blur cost 50 to 110 ms each on an A4 page at 200 dpi;
- `CIDivideBlendMode` computes background ÷ input, and `oriented(.right)` turns a quarter turn clockwise.

Still to measure in the plan, on the private batch, each one with its fallback:

1. **Quality of the Romanian OCR** on the page markers, the dates and the titles. Fallback: titles without diacritics are acceptable.
2. **Cleaning in Core Image** faithful to the Python prototype. Core Image has no 21 px median: Gaussian blur instead, compared with the Python render by the mean pixel difference. Fallback: repeated 3×3 median.
3. **Watermark detection** right on the 16 Document-mode pages. Fallback: manual switch, off by default.

## Technical rules

Detailed in the technical guide of the time (`git show mac-final:wiki/development/technical-guide.md`):

- Swift 6, strict concurrency; no `!` and no `as!` without a comment that justifies it;
- states as enums with associated values, typed errors;
- no premature abstraction: a protocol only if there are at least two implementations or an external service (first expected case: payment);
- a single source for coordinates (`Geometry.swift`);
- Apple frameworks before any dependency;
- measure before you optimize, with the benchmarks of this spec;
- comments in English, only for the why;
- interface strings in the Xcode catalog, FR and EN, from the start.

## Planned next steps

iPhone app (reuses `ScanCore` and `PDFCore`, adds the camera), Web version (rewrite that follows `algorithm.md`), other PDF tools in `PDFCore` and the shell, then the commercial layer.
