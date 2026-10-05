# Desktop: the app shell, design

_Written on 5 October 2026. Status: milestone 1 delivered on 5 October (site side first, then the desktop entry); milestones 2 and 3 to come. Follows [Desktop: Tauri shell on the site's code](2026-10-05-desktop-tauri-design.md), whose step 1 loaded the whole site in the window._

## Context

Step 1 of the Tauri shell opens the built site in the system webview: 86 pages, the site header and footer, the SEO texts under each tool, the language switcher, 63 MB embedded. It works, and it looks like a site in a window (the author's remark, 5 October 2026).

The Mac app in Swift, frozen on 4 October, had the right form: a single window, the monastery home screen as a grid by category, the "Search a tool" field in the title bar, one screen per tool with the page on the left and a fixed panel on the right, the back chevron, ⌘O, a copy saved through the native dialog, "Show in Finder" ([home](2026-10-02-mac-home-design.md), [Mac design system](2026-10-01-mac-design-system-design.md)). It had no file associations, no recent files and no updates.

The site already has almost everything needed, and the parts are clearly separated:

- **Reusable as is**: the board (`Board`, `apps/web/src/board/Board.tsx`), the only Preact island of the site, with three props (`toolId`, `lang`, `monks`), which reads neither the URL, nor the history, nor the page title; the editors it loads, including the Scanner, which has its own saving and its own questions; the engine (`board/engine.ts`); the illustrations (`Monk`, `Scene`, `Avatar`, `ToolIcon`); `tokens.css` and `fonts.ts`; the dictionaries (`dictionaries[lang]`, `boardTexts`, `searchTexts`); the search (`home/search.ts`, without DOM).
- **Tied to the page, not to the board**: from 64 rem, and only when documents are open (`main:has(.board)`), the board merges into the grid of the tool page (`[tool].astro`), and its panel sits under `--nav-height`; the globals of `Base.astro`; the theme, set on `<html data-theme>` by the inline script of `Base.astro` (`tokens.css` has no `prefers-color-scheme` rule); the drop overlay, drawn by `Base.astro`.
- **Astro only**: the cards (`home/ToolCard.astro`), the "I want to…" picker (`Pick.astro`), the filters (`home/filters.ts`, DOM code on the home page markup), the pages.

Three site gestures do not exist in WKWebView under wry: the `<a download>` link is cancelled without a download handler (`download.ts`, and the Scanner's saving in `ScannerApp.tsx`); `window.open` does nothing ("View" in `Result.tsx` opened a tab); `confirm()` does not show and answers "no" (twice in the Scanner). File drop is a different case: Tauri intercepts it unless the shell turns off its drop handler.

Common practice (VS Code, Obsidian, Linear, Stirling PDF v2, which is moving to Tauri): one component base, two entries. The marketing site on one side, the app shell on the other. You do not hide sections of the site: you compose another page with the same building blocks.

## Principle: a system app, not a site in a window

The author's decision, 5 October 2026: judge the desktop app as a native app of its system. On Mac, it must behave and look like the Swift app frozen on 4 October (removed on the 5th; its code is at the `mac-final` tag). On Windows, like a Windows app. On Linux, like an app of the desktop environment. The web is how it is built, not how it looks. In practice:

- **The window is the system's window**: integrated title bar on Mac, native decorations elsewhere, remembered size and position, the system's dark mode and accent color, the system font for the controls (Bricolage for the large titles only, as on Mac).
- **The gestures are the system's gestures**: menus in the system language with their shortcuts (⌘O, ⌘W, ⌘Q, ⌘Z), native dialogs to open and save, file drop anywhere, double-click in Finder or Explorer, "Show in Finder", a guard before you quit with an unsaved result.
- **Nothing of the web shows through**: no site header or footer, no SEO text, no language switcher, no URL or page navigation, no "download" or "new tab", no link that replaces the app in its window, no theme button.
- **The document is at the center**: it stays open from one tool to the next, and the app never reloads.

The test: someone who knows the Swift app must not see the difference in the first minute, and someone who knows the site must not be reminded of it. Each decision below follows from this principle. A decision that contradicts it gives its reason in its row, or is not taken.

## Goal and success criteria

When it opens, Holy PDF for desktop is an app: you recognize the brand and the monastery, and nothing recalls a site.

The spec succeeds when:

- the window opens on the monastery, with no site header or footer, no SEO text, no language switcher, no link that replaces the app in the window;
- a tool opens in the same window, board on the left and panel on the right, and the chevron goes back to the monastery; the current document follows when you change tools, if the next tool accepts it;
- ⌘O opens the native dialog; a file dropped anywhere in the window, the monastery included, opens; a double-click on a PDF in Finder opens the app with it;
- a result is saved through the native dialog, under the name the board already gives it, the Scanner included, then "Open" and "Show in Finder" work;
- the theme, the language and the window size follow the system, and the window comes back where you left it;
- leaving a tool closes its documents in the engine (a test counts them);
- the app embeds neither the site's videos nor its pages;
- `pnpm desktop:smoke` passes: the engine page, then the probed shell (monastery, a tool, back) with no violation and no error;
- `pnpm verify` passes, with the tests of the changes made to the site for the shell.

## Scope

**In the spec:** the desktop entry (`apps/desktop/app/`), the monastery, the tool screen, the title bar, the menus and shortcuts, opening (dialog, drop, double-click), saving (copy, native dialog, open, show in folder, the Scanner included), the theme, the language, the window, the external links, the bundle size, the smoke test, and the site changes it requires.

**Out of the spec:** automatic updates, signing and sales (milestone 3 of the [Tauri spec](2026-10-05-desktop-tauri-design.md)), processing a whole folder, saving in place, favorites and recent files, preferences (language or theme chosen by hand), the checks on Windows and Linux (the shell is written for all three; the checks come with milestone 3), Turborepo and the shared package.

## Decisions

### The shell

| Topic | Decision | Reason |
|---|---|---|
| Entry | `apps/desktop/app/index.html` and `App.tsx` (Preact), built by Vite into `dist-app`; `frontendDist` points there | An app composes the site's building blocks; it does not hide parts of the site |
| Development server | `pnpm desktop:dev` starts the Vite server of this entry through `beforeDevCommand` (`devUrl`, port 1420, `cacheDir` under `apps/desktop`), after it copies the `ocr/` and `scan/` folders into the site's public folder, which Vite serves in development | A separate server leaves the site's `pnpm dev` alone, and the shell starts with one command |
| What comes from the site | Imported by relative path from `apps/web/src`, like the smoke test page: board, editors, engine, illustrations, `tokens.css`, `fonts.ts`, dictionaries, `home/search.ts` | No copy. The shared package will come with Turborepo, after the `Packages/` vs `packages/` question ([roadmap](../product/roadmap.md)) |
| Preact | `@preact/preset-vite` and `preact` in `apps/desktop`, at the site's exact version, `resolve.dedupe: ["preact"]`; `compat` like the site (`dnd-kit` imports `react`); `app/` goes into `tsconfig.json` with `jsxImportSource` | The smoke test page has no JSX; two copies of Preact would break the hooks |
| What belongs to the app only | The monastery in Preact (`Monastery.tsx`: cards from `cast`, `toolNames`, `toolShort`, `monks`, `upcoming`), the title bar, the tool screen and its grid, the in-memory search, the native saver, the app texts, `app.css` | `ToolCard.astro`, `Pick.astro` and `filters.ts` are Astro and DOM code written for a page: to rewrite them in Preact costs less than to make them shareable, and the card fits in thirty lines |
| Texts | Each text lives with the code that shows it, in French and English, under the site's rules (« vous », a non-breaking space inside « »): the app's own screens in `app/texts.ts`; the result page words and the write error in `i18n/fr.ts` and `en.ts`; the Scanner question in `scanner/texts.ts`; the menus in `lib.rs`. See "Texts" below | `Result` and the Scanner are site code, which imports nothing from the app; the menus are built in Rust before the page |
| Navigation | One state in `App.tsx`: the monastery, or a tool. No router, no URL. The sidebar, the bar's ← chevron and ⌘[ go back to the monastery; the window title says "Holy PDF" or the tool name (`setTitle`). The board is mounted with `key={toolId}` | The Mac's navigation stack. The board does not read the URL; one key per tool guarantees a clean unmount |
| Language and system | Rust reads the language (`sys-locale`) and the system (`std::env::consts::OS`) and gives them to the page through an initialization script (`window.__HOLY__ = { lang, os }`); `fr` if the language starts with `fr`, `en` otherwise | The menus are built in Rust and must be in the system language; in WKWebView, `navigator.language` is not guaranteed to follow the system |
| Theme | `data-theme` follows `prefers-color-scheme`, live; no button | The `Base.astro` script is not there; an app follows the system. The manual choice comes with the preferences |
| Window | Minimum 64 rem × 680 px (1,024 × 680), default 1,280 × 840; `window-state` plugin for the size and the position | Below 64 rem, the board goes back to its floating web page panel; an app comes back where you left it |
| Sidebar | `Sidebar.tsx`, on the left under the title bar, 15 rem, stuck to the screen (`position: sticky`) and scrollable: "Monastery" at the top with the monk's avatar, then the five categories (`byCategory`, `t.categories`) and their tools, with line icon (`ToolIcon`) and short name (`toolShort`), the open tool highlighted (`aria-current`), the upcoming tool grayed out with "Soon". Visible from 80 rem (1,280 px, the default width); below that, it hides and the title bar chevron comes back | The Mac's source list (Finder, Mail): go from one brother to another without going back through the monastery (the author's request, 5 October, "like Stirling PDF"). Below 1,280 px, three columns (sidebar, table, panel) would crush the table |
| Title bar | Mac: `title_bar_style: Overlay`, `hidden_title`, traffic lights offset; the app bar (52 px, `data-tauri-drag-region="deep"`) holds the chevron, the title and, on the right, the "Search a tool" field. Windows and Linux: system decorations, the same bar without the offset. `--nav-height` is 52 px, fixed | The integrated title bar is the most visible sign of a Mac app; with `deep`, the whole bar drags the window, not only its background. The board aligns its panel on `--nav-height` |
| Menus | Rust, labels in the system language: the app menu (About; on Mac, Services, Hide, Hide Others, Show All; Quit), File (Open… ⌘O, Close ⌘W), Edit (Undo ⌘Z, Redo ⇧⌘Z, then Cut, Copy, Paste, Select All, predefined), Window, Help (Website, Source code, FAQ in the browser; Licenses in milestone 3). Open, Undo and Redo send an event to the page; Close and Quit are handled in Rust until milestone 2, where the guard will route them through the page | The predefined items have English labels. The predefined Undo sends `undo:` to WebKit, which the board does not hear: the app's item sends it to the active field (`execCommand`) or to the board, never to both. The Scanner already answers ⇧⌘Z. The predefined Quit asks no question |
| External links | `on_navigation` accepts only the app origin and `devUrl`; `http(s)` and `mailto` go to the browser through `opener.open_url`, and any other scheme is blocked. `on_new_window` does the same for `window.open` | A link must never replace the app in its window; a dropped `file://` must not get out either |
| Capabilities | `core:default` plus `core:window:allow-set-title` and `allow-start-dragging`; `dialog:default`; `fs:allow-read-file` and `fs:allow-write-file` (the paths chosen in a dialog enter the `fs` scope); `opener:default` (which covers "Show in Finder") plus `opener:allow-open-path` on `$HOME/**` and `/Volumes/**`; `window-state:default`. The guarded close of milestone 2 will add `allow-close` and `allow-destroy` | `core:window:default` has no setter permissions: the title and the bar drag need them. The `opener` scope is a fixed list in the capability, with no runtime additions like `fs`: the home folder and the external volumes cover what the save dialog offers |
| CSP | Fixed policy in `tauri.conf.json`, with `dangerousDisableAssetCspModification`: `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' ipc: http://ipc.localhost; worker-src 'self' blob:; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'`. `build.rs` no longer scans the site's inline scripts | The app entry has no inline script: Vite puts the scripts in files, and the hashes of step 1 have no purpose any more. The only inline style is the font style, which `main.tsx` injects and `'unsafe-inline'` allows |
| Bundle size | `dist-app` = what Vite bundles (board, editors, engine: PDFium 4.6 MB, qpdf 2.2 MB, fonts) plus `ocr/`, `scan/` and `licenses/` copied from `apps/web/public` at the end of the build (`writeBundle`, `copyPublicDir: false`), because `tesseract.ts` and `scanWorker.ts` read them by absolute path on the origin. In development, `publicDir` points to `apps/web/public`. The site's `copy-ocr.mjs` and `copy-scan.mjs` scripts, which fill these folders, run before `desktop:dev` and `desktop:build` | No videos, no pages. Measured on 5 October: 41 MB, of which 18 for the three Tesseract cores and their languages, 15 for OpenCV and libheif, 7.5 for the app; against 63 for the whole site. A single Tesseract core will come later |
| Fonts | `main.tsx` adds the two preload links (`preloadedFonts`, the same hashed files that `fonts.ts` imports), then injects `fontFaces` | `fonts.ts` exports only strings, `Base.astro` writes them, and a static `index.html` cannot read an export; with `font-display: optional`, a font missed at the first render is missing for the whole session, and the preload prevents that |
| Globals | They move to `apps/web/src/styles/base.css`, imported by `Base.astro` and by the app: `box-sizing`, `body` (background, ink, font), `button { font: inherit }`, `a` and `a:hover`, the transition of `:where(a, button, summary, label)`, `.scroll`, `.drop-overlay`, `.visually-hidden`, `:focus-visible`, the headings, `.highlight`, `.lift`, the "reduce motion" rule. `.tool-glyph` (the stroke of the line icons) is copied into `app.css` for now, to move into `base.css` later. These stay in `Base.astro`: `--nav-top`, `--nav-height` and its values on scroll, the `body` `padding-top`, the `main` width, `.tool-glyph`, the 75 rem query | Two copies would drift apart silently; the board buttons rely on the shared transition; the site bar rules concern only the site |
| Smoke test | `--smoke` alone keeps the engine page; `--smoke app` loads the app under a probe (`smoke/app-probe.js`) that reports the monastery, opens Compress through its card, reports the tool screen, goes back through the chevron and reports again: three reports, each with no violation and no error; `smoke:site` becomes `smoke:app`. Exit codes 0, 1, 2 and 3 unchanged | Without URLs, the page list of step 1 has no meaning any more; the probe's gestures replace the links |

### The board in the shell

| Topic | Decision | Reason |
|---|---|---|
| Tool screen | The site's page header (tool name and its emoji, the monk's sentence), then the board. As soon as documents are open (`main:has(.board)`, the site's condition), the `"head panel" auto "work panel" 1fr / minmax(0, 1fr) 27.5rem` grid of `[tool].astro`, without the sections below. Otherwise (empty board, result, Scanner), one column. The page header becomes compact and the sentence hides under `.board` as under `.result`, the site's rule | Without the condition, the empty card, the result page and the Scanner would sit next to an empty panel column |
| Search | ⌘F and ⌘K focus the field. On the monastery, it filters the cards live; Return opens the best result. On a tool screen, it opens a floating palette with the same results, and Escape closes it. Rules and words from `home/search.ts` and `searchTexts`; a query made only of stop words (« pdf », « le ») leaves the monastery in place, as on the site; the index build, written today in the `search.json.ts` route, moves into `home/index.ts`, which the route and the app call | One source for the words, a rule already set for the Mac. ⌘F is the Mac's shortcut, ⌘K the shortcut of today's desktop apps |
| New board props | `files`, `saver`, `confirm` and `onDocumentChange`, all optional, with their default value in the board | Astro does not pass a function to an island: the site mounts the board as today |
| Files received by the board | `files`, reactive: each new array goes through `addFiles`; a one-file tool replaces its file, as when you choose another one | A prop read only at mount would not reach a board already on screen (⌘O on an open tool) |
| What the board holds | `onDocumentChange({ files, unsaved })`: the files of the current document (the result if it exists, otherwise the sources) and whether an unsaved result remains. The Scanner contributes its own state. A result passed to the next tool without being saved stays `unsaved` | The shell carries the document from one tool to the next and guards the close; the sources alone would be wrong after Compress; a copy never saved must not get lost silently |
| The document follows | When you change tools (palette, or chevron then card), the shell gives the next tool the files of the current document that it accepts (`accepts`, `multipleFiles`); a tool that accepts none of them starts empty. The board's back and start-over buttons drop the result without a question, as on the site | On the desktop you work on a document: compress, then sign the copy |
| Cleanup on unmount | When it unmounts, the board closes its engine documents and the overlay layer, and forgets its thumbnails | The site starts from zero on each page; the app never reloads. Today the documents close only in `addFiles`, `remove` and `startOver` |
| Saver | `board/deliver.ts` defines a saver: `kind` (`download` or `save`) and `save(bytes, name, type)`, which returns one of three outcomes: saved at a path, downloaded, or cancelled; by default, the current download. The board receives it as a prop (`saver`) and passes it to `Result` and to the Scanner, which also saves through it; the button wording follows `kind` ("Download" or "Save…") | Without a handler, wry cancels the `<a download>` link, the one in `download.ts` as well as the Scanner's. A cancelled dialog is not a download: `unsaved`, "Saved" and the Scanner's saved state depend on it. The Scanner must not import the board's chunk (`ScannerApp.tsx`): a prop, like the engine and the skeleton it already receives |
| Saving in the shell | The shell's saver: the `save` dialog of the `dialog` plugin, name suggested by the board (`fileName.ts`), last folder remembered (Documents at first), write through `fs.writeFile`, path returned. Several files stay a zip, with one dialog | A dialog from Rust in `on_download` would block the main loop |
| After saving | The result page shows "Saved", the file name, "Open" (`opener.openPath`) and "Show in Finder" (`revealItemInDir`). A write error shows on the hint line of the result page (the line used for errors today), with a new text | The Mac's gesture after each copy; the monk of the result page has a fixed mood |
| "View" before saving | The same preview as the board's thumbnail preview, in the page: the produced PDFs are reopened in the engine for the time of the preview, file by file for Split, and the JPEGs are shown as they are. On each result except Word, next to "Save…". No plugin, no write: the capability does not open `$TEMP` | `window.open` does nothing in WKWebView, and neither a tab nor Preview shows a ZIP; to look at a result before you save it is a normal app gesture (the author's requests, 5 October) |
| Scanner questions | A board dialog with a message and two labels (`ConfirmDialog`, rendered with each board screen; the board also uses it for its images question on Merge), given to the Scanner as a prop (`confirm`) like the saver; its two `confirm()` calls use it, with the labels of each question in `scanner/texts.ts` (the question before saving follows `kind`: "Download anyway?" or "Save anyway?", Cancel / Download or Save) | wry does not show `confirm()` on Mac: the question does not show and the answer is "no". The board's `RemoveDialog` is tied to a document and to its two labels |
| Open with the button | The board button keeps its `<input type=file>`: in WKWebView, wry opens the native panel (it ignores `accept`) | Nothing to change |
| Open with ⌘O | ⌘O and File › Open… go through the `dialog` plugin (filters by the open tool: PDF; JPEG, PNG, HEIC; PDF, JPEG, PNG on Merge; everything on the monastery), then `fs.readFile`, and give the files to the board through `files` or, on the monastery, to the "files arrived" state | A `click()` on the file input from a menu has no user gesture |
| Drop | The shell calls `disable_drag_drop_handler()`. On a tool screen, the drop reaches `useFileDrop` as on the site; on the monastery, `App.tsx` calls `useFileDrop` itself and draws the overlay | Tauri intercepts the drop and gives only paths, Mac included; the board expects `File` objects. Today only the board prevents the browser from navigating to the dropped file, and the overlay comes from `Base.astro` |
| Files arrived on the monastery | When files arrive (drop, ⌘O, double-click) or when the chevron comes back with an open document: under the title, "3 files ready. Pick a tool." and "Change files"; the cards that do not accept these files are grayed out (`aria-disabled`, in the keyboard order but with no effect). A card opens its tool with the files it accepts; ⌘O from a tool gives everything to the board, which itself says what it refuses | The monastery guides, like the old drop zone of the site's home page |
| Double-click | `bundle.fileAssociations` (PDF, JPEG, PNG, HEIC) with `rank: "Alternate"`. Mac: `RunEvent::Opened { urls }`; Windows and Linux: the arguments, and the `single-instance` plugin relays those of a second launch. Rust adds each path to the `fs` scope and keeps it until the page asks for it (`invoke("take_opened")` at startup, then an event). An open tool that accepts these files receives them through `files`; otherwise they go to the monastery | The app must not become the default PDF reader; paths that do not come from a dialog are not in the `fs` scope; a cold launch delivers the file before the page listens |
| Guard on close | Close (⌘W, red button: `onCloseRequested`) and Quit (⌘Q, app menu item) ask "The result of Compress is not saved." (Keep / Quit) when `unsaved` is true; otherwise the window closes and the app quits | The Mac had this guard; the Scanner's `beforeunload` does not show in WKWebView |
| Guard on tool change | The sidebar, the chevron then a card, or the palette ask nothing when the next tool takes the result: it follows. When the next tool does not take it, "The result of Compress is not saved." (Stay / Switch tool) | Compress then Sign is the normal path, not a loss; the question comes only if the result would be dropped |

### Rejected

| Option | Reason |
|---|---|
| Hide the site sections with CSS (`data-desktop`) | The texts stay in the DOM, and so do the page-per-tool model and the 63 MB; the "embedded site" effect would remain |
| A permanent sidebar of the tools | Rejected on the morning of 5 October (three columns do not fit in 1,024 px), reopened in the evening at the author's request: see "Sidebar" in the decisions. It is permanent only from the default window width |
| Make `ToolCard.astro` shareable | A thirty-line Preact card against a migration of the site pages |
| A saver in a shared module (`setSaver`) | The Scanner would have to import the board's chunk, which `ScannerApp.tsx` forbids |

## Screens

### The monastery

- **Bar**: on the left, nothing (the traffic lights on Mac); in the center, "Holy PDF"; on the right, the "Search a tool" field. The whole bar moves the window.
- **Top**: the title in Bricolage, highlighted like the Mac, and the trust sentence. No stamp, no drawn drop zone: the whole window receives the files, with the "Let go, I'll take care of them." overlay.
- **The categories**: Organize, Convert, Edit, Optimize, Security, in this order and with the site's names (`cast.ts`, `categories`). Each card reuses the site card: a 150 px band in the category tint with the monk (112 px) and his scene, the monk's name as a caption, the tool name, one sentence. The whole card is a button; on hover, it lifts as on the site (`.lift`). Adaptive grid: three cards per row at 1,024 px as at 1,280 px (the sidebar takes 15 rem), four from about 1,424 px.
- **Soon**: the upcoming tool (`upcomingIds`) under its category, with the tool's line icon and the "Soon · in meditation" tag, like the site card, not clickable.
- **Search**: as soon as there is one useful word, the categories give way to the monks found, from the best match to the worst, with the site's line "3 monks · “reduce” → Compress". Nothing found: "No monk does that… yet", the site's sentence and "See all the monks".
- **Files arrived** (drop, ⌘O, double-click): the state described above.

### The tool screen

- **Bar**: the ← "Monastery" chevron (below 80 rem; above, the sidebar replaces it), the tool name, the search field (palette).
- **Page header**: the tool name and its emoji as the title, the monk's sentence (`monks[id].intro`), aligned left, compact: the site's page header in workshop mode, where the sentence hides as soon as documents are open.
- **The board**: when empty, it is the site's dashed card with its monk and its "Choose PDF files" button; with documents, the table on the left and the panel on the right, stuck to the right edge under the bar, like the site's workshop. Nothing under the board: no "How to do it", no FAQ, no other monks.
- **Result**: the site's result page, with "Save…" as the main button and "View" next to it (the preview in the page, file by file). Once saved: "Saved", the file name, "Open", "Show in Finder". The back button returns to the table with the files.
- **Change tools** with an open document: through the sidebar, the palette, or the chevron then a card. The files that the next tool accepts wait for you there; if the next tool does not take an unsaved result, the "Stay / Switch tool" question comes up.

### Saving

1. "Save…" opens the native dialog, in the last folder used (or Documents), with the name the board gives the download on the site.
2. The write goes through `fs.writeFile`. An error (read-only folder, full disk) shows on the hint line of the result page: "Saving failed:" and the reason the system gives.
3. The saved path serves "Open" and "Show in Finder".
4. Several files (Split, PDF to JPG): one zip, one dialog. An output folder with numbered files, like the Mac, comes in milestone 2.
5. The Scanner saves through the same saver, with its current name.

## Texts

French then English, each in the file of the code that shows it:

| Where | Key | French | English |
|---|---|---|---|
| `app/texts.ts` | Monastery title, Mac | « Vos PDF, sur votre Mac 🙏 » (« sur votre Mac » surligné) | "Your PDFs, on your Mac 🙏" |
| `app/texts.ts` | Title, Windows | « Vos PDF, sur votre PC 🙏 » | "Your PDFs, on your PC 🙏" |
| `app/texts.ts` | Title, Linux | « Vos PDF, sur votre ordinateur 🙏 » | "Your PDFs, on your computer 🙏" |
| `app/texts.ts` | Trust sentence | « Tout est traité ici : rien n'est envoyé. » | "Everything happens here: nothing is sent." |
| `app/texts.ts` | Chevron | « Monastère » | "Monastery" |
| `app/texts.ts` | Files arrived | « 3 fichiers prêts. Choisissez un outil. », « Changer de fichiers » | "3 files ready. Pick a tool.", "Change files" |
| `app/texts.ts` | Guard | « Le résultat de Compresser n'est pas enregistré. », « Garder », « Quitter », « Rester », « Changer d'outil » | "The result of Compress is not saved.", "Keep", "Quit", "Stay", "Switch tool" |
| `i18n/fr.ts`, `en.ts` | Result page | « Enregistrer… », « Enregistré », « Ouvrir », « Afficher dans le Finder » (« dans l'Explorateur », « dans le dossier » sur Linux) | "Save…", "Saved", "Open", "Show in Finder" ("in Explorer", "in folder") |
| `i18n/fr.ts`, `en.ts` | Write error | « L'enregistrement a échoué : » | "Saving failed:" |
| `scanner/texts.ts` | Question before saving | « Enregistrer quand même ? », « Annuler », « Enregistrer » | "Save anyway?", "Cancel", "Save" |
| `lib.rs` | Menus | « Fichier », « Ouvrir… », « Fermer », « Édition », « Annuler », « Rétablir », « Couper », « Copier », « Coller », « Tout sélectionner », « Fenêtre », « Réduire », « Aide », « Site », « Code source », « Questions fréquentes », « À propos de Holy PDF », « Services », « Masquer Holy PDF », « Masquer les autres », « Tout afficher », « Quitter Holy PDF » | "File", "Open…", "Close", "Edit", "Undo", "Redo", "Cut", "Copy", "Paste", "Select All", "Window", "Minimize", "Help", "Website", "Source code", "FAQ", "About Holy PDF", "Services", "Hide Holy PDF", "Hide Others", "Show All", "Quit Holy PDF" |

The rest comes from the site when the site already has it ("Search a tool", "No monk does that… yet", "See all the monks", "Let go, I'll take care of them.", the tool names and sentences).

## Structure

```
apps/desktop/
  app/
    index.html        #app and the main.tsx script
    main.tsx          reads window.__HOLY__, sets lang and data-theme, preloads and injects the fonts, mounts App
    App.tsx           the screen state, the document that follows, the menu events, the guard, the monastery drop
    Titlebar.tsx      chevron (below 80 rem), title, search field and palette
    Sidebar.tsx       the source list: Monastery, categories and tools, the open tool highlighted
    Monastery.tsx     categories, cards, sleeping monk, results, files arrived
    ToolScreen.tsx    page header, workshop grid under a condition, Board with key, files, saver, onDocumentChange
    saver.ts          dialog, fs, opener: the shell's saver
    files.ts          the files a tool accepts (by name: a file read from a path has no type)
    shell.ts          what Rust gave: language, system
    texts.ts          the app texts, fr and en
    app.css           bar, grid, monastery, on the site's tokens
  smoke/app-probe.js  the `--smoke app` probe
  vite.config.ts      two modes (app, smoke), Preact preset, the site's publicDir in dev, copy of ocr/, scan/, licenses/ at build time
  tsconfig.json       + app/, jsxImportSource preact
  src-tauri/
    build.rs          tauri_build::build() only
    src/lib.rs        language and system, title bar, menus, on_navigation, on_new_window, native drop off, smoke test; Opened and take_opened in milestone 2
    capabilities/default.json
    tauri.conf.json   frontendDist ../dist-app, devUrl 1420, fixed csp, plugins; fileAssociations in milestone 2
apps/web/src/
  styles/base.css     the globals taken out of Base.astro
  layouts/Base.astro  imports base.css, keeps the bar rules
  board/Board.tsx     optional props files, saver, confirm, onDocumentChange; cleanup on unmount
  board/deliver.ts    the saver type, its three outcomes, the default download
  board/Result.tsx    Download or Save… by kind, Saved, Open, Show, error line
  board/ConfirmDialog.tsx   message and two labels
  scanner/            saver and confirm as props, no more confirm() or download link; scanner/texts.ts
  home/index.ts       the index build, called by search.json.ts and by the app
  i18n/fr.ts, en.ts   the result page words and the write error
```

## Milestones

1. **The shell**: the entry, Preact, the monastery and its drop, the tool screen, the bar, the menus and ⌘O, the search, the language and the system, the theme, the remembered window, the external links, the saver (result page and Scanner), the Scanner dialog, the cleanup on unmount, `base.css`, the fonts, the fixed CSP, the `app` smoke test, the folder copy, the size measurement. At the end of the milestone, you open a PDF with the button, with ⌘O or by drop, you work on it, you save the copy and you open it: the app is usable.
2. **The files**: the double-click, "Open With" and the second launch, the document that follows from one tool to the next (the Scanner then announces its pages, not all the photos it received), the guard on close, the output folder for Split and PDF to JPG, and the Scanner worker terminated on unmount (it leaks on each visit, on the site as in the shell).
3. **Distribution**: milestone 3 of the [Tauri spec](2026-10-05-desktop-tauri-design.md) (updates, signing, sales), Help › Licenses (the texts of `licenses/` in an app panel), then the checks on Windows and Linux.

## Known limits

- Several files come out as a zip in milestone 1.
- No recent files, no saving in place, no preferences.
- The language and the theme follow the system only.
- Closing the window quits the app (the Mac app kept running in the background).
- Quit from the Dock does not ask the guard question: macOS ends the app without going through the page.
- In milestone 1, "Close" and "Quit" do not ask the guard question yet, and the document does not follow from one tool to the next yet: the board announces them (`onDocumentChange`), but the shell listens to them only in milestone 2. So a tool change through the sidebar, the palette or the chevron drops an unsaved result without a question.
- "Open" and "Show in Finder" work only under the home folder and `/Volumes`: elsewhere, the error shows on the result page line, even though the file is saved.

## Tests

| Level | What | Where |
|---|---|---|
| Site, unit | The site tests run without DOM: the new logic is in pure functions. `documentOf` gives the sources while nothing is done, then the result as files, `unsaved` until it is saved; `release` closes each document and the layer in a fake engine and revokes the previews; the default saver downloads and returns "downloaded"; `searchIndex` lists each tool, ready ones first, with names, words and label. The rest (board props, `Result`, the Scanner and its dialog) is covered by the e2e flows | `apps/web/tests/unit/document.test.ts`, `deliver.test.ts`, `searchIndex.test.ts` |
| Site, e2e | The existing flows pass with `base.css`, the default saver and the Scanner dialog | `pnpm verify` |
| App, types | `tsc --noEmit` on `app/` and `smoke/` | `pnpm --filter @holy-pdf/desktop check` |
| App, smoke test | Engine page; then the monastery, Compress through its card, back, with no violation and no error | `pnpm desktop:smoke` |
| By hand | Open with ⌘O, by drop on the monastery and on a tool, by double-click; save, Open, Show in Finder; the Scanner saves and asks its question; dark mode; window restored; an external link goes to the browser; ⌘Q with an unsaved result; Compress then Sign with no question, then Compress then JPG to PDF with the question; ⌘Z in a text field undoes the typing, ⌘Z on the board undoes the edit, never both | `wiki/development/tests.md`, Desktop section |
