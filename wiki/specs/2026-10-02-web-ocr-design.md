# Web: OCR

_Written and shipped on 2 October 2026. Follows [OCR on Mac](2026-10-02-mac-ocr-design.md): same pages read, same invisible text. The author's choice (2 October): Tesseract.js, hosted by the site._

Brother Reader (`/fr/ocr-pdf`, `/en/ocr-pdf`) reads the text of the scanned pages of a PDF and lays it over them, invisible: search finds it, selection copies it, and the page keeps its look.

## Decisions

| Subject | Decision | Reason |
|---|---|---|
| Reading | Tesseract.js 7.0.0, LSTM engine only, French and English (`fra+eng`), `4.0.0_best_int` data | Probe of 2 October: about 3 s per dense A4 page in all three browsers. English adds 0.1 to 0.3 s |
| Hosting | `scripts/copy-ocr.mjs` copies the worker, the three LSTM cores and the two languages into `public/ocr/` (ignored by git) before `dev` and `build` | No file comes from another server. The browser picks its core by itself (relaxed SIMD, SIMD or plain): all three must be served |
| Weight | Nothing when the page loads. On first use: the library (19 KB, a separate chunk), one core (3.9 MB, 1.5 MB compressed) and the languages (3.7 MB). Tesseract keeps the languages in IndexedDB | OCR costs only the people who use it |
| Pages read | The pages with fewer than 50 characters of text (`textCounts` request of the engine) | As on Mac: a scan often carries a stamp or a number |
| Image read | The page rendered by the engine, long side at 2,400 px (about 200 dpi on A4), as JPEG | The same as on Mac. A sharper image changes almost nothing and takes longer to read |
| Writing | `writeTextLayer` (engine): each line read becomes a Helvetica text object in invisible mode, stretched over the box of the line, placed in the axes of the page as the PDF reader shows the page | Exact under all four rotations. The page content is not touched |
| Letters | What the WinAnsi encoding of the standard fonts can write is kept (Latin accents, `’ – € œ`). Another letter loses its accent ("ș" becomes "s") or disappears | No embedded font: the copy barely grows |
| Nothing to read | "Every page already has its text" (`textAlready`); "No text could be read" (`noTextRead`); no copy | An identical copy makes no sense |
| A single PDF | `multipleFiles: false` | Reading takes long. The Mac tool does the same |
| Titles | « OCR d'un PDF » / "OCR a PDF" | "make a PDF searchable" made the search "make pdf smaller" return nothing: "make" became a known word |
| Monk | "Brother Reader" (« Frère Lecteur »), the magnifying glass, the focused look | The name on the Mac. The focused look sets it apart from Brother Lens |

## Known limits

- Two languages: French and English, with no choice.
- A page with 50 characters or more is not read, even if it also carries an image with words.
- The annotations are drawn into the image that is read: their text can be read with the text of the page.
- A page turned by 90° inside its image (a scan placed askew) reads badly: the LSTM core does not detect the orientation.
- No cancel during reading.
- Phones and real scans have not been measured.

## Tests

- Engine (`tests/engine/ocr.test.ts`): each line is written where the PDF reader shows it and as wide as it, under all four rotations; the rendered page does not change; accents are kept or reduced to their base letter; characters are counted per page.
- Browser (`tests/e2e/ocr.spec.ts`): real reading of a scanned page by Tesseract.js, in all three browsers; message when every page already has its text.
