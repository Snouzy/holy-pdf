# Brand identity

_Created 29 September 2026. Updated 30 September 2026: name and visual direction chosen. The spec that applies them to the site is still to write._

## Intent

A strong and warm brand, like the PDF24 sheep: a character that comes in one illustration per tool, and that makes a utility app memorable.

## Name: Holy PDF

Chosen domain: **holy-pdf.com**. Also to buy: **holypdf.app**, as a redirect, because holypdf.com is taken.

Why this name:

- two basic English words, understood and easy to say everywhere, like "workout.cool" or "Smash Baby Burger";
- an exclamation ("Holy cow!"): the tone is funny, not religious;
- "PDF" in the name: people know what the site does, and the brand shows up in "… pdf" searches;
- the world of the monks holds together: a halo on the logo, one monk per tool.

Checks of 30 September 2026:

| Item | Result |
|---|---|
| holy-pdf.com, holypdf.app, holy-pdf.fr | available (whois and RDAP) |
| holypdf.com | taken since 17 January 2025, site offline, no product found |
| PDF product named "Holy PDF" | none found (web search) |
| INPI, EUIPO, USPTO trademarks, classes 9 and 42 | **to check by hand**: the search APIs refuse automated requests. The only one found on the web: "HOLY", class 6 (metal containers), unrelated |

