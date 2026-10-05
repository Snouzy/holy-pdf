# Roadmap: all tools

_Created on 29 September 2026. Reference: the PDF24 Tools catalog, taken from the screenshots of 29 September._

The final goal is an app that covers this whole catalog, on Mac, iPhone and the Web. Each phase delivers usable tools. A tool starts only with its spec, in `wiki/specs/`.

**Web, 1 October 2026:** Sign is implemented after the Organize / Compress / PDF to JPG milestone. [Its spec](../specs/2026-10-01-web-sign-design.md) covers freehand drawing, handwritten text and PNG/JPG/JPEG import, without a certificate (additions from acceptance testing until 2 October). The next tools of this milestone are Watermark, Page numbers, then Redact.

## Feasibility

| Mark | Meaning |
|---|---|
| **A** | Feasible with the Apple frameworks (PDFKit, Core Graphics, Vision, WebKit), with no dependency |
| **B** | Feasible with the Apple frameworks, but needs low-level code or a compromise to validate |
| **C** | Needs a third-party library or a service: a dependency decision to make in the tool's spec |

## The catalog

### Create

| Tool | Feasibility | Note |
|---|---|---|
| Create a PDF with a camera (**Scanner**) | A | Phase 0, shipped on Mac on 1 October 2026. On the site (3 October 2026): the same engine ported to OpenCV.js, board, correction and export; reading and suggestions in milestone B; see the [web spec](../specs/2026-10-02-web-scanner-design.md) |
| Images to PDF | A | Implemented on Mac (2 October 2026): one A4 page per image, in the order set; see the [spec](../specs/2026-10-02-mac-images-design.md). On the site: JPG to PDF |
| Web page to PDF | A | On Mac: `WKWebView.createPDF`. On the site: it would need a server; not for now (decision of 4 October 2026) |
| Generate a QR code | A | Removed on 4 October 2026: a traffic bait with no link to PDFs |
| Write a PDF | A | Text editor, then PDF layout |
| Create a fillable PDF form | B | On the site, in Edit (decision of 4 October 2026): existing fields are filled in place since 4 October (text, checkbox, radio button, lists), and the Field tool creates fields (text, checkbox, dropdown list; no radio buttons: PDFium gives no proper export value for a new button). On Mac: PDFKit widget annotations |
| Create PDF (from Word, Excel, PowerPoint…) | C | Office rendering: LibreOffice or a service. Not for now (decision of 4 October 2026) |
| Create a PDF job application | A | Document assembly, a use case of Merge |

### Organize

| Tool | Feasibility | Note |
|---|---|---|
| Merge PDF | A | Implemented on Mac (1 October 2026); see the [spec](../specs/2026-10-01-mac-merge-design.md) |
| Assemble documents | A | Merge of PDFs and images |
| Split PDF | A | Implemented on Mac (2 October 2026): scissors between the pages or « pages par fichier » (pages per file); see the [spec](../specs/2026-10-02-mac-split-extract-design.md) |
| Reorder pages | A | Implemented on Mac in Organize (2 October 2026), native grid, drag and undo; see the [spec](../specs/2026-10-02-mac-organize-design.md) |
| Delete pages | A | Available in Organize on Mac, with undo, and at least one page always kept |
| Extract pages | A | Implemented on Mac (2 October 2026): the checked pages in a new PDF; same spec as Split |
| Rotate PDF | A | Available per page in Organize on Mac, without rasterization |
| Pages per sheet | A | Implemented on the site (2 October 2026): 2 to 16 pages per A4 sheet; see the [spec](../specs/2026-10-02-web-pages-per-sheet-design.md). Implemented on Mac the same day; see the [spec](../specs/2026-10-02-mac-sheets-design.md) |
| Split pages in half | A | Implemented on the site (2 October 2026): left and right, or top and bottom; see the [spec](../specs/2026-10-02-web-split-in-half-design.md). Implemented on Mac the same day, bookmarks and links kept; see the [spec](../specs/2026-10-02-mac-sheets-design.md) |
| Add bookmarks | A | Implemented on Mac (2 October 2026): add, rename, remove, change level; see the [spec](../specs/2026-10-02-mac-bookmarks-design.md). On the site (3 October 2026): the same rules, destination view kept as is; see the [web spec](../specs/2026-10-03-web-bookmarks-design.md) |
| Extract images | B | Reading of the image objects of the PDF (`CGPDFScanner`) |

