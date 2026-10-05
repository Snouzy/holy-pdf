# Mac: Compress

_Written 2 October 2026. Status: Swift app removed on 5 October 2026 (tag `mac-final`); at the time, shipped in `apps/mac`. Third of the six tools ordered on 2 October (before: [Page numbers](2026-10-02-mac-page-numbers-design.md), [Protect and Unlock](2026-10-02-mac-protect-unlock-design.md); after: OCR, Redact)._

## Goal

Make a PDF lighter in Holy PDF for Mac, then save the copy. As on the site: three levels, the photos slim down, the text stays selectable. PDFKit and Quartz only, no new engine.

The spec succeeds when:

- a PDF that contains photos comes out lighter, more and more from the Low level to the Extreme level;
- the text, the links, the form fields and the bookmarks stay;
- a PDF that the tool cannot make lighter is not saved, and the screen says so before it asks where to save;
- the original file is never modified;
- the package, app and string tests pass, with no compiler warning.

## What PDFKit can do (probes of 2 October)

Size of the copy as a percentage of the original:

| File | Plain rewrite | Images as JPEG | Optimized for screen | Both | Quartz filter (200 / 144 / 96 dpi) |
|---|---|---|---|---|---|
| NASA fact sheet, 1.2 MB | 97 | 97 | 39 | 39 | 63 / 32 / 19 |
| Scanned Gemini photos, 2.5 MB | 99 | 99 | 196 | 196 | 57 / 28 / 12 |
| `images.pdf`, 1.5 MB | 149 | 51 | 21 | 9 | 149 (no effect) |
| arXiv paper, 2.2 MB | 104 | 120 | 91 | 92 | 94 / 91 / 89 |
| W-9 form, 137 KB | 125 | 125 | 125 | 125 | 125 |

- The two documented options (`saveImagesAsJPEGOption`, `optimizeImagesForScreenOption`) have no setting, and they make some files heavier.
- The Quartz filter is the one behind "Reduce File Size" in Preview. Built in memory with `QuartzFilter(properties:)`, it takes a resolution, a JPEG quality and a cap on the longest side. Without this cap, the Gemini scan comes out sixteen times heavier.
- No approach wins everywhere. All of them keep the text, the links, the fields and the bookmarks.
- The two known large files come out heavier with every approach (book scanned in JBIG2: 555% at best; IRS publication: 448%), in 70 to 100 s per write.

## Decisions

| Topic | Decision | Reason |
|---|---|---|
| Engine | `PDFCompression.compressed` writes two copies per level and keeps the lighter one: the documented options, and the Quartz filter of the level | No approach wins everywhere; two writes stay fast (0.1 to 0.6 s on the test files) |
| Levels | Extreme: JPEG and screen, filter at 96 dpi, quality 0.5, 1,600 px at most. Recommended: JPEG and screen, filter at 150 dpi, 0.6, 2,400 px. Low: JPEG only, filter at 200 dpi, 0.8, 3,200 px | The three levels, their order, their texts, their resolutions and their qualities are those of the site |
| Nothing to gain | If no copy is lighter by at least 1%, the engine returns `nil`: the screen says that the PDF was already well pressed, and nothing is saved | A copy heavier than the original makes no sense |
| Check | A copy with a different page count, or that asks for a password, is discarded. If no write gives a valid copy, it is an error, not an "already well pressed" PDF | Safeguard on an undocumented write key |
| Black-and-white scans | On opening, `PDFCompression.hasBilevelScan` looks for a large one-bit image (500 × 500 pixels or more, in the page or in a form). The screen then warns that the compression can make it blurry | All PDFKit writes turn each image into JPEG; no setting spares one. The site, in contrast, leaves these images intact |
| Two stages | "Compress the PDF" computes and shows the gain; "Save the compressed copy…" comes next | The user knows what they gain before they choose where to save |
| Result kept | The gain stays on screen after the save. Another level or another PDF clears it; the level stays from one PDF to the next | People often compress several files at the same level |
| Cancel | The work runs in the background, with "Cancel". PDFKit does not stop in the middle of a write: the session is free at once, and the result is thrown away when the write ends | The two large files take three minutes |
| iPhone | Without the Quartz filter, which exists only on the Mac: the documented options only | The `PDFCore` package also compiles for iOS |
| Monk | "Brother Press" (« Frère Pressoir » in French), book, focused look: the pose of the site | Same character as on the site |

## What changes in the shared building blocks

- `PDFCopySession.prepare` runs the work of a tool on the open document, off the main actor; the session is in the `working` state, and `cancelWork` takes it out of that state. A work that starts after a cancel waits for the end of the abandoned write: two writes at the same time would compete for memory. The work is declared to the system, so that it does not slow down when the window is hidden. It also removes the "copy saved" mention: the file on the disk is no longer what the tool just produced.
- `CopyToolView` shows the work in progress and its "Cancel" button at the bottom of the panel (`workingTitle`).
- `PDFCopySession.forget` becomes `onSaved` and `onClosed`: Compress keeps its result after the save, Protect empties its fields in both cases.

## Flow

1. Open or drop a PDF. A protected file asks for its password.
2. Choose the level, then "Compress the PDF".
3. The screen shows the gain ("Your PDF is 68% lighter", "1.2 MB → 388 KB"), or says that the PDF was already well pressed.
4. "Save the compressed copy…" suggests `nom-compressé.pdf`.

## Known limits

- Only the images change. A text PDF, or a PDF with images that are already small, does not get lighter.
- In a PDF that mixes photos and black-and-white scanned pages, these pages turn into JPEG and lose sharpness: the screen says so on opening, but it cannot prevent it.
- Recommended and Extreme share the write with the documented options: on a file that the Quartz filter does not touch, the two levels give the same copy.
- Black-and-white scans (JBIG2, CCITT) do not get lighter: PDFKit rewrites them in a heavier format.
- Since the evening of 2 October, the preview shows the compressed copy as soon as it exists, and a "Compressed copy | Original" picker lets you compare before you save (`PDFCopySession.showCopy`). The copy is opened once, off the main actor, at the end of the compression. A change of level goes back to the original.
- The level does not guarantee a size: it sets the resolution and the quality of the images.
- Apple does not document the `QuartzFilter` write key. Preview uses it; if it stopped working, the tool would keep the documented options.
- The copy of a protected PDF opens without a password, and the screen says so.
- The PDFKit limits described in the Protect spec (page labels lost) apply.

## Tests

| Level | What | Where |
|---|---|---|
| Engine | A photo PDF at least twice as light, more and more from the Low level to Extreme, text kept; a PDF without photos returns `nil`; link, field value and bookmark kept; copy of a protected PDF; signed PDF refused; large one-bit image found, direct or in a form, small one ignored | `PDFCompressionTests` |
| Shared session | The work of a tool on the open document, its failure; a cancelled work that does not stop, and the next one that waits for its end; the "saved" mention removed | `PDFCopySessionTests` |
| Tool | Compress then save, original intact, gain kept after the save; PDF already light; result cleared by another level or another PDF; black-and-white scan announced on opening | `CompressSessionTests` |
| Screens | Start, ready, gain in light, in dark and in English, copy saved, already light, work in progress with "Cancel" | `CompressSnapshots` |
| Real files | 36 PDFs from `fixtures-private/pdfs`, at the three levels (3 refused: unreadable or unknown password): pages, fields, links, bookmarks and text counted, all kept; the levels always go in the right direction | Probe of 2 October, not kept |
| Strings | All translated, never the informal « tu » | `check-strings.py` |
