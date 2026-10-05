# Mac: PDF to Word

_Written 2 October 2026. Status: Swift app removed on 5 October 2026 (tag `mac-final`); at the time, shipped in `apps/mac`. Requested by the author on 2 October ("continue with the next tool"), after the small debts: the site has had the tool since the same day ([site spec](2026-10-02-web-pdf-to-word-design.md))._

## Goal

Copy the text and the images of a PDF into an editable Word document (.docx), in Holy PDF for Mac, with the rules of the site. No library, no service: PDFKit, Core Graphics, and a .docx file written by hand. The roadmap put the tool in class C ("library or service"); the approach of the site shows that we can do without one.

The spec succeeds when:

- the text arrives paragraph by paragraph, with its size, its font, its bold and its italic;
- an image arrives in its place between the paragraphs;
- each page of the PDF gives one Word page;
- Word, Pages and TextEdit open the document;
- the original file is never modified, and a signed PDF is accepted;
- the package, app and string tests pass, with no compiler warning.

## Decisions

| Topic | Decision | Reason |
|---|---|---|
| Lines | PDFKit: `selectionsByLine()` gives the lines in reading order, columns included, and `attributedString` gives the size of each letter | Probe of 2 October: two columns read one after the other, 265 lines in 0.1 s |
| Fonts | PDFKit calls "Helvetica" any font that the Mac does not have. So `PageScan` reads the page content again with Core Graphics (`CGPDFScanner`): the font name of each text run and the point where it starts | Probe: on the arXiv paper, PDFKit sees no bold; the content names `NimbusRomNo9L-Medi`. Read of one page: less than 2 ms |
| Font change within a line | The line takes the font of the leftmost run. For each run in another font, a selection at its start point, the size of half a letter of the line, gives the index of its first letter (PDFKit picks a letter when its middle is in the box: review of 3 October, a 2-point box found nothing) | `characterBounds(at:)` and `characterIndex(at:)` count the letters without the line breaks of `string`: their indexes drift by one at each line (probe). The selections, in contrast, are correct |
| Bold, italic, family | Read from the font name (`-Bold`, `-Italic`, `-Medi`, and `CMBX`, `CMTI` for LaTeX), then from its weight and its flags. The PostScript name becomes a family that Word knows (`TimesNewRomanPSMT` → Times New Roman) | The rule of the site, plus the LaTeX fonts |
| Paragraphs | The rules of the site: a paragraph stops at a gap of more than 1.6 times the text size, at a move back up, at a size change, at a bullet or a number, or after a finished sentence on a short line | Same result on both sides |
| Runs on the same line | PDFKit cuts a line at a large blank: runs that follow each other on the same baseline are joined, with a space | If not, each column of a table would become a paragraph |
| Images | `PageScan` gives the frame of each image. The page is drawn once at 200 dpi and each image is cut out of it, as JPEG at 0.85 | A cut from the page drawing gives the image as it is seen: mask, rotation and colors included, with no need to decode each image format of the PDF. The site, in contrast, asks PDFium for the image |
| Inline images, clipped images | An image written in the content itself (`BI … EI`) is kept. An image clipped by a rectangle (`re` then `W`) keeps what the rectangle shows | Review of 3 October: without the clip, the image copied the text of the next column |
| Malformed page | A point that a matrix sends outside any page is skipped; a form that draws itself is read once, and a page reads no more than 2,000 forms | Review of 3 October: a crafted PDF crashed the app, another one froze it |
| Small images, scans | Less than 16 points on a side: skipped. An image that covers more than 80% of a page that also has text: it is a scan that was already read. A page without text keeps its image | The rules of the site |
| Document | `Docx` writes the XML parts of the site, in a ZIP archive written by hand: text compressed (Compression), JPEGs stored as they are, zlib checksum | No dependency. `unzip` checks the archive in the tests, and macOS reads the text and the styles back |
| Page | One Word page for each PDF page, all at the size of the first one, margins of 72 points, or a quarter of the page if the page is small; an image wider than the text is reduced | Like the site, except the margin of a small page: on the site, a page of less than 144 points gives a negative width |
| Saving | "Convert to Word…" opens the panel and suggests `nom-word.docx`, then the conversion shows the current page and can be cancelled | The suffix of the site. 142 pages take 11 s |
| Signed PDF | Accepted: no copy of the PDF is written | Like PDF to images |
| Monk | "Brother Copyist" (« Frère Copiste » in French), the quill, joyful: the name and the accessory of the site; the happy look of the site is already Brother Quill's on the Mac home screen | Same character as on the site |

## Flow

1. Open or drop a PDF. A protected file asks for its password.
2. "Convert to Word…", choose where to save.
3. "Your PDF is in Word": the file name, and "Show in Finder".

## Known limits

- Tables become lines of text; the columns are copied one after the other. The screen says so.
- Alignment, line spacing, text colors, vector drawings and links are not carried over.
- What the page writes over an image stays on the copied image. A clip that is not a rectangle is ignored.
- Two differences from the site: an image drawn twice at the same place is kept only once, and the frame of an image is cut at the page edge before the 16-point and 80% rules.
- A font change in the middle of a text run that the PDF writes in one go is not seen; a line that is not horizontal keeps the font that PDFKit gives it. A word split at the end of a line keeps its hyphen ("resi-dents"), as on the site.
- Word replaces the families that it does not have (Helvetica World, the LaTeX fonts) when it opens the file.
- A scan without OCR gives only its image; the OCR tool can read it first.
- The whole document is prepared in memory before it is written: a 300-page scan needs a few hundred MB. Above 65,000 images or 3 GB, the conversion stops with a message.
- TextEdit does not show the images of a .docx: Word, Pages and Quick Look in the Finder show them.

## Tests

| Level | What | Where |
|---|---|---|
| Document | Paragraphs, sizes, bold, italic and families read back by macOS; page break; image at its size, reduced to the text width, read back by `unzip`; page narrower than the margins; characters that XML refuses; compressed text | `DocxTests` |
| Engine | Font, size, bold and italic per run, font change in the middle of a line at an ordinary word gap, font changed without a move of the pen, font restored by "Q", fonts inherited from the parent of the page; font names (Medium, Medi, LaTeX); page that misleads the read (huge matrix, form that draws itself); inline image, clipped image; paragraphs (short line after a sentence, gap, bullet, size change, ragged-right text); two columns; one page for each page, rotated pages; image in its place, small image skipped; scan kept alone, skipped behind its read text; signed PDF read, password; progress and cancel | `PDFWordTests` |
| Tool | Document saved and read back, original intact, folder that refuses the write | `WordSessionTests` |
| Screens | Start, ready in light, in dark and in English, document saved | `WordSnapshots` |
| Real files | Six PDFs from `fixtures-private/pdfs`: arXiv paper (15 pages, 0.4 s, bold headings), W-9 form, IRS Publication 17 (142 pages, 12 s, 5,978 bold runs), NASA fact sheet with photos, rotated page, scanned photos; macOS reads all six back | Probe of 2 October, not kept |
| Strings | All translated, never the informal « tu » | `check-strings.py` |
