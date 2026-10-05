<img src="apps/web/public/favicon.svg" width="72" alt="">

# Holy PDF

Free PDF tools that run in your browser. Merge, split, compress, sign, edit, fill forms, scan, OCR: the files never leave your device.

No upload, no account, no quota, no advertising. The code is free software under the AGPL.

[holy-pdf.com](https://holy-pdf.com) · [Wiki (French)](wiki/index.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Licensing](LICENSING.md)

## Why

I kept an Adobe subscription for a few PDFs a month: a signature to add, a family file to merge, photos of my parents' papers to turn into one document. When I dropped it, every online tool I found either charged for the basics or asked me to hand over the files without saying what became of them. For a yoghurt cake recipe, fine. For my mother's identity card, no. So I built the tool. The full story is in the [wiki](wiki/product/story.md).

## The promise, and how to check it

Everything runs in your tab. The engines (PDFium and qpdf compiled to WebAssembly, OpenCV, Tesseract) load once and work inside a Web Worker. Open the browser's developer tools on the Network tab, run any tool, and watch: after the page's own assets, no request carries your file.

The whole site is static. There is no backend to trust.

## Tools

| Category | Tools |
|---|---|
| Organise | Merge, Split, Organise pages, Delete pages, Extract pages, Rotate, Pages per sheet, Split in half, Bookmarks |
| Convert | JPG to PDF, PDF to JPG, PDF to Word, Pixelize |
| Edit | Edit (text, images, shapes, pen, highlighter, annotations, links, stamps, form fields), Sign, Watermark, Page numbers, Overlay, Crop, Redact |
| Optimise | Compress, Flatten, OCR, Scan (photos of documents into a clean PDF), Repair |
| Security | Protect, Unlock |

Each tool has a spec in [`wiki/specs/`](wiki/specs/) with every decision and its reason, in French.

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
- `wiki/`: product, specs and technical guide, in French. Opens as an Obsidian vault.
- `tools/`: research prototypes.

## Licence

Copyright (C) 2026 Snouzylabs S.R.L. and the Holy PDF contributors.

Code and texts: [AGPL-3.0-or-later](LICENSE), with two additional terms in [LICENSE-EXCEPTION.md](LICENSE-EXCEPTION.md): a permission for app-store distribution, and no trademark rights. The name, the logo and the monk identify Holy PDF only: see [BRAND.md](BRAND.md). Plain-language summary in [LICENSING.md](LICENSING.md).
