# Web: PDF to Word

_Written and shipped on 2 October 2026, in the milestone that finished the site catalog. The Mac app has had the tool since the same day ([Mac spec](2026-10-02-mac-pdf-to-word-design.md))._

Brother Copyist (`/fr/pdf-en-word`, `/en/pdf-to-word`) copies the text and the images of one or more PDFs into an editable Word document (.docx).

## Decisions

| Topic | Decision | Reason |
|---|---|---|
| Engine | `engine/word.ts` reads the text with PDFium, character by character; `engine/docx.ts` writes the .docx by hand (XML and `fflate`) | No new dependency: a .docx library would weigh more than the rest of the tool |
| Order | The order in which PDFium reads the page, which follows the columns | A sort by height mixed the lines of two columns (seen on IRS Publication 17) |
| Lines | PDFium puts a line break between the lines it finds; a space that it adds takes the style of the previous word | These generated characters belong to no text object |
| Paragraphs | A paragraph ends: at a gap of more than 1.6 times the text size, at a jump back up (next column), at a size change, at a line that starts with a bullet or a number, or after a sentence that ends on a short line | A ragged text has short lines everywhere. "Short" is measured against the lines that start from the same margin, not against the page; otherwise each line of a left column would be short |
| Style | Font, size, bold, italic per run. The size is the `Tf` size multiplied by the scale of the character matrix. Bold and italic are read in the font name (`Helvetica-Bold`, `Times-Italic`), then in its weight and its flags | The standard fonts declare no useful weight or flags (probe of 2 October). The PostScript name becomes a family that Word knows (`TimesNewRomanPSMT` → Times New Roman) |
| Images | Rendered by `FPDFImageObj_GetRenderedBitmap` (mask included, laid on white); an upright image without a mask keeps its own pixels, which are finer; JPEG 0.85, longest side 2,400 px; inserted before the first paragraph that starts lower than the image in the same band | The PDFium render makes one pixel per point: too blurry for a photo |
| Scan read by OCR | An image that covers more than 80% of a page that has text is left out | Its text is already in the document. A page without text keeps its image, so that the document is not empty |
| Page | One Word page per PDF page, all at the size of the first one, 72-point margins; an image wider than the text is reduced to the text width | One section per page would complicate the document for a rare gain |
| File | `name-word.docx`, type `application/vnd.openxmlformats-officedocument.wordprocessingml.document`; the result screen says "Word document" | The suffix follows the suffix of the other tools |
| Monk | "Brother Copyist" (« Frère Copiste »), the quill, the happy look | The one who copies; the happy look sets this monk apart from Brother Quill, who looks diligent |

## Known limits

- Tables become lines of text; the columns are copied one after the other.
- Alignment, line spacing, text colors, vector drawings and links are not carried over.
- A rotated page keeps its images in the orientation of the original page.
- A bold run-in heading on the same line as the text, or an indented abstract, can split a paragraph in two.
- A scan without OCR gives only its image.

## Checks

- Engine (`tests/engine/word.test.ts`): font, size, bold and italic per run; paragraphs (short line after a sentence, gap, bullet, ragged text); two columns read one after the other; one page per page; image at its place and reduced to the text width; scan kept alone, left out behind its OCR text; file opened by `textutil` (macOS, skipped elsewhere).
- Browser (`tests/e2e/pdf-to-word.spec.ts`): document downloaded, text and page break.
- Probe of 2 October on four real PDFs from `fixtures-private` (arXiv paper, W-9 form, IRS Publication 17 in 142 pages, NASA fact sheet): all four open; 142 pages in 3.3 s in Node.
