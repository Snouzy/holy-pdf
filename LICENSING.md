# Licensing

Copyright (C) 2026 Snouzylabs S.R.L. and the Holy PDF contributors. Snouzylabs S.R.L. publishes Holy PDF.

This page is a plain-language guide. What binds is the license text in [LICENSE](LICENSE) and the additional terms in [LICENSE-EXCEPTION.md](LICENSE-EXCEPTION.md).

## 1. The code and the texts: AGPL-3.0-or-later

Everything in this repository that is not a third-party component listed below is free software under the GNU Affero General Public License, version 3 or any later version: the site in `apps/web/` (its code, the texts of its pages and articles, the source files of its illustrations), the desktop app in `apps/desktop/`, the wiki, the tools and the tests.

In short: you may use, study, change and redistribute it, including commercially, as long as the people who receive it, or who use a modified version over a network, can get the corresponding source under the same license.

One exception: the films in `apps/web/public/videos/` are not part of the program and are not under the AGPL. They belong to Snouzylabs S.R.L., all rights reserved.

Two additional terms under section 7 come with it, in [LICENSE-EXCEPTION.md](LICENSE-EXCEPTION.md): a permission to distribute builds through application stores, and a reminder that the license grants no trademark rights. Copy that file along with `LICENSE` when you redistribute.

## 2. The brand: a trademark matter

The source files of the logo and of the monk illustrations ship with the code, under the AGPL, so that anyone can build and run the site. What stays reserved is the use of the name "Holy PDF", the logo and the monk to identify a product, site or service that is not Holy PDF. That is trademark law, not copyright on the files. [BRAND.md](BRAND.md) says what you may do without asking, and what a fork must change.

## 3. Third-party components

The site ships these components, each under its own license, with their notices in [`apps/web/public/licenses/`](apps/web/public/licenses/) and [`apps/web/public/fonts/`](apps/web/public/fonts/):

| Component | Role | License |
|---|---|---|
| PDFium, through @embedpdf/pdfium | PDF engine | BSD-3-Clause (PDFium), MIT (the WebAssembly build) |
| qpdf, through @wasm-zoo/qpdf | Compaction, repair, encryption | Apache-2.0 (qpdf), MIT (the WebAssembly build) |
| OpenCV | Scanner | Apache-2.0 |
| Tesseract | OCR | Apache-2.0 |
| libheif and libde265, through libheif-js | HEIC photos | LGPL-3.0-or-later |
| Bricolage Grotesque, Figtree, Caveat | Fonts | SIL Open Font License 1.1 |
| Feather Icons, Lucide, Simple Icons | Icons | MIT, ISC, CC0-1.0 |

The desktop app embeds the same components, and adds Tauri 2 and its plugins (MIT or Apache-2.0) with the Rust crates they pull in. Its builds will show all these notices in Help › Licenses, planned for its first release.

These are free licenses that can accompany AGPL code. The additional permission above does not extend to them. One point is still open and tracked in the wiki: a generated notice for the libraries embedded inside `pdfium.wasm` (FreeType, libjpeg-turbo, OpenJPEG, Little-CMS, zlib) and for the JavaScript dependencies bundled with the site.

## Contributions

By contributing you certify the [Developer Certificate of Origin](https://developercertificate.org/) (`git commit -s`) and agree that your contribution is licensed under AGPL-3.0-or-later with the additional terms in [LICENSE-EXCEPTION.md](LICENSE-EXCEPTION.md). There is no contributor license agreement and no copyright assignment: what you write stays yours, under the same terms as everything else here.
