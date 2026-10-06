# Tests

_The site and the desktop app. The tests of the Swift engine and of the Mac app are at the `mac-final` tag, together with the app._

## Commands

From the root of the repository:

| Goal | Command |
|---|---|
| Site, before any merge | `pnpm verify`: types, unit tests, build, SEO, end-to-end Chromium |
| Site, when the layout, fonts, budgets or engine change | `pnpm verify:full`: adds Firefox, WebKit and Lighthouse |
| Desktop | `pnpm desktop:smoke` (Rust via rustup) and `pnpm --filter @holy-pdf/desktop check` |

## The private batch

`fixtures-private/`, at the root of the repository, is **ignored by git**: real photos and downloaded PDFs stay there, and nothing leaves it.

## Web version

Sign: `pnpm exec playwright test tests/e2e/sign.spec.ts --project chromium --project firefox --project webkit` covers the drawing, PNG/JPG/JPEG (exported PNG alpha read back with pdf.js), placement and size, two pages, repeated export, phone, language, local drop, pending decoding, and failure/retry of the two previews. `tests/engine/sign.test.ts` checks rotations/CropBox, transparent pixels, preservation of the catalog with pdf.js, protected documents, refusal of digital signatures, and sharing of the image across ten pages.

`tests/e2e/sign-navigation.spec.ts` checks the floating navigation by a click at coordinates after scrolling, its disappearance outside the PDF area, the zoom, and no overflow at 1280 and 390 px. The click at coordinates prevents an automatic scroll of the test harness from hiding a control that cannot be reached.

`tests/e2e/sign-insert.spec.ts` checks adding in one action and the "Add here" prompt at 1280 and 390 px. At a height of 720 px, the action is clicked at coordinates without scrolling the panel. Its visibility and the absence of overlap with the options are measured. Placement by click is checked after zoom and rotation, with export. A cleared input or an empty mode cannot insert an old draft. Existing placements stay exportable. The first click outside keeps its deselect-only behavior.

This suite also checks that the instruction and the document position stay stable during character-by-character typing, its clearing, and selection/deselection. Mutations are observed in FR/EN at 1280 and 390 px to detect transient flips, not only the final state of the text.

Protect and Unlock: `tests/engine/transform.test.ts` (encryption read back by PDFium and pdf.js, signed PDF refused) and `tests/e2e/protect-unlock.spec.ts` (matching passwords before the run, the preview of the protected copy, copies that open with or without a password).

Page numbers: `tests/engine/numbers.test.ts` (formats, range, position read back by pdf.js under the four rotations) and `tests/e2e/page-numbers.spec.ts` (settings entered before the PDF has finished opening).

Watermark: `tests/engine/watermark.test.ts` (range, angle, transparency measured on the pixels, width) and `tests/e2e/watermark.spec.ts` (accented text, emoji refused, default text).

Flatten: `tests/engine/flatten.test.ts` (filled field turned into page text, annotation removed) and `tests/e2e/flatten.spec.ts`.

Pages per sheet: `tests/engine/nup.test.ts` (sheet size and orientation, reading order) and `tests/e2e/pages-per-sheet.spec.ts`.

Split in half: `tests/engine/halves.test.ts` (halves and visible words read back by pdf.js) and `tests/e2e/split-in-half.spec.ts`.

Pixelize: `tests/engine/pixelize.test.ts` (no text, one image per page, displayed sizes kept) and `tests/e2e/pixelize.spec.ts`.

Form fields: `tests/engine/forms.test.ts` (a text field and a checkbox drawn in the render of a page, which goes through the form environment of the document; list of the fields of an upright page and of a rotated page; values set, read back by pdf.js and rendered, refusal of an index that is not a widget; fields added on an upright page and on a rotated page, read back, filled, refusal of a duplicate name). In-place filling and the Field tool are also in `tests/e2e/edit.spec.ts`.

Redact: `tests/engine/redact.test.ts` (six secrets of a page absent from the bytes and from the decompressed streams, bookmark and link kept, rotations, cap of 6,000 pixels, signed PDF and XFA refused) and `tests/e2e/redact.spec.ts` (including moving an area by its handle and with the arrow keys, and the 44 px target of the small buttons).