### Edit

| Tool | Feasibility | Note |
|---|---|---|
| Add a watermark | A | Implemented on Mac (2 October 2026): text or image, opacity, angle, page range; see the [spec](../specs/2026-10-02-mac-watermark-design.md). On the site (2 October 2026): text only, centered; see the [spec](../specs/2026-10-02-web-watermark-design.md) |
| Add page numbers | A | Implemented on Mac (2 October 2026): format, position, first number, size, range; see the [spec](../specs/2026-10-02-mac-page-numbers-design.md). On the site (2 October 2026): the same settings, text in the content of the page; see the [spec](../specs/2026-10-02-web-page-numbers-design.md) |
| PDF overlay | A | Implemented on Mac (2 October 2026): the pages of one PDF over or under those of another; see the [spec](../specs/2026-10-02-mac-overlay-design.md). On the site (3 October 2026): the same rule, several receiving PDFs; see the [web spec](../specs/2026-10-03-web-overlay-design.md) |
| Sign PDF | A | Implemented on Mac (1 October 2026): drawn or imported signature. On the site: drawn, typed or imported. The qualified electronic signature (eIDAS) is out of scope |
| Redact a PDF | B | Implemented on Mac (2 October 2026): a page that carries a black area becomes an image at 200 dpi, and its content leaves the file; see the [spec](../specs/2026-10-02-mac-redact-design.md). On the site (2 October 2026): the same rule, PDFium engine; see the [web spec](../specs/2026-10-02-web-redact-design.md) |
| Crop PDF | A | Implemented on the site (4 October 2026): the drawn area becomes the CropBox, on one page or on all pages; see the [spec](../specs/2026-10-04-web-crop-design.md). Added after the comparison with iLovePDF |
| Edit PDF | B | Implemented on the site (4 October 2026) in two versions: additions (text, text boxes, images, shapes, pencil, highlighter), then the document itself (original text corrected, objects moved and deleted, annotations, links, images rotated and cropped), zoom and shortcuts; see the [spec](../specs/2026-10-04-web-edit-design.md). On Mac the same day, step A; see the [Mac spec](../specs/2026-10-04-mac-edit-design.md). Stamps, form filling and field creation also on 4 October |

### Optimize and repair

| Tool | Feasibility | Note |
|---|---|---|
| Compress PDF | A | Implemented on Mac (2 October 2026): three levels, PDFKit write options and Quartz filter, the lightest copy wins; see the [spec](../specs/2026-10-02-mac-compress-design.md). On the site since 30 September |
| OCR PDF | A | Implemented on Mac (2 October 2026): the Vision reading of the Scanner as invisible text on the pages without text; see the [spec](../specs/2026-10-02-mac-ocr-design.md). On the site (2 October 2026): Tesseract.js hosted by the site, French and English; see the [web spec](../specs/2026-10-02-web-ocr-design.md) |
| Pixelize a PDF | A | Implemented on the site (2 October 2026): pages as JPEG at 150 or 300 dpi; see the [spec](../specs/2026-10-02-web-pixelize-design.md). Implemented on Mac the same day; see the [spec](../specs/2026-10-02-mac-sheets-design.md) |
| Flatten the PDF | B | Implemented on the site (2 October 2026): fields and annotations into the content; see the [spec](../specs/2026-10-02-web-flatten-design.md). Implemented on Mac the same day, links kept; see the [spec](../specs/2026-10-02-mac-flatten-design.md) |
| Repair PDF | B | Implemented on the site (3 October 2026): qpdf reads a truncated file, or a file without a cross-reference table, again, with PDFium as fallback; see the [spec](../specs/2026-10-03-web-repair-design.md) |
| Optimize PDF for the Web | C | Linearization: not in the Apple frameworks (qpdf) |
| PDF to PDF/A | C | ISO conformance: fonts, ICC profiles, validation |

