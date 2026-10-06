# Holy PDF wiki

You can open it in Obsidian: **Open folder as vault**, then choose the `wiki/` folder.

## Product

- [Roadmap](product/roadmap.md): all the planned tools, their feasibility, their status and the phases.
- [Brand identity](product/brand.md): Holy PDF, with the name, one monk per tool and the Blue Ink palette.
- [The story of Holy PDF](product/story.md): the lack of space, the family's PDFs and the birth of the project.
- [Launch posts](product/social-posts.md): the LinkedIn, Instagram and X versions, in French.

## Development

- [Technical guide](development/technical-guide.md): where things are, code rules for the site and the desktop app, performance, privacy, git.
- [Scanner algorithm](development/algorithm.md): the pipeline, independent of the language, and its measurements.
- [Tests](development/tests.md): commands, levels, manual checks.
- [Web version](development/web-version.md): Astro site, engine in the browser, known pitfalls.
- [Compression benchmark](development/compression-benchmark-2026-10-01.md): comparison of PDFium, qpdf, Cantoo and MuPDF, browser measurements and limits.
- [Site keywords](development/web-keywords.md): the addresses of the first seven tools in French and in English, the search candidates, volumes to check.

## Specs

_The "Mac: …" specs, the Scanner Mac v1 spec and the Mac app design system spec describe the Swift app, removed on 5 October 2026; its code is at the tag `mac-final`. They stay as an archive of the decisions._

- [Mac: Edit a PDF (step A: additions in the page)](specs/2026-10-04-mac-edit-design.md): additions written into the page, every letter, images cropped, rotated and flipped; B (annotations, links) and C (original content) were to follow.
- [Mac: Watermark](specs/2026-10-02-mac-watermark-design.md): text or image in the content of the pages, opacity, angle, range, with no added engine.

- [Mac: Page numbers](specs/2026-10-02-mac-page-numbers-design.md): format, position, first number, range; the building blocks shared by the tools that save a copy.

- [Mac: Compress](specs/2026-10-02-mac-compress-design.md): three levels, two PDFKit writers in competition, one of them with the Quartz filter, nothing saved without a gain.

- [Mac: Flatten](specs/2026-10-02-mac-flatten-design.md): filled fields and annotations put into the content of the pages, links kept.

- [Mac: Pages per sheet, Split pages in half, Pixelize](specs/2026-10-02-mac-sheets-design.md): three tools with a single setting each, the site's rules, progress and cancellation in the shared session.

- [Mac: Add bookmarks](specs/2026-10-02-mac-bookmarks-design.md): read, add, rename and remove bookmarks; what a tool reads at opening in the shared session.

- [Mac: Overlay two PDFs](specs/2026-10-02-mac-overlay-design.md): the pages of one PDF over or under the pages of another, an accurate preview of both positions.

- [Mac: PDF to Word](specs/2026-10-02-mac-pdf-to-word-design.md): text, styles and images in a .docx written by hand; the fonts read in the content of the pages.

- [Mac: Home by categories, with search](specs/2026-10-02-mac-home-design.md): the site's five categories, its search ported to Swift, its words copied by a script.

- [Mac: Images to PDF and PDF to images](specs/2026-10-02-mac-images-design.md): one A4 page per image, one JPG per page, the site's rules.

- [Mac: Redact](specs/2026-10-02-mac-redact-design.md): black areas drawn by dragging; the redacted page becomes an image at 200 dpi, and nothing of its content stays in the file.

- [Mac: OCR](specs/2026-10-02-mac-ocr-design.md): the Vision reading of the Scanner put as invisible text on the pages without text, with the lines read highlighted.

- [Mac: Protect and Unlock](specs/2026-10-02-mac-protect-unlock-design.md): AES-128 password when the copy is written; copy without encryption, with the known password only.

- [Mac: Split a PDF and Extract pages](specs/2026-10-02-mac-split-extract-design.md): scissors between the pages, checked pages, on the engine of Organize.

- [Mac: Organize pages](specs/2026-10-02-mac-organize-design.md): native grid, order, rotation and deletion without rasterization.

- [Mac: Merge PDF files](specs/2026-10-01-mac-merge-design.md): native assembly, preservation, limits and previews on demand.

- [Mac: Sign a PDF](specs/2026-10-01-mac-sign-design.md): local signature, drawn or imported, preservation of the PDF and performance budgets.

