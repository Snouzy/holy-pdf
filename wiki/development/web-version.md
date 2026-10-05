# Web version: technical choices

_Decided on 29 September 2026. Built in `apps/web/`: the tools Organize, Compress, PDF to JPG, Sign, Watermark, Page numbers, Protect, Unlock, Flatten, Pages per sheet, Split in half, Pixelize, Redact, OCR, PDF to Word, Scanner, Overlay, Bookmarks, Repair, Edit and Crop. The web version stays a cross-cutting workstream of the [roadmap](../product/roadmap.md)._

## Principle

All processing happens in the browser. No file goes to a server: it is the same promise as the desktop app.

## Site

| Choice | Reason |
|---|---|
| **Astro**, one static page per tool | The traffic of a PDF tool comes from search (« fusionner PDF »). Astro produces static HTML, with no JavaScript by default. |
| **Preact** (with `compat`) for the interface of a tool, as an island | It loads only on the tool page. Measured: with React, the page missed the LCP target. |
| **PDFium** in WebAssembly, in a Worker | One engine for almost the whole catalog, under the BSD license, compatible with the project's AGPL-3.0. The historical pdf-lib repository has had no release since 2021, but its Cantoo fork is active. MuPDF (AGPL or commercial license) would be compatible too, but adopting it would mean a wider engine replacement, still to evaluate. Updated comparison in the benchmark below. |
| **qpdf 12.4.2**, temporary deferred Worker | Recompacts the structures after PDFium, without re-encoding the JPEGs again. Distribution `@wasm-zoo/qpdf@0.1.1` pinned, ESM packaging adaptation and notices in `public/licenses/qpdf.txt`. |
| **Cloudflare Workers**, static files | No application server. Static bandwidth is free and unlimited. |

Not Next.js: its server side (server rendering, Server Components, API routes) has no use when everything runs in the browser.

## Engine

The engine is rewritten in TypeScript from the [scanner algorithm](algorithm.md). The Swift code cannot be shared: Swift compiles to WebAssembly since version 6.2, but Vision, Core Image and ImageIO do not exist on this target.

The split of roles stays the same as Apple's: the GPU for pixels, WebAssembly for computation on the CPU, Web Workers so that the interface does not freeze.

| Step | Apple | Web |
|---|---|---|
| Reduced decoding, EXIF orientation | ImageIO | `createImageBitmap` with `resizeWidth` and `imageOrientation: "from-image"` |
| HEIC | ImageIO | Safari decodes it. Chrome and Firefox: libheif in WebAssembly |
| Perspective correction, filters | Core Image (GPU) | WebGPU, WebGL2 as fallback |
| Page detection, edge refinement | Vision | OpenCV.js (WebAssembly, SIMD and threads builds). The Python prototype already uses OpenCV |
| OCR | Vision | PaddleOCR on ONNX Runtime Web (WebGPU), or Tesseract.js |
| Pages in parallel | `TaskGroup` | Web Workers, `OffscreenCanvas` |
| Page preview | PDFKit | `FPDF_RenderPageBitmap`, then `FPDF_FFLDraw` with the document's form environment (`engine/forms.ts`, opened at the first render, closed with the document): without it, PDFium leaves form fields blank. On a form marked `NeedAppearances`, this render rebuilds the appearance of each field in the open document, as a reader would |
| PDF writing | `PDFCore` | PDFium, text in rendering mode 3 (invisible) |
| Compression, pages to images | PDFKit, ImageIO | PDFium keeps the document and replaces the images; `OffscreenCanvas` encodes the JPEG; qpdf recompacts the structures |

The details and the reasons are in the [web foundation spec](../specs/2026-09-29-web-organiser-design.md). The styling (Holy PDF design system) is in its [own spec](../specs/2026-09-30-web-design-system-design.md). The scanner libraries are starting choices: the scanner's own spec will confirm them, under the dependency rule of the [technical guide](technical-guide.md).

## Compression measurements

### qpdf integration: 1 October 2026

After the [comparative benchmark](compression-benchmark-2026-10-01.md), qpdf is integrated into the real flow. **33/33 runs succeed**, and no delivered file is heavier, on the 11 PDFs in the three browsers. Recommended level, Apple M1 Pro, macOS arm64, one pass per document and browser, fresh context, built site served locally. The three repetitions of the previous study stay separate from this integrated validation. The times include the deferred local loading and the instrumentation. They do not predict a phone or a slow network.

| Browser | Median gain PDF 01–05 | Click → result, maximum of the 11 |
|---|---:|---:|
| Chromium 153.0.8010.12 | 40.23% | 6.23 s |
| Firefox 155.0 | 39.84% | 5.91 s |
| WebKit 26.6 | 33.06% | 6.03 s |

**Preservation: 33/33 outputs pass the independent comparison with pdf.js**, with no difference on the checked invariants: text, page boxes/rotation, bookmarks and resolved destinations, links, fields, title/XMP, tags and attachments. The other annotations, JavaScript actions, dynamic forms and OCG layers stay outside this check.

The 30% median threshold is passed in the three engines. Detail of the delivered gains:

| PDF | Chromium | Firefox | WebKit |
|---|---:|---:|---:|
| 01 | 82.79% | 81.73% | 72.91% |
| 02 | 40.23% | 39.84% | 33.06% |
| 03 | 22.72% | 22.69% | 22.68% |
| 04 | 13.49% | 12.97% | 12.76% |
| 05 | 67.87% | 63.19% | 38.39% |
| 06 | 0.00% | 0.00% | 0.00% |
| 07 | 37.53% | 36.68% | 34.49% |
| 08 | 76.84% | 76.28% | 72.72% |
| 09 | 0.00% | 0.00% | 0.00% |
| 10 | 77.99% | 77.52% | 69.86% |
| 11 | 30.89% | 28.56% | 12.25% |