### Security and privacy

| Tool | Feasibility | Note |
|---|---|---|
| Protect PDF | A | Implemented on Mac (2 October 2026): password with AES-128, the strongest that PDFKit writes; see the [spec](../specs/2026-10-02-mac-protect-unlock-design.md). On the site (2 October 2026): PDFium encryption, see the [spec](../specs/2026-10-02-web-protect-unlock-design.md) |
| Unlock PDF | A | Implemented on Mac and on the site (2 October 2026), only with the known password: a copy without encryption, with the print and copy limits lifted |

### Convert

| Tool | Feasibility | Note |
|---|---|---|
| PDF to images | A | Implemented on Mac (2 October 2026): one JPG per page, 150 or 300 dpi; same spec. On the site: PDF to JPG, with the extraction of photos |
| Convert images | A | ImageIO |
| PDF to Word, Excel, PowerPoint converter | C | Layout reconstruction: a library or a service. PDF to Word implemented on the site (2 October 2026): text, styles and images, without tables; see the [spec](../specs/2026-10-02-web-pdf-to-word-design.md). PDF to Word implemented on Mac the same day, without a library; see the [spec](../specs/2026-10-02-mac-pdf-to-word-design.md) |

### View and check

| Tool | Feasibility | Note |
|---|---|---|
| View PDF | A | `PDFView` |
| Search in PDFs | A | No (decision of 4 October 2026) |
| Compare PDF | B | Text diff + visual diff page by page |
| Check PDF/A | C | Validator (veraPDF or equivalent) |
| Viewer preferences | A | |

### Invoices

| Tool | Feasibility | Note |
|---|---|---|
| Create an invoice | A | Template and layout |
| Create an invoice visually | A | Template editor |
| Create an electronic invoice | C | Factur-X / ZUGFeRD: PDF/A-3 + embedded XML |
| PDF invoice to electronic invoice | C | Same |
| XML electronic invoice to PDF | B | Reading of the XML and layout |
| Validate an electronic invoice | C | Validation of the schemas and of the business rules |

Electronic invoicing becomes mandatory for companies in France, in steps, from September 2026. It is a strong commercial argument, but also the most standardized workstream of the catalog.

### Desktop

| Tool | Feasibility | Note |
|---|---|---|
| PDF reader | A | View PDF as the default app |
| PDF printer / Creator | — | macOS already offers it ("Save as PDF" in each print dialog). To reconsider only for Windows |

## Phases