OCR: `tests/engine/ocr.test.ts` (invisible text where the reader sees the line, under the four rotations; accents written or reduced to their base letter; characters counted per page) and `tests/e2e/ocr.spec.ts` (real reading of a scanned page by Tesseract.js).

PDF to Word: `tests/engine/word.test.ts` (styles, paragraphs, columns, pages, images, scans; opened by `textutil` on macOS) and `tests/e2e/pdf-to-word.spec.ts`.

Scanner: `tests/scan/` (detection, straightening, cleanup, photo formats; bench of the 17 photos of `fixtures-private` against `edits.json` and `expected.json`, skipped without them), `tests/scanner/session.test.ts` (board and undo), `tests/engine/scanPdf.test.ts` and `tests/e2e/scanner.spec.ts` (photo made with OpenCV, A4 PDF, corner corrected then undone, page lying on its side turned upright and named after its title, searchable text, the question before a document is removed). Reading: `tests/scan/suggest.test.ts` (translated Swift tests) and `tests/scan/reading.test.ts` (bench of the 17 photos with Tesseract in Node, about 7 minutes). The two benches of the 17 photos (`photos.test.ts`, `reading.test.ts`) run only with `SCAN_BENCH=1 pnpm test` and `fixtures-private`.

Overlay: `tests/engine/overlay.test.ts` (pages, on top and underneath, fit under rotation, signatures) and `tests/e2e/overlay.spec.ts`.

Bookmarks: `tests/engine/bookmarks.test.ts` (reading, views kept, top of page under rotation, signatures, read back by pdf.js), `tests/unit/bookmarksOutline.test.ts` (position and level of a new bookmark) and `tests/e2e/bookmarks.spec.ts`.

Edit: `tests/engine/edit.test.ts` (text read back in place on four rotations, shapes and highlighter read back as pixels, order, image, stamp, refusals), `tests/engine/editOriginals.test.ts` (objects of a page, words, moving, deletion, text correction with or without a font change), `tests/engine/editAnnotations.test.ts` (note, highlight, underline, strikethrough, links, read back by pdf.js and rendered), `tests/engine/editImages.test.ts` (added image rotated, flipped, cropped, shared; original image rotated, flipped, cropped, JPEG kept), `tests/unit/editModel.test.ts` (creation, moving, handles, selection, order, undo, style, edits of original content, text box), `tests/unit/editMetrics.test.ts` (advance widths, line breaking, stamp layout) and `tests/e2e/edit.spec.ts`.

Crop: `tests/engine/crop.test.ts` (box read back by pdf.js on three rotations and on a page already cropped, a single page, mark kept in its place, refusals), `tests/unit/cropBox.test.ts` (draw, move, handles) and `tests/e2e/crop.spec.ts`.

Repair: `tests/engine/repair.test.ts` (truncated file, lost table, PDFium fallback, password, signature) and `tests/e2e/repair.spec.ts`.

`tests/e2e/sign-move.spec.ts` moves a signature by its four-way arrow, first by dragging, then by two arrow keys pressed in quick succession. It checks that the three tabs keep their size and fit on one line in both Draw and Text, with a classic scroll bar included (measurement skipped if Figtree could not load). It also checks that a signature button that receives focus moves above the floating page bar. Under heavy load, with the three browsers in parallel, a synthetic key sent right after "Add to this page" can get lost. So `sign-selection.spec.ts` keeps pressing the key until the rotation reads 90°, and keyboard rotation has its own test. `tests/e2e/sign-controls.spec.ts` exercises the free rotation handle, then the keyboard at 125% and on a rotated page, and the drag of the small corner with the opposite corner held in place. The page rotations are read back in the exported PDF, including a page without a signature. The engine tests also compare pixels for free angles with CropBox and native rotation.

`tests/e2e/sign-selection.spec.ts` covers the real left stop after rotation, the stable center during resizing, the small corner handle, the separate rotation, deselection by a click outside or with Escape, the next selection, and their export. The unit/engine tests cover the four edges and the native rotations with cropping.

`tests/e2e/sign-text.spec.ts` checks the deferred, local loading of the font, accented wording, the two styles, coexistence with an image, the proportions after selecting an older element, transparency in the export, preservation of the input between tabs, and recovery after a font failure. The client/engine tests check missing references, sharing of assets, transfer without detaching the originals, and the cumulative pixel limit.