- [Desktop: Tauri shell on the site's code](specs/2026-10-05-desktop-tauri-design.md): the proof that the site's engine runs in the Tauri webview (PDFium, qpdf, workers, `tauri://`), the built site loaded in the shell, the CSP and the smoke tests, and the order of the next steps.
- [Desktop: the app shell, design](specs/2026-10-05-desktop-shell-design.md): the desktop app built from the site's building blocks, without the site around them: monastery, tool screen, title bar, native open and save, and the changes that the board needs.
- [Web: a short film per tool](specs/2026-10-06-web-tool-films-design.md): the 15-second vertical film of a tool behind the home film's pill, a native dialog, nothing loaded before the click, an end that opens the file chooser.
- [Web: audience measurement with GA4](specs/2026-10-06-web-analytics-design.md): Google Analytics behind a port, loaded only after consent, a banner with no flash, the tool's name and never a file.
- [Web: Overlay two PDFs](specs/2026-10-03-web-overlay-design.md): the pages of one PDF over or under the pages of another.
- [Web: Add bookmarks](specs/2026-10-03-web-bookmarks-design.md): read, add, rename, arrange and remove the bookmarks of a PDF.
- [Web: Repair a PDF](specs/2026-10-03-web-repair-design.md): qpdf reads a damaged PDF again, with PDFium as a fallback.
- [Web: Edit a PDF](specs/2026-10-04-web-edit-design.md): text, images, shapes, pencil and highlighter added into the page; then, on 4 October, edits of the original content, stamps, forms and their fields.
- [Web: Crop a PDF](specs/2026-10-04-web-crop-design.md): the drawn area becomes the box of the page, on one page or on all of them.
- [Web: Scanner](specs/2026-10-02-web-scanner-design.md): photos of documents into clean PDFs, the Mac engine ported to OpenCV.js.
- [Web: PDF to Word](specs/2026-10-02-web-pdf-to-word-design.md): text, styles and images in a .docx written by hand.
- [Web: OCR](specs/2026-10-02-web-ocr-design.md): text read by Tesseract.js and put, invisible, on the scanned pages.
- [Web: Redact a PDF](specs/2026-10-02-web-redact-design.md): areas drawn in black, the page becomes an image and its content leaves the file.
- [Web: Pixelize a PDF](specs/2026-10-02-web-pixelize-design.md): pages turned into JPEG images, text that cannot be copied.

- [Web: Split the pages in half](specs/2026-10-02-web-split-in-half-design.md): each page in two halves, in reading order.

- [Web: Pages per sheet](specs/2026-10-02-web-pages-per-sheet-design.md): 2 to 16 pages per A4 sheet, text kept.

- [Web: Flatten a PDF](specs/2026-10-02-web-flatten-design.md): fields and annotations fixed into the content of the pages.

- [Web: Add a watermark](specs/2026-10-02-web-watermark-design.md): text across the pages, color, opacity, angle, width and range.

- [Web: Add page numbers to a PDF](specs/2026-10-02-web-page-numbers-design.md): format, six positions, first number, size and range, text in the content.

- [Web: Protect and Unlock a PDF](specs/2026-10-02-web-protect-unlock-design.md): password added or removed in the browser, generic `transform` request.

- [Web: Sign a PDF](specs/2026-10-01-web-sign-design.md): freehand, handwritten text or PNG/JPG/JPEG, local placements and performance budgets.

- [Scanner Mac v1: design](specs/2026-09-29-scanner-mac-v1-design.md): engine, Mac app, errors, tests.
- [Mac app: Holy PDF design system, design](specs/2026-10-01-mac-design-system-design.md): name, icon, monks, title font, the formal « vous », images exported from the site.
- [Web version: foundation and Organize tools, design](specs/2026-09-29-web-organiser-design.md): Astro site, board, PDFium engine, performance budgets.
- [Web version: Holy PDF design system, design](specs/2026-09-30-web-design-system-design.md): colors, fonts, monks, D2 home page, tool pages, dark mode.
- [Web version: a tool's flow, Compress and PDF to JPG, design](specs/2026-09-30-web-parcours-lot1-design.md): set, run, get the result; compression of the images; pages or photos as JPG.
- [Web: footer pages, design](specs/2026-10-02-web-pages-design.md): legal pages, About, Contact, Press, What's new, FAQ, Apps, blog and guides, in FR and EN.
- [Web: home page redesign and FAQ per tool](specs/2026-10-02-web-landing-design.md): compact top without a drop zone, lower sections, FAQ as a conversation, the questions of each tool linked from the FAQ page.