| Phase | Content | Why in this order |
|---|---|---|
| 0 | **Scanner**: engine, command-line tool, Mac app | Shipped on 1 October 2026 (PR #2 and #7). Swift app removed on 5 October (tag `mac-final`). The Scanner continues on the site and in the desktop app |
| 1 | **Grid home** (categories, search, favorites, recents) + **Organize**: merge, split, reorder, delete, extract, rotate, images ↔ PDF | All in A, reuses the board and `PDFCore`, covers the most frequent uses. Shipped on Mac on 2 October 2026, except favorites and recents; see the [home spec](../specs/2026-10-02-mac-home-design.md) |
| 2 | **Edit**: watermark, page numbers, sign, redact, overlay, pages per sheet, split in half, bookmarks | In A and B, once `PDFCore` can redraw pages |
| 3 | **Optimize and secure**: compress, OCR of an existing PDF, pixelize, flatten, protect, unlock, repair | Reuses OCR and rendering |
| 4 | **Create and view**: web page, QR code, write a PDF, forms, reader, search, comparison | |
| 5 | **Invoices**: creation, then electronic invoice | First workstream in C: dependency decision, standards |
| 6 | **Office conversions and standards**: Office ↔ PDF, PDF/A, linearization | The most costly, the least differentiating |

Cross-cutting workstreams, to plan in parallel:

- **Brand identity**: see [Brand identity](brand.md). To do before phase 1, because the grid home lives on its illustrations. Applied to the site and to the Mac app;
- **iPhone app**: after phase 0, with the camera for the Scanner;
- **Web version**: static Astro site, tools in Preact, engine rewritten from `wiki/development/algorithm.md` and run in the browser, A and B tools through PDFium in WebAssembly. Shipped: the 7 Organize tools, then Compress and PDF to JPG (30 September 2026), all with the three-step flow; navigation bar, footer and centered tool page (1 October 2026). See [Web version](../development/web-version.md);
- **Commercial layer**: decided on 4 October 2026, see below.

## Decisions of 4 October 2026

- Not for now: anything that needs a server or an AI model (web page to PDF, Office to PDF, summary, translation).
- No: search in PDFs. Removed: the QR code.
- Done next, in Edit on the site: stamps, form filling and field creation.

### Business model and open source

- **The site stays free, with no account, no quota, no ads.** It is the promise of the founding story, not a pricing choice: the marginal cost of an operation is zero, since everything runs on the user's device.
- **The whole repository becomes public under AGPL-3.0-or-later**, with two additional terms (section 7): distribution through the app stores, and no trademark rights. They were written before any outside contribution, while the rights holder is still the only contributor. No CLA: DCO on contributions. The illustration files are under AGPL like the code. The name, the logo and the monk stay reserved trademarks ([BRAND.md](../../BRAND.md)). A fork takes a new name. Trademark filing in the name of the company, for the name and the monk (figurative mark), classes 9 and 42, at the INPI or the EUIPO.
- **The desktop app is built with Tauri 2 on the code of the site** (`apps/desktop/`), Mac and Windows first, Linux once WebKitGTK has run the engine. Proof made on 5 October 2026: the engine of the site (PDFium, qpdf, workers) runs in the Tauri webview, served by its protocol. The same day, the shell loads the built site, in the system language; see the [spec](../specs/2026-10-05-desktop-tauri-design.md). The site in a window is only a step: the app must look like a native app of its system, the Swift app on Mac, a Windows app on Windows, with nothing of the site around it ([app shell spec](../specs/2026-10-05-desktop-shell-design.md)). It sells what the site cannot do: open PDFs by double-click, process a whole folder, save in place, work offline. One-time purchase, updates included, direct sale through an official merchant before the stores. Its code is in the same public repository.
- **The Swift Mac app is frozen**: fixes only. With two engines, every feature had to be built twice. Its code stays for possible macOS extensions (Quick Actions, Share) and for the camera of the iPhone Scanner, if Tauri is not enough.
- **The Swift Mac app is removed (5 October 2026)**, at the request of the author: `apps/mac` and `Packages/Core` leave the repository. The `mac-final` tag keeps their last state. Work on these extensions would start again from there.
- **Organizations**: a « Pour les organisations » (For organizations) page on the site brings in the requests. The offer (intranet bundle in the client's colors, signed and updated build, support, GDPR file) is coded only at the first request, in a second private repository that depends on the public one.
- Rejected: ads, donations, quotas on the site, subscriptions for individuals.
- **Fresh history for the public repository.** The review of 5 October 2026 found, in three commits of September, the description of the private batch of photos (names, types of records, dates). Cleaning the current version is not enough: the public repository starts from a first commit that takes the cleaned tree. The private repository keeps the full history, as an archive.
- **The plans leave the repository.** `wiki/plans/` held execution logs written for agents, with the paths of the author's machine. The specs stay the documentation. The plans live in `tasks/`, untracked.
- **Publisher and rights holder: Snouzylabs S.R.L.** (decision of 5 October 2026), the company that also publishes workout.cool. The code is under "Copyright (C) 2026 Snouzylabs S.R.L. and the Holy PDF contributors". The brand and the videos belong to the company, and the legal notice names it as the publisher. Registered office and registration number still to add.
- **Tree layout (5 October 2026).** The site moves from `Web/` to `apps/web`, with a pnpm workspace at the root (`pnpm dev`, `pnpm verify`): the `apps/*` convention of JS monorepos, which the Tauri desktop app will join in `apps/desktop`. Turborepo and the extraction of a shared package (the engine) wait for this second package. The case conflict between `Packages/` (Swift) and a future `packages/` (JS) went away with the removal of the Swift app, on 5 October.