Check links: [INPI](https://data.inpi.fr), [TMview](https://www.tmdn.org/tmview/) (EUIPO and national offices), [USPTO](https://tmsearch.uspto.gov).

Rejected names:

| Name | Reason |
|---|---|
| pdf-monk | **PDFMonk** exists in the same market ([pdfmonk.com](https://www.pdfmonk.com/)) |
| Monkey PDF, PDFMonkey | already taken ([monkeypdf.org](https://monkeypdf.org/), [pdfmonkey.io](https://docs.pdfmonkey.io/)) |
| Halo PDF | iPad app "Halo PDF" that already merges and sorts pages |
| Vesper PDF | reading app "Vesper" (EPUB, PDF), released in June 2026 |
| Abbey PDF | sounds like ABBYY, a publisher of OCR and PDF software |
| Brother PDF | Brother, the printer maker |
| PDFrère | reads as « pé-dé-frère » in French |
| Scriptorium, Copiste, Vélin, Capucin | domains taken |
| pdf.church | available, but "church PDF" already means church document templates |

## Visual direction

Reference: the mockup of 30 September 2026, "Design system" page (foundations, components, monks), not published; the SVGs of the site (`apps/web/src/illustrations/`) are its reference version.

- **Style**: one monk per tool. Ready tools have a large card with the monk and a scene (a PDF sheet that the monk staples, cuts, rotates…). Upcoming tools have a sleeping monk and a "Soon" stamp.
- **Paper**: sheets with a folded corner, yellow highlighter on headings, stamps.
- **"Blue Ink" palette**: background `#EEF1F6`, ink `#141A2E`, primary `#2346D8`, highlighter `#FFE45C`, stamp `#C8321B`. Category colors: Organize `#2346D8`, Convert `#0B7A5E`, Edit `#B4418E`, Optimize `#A35900`, Security `#5B6272`. Stamp, Convert and Optimize are dark so that they pass the AA contrast.
- **Typography**: Bricolage Grotesque 800 for headings, Figtree for text.
- **Headings**: no accent font (tried, refused). One emoji per heading, at the end, right after the last word: 🙏 home, 🤲 ready tools, 🕯️ upcoming, 🤫 privacy, one emoji per tool.
- **Avatars**: the head and the accessory come out of the circle.
- **Dark mode**: proposed on the canvas, still to approve.

## The monks

A monk in a brown homespun habit, yellow rope, five moods: happy, focused, joyful, oops, asleep. The monk speaks in the first person, in short sentences, with nods to monastery life ("Forgive it its extra pages", "bound like a missal"), and never in a joking tone in an error. The halo appears only in the logo.

| Tool | Monk | Accessory |
|---|---|---|
| Scanner (Mac and site) | Brother Snap | phone |
| Merge | Brother Staple | stapler |
| Split | Brother Scissors | scissors |
| Organize pages | Brother Binder | sheet |
| Delete pages | Brother Eraser | eraser |
| Extract pages | Brother Lens | magnifying glass |
| Rotate | Brother Spin | rotation arrow |
| JPG to PDF | Brother Frame | photo frame |
| Compress | Brother Press | book |
| PDF to JPG | Brother Illuminator | photo frame |
| Sign | Brother Quill | quill |
| Watermark | Brother Stamp | stamp |
| Page numbers | Brother Folio | sheet |
| Protect | Brother Padlock | padlock |
| Unlock | Brother Passkey | padlock |
| Flatten | Brother Roller | book |
| Pages per sheet | Brother Mosaic | sheet |
| Split in half | Brother Trimmer | scissors |
| Pixelize | Brother Glass | photo frame |
| Redact | Brother Inkpot | eraser |
| OCR | Brother Reader | magnifying glass |
| PDF to Word | Brother Copyist | quill |
| Overlay | Brother Layer | stamp |
| Bookmarks | Brother Ribbon | book |
| Repair | Brother Mender | stapler |
| Edit | Brother Scribe | quill |
| Crop | Brother Framer | photo frame |

## Texts to review

Written with the design system, not reviewed yet. Shared texts in `apps/web/src/i18n/fr.ts` and `apps/web/src/i18n/en.ts`; Sign controls in `apps/web/src/signature/text.ts`, loaded with the editor:

- `monks`: name, introduction, card line ("abbey" tone), instruction (`hint`), in-progress verb, verb button, result title and "start over" of each monk;
- `home` and `homeDrop`: the home page, its bubble and its drop zone. The H1 (« Outils PDF gratuits en ligne, dans votre navigateur ») targets search; its search volumes are in the design system spec;
- `home.compact`, `home.categoryCount`, `toolShort`: the compact view;
- the single trust sentence ("No file leaves your device, from import to download."): `home.lead`, `footer.tagline`, `drop.trust`, `toolPage.privacy` and the pages `compress.md` / `pdf-to-jpg.md`; `home.proofs`: the strip of the four proofs (100% local, 0 uploads, no account, GDPR), with no certification logo that the site does not hold;
- `toolPage` (title, sentence, trust line), `drop` ("Choose PDF files", "or drop them here", trust line, `release`), `nav` and `footer` (top bar, menus, footer), `flow` (including "Hallelujah, it's done"), `menu.darkMode`, `board.addPdf`, `board.addImages`, `board.undo`, `board.undoHint`, `board.removeConfirm`, `board.keep`, `board.removeConfirmed`, `bubble`, `upcoming`, `categories`.
- `frSearch` and `enSearch` (at the bottom of `fr.ts` and `en.ts`): the filter column of the home page, its switch, the "Soon · in meditation" label, the status line, the no-result message, and the words that search understands for each tool;
- `toJpg`, `compress`, `errors.noImages` and the pages `compress.md` and `pdf-to-jpg.md` in both languages: the tools of milestone 1. Their search volumes, checked on 30 September 2026, are not copied into the wiki.
- the footer pages and the first two articles (`apps/web/src/content/pages`, `apps/web/src/content/articles`), and their labels (`apps/web/src/i18n/pages.ts`).

The legal texts (Legal notice, Privacy, Terms of use, Cookies) are a serious base, not a lawyer's opinion. They cover the publisher and the host, the processing of files in the browser with no upload to the site, the technical data that Cloudflare processes, the absence of cookies and the two `localStorage` keys, the terms of a free service provided "as is", the nature of the signature that Sign places (neither advanced nor qualified in the sense of eIDAS) and French law. Details in the [footer pages spec](../specs/2026-10-02-web-pages-design.md). Two points stay open:

- the Privacy page must name the service that receives the emails (Cloudflare Email Routing, then the destination mailbox, and its transfer outside the EU if there is one);
- the notices of the libraries that `pdfium.wasm` embeds, beyond PDFium itself, are still to check and to publish in `public/licenses/`.

The publisher is Snouzylabs S.R.L. (decision of 5 October 2026), the company that also publishes workout.cool: the legal notice of a professional publisher must give the company name, the registered office, the phone number, the share capital, the registration number (CUI) and the publication director. The registered office, phone number, capital and CUI are still to add as soon as the author sends them.

Review of milestone 1, on 1 October 2026: the compression levels and their FR/EN FAQs no longer promise an intact quality. The three levels re-encode the images with loss; the FAQ separates selectable text from text inside a photo or a scan.

## Still to do

- check the trademarks, then buy holy-pdf.com and holypdf.app;
- apply the design system to the website: see the [spec](../specs/2026-09-30-web-design-system-design.md);
- an iPhone app icon (the icon of the removed Mac app, kept at tag `mac-final`: `apps/mac/PDFToolbox/HolyPDF.icon`);
- for the final version of the illustrations, plan an illustrator, with the canvas mockups as the brief.
