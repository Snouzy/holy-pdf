<img src="apps/web/public/favicon.svg" width="72" alt="">

# Holy PDF

Free PDF tools that run in your browser. Merge, split, compress, sign, edit, fill forms, scan, OCR: the files never leave your device.

No upload, no account, no quota, no advertising. The code is free software under the AGPL. A desktop app for Mac and Windows is on the way.

[![Try it on holy-pdf.com](https://img.shields.io/badge/try_it-holy--pdf.com-2346d8)](https://holy-pdf.com)
[![License: AGPL-3.0-or-later](https://img.shields.io/badge/license-AGPL--3.0--or--later-141a2e)](LICENSING.md)
[![Site checks](https://github.com/Snouzy/holy-pdf/actions/workflows/web.yml/badge.svg?branch=main)](https://github.com/Snouzy/holy-pdf/actions/workflows/web.yml)

[holy-pdf.com](https://holy-pdf.com) · [Wiki](wiki/index.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Licensing](LICENSING.md)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/readme-home-dark.png">
  <img src=".github/assets/readme-home-light.png" alt="The Holy PDF home page: “I want to merge my PDFs”, and Brother Staple ready to do it in the browser.">
</picture>

## See it in 30 seconds

[![Watch the 30-second film](.github/assets/film-poster.jpg)](https://holy-pdf.com/videos/holy-pdf-en.mp4)

## Why

I kept an Adobe subscription for a few PDFs a month: a signature to add, a family file to merge, photos of my parents' papers to turn into one document. When I dropped it, every online tool I found either charged for the basics or asked me to hand over the files without saying what became of them. For a yoghurt cake recipe, fine. For my mother's identity card, no. So I built the tool. The full story is in the [wiki](wiki/product/story.md).

## The promise, and how to check it

Everything runs in your tab. The engines (PDFium and qpdf compiled to WebAssembly, OpenCV, Tesseract) load once and work inside a Web Worker. Open the browser's developer tools on the Network tab, run any tool, and watch: after the page's own assets, no request carries your file.

The whole site is static. There is no backend to trust.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/readme-merge-dark.png">
  <img src=".github/assets/readme-merge-light.png" alt="Merge PDF files: three PDFs open as page thumbnails, ready to reorder and merge, with the note “No file leaves your device”.">
</picture>

## Tools

| Category | Tools |
|---|---|
| Organize | Merge, Split, Organize pages, Delete pages, Extract pages, Rotate, Pages per sheet, Split in half, Bookmarks |
| Convert | JPG to PDF, PDF to JPG, PDF to Word, Pixelize; Web page to PDF is coming |
| Edit | Edit (text, images, shapes, pen, highlighter, annotations, links, stamps, form fields), Sign, Watermark, Page numbers, Overlay, Crop, Redact |
| Optimize | Compress, Flatten, OCR, Scan (photos of documents into a clean PDF), Repair |
| Security | Protect, Unlock |

Each tool has a spec in [`wiki/specs/`](wiki/specs/) with every decision and its reason.

## Run it

```sh
pnpm install
pnpm dev       # http://localhost:4321
pnpm verify    # types, unit tests, build, SEO checks, Chromium end-to-end
```

Node 22.12 or later (CI uses 24) and pnpm. Details in [CONTRIBUTING.md](CONTRIBUTING.md).

## Repository

- `apps/web/`: the site (Astro, Preact) and its engine. Development happens here.
- `apps/desktop/`: the desktop app (Tauri 2) for Mac and Windows, then Linux: its own entry composed from the site's tools, in the system webview. `pnpm desktop:dev`, `pnpm desktop:build`, `pnpm desktop:smoke`. Needs Rust.
- The native Swift app and its engine were removed on 5 October 2026; the tag `mac-final` keeps their last state.
- `wiki/`: product, specs and technical guide. Opens as an Obsidian vault.
- `tools/`: research prototypes.

## License

Copyright (C) 2026 Snouzylabs S.R.L. and the Holy PDF contributors.

Code and texts: [AGPL-3.0-or-later](LICENSE), with two additional terms in [LICENSE-EXCEPTION.md](LICENSE-EXCEPTION.md): a permission for app-store distribution, and no trademark rights. The name, the logo and the monk identify Holy PDF only: see [BRAND.md](BRAND.md). Plain-language summary in [LICENSING.md](LICENSING.md).