`tests/e2e/sign-drawing.spec.ts` checks enlarging, undoing the last stroke with the remaining drawing unchanged, Escape/focus, mobile, the exported alpha, and coalesced events with fallback. A synthetic stroke of 5,000 moves checks that the number of emitted segments stays linear. The attached measurements cover synchronous processing and canvas commands, not the GPU or display latency. `tests/unit/drawing.test.ts` checks smoothing, the end point, faithful replay, and the point limit.

Sign performance: `pnpm exec playwright test tests/bench/sign.spec.ts --project bench --workers 1`, with no other suite in parallel. It generates its synthetic PDF and JPG, measures three exports and the DOM mutation latency during a move, and checks the image limits and that no new render requests occur. Results, hashes and screenshots are in `fixtures-private/sign/`, ignored by Git. [Results and limits](web-version.md#sign-measurements-1-october-2026).

From `apps/web/`:

| Goal | Command |
|---|---|
| Types | `pnpm check` |
| Logic and engine | `pnpm test` |
| SEO (after `pnpm build`) | `pnpm test:seo` |
| End to end, 3 browsers (after `pnpm build`) | `pnpm e2e` |
| Load budgets | `INDEXABLE=true GA4_ID=G-TEST1234 pnpm build && pnpm lighthouse` |
| Consent banner (on a build with `GA4_ID`) | `GA4_ID=G-TEST1234 pnpm test:seo && pnpm exec playwright test consent --project chromium` |
| Processing time, local only | `pnpm build && pnpm bench` |
| Before a merge, and in CI | `pnpm verify`: types, unit tests, build, SEO, e2e Chromium (about 1.5 min) |
| Before a merge that touches the layout, fonts, budgets or engine | `pnpm verify:full`: adds Firefox, WebKit, a build with a test `GA4_ID` for the consent tests, and Lighthouse on that build (about 12 min) |
| Site served as in production | `pnpm serve`, then `http://localhost:8787` |

The test files are generated by the tests: a PDF where each page shows its name in large type, a protected PDF, a truncated PDF, a JPEG of 960 bytes. The engine is checked with pdf.js, never with itself.

The design system has its own tests:

- **Contrast** (`tests/unit/tokens.test.ts`): each text and background pair of `tokens.css` reaches 4.5:1, in light and in dark. The PDF sheets stay white. In dark mode, each tint and the disc of the upcoming monks stand out from the panels.
- **Fonts** (`tests/unit/fonts.test.ts`): each letter of the dictionaries and of the tool texts is in the font subset.
- **Illustrations** (`tests/unit/illustrations.test.ts`): each monk draws only its accessory, always on top of the hands, takes its colors from the CSS variables, and the avatar clips the robe to the circle. Each tool, ready or asleep, has its own line icon.
- **Home** (`tests/e2e/home.spec.ts`): the guarantees just under the title, above the sentence, and the video button centered under the sentence; the top sentence, whose verb changes the monk and leads to its tool; its menu by keyboard (arrows, Enter, Escape, first letters), at text size, closed by a click elsewhere, and inside the screen at 320 and 390 px; a space between two verbs, so that the chosen verb and the one under the pointer do not touch; the video, never loaded on arrival, opened by the round preview and stopped by Escape, and its bubble in the FAQ; the English video on the English page; one row per category in the compact view, which scrolls sideways and fades out while more monks remain; the first row of monks visible on a 1280 × 800 screen; the compact view kept after a reload; the promise signed by Brother Quill, then the band of the four guarantees below it; the halo of the monk of "Why monks?"; the six shortcuts of the final band, in two rows at 1280 px, three at 900 px and six at 390 px, the last one leading to JPG to PDF, and the haloed monk; the three gestures as a frieze without cards, on one line at 1280 px, stacked and without a line at 390 px; the FAQ with six questions and six answers, the last bubble opaque once on screen, the link to the FAQ page; the "Paperwork to hand in" case that leads to the guide; no extra width at 320 and 390 px, fonts blocked. `filter.spec.ts` checks that "Show them", on the card of the monks in meditation, turns on the switch.
- **404 page** (`tests/e2e/notfound.spec.ts`): an unknown address under `/fr/` answers 404 in French and leads to a tool through the sentence. Under `/en/` and with no language, it answers in English. No extra width at 320 and 390 px.
- **Drop on the whole page** (`dropTracker.test.ts`, `files.spec.ts`): only drags that carry files count. On a tool page, a file dropped anywhere opens.
- **Monk bubble** (`bubble.test.ts`): what the monk says, depending on the state of the board.
- **Theme** (`tests/e2e/theme.spec.ts`): the light and dark switch, kept from one page to the next, the device's dark mode, reduced motion.
- **Width** (`tests/e2e/site.spec.ts`): the home page fits at 320, 390, 768 and 1,024 px, even with the fallback fonts.

The flow and the two tools of milestone 1 have their tests:

- **Flow** (`flow.test.ts`, `deliver.test.ts`, `document.test.ts`, `tests/e2e/flow.spec.ts`): set, run, result, and back with everything intact; a single file downloaded as is, several as a `.zip` on a computer and through the share sheet on a touch screen; the default saver downloads; the document that the desktop shell forwards (result or sources, saved or not) and what a board releases when it unmounts; the page header that collapses; the verb button under the thumb on a phone.
- **Board** (`tests/e2e/board.spec.ts`): a click or Enter on a page opens its preview, the arrows go through the pages, Escape closes it, and a page turned on its side fits the frame. "Add a PDF" works from the tile after the pages and from the panel above the verb, which a phone hides. "View" shows the result of Merge, and the files of Split one after the other, before the download. Also: removing a file, the options of each tool in the panel, the file tabs and the undo button. `files.spec.ts` checks that Merge asks before it turns images into pages, and reads back the A4 pages it made. On a touch screen (Chromium and WebKit), a horizontal swipe turns the preview's pages and a vertical drag does not.
- **Search index** (`searchIndex.test.ts`): each tool, ready ones first, with its names, its words and its label, in both languages. The same build serves `search.json` and the desktop app.
- **Compression** (`tests/engine/compress.test.ts`, `tests/e2e/compress.spec.ts`): a PDF with a photo gets lighter and keeps text, bookmarks, internal destination, title/XMP, filled field, tags and attachment (checked by pdf.js); a shared image re-encoded only once; nested form XObjects sized for the largest placement; a protected PDF decrypted on export; fallback to the original when there is no gain.
- **Transparent image** (`tests/engine/imageStreams.test.ts`): soft and explicit masks, rendering intents and annotation resources are preserved; an unknown layout is rendered intact; `/Matte`, color masks, unknown keys and ambiguous dictionaries are left as they are.
- **PDF to JPG** (`tests/engine/images.test.ts`, `tests/e2e/pdf-to-jpg.spec.ts`): one image per page at 150 or 300 dpi, 16 million pixels at most; each photo once, without the small images; the preview of the images; the "?" help by keyboard.
- **Bar and footer** (`tests/e2e/nav.spec.ts`): Merge, Sign and Compress in the bar; the state on scroll without a layout shift; only one menu open at a time; Escape and focus; the drawer on a phone, with the page behind it `inert`; cleanup after a `ClientRouter` navigation; the theme and the focus ring of the footer; the icons centered in their buttons.
- **Panel on scroll** (`tests/e2e/sidebar-layout.spec.ts`): panel and action always visible while reading the instructions, the FAQ and the related tools, at 1,024 and 1,280 px; content fully on the left, and a click on the right edge of the FAQ without interception; last choice fully reachable above the action at 1,024 × 600; element order and visible button at 390 px. Checked in the three browsers. Private diagnostic screenshots are in `fixtures-private/sidebar-review/`.
- **Tool page** (`tests/e2e/toolpage.spec.ts`): a single monk; the button label for each tool; the button at full width on a phone.
- **Native extraction and JPEG** (`tests/engine/images.test.ts`, `tests/unit/jpeg.test.ts`): native dimensions, clipping ignored, masks kept on a white background, photos inside forms, protected files, no false duplicates between different masks; missing or lost context, allocation limits and refusal of non-JPEG outputs.
- **Measurement on real PDFs**, on demand: `MEASURE_DIR=../../fixtures-private/compress pnpm vitest run tests/engine/measure.test.ts`. It measures the save alone, the three levels and the delivered gain after the fallback to the original. It compares the structure of the Recommended candidate with pdf.js, even if this candidate is heavier. Reports and candidates are in `fixtures-private/compress/runs/preserve-structure/`, outside the repository. Destination coordinates are normalized to six decimals to tolerate PDFium's float32 serialization.
- **Processing time** (`tests/bench/lot1.spec.ts`, run by `pnpm bench`): Compress and PDF to JPG on 20 pages with photos.

The global benchmark `pnpm bench` follows the current flow: it tells the 100 pages apart from the add tile, measures rotation on Rotate, then waits for the merge result before its download. The time of the first thumbnails is timestamped in the page, without the Playwright round trip. Rotation measures the style mutation, not the final paint. The ×4 CPU slowdown stays a simulation and does not replace a physical phone. The milestone 1 targets (10 s and 8 s) are now assertions. Before, they were only shown in the logs.

The footer pages have their tests:

- **Addresses and dates** (`tests/unit/sitePages.test.ts`): safe, unique slugs, distinct from the tools and from `search.json`; a frontmatter date stays the same day west of UTC.
- **Content** (`tests/unit/content.test.ts`, `tests/unit/fonts.test.ts`): one file per page and per language, the articles under the same names in each language; each letter in the font subset.
- **SEO** (`tests/seo/pages.test.ts`): on top of the checks of each built page, neither the home page nor a content page hydrates an island. An article that declares an editorial image includes its absolute URL in `BlogPosting` JSON-LD and renders the image in the page. Each question of a tool page has a unique anchor and appears in its `FAQPage` JSON-LD. The FAQ page links each question of each tool to an anchor that exists, and declares its own questions as `FAQPage`.
- **Questions** (`tests/unit/faq.test.ts`, `tests/e2e/toolpage.spec.ts`): the anchor of a question, without accents or punctuation; the questions of a Markdown page, with links reduced to their text; an address with `#question` opens that question, and only that one.
- **Browser** (`tests/e2e/pages.spec.ts`): each footer link leads to its page, and each internal link of these pages responds; switching language keeps the page or the article; the `#mac` and `#iphone` anchors; from the blog to the article and back; no page scrolls sideways at 320 and 390 px, fonts blocked.

If port 8787 is already in use, a local copy of `playwright.config.ts`, not committed, can run the site on another port, 8788 for example: `pnpm exec playwright test tests/e2e/pages.spec.ts --config <copy>` (the test file goes before `--project`).

Lighthouse CI has a budget per page type, gzipped: 24 KB of JavaScript and 42 KB of document on the home page (40 KB before the consent banner, 6 October 2026), 50 KB (51,200 bytes) on a tool page, 80 KB of fonts; LCP ≤ 1.5 s on the home page, ≤ 1.6 s on a tool page.

## qpdf validation and integrated campaign

- `tests/engine/qpdf.test.ts` uses the real WASM and also checks the CLI statuses, size/header/EOF and the cleanup of temporary files with targeted test doubles.
- `tests/engine/compact.test.ts` checks the transfer of a copy, the Worker termination on success/error/timeout, and the fallback to the candidate if the output grows.
- `tests/engine/compressionProfile.test.ts` checks PDF/A and PDF/X profiles, envelopes, Flate, escaped names, XML encodings, read limits and ordinary Adobe `pdfx` metadata.
- `tests/e2e/compress.spec.ts` checks deferred loading, documents with a signature returned strictly intact, and recovery after a JS/WASM failure.
- `tests/e2e/jpeg-worker.spec.ts` uses the production Worker in the three browsers: JPEG larger than 55 KB, dimensions and non-black pixels.

Reproducible private campaign, from `apps/web/`, with the built site served by `pnpm serve` in another terminal:

```sh
node scripts/benchmark-compression-integrated.mjs --output ../../fixtures-private/compress/runs/compression-integrated-final
BENCH_EXPECT_PDFS=33 BENCH_VERIFY_REPORT=integrated-final-structure.json node scripts/benchmark-compression-options.mjs verify ../../fixtures-private/compress/runs/compression-integrated-final/chromium ../../fixtures-private/compress/runs/compression-integrated-final/firefox ../../fixtures-private/compress/runs/compression-integrated-final/webkit
```

The first script performs the real drops, clicks and downloads, with no outside request. It makes one pass by default, and `--repeats 3` is possible. It records deferred loading, times and partial memory measurements. The full native allocations of the Workers are not covered. Keep the processor free of other tests during the measurements. Same-origin Blobs must stay allowed: WebKit can use them to read the JPEGs.

The second compares each output with its original through pdf.js: pages/rotation/boxes, text, bookmarks and resolved destinations, links, fields, XMP, tags and attachments. It fails if an invariant differs or if the expected count is not reached. This check does not cover all JavaScript behaviors, dynamic forms, other annotations or OCG layers.

Quality, from the root of the repository, with a temporary Python environment that contains PyMuPDF, NumPy, Pillow and scikit-image:

```sh
python apps/web/scripts/verify-compression-quality.py --candidate fixtures-private/compress/runs/compression-integrated-final/chromium --output fixtures-private/compress/runs/compression-quality/chromium
```

Repeat for Firefox/WebKit. The versions are recorded in the report. The SSIM scores, crops and montages stay private. They need a visual review and are not a certification. Results, limits and performance: [Web version](web-version.md).

## Desktop

`pnpm desktop:smoke` (or `pnpm --filter @holy-pdf/desktop smoke`) compiles two binaries of the Tauri shell and runs them with `--smoke` (see the [spec](../specs/2026-10-05-desktop-tauri-design.md)):

- `smoke:engine` loads the engine test page (`apps/desktop/smoke/`): the process exits with 0 if PDFium, qpdf and the workers run in the webview, served by `tauri://`.
- `smoke:app` builds the desktop entry (`apps/desktop/app/`) and embeds it. Then the probe injected by the shell reports three times (the monastery, Compress opened from its card, the return through the sidebar's Monastery entry) under the app's CSP, and records CSP violations, script errors, unhandled rejections and load errors. The exit code is 0 if the three reports are clean, 1 otherwise, 2 if the chain did not finish within 120 s, 3 if the window was closed or the app quit before the verdict.

Rust via rustup is necessary. Nothing runs in CI. The site's development server does not need to run. `pnpm --filter @holy-pdf/desktop check` checks the types of the entry and of the engine page against the site sources.

By hand, in the app (`pnpm desktop:dev`):

1. ⌘O opens the native dialog, filtered on PDFs from a PDF tool, and on PDFs, JPEGs and PNGs from Merge. The chosen files arrive on the board. From the monastery, "3 files ready" appears and the cards that do not accept them are grayed out.
2. A PDF dropped on the monastery or on a tool opens. The veil "Let go, I'll take care of them." appears during the hover. On Merge, a dropped PNG asks "… is an image. Shall I turn it into a PDF page before merging?", and "Convert" adds it as a page.
3. Compress a PDF, then "View": the preview opens in the page, without a save dialog. Change the level, run again: "View" shows the new copy. On Split, the preview steps through the files produced; on PDF to JPG, through the images. "Save…": the native dialog suggests the name of the copy in the last folder. "Saved" and the name appear, "Open" launches the system viewer, "Show in Finder" selects the file.
4. Scanner: with two photos, "Save all…" with a page to check asks "Save anyway?". Removing a document asks its own question.
5. Switch the system to dark: the app follows without a restart.
6. Move and resize the window, quit, relaunch: it comes back at the same place.
7. Help › Website opens in the browser, and the app stays on its screen.
8. ⌘Q quits. ⌘W closes the window and quits (the guard comes in milestone 2).
9. ⌘Z in the search field undoes the typing. ⌘Z on the board undoes the edit. Never both. ⌘F and ⌘K activate the search, ⌘[ goes back to the monastery, Enter opens the best monk.
10. The sidebar lists the tools by theme, with the open tool highlighted. A click changes the tool, and "Monastery" goes back to the home. Shrinking the window below 1,280 px hides the sidebar and brings back the chevron.
11. On Merge, a click on a page opens it in a preview: the arrow keys go through the pages, and Escape closes it. "Add a PDF", above the verb, adds a file without a scroll to the end of the pages.
