# Web version: a tool's flow, Compress and PDF to JPG, design

_Written on 30 September 2026. Status: shipped in `apps/web/`. The approved mockups (the « Nouveaux outils — lot 1 » page, second version, and the « 4 · Le parcours d'un outil » artboard of the "Design system" page) are not published._

## Context

**Addition approved on 1 October 2026:** after the [comparative benchmark](../development/compression-benchmark-2026-10-01.md), Compress adds qpdf 12.4.2 after it replaces the photos in the kept document. PDFium does not rewrite Object Streams. The browser APIs give no structural PDF optimizer. This dependency replaces writing our own compactor. Pinned distribution `@wasm-zoo/qpdf@0.1.1`, with a minimal and reproducible ESM packaging adaptation. The Apache-2.0 license and the third-party notices are kept. The module loads only for compression, in a temporary Worker that is released after the work. Setting: `--object-streams=generate --compress-streams=y`, with no extra JPEG pass and no forced Flate recompression. The minimum gain of 1% still applies to the final result. This step must not turn a profile that forbids Object Streams into PDF 1.5.

The site has 7 tools, all in the Organize category except JPG to PDF. They share the board: a grid of pages and an action bar with **View** and **Download** (see the [design system spec](2026-09-30-web-design-system-design.md)).

On 30 September, the first milestone of upcoming tools was chosen: **Compress** and **PDF to images**. A first mockup kept the board and put the options in a panel on the right. It was judged less clear than the iLovePDF flow. The second mockup, which was chosen, follows three stages: you set up, you run, you collect. This flow joins the design system, for all tools.

Interface rule: each screen must be clear in less than 5 seconds to people who are not at ease with digital tools. So: no clutter, help next to each difficult choice, one single place to look at first, a visible response to each action, and phone first.

## Goal and success criteria

A visitor drops a PDF and sees one single button that says what it will do. The visitor taps it and sees the work progress. Then the visitor arrives on a page that says what they gained and gives them their file.

The spec succeeds when:

- the 9 tools (the 7 current ones, Compress, PDF to JPG) follow the three stages;
- Compress makes a PDF with photos smaller without touching the text: the text stays selectable;
- PDF to JPG gives one image per page, or the photos of the PDF;
- several output files arrive in a `.zip` on a computer, and in the share sheet on a phone;
- the current performance budgets hold;
- the tests of the Tests section pass on Chromium, Firefox and WebKit.

## Scope

**In the spec:**

- the three-stage flow and its components: settings panel, choice cards, tiles, toggle, "?" help, verb button with progress, result page;
- the move of the 7 current tools to this flow;
- the Compress tool (3 levels);
- the PDF to JPG tool (2 modes, 2 qualities);
- the progress that the engine sends;
- sharing several files on a phone;
- the pages, the texts and the monks of the 2 tools.

**Out of the spec:** PNG and WebP output (JPG only, the author's choice), a compression level set by percentage, font compression, linearization, the other upcoming tools (milestone 2: write on the pages; milestone 3: passwords; milestone 4: OCR and scanner).

## Decisions

| Subject | Decision | Reason |
|---|---|---|
| Flow | Three stages for all tools: set up, run, collect | The author's choice, based on iLovePDF. One single button per screen, and it says what it does |
| Rejected | Keep the action bar with View and Download | Nothing says what will happen. For Compress, the result does not show in the grid |
| Result page | It replaces the board, in the same island. The output file stays in memory until "start again" or a new edit | View and Download do not redo the work. View no longer needs to open the tab before the work ends |
| Top of the page | As soon as a file is chosen, the sentence and the monk's portrait disappear. The H1 stays, smaller | The space goes to the work. The static HTML does not change, so SEO does not change either |
| Compression | PDFium re-encodes the images as JPEG and lowers their resolution. Text, drawings and fonts do not change | The screen's promise: "The text stays selectable". qpdf, loaded on demand, then recompacts the structures (addition of 1 October) |
| Rejected | Pixelize the pages | The text would no longer be selectable |
| Rejected | Ghostscript in WebAssembly | AGPL license, more than 10 MB |
| JPEG encoding | `OffscreenCanvas.convertToBlob` in the Worker, already used for the thumbnails | Native, no dependency |
| Several output files | On a phone, `navigator.share` with the files (the user puts them in Photos or Files). Elsewhere, a `.zip`, with `fflate`, already present | A `.zip` is hard to open on a phone. Browsers block several downloads in a row |
| Identifiers | `compress` and `pdf-to-jpg`. The upcoming identifier `pdf-to-images` goes away | The tool only makes JPG |
| Engine tests | `jpeg-js`, as a development dependency only, encodes the JPEGs in Vitest | Node has no `OffscreenCanvas`. The site does not ship `jpeg-js` |

## A tool's flow

### 1. Set up

**Computer.** Two columns under the title:

- **On the left, the files.**
  - Page-by-page tools: the file tabs, the Undo button and the page grid, as today.
  - Compress and PDF to JPG: a gray dotted area with one card per file: first page, name, size and page count, and a × that removes the file. The "+ Add a PDF" pill is at the top right of the area. The sentence "You can also drag more PDFs into this area." is at the bottom.
- **On the right, the panel**, 460 px, on the surface, from top to bottom:
  1. the tool's monk (84 px, on the tint of its category) and its bubble, with its name and a sentence that says what to do;
  2. the tool's options, if it has any;
  3. at the bottom, the **verb button**, full width, 60 px high, with an arrow;
  4. under the button, the padlock and "Your files stay on this device.".

**Sticky panel (decision of 1 October 2026).** On a computer, the panel stays visible on the right while the board, the explanations, the FAQ and the other tools scroll. This whole part of the page keeps the panel's column free: the content stays on the left and never goes under the panel. The footer stays outside this grid. On a short screen, the settings scroll in their own area. The button and the privacy line have a reserved space that does not hide the choices.

**Phone.** One column: the title, the monk and its bubble, the files (one row per file, or the grid), then the options. The verb button sticks to the bottom of the screen, 56 px high, with the padlock line.

**Option components:**

- **Choice card**: a real radio button in a `fieldset` with its `legend`. The name in bold, a gray sentence in simple words, a circle on the right, and sometimes a small drawing on the left. A chosen card has a 2 px primary outline, a pale blue background and a check mark. The recommended choice carries "Best pick" on the yellow highlighter, and it is checked by default.
- **Tile**: a choice card laid out as a column, with a 72 × 46 px drawing, for two choices that change the nature of the result.
- **Toggle**: two choices side by side, for a secondary setting. The recommended choice says so under its name.
- **"?" help**: a button next to a name, with `aria-expanded`, opens a bubble below it. The bubble closes with Escape or when the button loses focus. Use it only when the gray sentence is not enough.
- **Help sentences**: a green check mark for a guarantee, a gray "?" for a detail.

**Verb button.** A verb in the infinitive and an object (see the texts table). The button is disabled (45% opacity) while no file is ready, or while the tool has nothing to produce (no page chosen, no cut). The monk then says why.

### 2. Run

The verb button becomes the progress bar, in the same place (`role="progressbar"`, `aria-valuenow`). It fills from left to right and shows the percentage. It can no longer be clicked. The monk switches to the `focus` mood and says its current verb ("Pressing…"). On a phone too, the progress shows only in this button. Nothing else moves. An `aria-live` region announces the start and the end.

The engine sends the progress as steps done out of steps to do: pages for the images; pages, then one compaction step per file, for Compress; one step per output file for the page-by-page tools.

### 3. Collect

The result page replaces the board. Focus moves to its title.

- At the top left, a button goes back to stage 1 with everything intact (files, pages, choices): "Change the settings" or "Back to the pages".
- A white card. On the left, the monk in the `joy` mood, 200 px, in its circle, with the bubble "Hallelujah, it's done 🙌". On the right:
  - an H2 that says what changed, with the highlighter on the number;
  - a proof: the before and after bars for Compress, the image thumbnails for PDF to JPG, and "file-name.pdf · 12 pages · 2.4 MB" for the other tools;
  - the main **Download** button, then **View** on each result except Word: the in-page preview, file by file (see "Page preview" in the [foundation spec](2026-09-29-web-organiser-design.md));
  - the name of the output file, in gray.
- Under the card, a link empties the board and reopens the drop area: "Compress another PDF", etc.

**Several output files** (Split, PDF to JPG, and Compress with several PDFs):

- If the device has a touch screen (`pointer: coarse`) and `navigator.canShare({ files })` accepts the files, the button says "Save the 3 images" (or "the 3 PDFs") and opens the share sheet. Under it: "In Photos, or in Files.". A share sheet closed without a choice does nothing.
- Otherwise, the button says "Download the 3 images" and downloads a `.zip`. Under it: "They come in a .zip folder: open it to see the images.".
- A single output file downloads as it is, without a `.zip`.

**Going back.** Any edit after the result (a file added, a page moved) drops the output file. "Change the settings" keeps the state and puts focus back on the verb button.

### The 7 current tools

| Tool | Panel options | Monk's sentence (ready) |
|---|---|---|
| Merge | none | Drag the pages into the order you want. |
| Split | "Split every [N] pages" and Apply | Tap the scissors between two pages to cut. |
| Organize | none | Drag the pages to change their order. |
| Delete pages | none | Tap the bin of each page to remove. |
| Extract pages | the number of chosen pages | Tick the pages to keep. |
| Rotate | the secondary "Rotate all" button | Tap a page's arrow to turn it. |
| JPG to PDF | none | Drag the images into the order you want. |

The bubble keeps its other states: "Reading contract.pdf…" while a file opens, and the error message in the `oops` mood. The current question (« J'agrafe tout ça ? ») goes away: the verb button replaces it.

## Compress

Brother Press, Optimize category, accessory `book`, emoji 🗜️. One or several PDFs.

### Levels

| Level | Gray sentence | Maximum resolution | JPEG quality |
|---|---|---|---|
| Extreme | Strong compression. Images lose detail. | 96 dpi | 0.5 |
| Recommended (the advised choice, checked by default) | A balance between file size and image quality. | 150 dpi | 0.6 |
| Low | More image detail preserved. Gentler compression. | 200 dpi | 0.8 |

Tuned on 1 October 2026 on 11 real PDFs (preliminary check 1): see [Compression measurements](../development/web-version.md#compression-measurements).

All three levels use lossy image compression. None of them guarantees intact quality. The raster text of a scan can lose sharpness. The French and English FAQs separate this case from text that is already selectable, which stays selectable.

Under the cards: "✓ The text stays selectable, at every level.". A small drawing of three bars shows the strength of each level.

### What the engine does

For each page, and inside each form XObject of the page, for each image:

1. Leave the image as it is if it has 1 bit per pixel (fax, JBIG2), or if it is less than 64 px on a side.
2. Compute its displayed resolution from its largest placement, across all pages and inside the form XObjects.
3. Read its pixels (`FPDFImageObj_GetBitmap`), scale them down to the level's maximum resolution if the image is above it, then encode them as JPEG at the level's quality.
4. Save the source document, then replace the image stream directly, but only if the JPEG is smaller. Keep the soft mask and the supported dictionary keys. Leave ambiguous or unsupported cases as they are.
5. Recompact with qpdf in a temporary Worker, then release this Worker. The progress reaches 100% only after this step. Declared archiving or printing profiles, or undetermined metadata, turn off the generation of Object Streams. This safeguard is not a PDF/A or PDF/X certification.

An image drawn on several pages is re-encoded only once and stays shared. **Never rebuild the document by copying pages to compress it**: this copy removes bookmarks, destinations, forms, accessibility tags, attachments and metadata. Saving the source document and rewriting only the image streams must preserve these structures, checked with pdf.js. Protected files opened with their password are exported decrypted, as in the other tools.

The tool keeps the original if the final candidate does not gain at least 1%, except for an unsigned protected PDF, whose export stays decrypted.

A document that contains a digital signature is returned exactly as it is: any rewrite would invalidate the signature. This rule also applies to a password-protected document: it stays protected on export. qpdf is not loaded for this document. The compactor accepts at most 128 MiB of intermediate input and stops after 120 seconds. When a limit is reached, the existing resource error is used.

### Result

- Title: "Your PDF is <highlighted>75% lighter</highlighted>"; with several PDFs: "Your PDFs are 62% lighter"; with no gain: "This PDF was already well pressed".
- Proof: two bars, "Before 12.4 MB" in gray and "After 3.1 MB" in green, to scale.
- Name: `rapport-annuel-compresse.pdf`. Several PDFs: `rapport-annuel-compresse.zip`, and each PDF keeps its name followed by `-compresse`.
- View: the preview of the output PDF in the page, as on the other results.

## PDF to JPG

Brother Illuminator, Convert category, accessory `frame`, emoji 🖼️. One or several PDFs.

### Options

**"What do you want?"**, two tiles:

| Tile | Gray sentence | What the engine does |
|---|---|---|
| Pages to JPG (checked by default) | Every page becomes a picture. | Renders each page (`renderPage`, annotations included) on a white background |
| Extract images | Only the photos in the PDF. "?" help: "The text is left out: you get only the photos, as they are in the PDF." | Renders each image resource on a temporary page at its native size, with no page clipping and with its masks on white. Images under 64 px on a side and duplicates of rendered pixels (SHA-256 fingerprint) are skipped |

Under the tiles: "+ 3 pages, so 3 JPG images." (the number follows the files; in extraction mode, this line goes away: the number is known only after the work).

**"Image quality"**, a toggle:

| Choice | Pages to JPG | Extract images |
|---|---|---|
| Normal (recommended) | 150 dpi, quality 0.85 | quality 0.85 |
| High | 300 dpi, quality 0.92 | quality 0.92 |

Under it: "? High: sharper images, but heavier files.". No image goes over 16 million pixels: above that, the resolution drops for a page converted to JPG. Native extraction and the encoder explicitly refuse an image over 16 million pixels or 16,384 pixels on a side, and do not silently change its dimensions.

### Result

- Title: "Your <highlighted>3 images</highlighted> are ready", or "Your image is ready".
- Proof: the first 6 images actually produced, in both modes, then the number of remaining images.
- Names: `cours-anglais-1.jpg`, `cours-anglais-2.jpg`… in pages mode; `cours-anglais-image-1.jpg`… in extraction. The `.zip`: `cours-anglais-images.zip`.
- No image found in extraction: no result page. The monk, in the `oops` mood, says "This PDF holds no photo. Try “Pages to JPG”.".

## The engine

- **New requests** in `protocol.ts`: `compress` (files, level, names) and `images` (files, mode, quality, names).
- **Delivery**: the `export`, `compress` and `images` requests always return the files. The board asks for a `.zip` separately, when several files are downloaded or if sharing fails. A single output file is returned alone.
- **Responses**: a shared output `{ type: "files", files: { name, bytes }[] }`; the `zip` request returns `{ type: "zip", bytes }`. The "after" size of Compress is the sum of the sizes of the delivered PDFs, before they go into the `.zip`.
- **Progress**: the Worker sends `{ id, progress: { done, total } }` before the final response. `client.ts` passes it to an `onProgress` callback. Progress messages do not count as a response.
- **JPEG encoding**: the engine functions receive `encodeJpeg(pixels, width, height, quality)`. The Worker gives it `OffscreenCanvas`; Vitest gives it `jpeg-js`.
- **Memory**: one page or one image at a time. Each PDFium bitmap is destroyed as soon as its JPEG is made. The output JPEGs go into the output list one by one, as they are made.

## Structure

```
apps/web/src/
  board/
    Board.tsx          the current stage (set up, run, collect), the delivery
    flow.ts            pure reducer of the three stages, tested on its own
    Panel.tsx          replaces ActionBar: monk, tool options, verb button and its progress
    Result.tsx         result page: title, proof, Download or Save, View; Open and Show when the saver returns a path
    FileCards.tsx      file cards (computer) and rows (phone), for tools without a grid
    deliver.ts         share or download, choice of the delivery; the saver (Saver) that the desktop shell replaces, and its three outcomes
    ConfirmDialog.tsx  a question with two answers, for the board and the Scanner (no more confirm(): the desktop webview does not show it)
    document.ts        the document that the shell tracks (result or sources, saved or not); what a board releases when it unmounts
    Options.tsx        choice cards, tiles, toggle, "?" help, and the options of each tool
  engine/
    compress.ts        re-encoding of the images, saving of the source document
    images.ts          pages as JPEG, image extraction
    output.ts          shared output, files or zip (`zipParts` leaves `build.ts`)
  illustrations/Scene.tsx   "compress" scene (thick stack to thin sheet) and "pdf-to-jpg" scene (sheet to photos)
  content/tools/{fr,en}/compress.md, pdf-to-jpg.md
```

`tools.ts` gets a field `workspace: "pages" | "files"`: the page grid, or the file cards. `output` gets `compressed` and `images`. `cast.ts` moves `compress` and `pdf-to-jpg` from the upcoming tools to the ready tools: the home page shows 9 cards and "And 10 monks in meditation".

## Pages and SEO

| Tool | FR address | EN address | H1 FR | H1 EN |
|---|---|---|---|---|
| Compress | `/fr/compresser-pdf` | `/en/compress-pdf` | Compresser un PDF | Compress a PDF |
| PDF to JPG | `/fr/pdf-en-jpg` | `/en/pdf-to-jpg` | PDF en JPG | PDF to JPG |

The `title`, `description`, steps and FAQ were written after a check of search volumes with a keyword research tool. They are still marked "to review" in [Brand identity](../product/brand.md). The steps of the 7 current tools change too: "Click “Merge the PDFs”", then "Download the PDF".

## Texts

| Tool | Monk FR / EN | Verb button | Result title | Start again |
|---|---|---|---|---|
| Merge | Frère Agrafe | Merge the PDFs | Your PDFs are joined | Merge other PDFs |
| Split | Frère Ciseaux | Split the PDF | Your PDF is split into 3 | Split another PDF |
| Organize | Frère Classeur | Tidy up the pages | Your pages are in order | Organize another PDF |
| Delete pages | Frère Gomme | Delete the pages | 2 pages removed | Edit another PDF |
| Extract pages | Frère Loupe | Extract the pages | 3 pages extracted | Extract from another PDF |
| Rotate | Frère Toupie | Rotate the PDF | Your pages are straight | Rotate another PDF |
| JPG to PDF | Frère Cadre | Make the PDF | Your PDF is ready | Convert other images |
| Compress | Frère Pressoir / Brother Press | Compress the PDF | Your PDF is 75% lighter | Compress another PDF |
| PDF to JPG | Frère Enlumineur / Brother Illuminator | Convert to JPG | Your 3 images are ready | Convert another PDF |

Brother Press: "Brother Press squeezes your PDF files without touching the text: the photos slim down, the words stay." Bubble: "Choose the pressure. I'll do the rest." Working: "Pressing…"

Brother Illuminator: "Brother Illuminator turns your pages into JPG images." Bubble: "Every page, or just the pictures?" Working: "Illuminating…"

In `i18n`, `MonkTexts.question` becomes `hint` (the sentence from the table of the 7 tools), and gets `verb`, `result` (a function of the number) and `again`. The back button has two shared texts: "Change the settings" (Compress, PDF to JPG) and "Back to the pages" (page-by-page tools). The two dictionaries keep the same type. All these texts are "to review".

## Error handling

| Case | What the visitor sees |
|---|---|
| Password-protected PDF | As today: the password field on the file's tab or card |
| Unreadable file | The card in error, the message in stamp red, the × to remove it. The other files stay usable |
| Out of memory during the work | Back to stage 1, the monk in `oops`: "This file is too large for this device." |
| Compress with no gain | The result page, "This PDF was already well pressed", and the original for download |
| Extraction with no photo | Stage 1, the monk in `oops` (see PDF to JPG) |
| Share refused or closed | Nothing. The button stays there |
| Share impossible when it was planned | The `.zip` downloads |

## Accessibility

- The choices are real radio buttons in a `fieldset`: the arrow keys move from one to the next.
- The "?" help has a label ("Extract images: help"), exposes its state with `aria-expanded`, and its bubble closes with Escape.
- The progress bar has `role="progressbar"`. The start and the end are announced.
- The result page takes focus on its title. "Change the settings" gives focus back to the verb button.
- On a phone, every touch target is at least 44 px, and the verb button is at least 56 px.
- `prefers-reduced-motion`: the bar jumps from step to step, with no animation.

## Performance

The budgets of the design system spec do not change: JavaScript of a tool page ≤ 50 KB (gzip), LCP ≤ 1.6 s. The flow components load with the board. The compression and image code lives in the Worker, which loads after the page.

Reference points, measured in preliminary check 1, on a recent laptop:

| Operation | Reference point |
|---|---|
| Compress a 20-page PDF with photos (15 MB), Recommended level | < 10 s |
| PDF to JPG, 20 A4 pages, Normal quality | < 8 s |
| Worker memory peak | < 400 MB |

## Tests

**Unit (Vitest):**

- `flow`: set up, run, progress, result, going back with the state intact, an edit that drops the result, a failure that goes back to stage 1.
- `deliver`: one file gives one download; several files give sharing if the screen is a touch screen and `canShare` accepts, otherwise the `.zip`.
- Output file names for Compress and PDF to JPG.
- Texts: each tool has `hint`, `verb`, `result` and `again` in both languages.

**Engine (Vitest, PDFium in WebAssembly, `jpeg-js`):**

- Compress: a PDF with a large photo gets smaller; text, bookmarks, links, title/XMP, form, tags and attachment stay readable (pdf.js); the masks of transparent images are kept; 1-bit images and small images stay intact; shared images and form images stay shared after compression; a PDF with no gain returns the original.
- PDF to JPG: as many JPEGs as pages, at the right dimensions for 150 and 300 dpi; extraction returns one image per photo, with no duplicate and no small image; a PDF with no photo returns an empty list.
- Progress: `done` goes from 1 to `total`, in order.

**End to end (Playwright, Chromium, Firefox, WebKit):**

- Compress: drop a PDF with photos, keep Recommended, run, see the progress then "% lighter", download a smaller PDF; "Change the settings" comes back with the file.
- PDF to JPG: 3 pages give 3 images in a `.zip`; the "?" help opens and closes with the keyboard; extraction from a PDF with no photo lets the monk say so.
- Phone (390 px, emulated touch screen, mocked `navigator.share`): the button says "Save the 3 images" and shares 3 files; no horizontal scroll; the verb button stays visible at the bottom.
- The 7 current tools: the verb button, then the result page, then Download and View. The existing board tests are adapted to the new flow.
- The top of the page collapses as soon as a file is chosen, and the H1 stays.

## Preliminary checks

To do at the start of the plan, before the components:

1. **Compression gain.** On 10 real PDFs (reports with photos, scans, presentations, a text-only PDF), measure the gain of each level and the time. The private batch stays out of the repository. If the Recommended level gains less than 30% on the PDFs with photos, stop and talk with the author. Result: see [Web version](../development/web-version.md#compression-measurements).
2. **Images and structure.** Check that the stream rewrite replaces the old data, that a shared image is still written once, and that bookmarks, links, title, forms, tags and attachments are kept. Measure the size of the save alone separately: PDFium can unpack the object streams.
3. **Sharing.** Check `navigator.canShare({ files })` with 3 JPEGs on Safari iOS and Chrome Android, and the « Enregistrer dans Photos » choice.
4. **Home page weight.** Measure the compressed HTML of the home page with 9 cards against the 25 KB budget.

## Build order

1. Preliminary checks 1 and 2: they can stop Compress.
2. The three-stage flow, the progress and the delivery, applied to the 7 current tools.
3. PDF to JPG.
4. Compress.

Each step leaves the site usable and its tests green.

## Deviations during the build

The plan and the execution changed the spec on nine points:

1. The engine always returns the files. A `.zip` is made on demand, when several files are downloaded. The spec had each request choose `zip` or `files`.
2. The PDF to JPG result shows the output images (the first 6), in both modes, and not the board thumbnails.
3. The first implementation left shared images and form XObject images as they were. The review fix of 1 October replaces their streams directly in the source document: no rewrite of the form content is needed.
4. The "?" help is a button with `aria-expanded` whose bubble opens below it, and not a `popover`: a popover cannot sit under its button without CSS anchor positioning, which none of the three browsers has. Escape, or focus leaving the button, closes it.
5. During the work, the monk says its verb ("Pressing…") and the button shows the percentage. "Page 2 of 4" would be wrong for the page-by-page tools, whose steps are files.
6. Order: the compression engine and its measurement come first, because measuring the gain needs the engine.
7. The progress shows only in the verb button, not on each file row on a phone: the engine counts the pages of all the files together.
8. Compress keeps the original unless the new file gains at least 1%, and never returns the original of a protected PDF: that file would still ask for its password, while the site promises files without one.
9. An image with transparency is re-encoded as JPEG and keeps its soft mask: PDFium loses the mask when it writes a JPEG, so the stream is rewritten in the saved file. The rewrite checks the layout of the file and returns the bytes as they are if it does not recognize the layout. The levels become 96, 150 and 200 dpi (quality 0.5, 0.6 and 0.8), instead of 100, 150 and 220. The sentence "leave it as it is if it has transparency" in the Compress section no longer applies.

Decisions made during the work:

- Preliminary check 1: the old medians of 29%, then 31%, included a structure removal by page copy. They do not validate the 30% threshold. Redo the measurement on the 11 PDFs and keep the source document, with a median on PDFs 1 to 5 (reports with photos, JPEG scan). Separate the raw candidate from the file actually delivered when the tool keeps the original. Table and details: [Web version](../development/web-version.md#compression-measurements).
- JPG to PDF has neither file tabs nor color marks, since an image is a page. The caption under each image gives the file name. On hover, a tooltip gives the name and the size.
- The result bubble says "Hallelujah, it's done". The file tabs fit on a single row that scrolls sideways (thin bar, fade on the right while some tabs are hidden), with the Undo button always visible.
- The header is sticky. Its menus show one line icon per tool, and not the small monks. The footer follows the structure of the design system: three promises, the brand, five columns of links. Its pages that were not written yet pointed to `#`. The social network icons come from Simple Icons (CC0), written into the page. Details in the [design system spec](2026-09-30-web-design-system-design.md#common-layout).
- An empty tool page centers one single action: the monk above the "Choose…" button. It replaces the drop titles (`t.drop.*`). The visible breadcrumb goes away. It stays in the JSON-LD.

## Planned next steps

- review of the texts and the SEO pages of the 2 tools;
- milestone 2: write on the pages (Sign, Watermark, Page numbers, Redact);
- milestone 3: Protect and Unlock. PDFium exposes `EPDF_SetEncryption`: no extra library;
- milestone 4: OCR and Scanner.
