# Web version: foundation and Organize tools, design

_Written on 29 September 2026, updated on the 30th with the results of a full prototype. Status: shipped in `apps/web/`._

## Context

`pdf-toolbox` targets Mac, iPhone and the Web (see the [roadmap](../product/roadmap.md)). The stack choices of the web version are in [Web version](../development/web-version.md).

The web version splits into three sub-projects, each with its own spec:

1. **the foundation and the Organize tools**: this spec;
2. the port of the scanner, once `algorithm.md` stops changing;
3. the tools of the next phases.

The priority is performance: at load time, because it counts for Google ranking, and during processing. The traffic comes from search.

## Goal and success criteria

A visitor arrives from Google on the page of a tool, drops their files, arranges them on the board and downloads the result. They have no account to create, and no file is uploaded.

V1 succeeds when:

- the 7 tools work on Chromium, WebKit and Firefox, on computers and on phones;
- no network request carries the content of a file;
- each page holds the load budgets of the Performance section, and CI blocks otherwise;
- the operations meet the processing targets set by the benchmark;
- each page passes the SEO checks of the Tests section.

## Scope

**In v1:**

- static Astro site, in French and in English;
- one home page per language, with the tool grid;
- 7 tools: merge, split, organize pages, delete pages, extract pages, rotate, images to PDF;
- the shared board, the PDFium engine in a Worker;
- Cloudflare hosting, CI (tests, Lighthouse).

**Out of v1:** the scanner, the tools of phases 2 to 6, accounts and payment, analytics, offline mode, other languages, brand illustrations, the choice of the domain.

## Decisions

| Subject | Decision | Reason |
|---|---|---|
| Location | `apps/web/` folder in this repository | Shares the wiki, `algorithm.md` and the future test photos. No code shared with Swift |
| Site | Astro 7 (Vite 8), one static page per tool and per language | Static HTML, no JavaScript by default |
| Interface | Preact 10 with `compat`, as an island, only for the board | Measured on 30 September: with React, the tool page misses the LCP (1.51 to 1.58 s) and goes over 80 KB as soon as drag and drop is added. With Preact: LCP 1.37 s and 32 KB of JS |
| Drag and drop | dnd-kit (`@dnd-kit/core` 6.3, `@dnd-kit/sortable` 10) | Mouse, finger and keyboard, with announcements for screen readers. Works with `preact/compat`. Versions frozen since 2024, but stable |
| PDF engine | PDFium in WebAssembly (`@embedpdf/pdfium` 2.15.1), in a Worker | One engine for almost the whole catalog, MIT / BSD / Apache license. Measured: merge 2.7× faster than pdf-lib, thumbnails as fast as pdf.js |
| Rejected | MuPDF | AGPL license, compatible with the license of the project (AGPL-3.0). Rejected because PDFium already covers almost the whole catalog with a single engine |
| Rejected | Next.js | Its server side is of no use when everything runs in the browser |
| Hosting | Cloudflare Workers, static files | Free and unlimited static bandwidth, 25 MiB per file. The free plan of Vercel forbids commercial use. The free plan of Netlify caps at about 15 GB per month |
| Languages | French and English | Like the Mac app. Other languages can be added without changing the structure |
| Tool screens | One shared board, set per tool | A single component to optimize, already cached from one tool to the next |
| Analytics | No script. Google Search Console only | No third-party script on the critical path |
| COOP / COEP | Not in v1 | No engine uses WebAssembly threads. These headers will come back with the scanner (OpenCV with threads). 3 October 2026: the Scanner shipped without them, and `public/_headers` still sets neither |
| Domain | The brand's domain, chosen later. Until then, the `*.workers.dev` address, with `noindex` | Do not let search engines index a temporary address. Replaced on 30 September 2026 ([design system spec](2026-09-30-web-design-system-design.md)): holy-pdf.com, not bought yet on 5 October 2026; until then, each build is `noindex` unless `INDEXABLE=true` |

## Structure

```
apps/web/
├── astro.config.mjs
├── wrangler.jsonc            Cloudflare hosting (static files)
├── public/
│   ├── _headers              cache and security headers
│   └── _redirects            / → /en
├── src/
│   ├── pages/[lang]/         home page and one page per tool, per language
│   ├── content/tools/fr|en/  SEO text of each tool (Markdown)
│   ├── i18n/                 interface strings, FR and EN
│   ├── layouts/              page template: header, SEO tags, footer
│   ├── board/                the board (Preact island)
│   └── engine/               the Worker: PDFium, fflate
└── tests/
```

## Pages and SEO