PDF 09 declares PDF/A-3: the conservative guard disables Object Streams for all declared PDF/A and PDF/X files, not only for the versions that forbid them. Here it falls back to the original, unlike the unfiltered prototype. The guard resolves the metadata wrappers and the Flate streams. Unknown or unreadable metadata also disables this transformation. This does not certify the PDF/A or PDF/X conformance of the re-encoded document.

qpdf is requested only after the click, in the 33 runs. Its Worker is closed after processing: observed in Chromium and Firefox, not observable by Playwright for nested WebKit Workers. Documents that carry a digital signature are returned byte for byte, without loading qpdf. JS/WASM download failures are recoverable: a new attempt recreates the Worker.

Chromium memory: renderer process peak **664.1 MB**; sampled maximum of JS + Worker backing storage **177.1 MB**. These are two different scopes: neither one proves the 400 MB budget of the complete Worker. Sampling can miss a peak and does not cover all native allocations. The compactor caps the intermediate input at 128 MiB and terminates its Worker after 120 s. These guards do not guarantee a memory peak below 400 MB.

Private report and the PDFs actually downloaded: `fixtures-private/compress/runs/compression-integrated-final/`. Reproduction and limits: [Tests](tests.md). The initial WebKit diagnosis was an error in the test bench, which blocked local Blob URLs: after the fix, 11 PDFs × 3 runs work with no change to the encoder. No test on a physical Safari/iPhone at this stage.

The final campaign follows the removal of the cyclic import in WebKit. The 33 outputs are identical to the previous campaign once the trailer `/ID` alone is neutralized (6 are already identical byte for byte). No stream or page content differs. The quality checks below stay valid. Private proof: `compression-integrated-final/comparison-previous.json`.

### Quality of the delivered JPEGs

Local check with PyMuPDF and scikit-image: up to four pages per document (first, middle, last, and the page with the most image pixels), deduplicated; rendered at 144 dpi at most, capped at 4 Mpx. Comparison of the whole page and of the largest image placement area, cropped by its rotation and the page limits: **120 pages and 81 crops** across the three browsers.

| Browser | Page SSIM minimum / median | Image SSIM minimum / median |
|---|---:|---:|
| Chromium | 0.94359 / 0.99965 | 0.86265 / 0.97551 |
| Firefox | 0.94433 / 0.99974 | 0.86265 / 0.97551 |
| WebKit | 0.96265 / 1.00000 | 0.95272 / 0.99730 |

Visual inspection of the most sensitive Chromium montages: the raster box of guide 11, page 10, keeps its text but becomes softer and shows JPEG artifacts. The cover photo of report 02 loses detail. Scan 05, page 14, keeps its content, with modified edges. **The historical minimum of 0.955 is not reproduced in all cases.** The medians close to 1 include unchanged pages and do not guarantee the quality of each photo. These scores are diagnostic, not a new acceptance threshold invented after the measurement. Compression stays lossy. A strict guarantee of visual fidelity is not established.

The crops do not interpret all clipping paths and occlusions. 1-bit images are excluded from the crops, not from the page renders. Private files: `runs/compression-quality/{chromium,firefox,webkit}/quality.json`, montages and full-resolution pairs `worst-*.png`.

Engine validation after integration: **442 unit tests**, **375 browser tests** (125 per engine), **104 SEO tests**, build and types with no error. The 33 final outputs are checked in `runs/benchmark-options/integrated-final-structure.json`. This campaign validates the engine. The layout changes of the panel do not modify the PDFs produced.

### History before qpdf: document preserved, Node encoder

_Measured again on 1 October 2026 after the fix of document preservation, on the 11 private PDFs, in Node with jpeg-js and nearest-neighbor downscaling. The historical gains of 31% are no longer valid: they included a removal of structure._

Levels unchanged: Extreme 96 ppi / quality 0.5; Recommended 150 ppi / 0.6; Low 200 ppi / 0.8. At this historical step, no new SSIM campaign had been run; see the integrated measurements above.

The last three columns give the **gain of the delivered file**, after the fallback to the original when the candidate does not gain at least 1%. "Save only" gives the size change before the images are re-encoded; a + sign means the file grows. The detailed times are in the private report and stay indicative, because other tests ran in parallel.

| PDF | Content | Pages | MB | Save only | Extreme | Recommended | Low |
|---|---|---:|---:|---:|---:|---:|---:|
| 01 | report with photos | 74 | 36.9 | +2.8% | 83.6% | 73.6% | 52.6% |
| 02 | report with photos | 288 | 5.5 | +165.1% | 0.0% | 0.0% | 0.0% |
| 03 | report with photos | 31 | 5.2 | +4.1% | 0.0% | 0.0% | 0.0% |
| 04 | report with photos | 230 | 5.8 | +2.6% | 2.5% | 2.2% | 1.7% |
| 05 | JPEG scan | 41 | 16.8 | +0.8% | 80.0% | 54.7% | 0.0% |
| 06 | black-and-white scan | 57 | 2.3 | +0.8% | 0.0% | 0.0% | 0.0% |
| 07 | presentation | 60 | 7.4 | -0.6% | 35.8% | 32.3% | 26.6% |
| 08 | presentation | 51 | 11.0 | -0.3% | 78.0% | 73.3% | 63.6% |
| 09 | text only | 151 | 1.5 | +0.5% | 0.0% | 0.0% | 0.0% |
| 10 | shared banner | 56 | 5.8 | +7.7% | 74.3% | 66.6% | 60.2% |
| 11 | screenshots | 19 | 1.3 | +13.9% | 25.2% | 2.9% | 0.0% |

**Before qpdf: Recommended median gain on PDFs 1 to 5 of 2.23%, below the 30% threshold. The integrated browser measurement above removes this gain blocker.**

Report 02 grows ×2.65 on save only and stays at ×2.55 after recommended compression: the tool therefore delivers the original. PDF 03 also falls back to the original. The Recommended gains of PDFs 01 and 05 stay high, but they are not enough to raise the median. This first fix did not yet include the recompaction of object streams.

