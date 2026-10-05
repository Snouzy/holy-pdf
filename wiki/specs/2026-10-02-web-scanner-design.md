# Web: Scanner

_Written on 2 October 2026. Milestones A and C shipped on 3 October (engine, board, correction, export), milestone B the same day (reading, upright orientation, suggestions, searchable text). Author's choice (2 October): parity with the [Mac Scanner](2026-09-29-scanner-mac-v1-design.md), detection by OpenCV.js, HEIC decoder. The algorithm is the one in [Scanner algorithm](../development/algorithm.md), with the same test photos._

Brother Snap (`/fr/scanner`, `/en/scanner`) turns photos of documents into clean PDFs, as if they came out of a scanner: page detected and straightened, white paper, shadows removed, one PDF per document.

## What changes compared to the Mac

| Topic | Mac | Web | Reason |
|---|---|---|---|
| Approximate detection | Vision `VNDetectDocumentSegmentationRequest` | OpenCV.js: reduced grayscale, blur, Canny, dilation, largest convex contour with four vertices (`approxPolyDP`) that covers at least 20% of the photo; otherwise the whole photo, page ⚠︎ | No Vision in a browser. The edge refinement of `algorithm.md` follows, unchanged |
| Straightening, cleaning | Core Image | OpenCV.js (`warpPerspective`, dilation, blur, per-pixel operations) | Same parameters |
| HEIC | ImageIO | libheif (WebAssembly), loaded only when a HEIC file arrives; the capture date is read from the EXIF item of the file (`heicCaptureDay`) | Only Safari decodes HEIC, and libheif does not give the EXIF |
| Reading | Vision, Romanian, French, English | Tesseract.js, `ron+fra+eng`, already served by the site's OCR, plus Romanian | The reference batch is Romanian |
| Upright orientation | Fast OCR in the 4 directions | Tesseract at 1,200 px in the 4 directions, same score | The LSTM core has no orientation detection |
| PDF writing | PDFCore (Core Graphics) | The site's PDFium engine: one page per image, JPEG embedded without recompression, invisible text (`writeTextLayer`), title in the metadata | The building blocks exist |
| Computing | Queue bounded to the number of cores | One Scanner worker (OpenCV, libheif), one page at a time; Tesseract in its own worker | The memory of a phone: a decoded 24 Mpx photo weighs 96 MB |
| Download | Save panel | One PDF, or a .zip when there are several; on phones, the share sheet | Like the other tools of the site |
| Undo | ⌘Z, ⇧⌘Z, Edit menu | ⌘Z / Ctrl+Z, ⇧⌘Z / Ctrl+Y, and two buttons | No menu in a web page |

## Weight

Nothing when the page loads. At the first file: OpenCV.js (13.3 MB, about 3.5 MB compressed) and the Scanner worker. At the first HEIC file: libheif (1.5 MB). At the first reading: Tesseract and its languages (about 7 MB, kept by the browser). The files are copied to `public/scan/` and `public/ocr/` before `dev` and `build`, as for OCR.

## Flow

The flow of the Mac, adapted to a web page:

1. **Start**: drop zone, "Choose photos", and on phones "Take a photo" (the camera opens).
2. **Board**: one row per document (editable name, reason for the suggestion, pages); ⚠︎ on the pages to check, with the reasons; "⚠︎ N pages to check" filter; drag a page to another document, or to the end of the row to create a new one; delete a page or a document; undo and redo; "Add photos".
3. **Correction**: the photo with its 4 corners and a magnifier on the corner that is held, the result next to it; Corners and Eraser tools (adjustable size), Rotate, Undo, Redo, Next page; settings: rendering (Document or Color), watermark (auto, kept, removed), size (Auto, A4, A5, Letter), "Restore automatic detection". Crossed corners are refused with a message.
4. **Export**: all the documents, or a single one from its row; searchable text (on by default); a reminder of the pages still to check; never the GPS position.

## Reading (milestone B)

| Topic | Decision | Reason |
|---|---|---|
| Order | A page is read once it is drawn: first its direction (4 readings at 1,200 px), then its lines on the final page; one page at a time, after the drawing | Erased text never goes into the PDF: we read what is drawn |
| Direction | The best score (confidence × characters) becomes the automatic direction, as long as the visitor does not choose one; 0 if nothing can be read | Like the Mac. 17 pages out of 17 correct on the batch |
| Suggestions | `suggest.ts`, port of `DocumentSuggester`: grouping by page markers, latest date before the capture, title, name `YYYY-MM-DD_Title`; the reason shows next to the number of pages | Applied when all the pages are read, never after a change on the board (move, deletion, name) |
| Markers | In addition to the Mac rules: optional spaces ("Pagina 2 din3"), and "x/n" at the end of a line | Tesseract sticks the marker to the words of its line and loses spaces |
| Capture date | EXIF of the JPEG, and EXIF item of the HEIC read from the file | The reference date for the date rule |
| Searchable text | Box checked by default; the lines become invisible text on the image, at the right place in the page | Like the OCR tool |

## Known limits

- A phone takes several seconds per page: the board fills page after page.
- No session resume: reloading the page loses the batch. The screen asks for confirmation before leaving with documents that are not downloaded.
- Since 5 October 2026, the two questions of the Scanner (pages still to check, document to delete) go through the board's dialog (`ConfirmDialog`), and saving goes through its saver (`Saver`). Both are received as props, like the engine: the webview of the desktop app does not show `confirm()` and cancels download links ([shell spec](2026-10-05-desktop-shell-design.md)).

## Tests

- Engine, in Node (`tests/scan/`): each building block on images made by the test; the pipeline on the 17 photos of `fixtures-private` when they are there (skipped otherwise), against the criteria of the Mac spec: all wrong pages flagged, at most 2 good pages flagged by mistake, 17 pages upright, watermark correct on 16, 10 groupings out of 11, 9 dates out of 11, less than 500 KB per page.
- Browser: import of a photo made by the test, board, correction of a corner, export, PDF read back by pdf.js.