**Addresses.** All content lives under `/fr/` and `/en/`, with translated addresses. We set them after a keyword research per tool and per language, based on search volumes. Examples: `/fr/fusionner-pdf` and `/en/merge-pdf`, `/fr/jpg-en-pdf` and `/en/jpg-to-pdf`. The addresses have no trailing slash. The root `/` redirects to `/en`.

**Tool page**, in this order:

1. an `H1` title, then the drop area, visible without scrolling;
2. the sentence "Your files do not leave your device";
3. the how-to in 3 steps, an explanation, a FAQ of 5 to 8 questions;
4. links to the neighboring tools.

**Tags**

- `title` and `meta description` per language;
- `canonical` to the page itself, `hreflang` fr/en and `x-default`;
- a `sitemap.xml` generated at build time.
- The JSON-LD is limited to `WebApplication` and `BreadcrumbList`. No FAQ markup: since 2023, Google shows these rich results only for health sites and official sites. Replaced on 2 October 2026 ([home page spec](2026-10-02-web-landing-design.md)): each tool page also has a `FAQPage`.

**Writing.** The texts are written in French and in English, then reviewed by the author. The main keyword of each page comes from the search volume research.

## The board

The board is a Preact island. Rotate, delete and reorder change only its state, with no call to the engine.

```ts
type DocStatus =
  | { kind: "opening" }
  | { kind: "ready"; pageCount: number; sizes: PageSize[] }
  | { kind: "failed"; error: EngineError }

type PageRef = { id: string; docId: string; index: number; rotation: 0 | 90 | 180 | 270 }
```

`rotation` adds to the rotation that the page already has in its file.

On all tool pages, the board lets the user add files, reorder (by finger, mouse and keyboard), rotate, delete and select. A tool is only a setting of the board:

| Tool | Accepted files | Highlighted | Main button → result |
|---|---|---|---|
| Merge | several PDFs, and images (JPEG, PNG) converted into pages on request | pages grouped by file | 1 PDF |
| Split | 1 PDF | scissors between the pages, or "every N pages" | a ZIP of PDFs |
| Organize | 1 PDF | drag the pages | 1 PDF |
| Delete pages | 1 PDF | ✕ on each page | 1 PDF |
| Extract pages | 1 PDF | page selection | 1 PDF with the selection |
| Rotate | 1 or several PDFs | ↻ per page and "Rotate all" | 1 PDF |
| Images to PDF | JPEG, PNG | an image becomes a page | 1 PDF |