The structure of the **candidates**, before any fallback to the original, is compared with pdf.js on the 11 files: bookmarks and their destinations, links, title, XMP, fields, attachments, tagging flag and tagged pages. A synthetic fixture also checks the content of the attachments and the detailed tags.

| Document | Bookmarks before → after | Internal links before → after | Title | Tagged pages before → after |
|---|---:|---:|---|---:|
| PDF 02 | 30 → 30 | 32 → 32 | kept | 288 → 288 |
| PDF 09 | 219 → 219 | 1,651 → 1,651 | kept | 0 → 0 |
| PDF 11 | 14 → 14 | 69 → 69 | kept | 19 → 19 |

Scan 05 contains 37 JPEGs with an explicit `/Mask`: the previous direct replacement removed these masks. They are now kept, also after the photos are downscaled.

Reproduction: `cd apps/web && MEASURE_DIR=../../fixtures-private/compress pnpm vitest run tests/engine/measure.test.ts --silent=false`. JSON/Markdown reports, structure details and Recommended candidates: `fixtures-private/compress/runs/preserve-structure/` (ignored by git).

## Site measurements

_Measured again at closing on 1 October 2026 (`INDEXABLE=true pnpm build`, then `pnpm lighthouse`), 5 pages × 3 runs, all assertions pass. The final compression texts and the persistent panel are included. An independent touch-up of the navigation border, and its rebuild, happened during the collection: the home pages were measured before this touch-up, the last tool pages after it. This campaign is therefore not presented as a measurement of one single immutable build. The border check is tracked separately._

| Page | Median LCP | CLS | JavaScript | Document |
|---|---:|---:|---:|---:|
| `/en/` | 1,359 ms | 0 | 23,163 B | 25,639 B |
| `/fr/` | 1,356 ms | 0 | 23,163 B | 25,904 B |
| `/en/merge-pdf/` | 1,519 ms | 0 | 39,806 B | 20,313 B |
| `/fr/fusionner-pdf/` | 1,520 ms | 0 | 39,806 B | 20,560 B |
| `/en/compress-pdf/` | 1,521 ms | 0 | 39,806 B | 20,498 B |

Closing measurement: all Lighthouse CI assertions pass on the three runs of each page. JavaScript budget of the tool pages restored to **51,200 bytes (50 KB)**; measured weight **39,806 bytes**. Median LCP of the tools around 1.52 s (budget 1.6 s), home around 1.36 s (budget 1.5 s), zero CLS. The bytes are the transfer bytes reported by Lighthouse CI. The page grid still loads with the first file.

Home with the video (3 October 2026): LCP 1,204 ms in English, 1,279 ms in French (the video poster loads there), document 37,175 B and 38,026 B, no separate JavaScript.

