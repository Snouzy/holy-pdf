# Mac: OCR

_Written on 2 October 2026. Status: Swift app removed on 5 October 2026 (tag `mac-final`); at the time, shipped in `apps/mac`. Fourth of the six tools ordered on 2 October (before: [Page numbers](2026-10-02-mac-page-numbers-design.md), [Protect and Unlock](2026-10-02-mac-protect-unlock-design.md), [Compress](2026-10-02-mac-compress-design.md); next: Redact)._

## Goal

Make a scanned PDF searchable in Holy PDF for Mac: read the text that its pages show, put it on top of them, invisible, then save the copy. Vision and PDFKit only, with no new engine.

The spec succeeds when:

- a page without text carries, in the copy, the text read in its image: search finds it, selection copies it;
- the added text is invisible, and placed where the reader sees the words, also on a rotated page;
- a page that already has its text is not touched;
- a PDF with nothing to add is not saved, and the screen says so before it asks where to save;
- the original file is never modified;
- the package, app and text tests pass, with no compiler warning.

## Two paths compared (probes of 2 October)

Five pages of a book from 1886, rendered as images without text:

| Path | Duration | Reading of one line |
|---|---|---|
| PDFKit write option (`saveTextFromOCROption`) | 5.5 s | "Unt a narrow strip from the belly tol", one line missing |
| Scanner reading (`TextReader`, Vision in accurate mode) on the page rendered at 2,400 px | 1.8 s | "Cut a narrow strip from the belly for" |

Vision reads better and three times faster, reports progress page by page, and can be cancelled between two pages. Between 1,600, 2,400 and 3,200 px, the reading changes little; 2,400 px holds an A4 page at 200 dpi.

## Decisions

| Topic | Decision | Reason |
|---|---|---|
| Reading | The Scanner's reading: `TextReader.read`, Vision in accurate mode, Romanian, French and English, with no language correction | Already proven on administrative documents; correction rewrites names, numbers and dates |
| Writing | `PDFTextLayer.adding`: the Watermark's `PageOverlay` building block draws the page, then the text in invisible mode, with the Scanner's `PDFWriter.drawInvisibleText` | Two building blocks that are already tested. We do not re-encode the page image |
| Independence | `PDFCore` does not know Vision: it receives the reading function. The app gives it the one from `ScanCore` | `PDFCore` and `ScanCore` stay two modules with no link |
| Pages read | Pages with fewer than 50 characters of text: a scanned page often carries a stamp (a page number added by this app, a fax header, the mark of a scanner). What the page already says is not written a second time. A page that has its text, even bad text, stays as it is | Without this, "number, then read" in this app would read nothing. A second layer on a typed page would double each word in search |
| Annotations | Form fields, notes and stamps put on the page are not read | Their text is not the text of the page, and it can change later |
| Memory | `render` empties what PDFKit keeps after each page | Measured on 2 October: 625 MB for 40 pages before, 3 MB after |
| Unsaved reading | Opening another PDF or quitting asks for confirmation while the read copy is not saved | Reading a long scan takes minutes |
| Nothing to add | The engine returns `nil`: the screen says there is no text to add, and nothing is saved | An identical copy has no purpose |
| Two steps | "Read the text" reads and shows the result; "Save the copy with its text…" comes next | The user sees what was read before choosing where to save |
| What was read | The lines read are highlighted on the page preview | The added text is invisible: without this, nothing shows the work |
| Progress | "Reading page 4 of 12…" while page 4 is read, with "Cancel"; the cancellation takes effect at the next page | 300 pages take two minutes |
| Monk | "Brother Reader", magnifying glass, a focused look so as not to repeat Brother Lens | The site's accessory for OCR |

## Flow

1. Open or drop a PDF. A protected file asks for its password.
2. "Read the text". The bottom bar shows the current page.
3. The screen says on how many pages text was added, and highlights the lines read on the displayed page; or it says that there is nothing to add.
4. "Save the copy with its text…" suggests `name-ocr.pdf`.

## Known limits

- By default, three languages are read together: Romanian, French, English. Since the evening of 2 October, "Language of the text" also offers each of the languages that Vision reads on this Mac, one at a time. The chosen language applies to the next reading: the reading already done stays on screen, because a click in a list must not throw away minutes of reading. Latin letters read the same in all languages (Vision reads without language correction): the choice matters for the other scripts, Japanese, Chinese, Korean, Arabic, Thai. The choice is not kept from one launch of the app to the next.
- A page that mixes 50 or more characters of typed text and an image with words is not read.
- Lines with low confidence are not discarded: a photo or a diagram can give a few words with no meaning.
- The read copy stays in memory until it is saved or the document is closed.
- Existing text of poor quality (an old OCR) is not replaced: PDFKit cannot remove text from a page.
- Handwriting and very small characters in a coarse scan read badly: the copy carries what Vision read, errors included.
- The limits of PDFKit when it writes apply (Watermark spec): slowness and swollen files on some JBIG2 scans.
- The copy of a protected PDF opens without a password, and the screen says so.

## Tests

| Level | What | Where |
|---|---|---|
| Engine | A scanned page receives the lines read, on a 2,400 px image, with progress; the text is invisible; it lands in the right place under the four rotations; pages that have text are not read; a scan that carries a page number is read, and the number is not written again; a cancelled reading stops at the next page; nothing to add returns `nil`; a reader that fails stops the work; signed PDF refused, protected PDF opened; the highlighting on the preview | `PDFTextLayerTests` |
| Tool | Read a scan with Vision, highlighting on the preview, searchable copy saved, original intact; an unsaved reading counts as a change; a typed PDF has nothing to read; another PDF clears the result | `OCRSessionTests` |
| Screens | Start, ready, text read in light mode, in dark mode and in English, nothing to add | `OCRSnapshots` |
| Real files | Five scanned pages of a book: 2.2 s, all five pages searchable ("CUTTING UP A HOG" found), file of 7,460 to 7,496 KB. A typed form and a rotated page: nothing to add | Probe of 2 October, not kept |
| Texts | All translated, never the informal « tu » | `check-strings.py` |