- **Images to PDF**: when it opens, each image becomes a one-page A4 document, oriented like the image, with the image fitted and no margin. Then the board treats it like any other page. PDFium embeds the JPEG without re-encoding it. HEIC is refused: it belongs to the scanner.
- **Output file name**: `<first file>-<action>.pdf`, with the action translated (`facture-fusionne.pdf`, `invoice-merged.pdf`).
- **Thumbnails**: the Worker renders each page at 2× the displayed size and encodes it as JPEG. The board shows it in an `<img>`: the browser frees off-screen images by itself, while a `<canvas>` would keep its pixels (about 500 MB for 1,000 pages). A single `IntersectionObserver` watches the grid. The pages near the screen are requested from top to bottom, two at a time at most. A page that leaves the screen before its turn leaves the queue.
- **Page preview** (5 October 2026): a click on a thumbnail, or Enter on it, opens the page in a native `<dialog>`. The engine renders it at the size of the frame (1,600 px at most on the long side, like the sheet of the Mac app), with its rotation. The render starts 100 ms after the last arrow key, so that a held arrow key does not put one render per page in the Worker's queue. A shimmer waits for the render. "Preview unavailable" replaces a page that the engine does not render. The arrow keys move to the next or previous page in board order, and Escape closes. The rendered images are freed on close. Space stays the key for keyboard dragging, and dnd-kit holds back the click that ends a drag. On the result page, "View" opens the same preview on what was just produced: the PDFs are reopened in the engine for the time of the preview (file by file for Split, each page named "file, page n"), and the JPEGs are shown as they are. There is no preview for Word. A browser tab cannot show a ZIP, and it does not work in the desktop shell: hence the in-page preview everywhere.
- **Images on Merge** (5 October 2026): an image dropped or chosen on Merge is no longer refused. The monk asks "photo.png is an image. Shall I turn it into a PDF page before merging?" ("These are 3 images…" for several; JPEG and PNG only, other formats are still refused). "Convert" opens each image as a page, through the JPG to PDF path. "Leave out" adds only the PDFs of the batch. One question per batch. The file picker and, in the desktop app, the monastery and ⌘O accept images on Merge.
- **File chosen before the page is interactive**: it stays in the field, and the board opens it as soon as the board starts.
- **File being opened**: a skeleton card in the grid, with its name and ✕ to remove it. A thumbnail that is not rendered yet has the same effect.
- **Language switch**: on the tool pages, navigation happens on the client side (Astro's `ClientRouter`) and the board keeps its files. The home page stays without JavaScript. Replaced on 30 September 2026 ([design system spec](2026-09-30-web-design-system-design.md)): the home page loads `ClientRouter` too. Since 2 October 2026, it hydrates no island.
- **Screen readers**: the drag and drop announcements are translated and name the page ("Page 3 dropped at Page 1").
- **Undo**: a button and `Ctrl+Z` / `⌘Z` undo the last action. No confirmation before a deletion: the board never touches the original file. Undo never removes the pages of a file opened in the meantime.

## The engine

`engine/` is the only code that knows PDFium. It runs in a Worker and answers typed messages:

| Message | Response |
|---|---|
| `open(file, password?)` | page count and sizes, or `EngineError` |
| `thumbnail(doc, page, width)` | a JPEG image (`Blob`) |
| `export(plans)` | one PDF per plan. If there are several plans (Split), a ZIP made by fflate, without compression since the PDFs are already compressed |

A plan is an ordered list of `{ docId, index, rotation }`.

The later specs add their requests to `engine/protocol.ts` (`compress`, `images`, `sign`, `transform`, `zip`, `close`…).

The Worker starts after the `load` event and loads PDFium right away: the engine is compiled by the time the user drops a file. It handles one request at a time. If PDFium stops on an internal out-of-memory error, the client replaces the Worker and reopens the files before the next request.

Data flow:

1. The dropped file is read as an `ArrayBuffer` and transferred to the Worker without a copy.
2. The Worker opens the document and returns the page count and the page sizes.
3. The board requests the thumbnails of the visible pages.
4. On export, the board sends the plans. The Worker builds the PDFs and transfers the bytes without a copy. The browser starts the download.

## Performance

**Load** (Lighthouse mobile, default settings):

| Measure | Target | Measured on 30 September |
|---|---|---|
| LCP | ≤ 1.5 s | 1.37 s (tool), 0.76 s (home) |
| CLS | ≤ 0.02 | 0 |
| TBT | ≤ 100 ms | 0 ms |
| Performance / Accessibility / Best Practices / SEO score | ≥ 95 / ≥ 95 / 100 / 100 | 100 / 100 / 100 / 100 |
| JS before interaction, tool page | ≤ 80 KB brotli, Preact and board included | 37 KB, of which 5 KB for the router |
| JS on the home page and the content pages | 0 KB | 0 KB |

The budgets changed on 30 September 2026 with the [design system spec](2026-09-30-web-design-system-design.md) (`lighthouserc.json`): LCP ≤ 1.5 s on the home page and ≤ 1.6 s on a tool page; JavaScript ≤ 24 KB on the home page and ≤ 50 KB on a tool page.

- System fonts, no web font. Replaced on 30 September 2026: Bricolage Grotesque and Figtree, hosted on the site.
- No third-party script. CSS inlined in the page.
- The engine (1.65 MB brotli) exists in only one copy: only the Worker references it. A reference from the page created a second copy. Its name carries a hash, and it is cached for one year (`immutable`).

**Processing.** Targets set on 30 September by the benchmark (`pnpm bench`, Chromium, scan pages of about 180 KB):

| Operation | Mac target | Measured on Mac M1 Pro | Phone target |
|---|---|---|---|
| Opening a 100-page PDF (18 MB) | — | 80 ms | — |
| First 12 thumbnails of this PDF | ≤ 500 ms | 380 ms | ≤ 1.5 s |
| Rotate all (100 pages), until display | ≤ 16 ms | 3 ms | ≤ 16 ms |
| Merge of 10 PDFs, 500 pages, 90 MB | ≤ 1 s | 210 to 260 ms | ≤ 10 s |

The 4× CPU slowdown of Chromium slows only the page, not the Worker in a reliable way: it is valid for rotation (12 to 15 ms), not for the engine. The phone targets are checked by hand on an iPhone before the site goes live.

## Error handling

The engine returns typed errors, with no sentence for the user. The board writes the sentences, in French and in English.

```ts
type EngineError =
  | { kind: "unsupportedFormat" }
  | { kind: "passwordRequired" }
  | { kind: "wrongPassword" }
  | { kind: "damaged" }
  | { kind: "outOfMemory" }
  | { kind: "engineUnavailable" }
```

The later tools add their own kinds in `engine/types.ts` (`noImages`, `alreadySigned`, `xfaForm`…).

| Case | Behavior |
|---|---|
| Unsupported format | Detected from the first bytes, not from the extension. Message on the file, the other files continue |
| Protected PDF | The board asks for the password. The output PDF is no longer protected, and a message says so |
| Wrong password | Message, a new try is possible |
| Damaged PDF | Message on the file, the other files continue |
| Not enough memory | "too large for this device" message. No limit guessed in advance |
| PDFium stops (internal out-of-memory) | The Worker is replaced and the files are reopened. The current operation shows "too large for this device" |
| Engine download fails | Message and a "Try again" button |
| File that the browser cannot read (folder, file still in the cloud) | "cannot be opened" message on the file, the other files continue |
| File still opening | Skeleton card, ✕ to remove it without waiting for the end |
| File dropped next to the board | Ignored: the page stays, with its layout |

## Tests

| Level | Tool | Checks |
|---|---|---|
| Unit | Vitest | the board state, the tool settings, the export plans, the file names, format detection |
| Engine | Vitest on Node | merge, rotation, order, extraction, images to PDF, read back with pdf.js, which is used only in the tests so that the engine is not checked against itself |
| End to end | Playwright: Chromium, WebKit, Firefox | for each tool: drop, act, download, check the PDF. And no network request other than the site's files during processing |
| SEO | Vitest on the built HTML | `title`, `description`, `canonical`, `hreflang` pair and `H1` on each page, all pages in the sitemap |
| Performance | Lighthouse CI (in CI), Playwright benchmark (local only) | the budgets and the targets of the Performance section |

The test files are generated at test time: PDFs where each page carries its number in large print (to check the order), a protected PDF, a truncated PDF, images. No real document.

CI runs in GitHub Actions, on each pull request. Since 2 October 2026, it runs `pnpm verify` only (Chromium); Firefox, WebKit and Lighthouse run locally with `pnpm verify:full`.

## Preliminary checks

Done on 29 and 30 September, on a full prototype (site, board, engine, tests):

1. **PDFium against `@cantoo/pdf-lib` and pdf.js**: PDFium chosen. Merge of 500 pages (100 MB) in 116 ms against 318 ms on Node. The first 12 thumbnails of a 20 MB PDF in 254 ms in a Chrome Worker, as fast as pdf.js.
2. **API of `@embedpdf/pdfium`**: everything is there. `EPDFImageObj_SetJpeg` embeds a JPEG without re-encoding, and `FPDF_SaveAsCopy` writes through a JavaScript callback.
3. **PDFium on Node**: it runs, so the engine tests stay in Vitest.
4. **Memory**: the heap caps at 2 GiB and never shrinks. A `malloc` that cannot succeed returns 0 cleanly. An internal out-of-memory error stops the module (`RuntimeError`): the Worker is then replaced.
5. **80 KB budget**: missed with React, met with Preact (32 KB).
6. **`_redirects`**: supported (`/ /en 301`).

Pitfalls found by the prototype, all covered by a test:

- PDFium accepts bytes that are not a JPEG: the pixel size of the image is checked before the page is created;
- a file chosen before the page hydrated was ignored;
- the dnd-kit announcements were in English and read internal identifiers;
- thumbnails requested out of order delayed the first ones by 500 ms;
- `astro check` refuses TypeScript 7: the project stays on TypeScript 6.0.3.

## Technical rules

The [technical guide](../development/technical-guide.md) applies, transposed to TypeScript:

- strict TypeScript, no `any` and no `as` without a comment that justifies it;
- a state is a discriminated union, never a combination of booleans. Errors are typed;
- `engine/` holds no sentence for the user;
- every visible string goes through `i18n/`, in French and in English, from the first view;
- a dependency comes in only if this spec justifies it. v1 list: `astro`, `@astrojs/preact`, `@astrojs/sitemap`, `preact`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `@embedpdf/pdfium`, `fflate`. Development tools: `typescript`, `@astrojs/check`, `vitest`, `@playwright/test`, `pdfjs-dist`, `@lhci/cli`, `wrangler`, `@types/node`, `@types/emscripten`; Added on 5 October 2026: `lucide-preact`, the line icons of the tools (menu, sleeping card, sidebar of the app), same stroke as our Feather icons, half a KB per icon, rendered on the server side on the site, ISC license in `public/licenses/lucide.txt`.
- measure before optimizing;
- comments in English, only for the why.

## Planned next steps

The port of the scanner (spec 2 of the web version), once `algorithm.md` stops changing; shipped on 3 October 2026 ([spec](2026-10-02-web-scanner-design.md)). Then the tools of the next phases, in the order of the roadmap, each one on the board and the engine of this spec.