Home rebuilt (3 October 2026, with the fill-in-the-blank sentence and its menu, `INDEXABLE=true pnpm build` then `pnpm lighthouse`, 3 runs): LCP 1,202 to 1,216 ms, CLS 0, document 36,283 B in English and 36,829 B in French with the scanner card, that is 35 B under the budget, no JavaScript file: the scripts of the filters and of the sentence are in the page. The home document budget goes from 28,672 to 36,864 B, then to 40,960 B on 3 October (the author's choice, to make room for the video). Without the import zone island, the page weighs about 17 KB less in total: before, 28.1 KB of document and 23.2 KB of JavaScript. The JavaScript budget of 24 KB stays in place.

Content page `/fr/mentions-legales/` (2 October 2026, one run): LCP 1,053 ms, CLS 0, document 12,043 B, no JavaScript file loaded (the scripts of `Base.astro` are in the page), fonts 25,886 B; the four Lighthouse scores at 1.

Processing times measured again at closing, on a 20-page PDF with photos (55.6 MB), in headless Chromium (`pnpm bench`, four cases, a single test worker, no other suite in parallel):

| Tool | Time | Target |
|---|---|---|
| Compress, Recommended level | 1.9 s | under 10 s |
| PDF to JPG | 1.9 s | under 8 s |

Memory on this run: the renderer process goes from 317 MiB at rest to a peak of 558 MiB in Compress; PDF to JPG goes from 317 to 472 MiB. This figure covers the whole process, not the Worker alone, so its 400 MB limit is not directly checked. The complementary CDP measurement of the Workers stays partial, as detailed in the 11-PDF campaign above. The total budget of the Worker is still to confirm.

The global benchmark (`tests/bench/bench.spec.ts`, included by `pnpm bench`) is repaired: it tells the pages apart from the add tile, measures the rotation on Rotate and follows the merge → result → download flow. The four cases pass, with the initial thresholds kept. The 10 s and 8 s limits of milestone 1 are now checked by assertions.

| Measurement | Local machine | CPU slowed ×4 | Local / ×4 target |
|---|---:|---:|---:|
| First 12 thumbnails of a 100-page PDF | 398 ms | 553 ms | 500 / 1,500 ms |
| Rotation of the 100 pages, DOM mutation | 3.7 ms | 15.6 ms | 16 / 16 ms |
| Merge of 10 files of 50 pages, result ready | 1,414 ms | 5,536 ms | 3,000 / 10,000 ms |

A first run had measured 17 ms for the rotation under CPU ×4: the margin stays small. The last measurement compares the raw value with the threshold, without rounding. It measures the style change, not the final paint. CPU throttling simulates neither all the memory nor the performance of a real phone. The times of the first thumbnails are timestamped in the browser predicate, without the Playwright return trip.

Sharing on a phone: check postponed on 1 October, to do on an online preview. `navigator.share` requires HTTPS or localhost. Once a preview of the branch is online, open `/en/pdf-to-jpg` on an iPhone (Safari) and, if possible, on Android (Chrome). Convert a 3-page PDF, tap "Save the 3 images" and check that "Save images" puts them in Photos. This manual check on a physical device stays separate from the automated browser tests.

## Panel validation after the fix

The panel stays on the right while the user reads the explanations, the FAQ and the related tools, which fill the left column. On a short screen, its options scroll separately from the action. The mobile order stays intact. The persistence fix is checked visually at 1024 × 600 and 1280 × 720, then by **30 targeted browser tests** on the three engines, **104 SEO tests**, types and build with no error. The tests check the visible action and the clickable adjacent content at the same time. The previous full campaigns (384 browser tests, 442 unit tests and Lighthouse) are not presented as new runs for this CSS fix. The PDF engine is unchanged.

## Sign: Brother Quill

Loading adjusted on 2 October: `board/DocumentSkeleton.tsx` shows a static sheet while the document opens and the preview renders, with no transient tab. Removal, errors and the password stay accessible. No engine or dependency added; the editor stays deferred. Types valid, nine targeted flows pass on Chromium/Firefox/WebKit: open → render, cancel, unlock and invalid file. Render inspected at 1,280 px and at 390 px in dark theme, with no overflow and no skeleton animation. Temporary checks and screenshots in `/tmp/holy-pdf-skeleton-check` and `/tmp/holy-pdf-skeleton-*.png`.

`/fr/signer-pdf` and `/en/sign-pdf` add a visual signature: drawn, typed as text, or imported from a PNG/JPG/JPEG. The original text and the pages are not rasterized. The drawing comes out on a transparent background. A PNG keeps its transparency and a JPEG keeps its background. This is not a signature with a certificate. PDFs that already have a digital signature are refused. A protected PDF, opened with its password, gets the existing warning about export without protection.

The editor `signature/SignatureEditor.tsx` and its texts are deferred until the PDF opens. One page is previewed at a time. Stale requests are ignored and the URLs are released. Pixel limits are checked before PNG/JPEG decoding and before the preview render. The drawing does not rebuild the interface at each point. The signature and the placements stay in memory, with no persistent storage, and survive a FR/EN switch and a return from the result.

`engine/sign.ts` reopens the original bytes for each export. One tiny temporary page per distinct mark provides a Form XObject shared between its placements. Only the resources of this signature are imported, never the user's pages. Ten placements therefore share one image and one mask. The geometry uses three corners converted by PDFium. The interpolation keeps the precision with rotation and an offset CropBox. The engine tests compare the text, links, bookmarks, forms, tags and attachments of the rich fixture with an independent reader.

The PDFium save can still decompact the internal structures of an original. Sign does not load qpdf. The tool does not announce a size reduction. The structure preservation checked on the fixtures is not a PDF/A or PDF/X certification, nor a proof of accessibility conformance of the added signature.

The navigation bar floats at the bottom of the document area and stops before the FAQ. On mobile, a `ResizeObserver` reserves the real height of the final action; no scroll handler is added. The ready document no longer shows its label. Zoom 50–200% and page rotation are transformations of the existing preview, with no new PDF render. A 10 px handle at the corner adjusts the size. The 32 px rotation button stays separate, below the signature. Their touch targets are 44 px. Rotation adjusts the angle freely (Shift: 15°, keyboard: 1°). Moves take the zoom and the page rotation into account. Only the corners that are actually rotated keep the signature inside the sheet. The rectangle before rotation can have negative coordinates: the engine accepts these values if the transformed content stays in the page. Dragging the corner keeps the opposite corner fixed. The keyboard and the panel slider keep the center fixed. At export, the signature angles are applied in physical coordinates, and the rotation of each page is added to that of the original after insertion.

Spec: [Sign](../specs/2026-10-01-web-sign-design.md).

### Text, initials and several signatures

Adding is one single action, common to the three modes: "Add to this page", in the panel footer above the export. This area is separate from the scrolling content. It does not cover the preview on a short screen. Text updates the ready draft automatically. Drawing computes its image only at the end of a gesture or after an undo, never during the movements. Switching modes restores that mode's own draft. Clearing the input immediately disables the add. Marks already placed stay exportable even with no new draft.

The instruction above the PDF depends only on the selection, never on the temporary preparation of the draft during typing. The placement and handling instructions occupy the same CSS Grid cell. The inactive instruction stays in the height calculation but is hidden visually and from assistive technologies. The height therefore follows the longest text at each width, with no JavaScript measurement and no page jump. The add help in the panel also stays present during typing.

A click in the PDF with no selection offers "Add here" at the chosen point. The coordinates are converted to the original frame of the page, after zoom and rotation. The first click outside a selection only deselects it. Move gestures do not offer an add. The offer disappears on a change of page, zoom, rotation or draft.

Validation of this direct add, on 2 October: **78 Sign scenarios** pass on Chromium/Firefox/WebKit, final build and types valid (**153 files with no diagnostic**), **545 unit/engine tests pass, 1 skipped**. The button is checked with no automatic scroll at 1280 × 720, with no overlap of the options. Screenshots in `fixtures-private/sign/insertion/`. No new loading or dependency. The Lighthouse measurements below are those of the earlier text step.

The selection offers a trash can next to the rotation, below the element (above it near the bottom of the page). It removes only this placement, and releases its resource if the resource is no longer used or prepared for a next add. Removal from the panel uses the same function.

Text mode keeps its input when the user switches tabs. `TypedSignature.tsx` mounts only when it opens for the first time. `typedText.ts` then loads Caveat Regular (24,904 bytes, OFL, self-hosted), then draws a line of 120 characters at most on a transparent canvas. The Simple style uses Figtree, which is already present. If Figtree could not load, it draws with the fallback font that the page already shows, without blocking (measured on 2 October 2026: under load, the test server sometimes leaves Figtree in error, and WebKit then returns an empty list). Caveat must be loaded before the render. A load failure offers "Try again". The preview and the added image share the same pixels. The original text of the PDF stays selectable, but the added mark is an image. The initial text size depends on its proportions, so that initials are not as wide as a full statement.

`SignatureDraft.images` maps each `imageId` to the RGBA pixels. Placements keep their own reference when the user prepares another text or drawing. Blob previews are cached per resource and revoked when the resource is no longer used. Resizing an old element uses its own proportions. The engine creates one shared Form per distinct resource and keeps the order of the placements. The client copies only the referenced images before the transfer. The editor's pixels stay available for another export. Common validation: 1 Mpx per image and 16 Mpx in total, that is 64 MB of source RGBA pixels at most (not a measurement of the total memory). The font and its origin are in `apps/web/public/fonts/signature/`.

Text validation on 2 October: **545 unit/engine tests pass, 1 skipped**, **114 SEO tests**, types with no diagnostic on **152 files**, and build valid. **69 Sign scenarios** pass on Chromium, Firefox and WebKit. The new scenarios read back three distinct images in the PDF, check their alpha and the original text, keep the proportions of an old mark, and recover after a font failure. Screenshots at 1,280 and 390 px reviewed, kept in `fixtures-private/sign/text/`.

Lighthouse after the text was added, three runs on Sign with the same build: **41,942 bytes of JavaScript / 51,200**, initial fonts **25,886 / 81,920**, median LCP **1,523.51 / 1,600 ms**, zero CLS and TBT. Performance, accessibility and best practices: 100. The SEO audit scores 66 only because of the deliberate `noindex` of the local build (`INDEXABLE` absent), so the full set of Lighthouse assertions is not green. Caveat does not load at first display. Reports and assertions in `fixtures-private/sign/text-lighthouse/`. No change to the budgets or the indexing for this measurement.

### Smoothed drawing and handles

`signature/drawing.ts` keeps the strokes within a limit of 12,000 points. Each new sample adds a quadratic Bézier segment, with a light stabilization adapted to speed for the mouse. Pen and touch do not get this position filter. Coalesced events are consumed when they are available; otherwise the normal move is enough. The final point and isolated clicks are kept. No recalculation of the full stroke during the movements. A replay happens to undo a stroke or to switch from one drawing surface to the other.

`DrawingSurface.tsx` shares the same drawing between the panel and an enlarged dialog. Undo removes only the last stroke. Esc closes the dialog and returns the focus to the button that opened it. The two canvases are each 1280 × 480 pixels. The white background is visual only, and the export keeps the alpha. When the limit is reached, the interface says so and offers to undo, clear or use the drawing.

The size handle is a visible 10 px square at the local bottom-right corner, with a 44 px target mostly outside the drawing. `resizeFromCorner` projects the move onto the rotated diagonal, keeps the proportions and the opposite corner, then bounds the scale factor with the four real corners. The keyboard and the panel slider keep their centered resize. The rotation button stays separate, below the real bounds after page rotation. It moves above near the bottom of the sheet. A click or a focus outside the selection and its controls hides the frame and the handles; Esc does the same. The drawing stays clickable so that it can be selected again. None of these operations triggers a PDF render.

After the feedback on the corner handle and on deselection: **88 targeted unit/engine/font tests**, **45 browser scenarios on the three engines**, types (148 files) and build pass. Screenshots at 1,280 and 390 px reviewed.

Earlier validation of the drawing, on 2 October: **522 unit/engine tests passed, 1 skipped**, types with no diagnostic on **148 files**, build and **114 SEO tests** valid. The **60 Sign scenarios** pass on Chromium, Firefox and WebKit, at widths of 1,280 and 390 px for the relevant checks. In particular, they check the edges after rotation, the center after a resize, the controls outside the signature, undo, the exported transparency and the return of the focus after the dialog closes.

Isolated measurement in Chromium 153 on 10,000 points: p95 below the clock resolution (0.1 ms), in the first 500 points as in the last 500; observed maximum 0.5 ms. This measures the synchronous dispatch of the event, the filter and the canvas commands. It does not include the GPU or the latency to display. Report and screenshots in `fixtures-private/sign/drawing/`. The browser test also checks the linear number of segments for 5,000 points. No dependency added. The previous Lighthouse measurements were not run again for this change, which loads on demand.

### Acceptance feedback: PNG, zoom and rotations

PNG/JPG/JPEG accepted. The limits of 10 MiB / 16 Mpx before decoding and the normalization to 1 Mpx are kept. The zero, partial and opaque alpha of the PNG is read back independently in the exported PDF. The navigation stays clickable after scrolling, without the test bench moving automatically to reach the buttons, on desktop and on a narrow screen.

After these changes: build and types (143 files) valid, **507 unit/engine tests** passed and one private measurement skipped, **114 SEO tests** and **42 Sign scenarios on the three browsers** passed, then **6 zoom/rotation checks** passed after the mobile case was added (three cases already covered, three new). Navigation and handle screenshots checked. The Lighthouse measurements and the times below describe the earlier campaign, not a new run. No engine or library added. Zoom, preview rotation and move reuse the same page render.

### Sign measurements: 1 October 2026

Three repetitions in Chromium 153, on a synthetic 20-page photo PDF (29,466,437 bytes), with 20 placements of the same JPG signature. The imported 2560 × 1600 image is scaled down to 1264 × 790 (998,560 pixels). Report, SHA256 hashes and light/dark screenshots at 1280 × 900 and 390 × 844: `fixtures-private/sign/`.

| Browser measurement | Result |
|---|---|
| Open to preview, median | 230 ms |
| Import to signature ready, median | 103 ms |
| Export to result, median | 242 ms (235 / 244 / 242 ms) |
| Size of each output | 29,934,187 bytes, that is +467,750 bytes for 20 placements |
| Move, p95 event → style mutation | 0.5 / 0.7 / 0.7 ms over 60 moves per repetition |
| New PDF render during the move | 0 requests |

These times include the interface waits for opening, import and export. The move measures the DOM update, **not** the paint or the GPU. This campaign on one computer and one synthetic file guarantees neither the times of all PDFs nor the performance of a physical phone. It does not measure the total memory of the Worker.

Node/WASM microbenchmark, 1 Mpx image and three runs: resource sharing takes ten placements of a noisy photo from 12.23 MB / 638 ms to **1.23 MB / 77 ms**. A drawing goes from 91.8 KB / 199 ms to **16.3 KB / 30 ms**. In both cases, nine extra placements cost only 1,344 bytes. These engine measurements are kept separate from the browser flow above.

Validation: **491 unit tests**, one private measurement skipped, **114 SEO tests**, types (141 files) and build valid. The full campaign on the three browsers passes **411 scenarios**. After the last preview protections and the per-segment drawing, the **30 Sign tests** pass on Chromium, Firefox and WebKit. When the page or signature preview fails, Add and Sign are disabled, with an explicit retry, and the placements are not lost.

Final Lighthouse: **18 runs on six pages**, with no rebuild during the collection, and all assertions passed. The JavaScript transfer is **23,259 / 24,576 bytes** on the home pages and **41,554 / 51,200 bytes** on the tool pages, Sign included. Median LCP: home EN 1,382 ms, FR 1,356 ms (budget 1,500 ms); Merge EN 1,524 ms, FR 1,522 ms, Compress 1,523 ms and Sign 1,524 ms (budget 1,600 ms). The six representative runs get 100 in the four categories, with zero CLS and a TBT of 0 to 1 ms. One isolated Compress run gets 92 in performance. The configuration evaluates the assertions on the representative run, which gets 100. Raw reports, configuration, assertions and summary archived in `fixtures-private/sign/lighthouse/`. Budgets unchanged.

## Content pages

_Added on 2 October 2026: [spec](../specs/2026-10-02-web-pages-design.md)._

The footer links lead to 12 pages, in French and in English: What's new, FAQ, Blog, PDF guides, Apps (`#mac`, `#iphone`), Privacy, Terms of use, Legal notice, Cookies, About, Contact, Press. Only the social network icons still point to `#`.

| File | Role |
|---|---|
| `src/sitePages.ts` | the ids, the translated slugs, the emoji of each page; `pagePath`, `articlePath` |
| `src/content/pages/<lang>/<id>.md` | the text of a page, its title, its description, its subtitle (`lead`), its date (`updated`) |
| `src/content/articles/<lang>/<fichier>.md` | a blog article or a guide (`section`), its translated `slug`, its date (`published`) |
| `src/layouts/ContentPage.astro` | the centered header and the text column; no island |
| `src/pages/[lang]/[page].astro` | the pages; the list of articles under Blog and Guides, the links to each tool under the FAQ |
| `src/pages/[lang]/[section]/[article].astro` | the articles, with `BlogPosting` in JSON-LD |
| `src/i18n/pages.ts` | the template labels, kept apart from `fr.ts` and `en.ts`, which `Board.tsx` imports in full |

**Adding content:**

- an article: one `.md` file per language, with the same file name, in `src/content/articles/<lang>/`. No TS file to touch;
- a page: its id and its slugs in `sitePages.ts`, one `.md` per language, a link in `SiteFooter.astro` if the page appears there;
- a language: the language in `languages` (`tools.ts`). TypeScript then asks for a slug for each page and each tool, and for the labels of `i18n/pages.ts`; then one `.md` per page and per article.

French texts put a non-breaking space inside the « » quotes, so that the quotes do not split from their word at the end of a line.

## Home

_Rebuilt on 2 October 2026: [spec](../specs/2026-10-02-web-landing-design.md)._

The top is a fill-in-the-blank sentence: "I want to [verb] my PDFs." The menu offers twelve verbs, each one linked to a tool (`home.pick.verbs` in the dictionaries). It is a `combobox` button and its `listbox` list, not a `<select>`: the native menu took on the size of the sentence. The script of `src/home/Pick.astro` handles the keyboard, puts the verb's monk in the badge (it copies the monk from the list) and changes the button's link. Then comes the monastery, then six sections: Three moves, Use cases, Privacy, Why monks, FAQ as a conversation, final banner. Everything is rendered at build time: the home page hydrates no island. Its only script is still the one for the monastery filters, written in the page.

| File | Role |
|---|---|
| `src/pages/[lang]/index.astro` | the page; the list of use cases (monks, links) and the monks of the three moves |
| `src/i18n/frSite.ts`, `enSite.ts` | the texts, under `home` |
| `src/cast.ts` | the emoji of each title (`titleEmoji`) |
| `src/home/filters.ts` | the filters, the "Show them" button that turns on the switch, and the fade of the rows that scroll sideways |
| `src/home/Pick.astro` | the sentence "I want to [verb] my PDFs.", its menu (opening, keyboard, choice, monk in the badge, button link); in a `compact` version on the 404 page |
| `src/films.ts`, `src/home/film.ts` | the video per language; the top button that opens it in a `<dialog>` and stops it on close |
| `src/pages/[lang]/404.astro` | the 404 page, one per language |
| `src/faq.ts` | the anchor of a question, the `FAQPage` JSON-LD, the questions of a Markdown page |

The home FAQ has its own texts, shorter than those of the FAQ page. A question added to the FAQ page therefore does not appear on the home page by itself.

## Known pitfalls

- **New route in development**: the Astro server started before Sign was added still answered 404 on the new FR/EN routes, although the catalog showed the tool and the build worked. A restart of `pnpm dev` on the same port restored the routes. The sign and re-export flow was then checked on 4321. After you add a tool, also check the server already used for manual testing, not only the built site on 8787.

- **Navigation separation**: `SiteNav.astro` uses a 1 px bottom border, transparent at rest and `--line` on scroll or when a menu is open. No shadow under the bar. The border exists in both states to keep the height stable.
- **Bar links**: Merge, Sign, Compress, then the Convert and All tools menus. Sign has replaced Split since 3 October 2026; the footer keeps Split. On hover, the logo takes the accent color and its monk leans, to show that it leads to the home page.
- **Style of a layout component in development**: after a change to `SiteNav.astro`, `astro dev` kept serving the old style, while the page's style was updated. Check on a build, or restart the server.

- **Panel and sections under the tool**: with a loaded document, `main` becomes a two-column grid. The `panel` area spans from the title to the related tools. The explanations, the text and the FAQ have their own areas in the left column. The panel thus stays visible on scroll without covering the content. `.workshop` stays `display: contents`: limiting it to this wrapper made the panel disappear during reading. `.panel-content` scrolls within the available space; `.go` keeps its own place. The phone keeps the order monk → files → options → action. The regression tests check together that the panel and the button are visible and that clicks reach the adjacent content.

- **Article identifier**: the `glob` loader takes the `slug` field of the frontmatter as the identifier. The `articles` collection sets `generateId` to keep `<langue>/<fichier>`, which pairs the two languages of an article.
- **Anchors of a content page**: Markdown derives the id of a heading from its text. An anchor that a link targets (`#mac`, `#iphone`) is written in HTML in the `.md`: `<h2 id="mac">`.
- **Title of a content page on a phone**: in the flex header, the minimum width of the `h1` is the width of its longest word. `overflow-wrap: break-word` does not reduce it: Firefox, at 320 px with fallback fonts, overflowed by 16 px on « Confidentialité ». The title takes `overflow-wrap: anywhere`, and hyphenation only below 30 rem.
- **Size**: the full build of OpenCV.js weighs about 10 MB, without the OCR models. Make a build reduced to the useful functions. Load the engine at the first dropped photo, not when the page opens. OCR also finds the orientation, so it cannot wait for the export.
- **WebAssembly threads**: they require `SharedArrayBuffer`, so the COOP and COEP headers. The Organize tools do not need them. Set them only on the scanner pages: under COEP, each external resource (font, analytics) must send a CORP or CORS header.
- **Document preservation**: Compress saves the source document, without copying its pages. Copying into a new document lost bookmarks, destinations, forms, tags, attachments and metadata. This save decompacts the internal structures. qpdf then recompacts them with `--object-streams=generate --compress-streams=y` when the profile allows it. The fallback to the original under a 1% gain still applies to the final result.
- **qpdf loading and WebKit**: the small adapter `compact.ts` is imported statically in the main Worker. The qpdf Worker and its WASM are created and loaded only on the Compress action. A dynamic import of the adapter produced a chunk that re-imported the Worker entry: WebKit executed it again and duplicated the error class, which turned a network failure into "damaged file". The test of an interrupted download of the Worker script and of the WASM covers this recovery.
- **`EPDFImageObj_SetJpeg`** writes a new dictionary and can remove the `/SMask` and `/Mask` masks. Compress no longer calls it: it rewrites the image stream in the saved source file (`imageStreams.ts`) and keeps the masks, `/Interpolate`, `/Metadata`, `/Intent` and `/Name`. The masks themselves are not re-encoded.
- **Stream rewrite**: it assumes the PDFium layout (one single classic xref table at the right offsets, direct `/Length`, no object streams). Otherwise, it returns the bytes as they are. It leaves alone masks with `/Matte`, color key masks `/Mask [...]` and unknown keys (`/OC`, `/StructParent`…). Indirect explicit masks are kept if their object is a stencil mask. If identical bytes have different decode dictionaries (`/Decode`, palette, dimensions…), the images stay intact. Annotation appearance resources are excluded from the rewrite, because their displayed size is not inventoried.
- **Environment variables**: a module that an island imports (`site.ts`, `tools.ts`…) also runs in the browser, where `process` does not exist. The build removes the unused code, which hides the problem. `astro dev` does not remove it, and the island no longer hydrates. Read environment variables in the frontmatter of an `.astro` file (`INDEXABLE` in `Base.astro`). The test `tests/unit/browser.test.ts` checks this.
- **Shared images and form XObjects**: the JPEG is computed once for the largest placement of the image, by composing the matrices of the nested forms. The stream rewrite keeps the shared references and does not modify the content of pages or forms.
- **Photo extraction**: `FPDFImageObj_GetRenderedBitmap` applies the clipping and the placement size; `GetBitmap` alone loses the masks. `nativeImages.ts` saves a temporary copy only once and adds isolated pages that reference each image resource at its native dimensions. The render keeps the mask and the color space, with no crop. The JPEG is laid on white. Deduplication compares the rendered pixels, not only the stream bytes, because the same stream can carry different masks.
- **Limits of native extraction**: the matching relies on the decoded streams and the dimensions, because the save can add a Flate filter. Mask or color variants are told apart at render. Inline images with no serialized XObject resource are refused explicitly. They are not replaced by a cropped extraction. Decoded data is limited to 64 MB before allocation.
- **JPEG encoder**: check the 2D context before and after drawing, and check the type and the markers of the result. Input and output are limited to 16 million pixels and 16,384 pixels per side. A native image beyond this limit produces the size error, with no silent partial export. Canvas surfaces are released after encoding.
- **Names and search**: reserving all the original names before adding suffixes avoids the collisions `scan`, `scan`, `scan-2`. Search ignores context words, normalizes format plurals, and decides between conversions by the PDF/format order the user asked for.
- **Engine tests**: Node has no `OffscreenCanvas`. The tests pass a `jpeg-js` encoder (development dependency only), with nearest-neighbor scaling.
- **Script shared between two pages**: a module imported by the scripts of two pages becomes a separate file, and so does the page script: the home page lost 150 to 230 ms of LCP the day `pick.ts` also served the 404 page. The code of a shared component goes into the component's own `<script>`, with no import: Astro writes it into each page.
- **404 page per language**: Cloudflare (`not_found_handling: "404-page"`) serves the `404.html` closest to the requested address, but Astro writes `fr/404/index.html` with `build.format: "directory"`. The `not-found-pages` integration of `astro.config.mjs` moves these files to `fr/404.html` and `en/404.html` after the build, and copies the English one to the root for addresses outside a language.
- **Video**: `preload="none"` loads only the poster. The poster of a video downloads even in a closed `<dialog>`, hence one single light poster (13 KB) for the preview, the window and the bubble. The Chromium of Playwright does not play H.264: the tests check opening and stopping, not playback.
- **Scrollbars**: the areas that scroll (the menu list, the rows of the compact view) carry the `scroll` class: a thin, rounded, ink-colored bar, with no track. Chrome and Safari draw it with `::-webkit-scrollbar`, Firefox with `scrollbar-color`. Chrome ignores `::-webkit-scrollbar` as soon as `scrollbar-width` or `scrollbar-color` is set: these two properties stay reserved for Firefox (`@supports (-moz-appearance: none)`). The menu list scrolls inside an `overflow: hidden` frame, otherwise the square track sticks out of the rounded corners.
- **Custom menu and Safari**: Safari does not give the focus to a button that the user clicks. A menu that closes when its button loses the focus must also close on a click elsewhere in the page (`pointerdown` on the document). The list shifts when it opens, to stay 16 px from the screen edges.
- **Home margin**: before the 40 KB budget, the home document had only 35 B of margin under 36 KB. The page script (filters, search, menu) weighs 8.8 KB compressed and the styles 8.4 KB. One more section will require raising the budget or moving the script into a file, at the cost of one request.
- **Anchor of a question**: navigation to `#ancre` does not open a closed `<details>` when the anchor is on the `<details>` itself. A small script in the page of a tool opens it on load and on each `hashchange`. The anchor comes from the text of the question: rewording the question changes its address, and the links of the FAQ page follow at build time.
- **Home budgets**: Lighthouse CI serves the site in brotli at quality 4 and counts the headers; `gzip -9` overestimates the document by about 13%. One more script request at load, even a tiny one, costs the simulated LCP one round trip (+150 ms): a home script is written into the page, and heavy data loads at first use (`/{lang}/search.json`). Astro does not parse the content of a `<template>`: a `<script>` put there stays as it is.
- **Texts absent from the tool pages**: `Board.tsx` imports the whole dictionaries. A text reserved for the home page, such as `frSearch`, is exported separately in `fr.ts` and `en.ts`: the build removes it from the script of the tool pages.
- **`pnpm dev` answers 504 "Outdated Optimize Dep"** after a change of dependencies or imports: the board island no longer hydrates, and nothing receives the dropped files. Stop it, run `pnpm dev --force`, then reload. The built site is not affected.
- **LCP and islands (Lantern)**: Lighthouse keeps in the LCP graph each request that ends before the observed paint, and an ES module never shows the evaluation that would take it out of the graph: the chunks of an island count, whatever the `client:` directive. The levers are the bytes of `Board.js`, the chunks of its second hop and the first 14,600 bytes of the document. The page grid therefore loads with the first file (`import()` in `Board.tsx`), never as a preload on `load`. The Vite preload helper stays in the `preact` chunk (`manualChunks`).
- **Modules shared with a deferred chunk**: a module that both `Board.tsx` and a chunk loaded later (the Sign editor) import becomes a separate chunk, so one more request before the LCP of each tool page. Measured on 2 October 2026: two chunks of this kind pushed the LCP from 1,520 to 1,670 ms (budget 1,600). `SignatureEditor` therefore receives `engine` and `Skeleton` from Board through its props. The image checks of `client.ts` live in `engine/signatureImages.ts`, and the placement geometry, which the editor imports, lives in `engine/signatureGeometry.ts`. An `import()` in `client.sign` does not work: the pixel copy must stay synchronous, because the interface keeps changing the signature after the call. A `manualChunks` that puts these modules with Board does not work either: it pulls the whole Board graph into an 87 KB chunk behind a facade.
- **Inline image (`BI … EI`)**: it has no XObject that the native document can draw alone. "Extract images" then reads its bitmap (`FPDFImageObj_GetBitmap`), already without clipping, instead of failing on the whole file.
- **File chosen before hydration**: the island reads it from its `<input type="file">`, then must empty the input. Otherwise Firefox restores this file on reload and the tool opens it again.
- **Linux fallback fonts**: they are wider than the macOS ones (CI uses them when the site fonts are blocked). At 320 px, a long word of the home title or of a table cell overflowed. These elements now break a word that does not fit alone (`overflow-wrap: anywhere`), with hyphenation below 360 px. The overflow tests name the element that overflows.
- **Board texts**: the island imports `i18n/board.ts`, which contains only the board texts (`fr.ts`, `en.ts`). The texts of the served pages only (menu, footer, home, categories, upcoming tools) live in `frSite.ts` and `enSite.ts`, and `dictionaries` joins both for Astro. Importing `dictionaries` into an island would bring everything into it: measured on 2 October 2026, the split removes 2.4 KB gzip from the tool pages and brings their LCP from 1,670 back to 1,520 ms. A new text goes into `fr.ts` if it serves the board, into `frSite.ts` otherwise. The texts of the monks also live in `frSite.ts`: the page of a tool passes to the board only the monk of that tool, in both languages (prop `monks`), so that each new tool does not make all the pages heavier (measured on 2 October 2026: −3.1 KB gzip, LCP of the tool pages from 1,670 to 1,520 ms). The props of an island must be serializable: the result title is a list of rules (`TitleRule[]`, `{count}` in the texts), read by `titleFor`.
- **`astro dev` cache**: it lives in `node_modules/.vite-dev`, apart from `node_modules/.vite`, which the build, `astro check` and vitest read. After this change, run `pnpm dev --force` once.

## To decide in the web scanner spec

- The OCR engine: PaddleOCR (more accurate) or Tesseract.js (faster), measured on the private batch.
- The performance targets of the scanner, on desktop and on phone.
