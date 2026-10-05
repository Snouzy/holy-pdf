# Web version: Holy PDF design system, design

_Written on 30 September 2026. Status: shipped in `apps/web/`. Added during the work and described here: the light and dark switch, the "abbey" tone and the brown habit, the centered page top, the compact view and the drop on the whole page. Replaced since: the top of the home page, its drop zone and the sections after the monastery, by the [home page redesign](2026-10-02-web-landing-design.md) (2 October 2026); Split in the top bar, by Sign (3 October); the hand-drawn tool icons, by Lucide (PR #15, 5 October)._

## Context

The site in `apps/web/` works: 7 tools, the shared board, the PDFium engine, Lighthouse in the green (see the [foundation spec](2026-09-29-web-organiser-design.md)). Its interface is bare on purpose: system font, a list of links on the home page, the temporary name `pdf-toolbox`.

On 30 September, the name and the visual direction were chosen: see [Brand identity](../product/brand.md). The reference mockups of 30 September 2026 are not published: the "Design system" page (foundations, components, monks), the "One monk per tool, iterations" page (home D2, Merge tool page, mobile) and the "Titles: fonts and emojis" page.

This spec applies this design system to the site.

## Goal and success criteria

A visitor who lands on Holy PDF sees at once a site of PDF tools, with a personality: one monk per tool. The visitor keeps everything the foundation gives: speed, no file upload, both languages.

The spec succeeds when:

- the home page follows the D2 layout and its drop zone points to the right tools;
- the 7 tool pages have the monk's portrait, the styled board and the action bar that speaks;
- dark mode follows the device, with the colors of this spec, and a header button switches between light and dark;
- each page meets the budgets of the Performance section, and CI blocks otherwise;
- the unit, SEO and end-to-end tests of the Tests section pass on Chromium, Firefox and WebKit.

## Scope

**In the spec:**

- the Holy PDF name in the site;
- the foundations: light and dark colors, fonts, shapes;
- the illustrations: monks, scenes, avatars, interface icons, favicon;
- the header, the tools menu, the footer;
- the D2 home page, with the drop zone that guides;
- the styling of the 7 tool pages and of the board;
- the 404 page;
- the new texts, in French and in English.

**Out of the spec:** the Mac app, the final illustrations by an illustrator, the pages of the upcoming tools, tool search, the share images (Open Graph), a separate "done" screen, the renaming of the Cloudflare Worker.

## Decisions

| Subject | Decision | Reason |
|---|---|---|
| Illustrations | Preact components that output SVG. Astro renders them to HTML at build time; the board reuses them in its island | One source per drawing, zero JavaScript on the static pages. Colors go through CSS variables, so dark mode duplicates nothing |
| Rejected | SVG files in `<img>` | An SVG in `<img>` does not read the page's CSS variables: dark mode would have to be copied into each file |
| Rejected | SVG sprite (`<symbol>`, `<use>`) | The most complex option, for a small weight gain on 19 monks |
| Fonts | Hosted on the site: Bricolage Grotesque (weight 800 only) and Figtree variable, taken from `@fontsource/bricolage-grotesque` and `@fontsource-variable/figtree`, then reduced to the letters of French and English by `scripts/subset-fonts.py` (fontTools) into `src/fonts/` | No request to Google Fonts. The subset takes the fonts from 42 to 25 KB, which keeps the home page LCP under 1.5 s |
| Home page | D2 layout: the 7 ready tools in large cards, the 12 upcoming ones in small avatars | Put forward what works. The author's choice |
| Home page drop zone | It guides to the tools that accept the files, then opens the tool page with the files. Removed on 2 October 2026 by the [home page redesign](2026-10-02-web-landing-design.md): a file dropped on the home page is no longer handled | The author's choice. Cost: an island and `ClientRouter` navigation on the home page |
| File handoff | In memory, in a shared module, during a `ClientRouter` navigation. Removed with the drop zone on 2 October 2026 | The simplest. If the page reloads, the files are lost and the usual drop zone shows |
| Dark mode | Automatic, from the device, and a moon or sun button in the header to choose | The author's choice. The choice stays in the browser. Without JavaScript, the site stays light |
| Tools menu | Native `<details>` | Zero JavaScript, works with the keyboard |
| Search | None at first. Replaced on 1 October 2026 by the search field of the filter column (see Home page) | 19 tools fit on one page |
| Accent font in headings | None | Tried, refused by the author. The yellow highlighter stays the only accent |
| Emojis | One per heading, at the end, next to the last word, system emoji | Sets the tone with no file to load |
| Domain | `SITE_URL=https://holy-pdf.com` when the domain is connected. Until then, `noindex` | The variable already exists. Do not get a temporary address indexed |

## Structure

```
apps/web/src/
  styles/
    tokens.css          light and dark colors, shapes, shadows, spacing
    fonts.ts            @font-face of the two fonts and the list of kept letters
  fonts/                the two reduced fonts and their OFL license (generated by scripts/subset-fonts.py)
  illustrations/
    Monk.tsx            the monk: accessory, mood, size, layer, halo
    Scene.tsx           the PDF sheet of each tool
    Avatar.tsx          the monk who comes out of the circle
    Icon.tsx            interface icons
  cast.ts               the cast: one monk per ready tool, the upcoming tools (12 then, 1 on 5 October 2026)
  home/
    HomeDrop.tsx        island of the home page drop zone (deleted on 2 October 2026)
    orient.ts           which tools for which files, pure function (deleted on 2 October 2026)
  board/
    handoff.ts          handoff of the files from the home page to the board (deleted on 2 October 2026)
    MonkBubble.tsx      the monk and his bubble, in the panel since the three-step flow
  layouts/Base.astro    head and script (tokens, fonts, theme), the site bar and the page width
  styles/base.css       the rules that every page and the desktop app share (body, links, headings, drop veil, highlighter)
  layouts/SiteNav.astro, SiteFooter.astro    the top bar and its menus, the footer
  illustrations/ToolIcon.tsx    the line icons of the tools, taken from Lucide (5 October 2026: the home-made glyphs were ugly)
  pages/[lang]/index.astro, [tool].astro, 404.astro
  i18n/fr.ts, en.ts     new texts
public/favicon.svg      head of the monk with a halo
```

`tools.ts` stays the source of the working tools. `cast.ts` adds what belongs to the monk. The engine, the board state and the Markdown content do not change.

## Foundations

### Colors

All in `tokens.css`, as variables. No component hard-codes a color.

| Role | Light | Dark |
|---|---|---|
| background | `#EEF1F6` | `#111527` |
| surface (sheets, cards, fields) | `#FFFFFF` | `#1B2138` |
| ink (text) | `#141A2E` | `#F1F3FA` |
| soft ink | `#3A4260` | `#A9B1CC` |
| gray (captions, inactive) | `#5B6272` | `#8C94AE` |
| primary (buttons, links) | `#2346D8` | `#8FA2FF` |
| primary on hover | `#1A36AD` | `#B4C1FF` |
| text on primary | `#FFFFFF` | `#111527` |
| highlighter | `#FFE45C` | `#FFD84A` |
| light highlighter (featured sheet) | `#FFF3B0` | `#FFF3B0` |
| fold (dog-ear corner, scene strokes) | `#D3DAE8` | `#2C3452` |
| border | `#C9D1E0` | `#3A4466` |
| stamp ("Soon", errors) | `#C8321B` | `#FF6B57` |
| upcoming tool (background) | `#ECEEF3` | `#333C60` |

Categories, one color for the text and one tint for the illustration background:

| Category | Light | Dark |
|---|---|---|
| Organize | `#2346D8` / `#E3E9FB` | `#8FA2FF` / `#2A3562` |
| Convert | `#0B7A5E` / `#DDF3EA` | `#4FD1A5` / `#1C3F36` |
| Edit | `#B4418E` / `#F8E1EC` | `#F28AC0` / `#4D2D4C` |
| Optimize | `#A35900` / `#FBEBD3` | `#FFB547` / `#45361B` |
| Security | `#5B6272` / `#E6E8EE` | `#A9B1CC` / `#303750` |

Monk: habit `#6B4226` (dark `#8A5A34`), habit shadow `#4E2E18` (dark `#6B4226`), skin `#F5CBA7`, hair `#141A2E`, cheeks `#F59A8C`, cord and accessories `#FFE45C`, outline `#141A2E` (dark `#0B0E1C`), paper `#FFFFFF`.

Board files: six colors in rotation, each with its tint: red `#E0452B` / `#FCE6E1`, blue `#2346D8` / `#E1E7FB`, yellow `#E3B400` / `#FFF6C7`, green `#0B7A5E` / `#DDF3EA`, pink `#B4418E` / `#F8E1EC`, orange `#A35900` / `#FBEBD3`. In dark mode, red becomes `#FF6B57` / `#512F2D`, yellow `#FFD84A` / `#3F3919`, and the four others take the dark values of the categories of the same color.

PDF sheets (thumbnails, scenes) stay white in dark mode.

### Highlighter

In light mode, a yellow band over the lower part of the letters (from 55 to 92% of the height), text in ink. In dark mode, the band covers the whole word (from 8 to 92%) and the text turns `#111527`. At most one highlighted word group per screen.

### Fonts

| Style | Font | Size |
|---|---|---|
| Heading 1 | Bricolage Grotesque 800, line height 0.98, letter spacing −2.5 px | 68 px, 40 px on mobile |
| Heading 2 | Bricolage Grotesque 800, letter spacing −1.5 px | 40 px, 26 px on mobile |
| Heading 3 | Bricolage Grotesque 800 | 24 px |
| Large text | Figtree 400, line height 1.5 | 19 px |
| Text | Figtree 400 and 600 | 16 px |
| Caption | Figtree 700, capitals, letter spacing +1.5 px | 12 px |

Heading sizes scale from mobile to desktop with `clamp()`. Both fonts are preloaded and declared with `font-display: optional`: a font that arrives too late is never swapped in after the first paint, so the text does not move. Preloading makes them arrive in time from the first visit (25 KB for both). They keep only the letters of French and English and the signs used in the texts (`latin` in `fonts.ts`). A missing letter, in a file name for example, uses the system font. After a change to this list: `python3 scripts/subset-fonts.py` (it needs `fonttools` and `brotli`).

### Shapes and shadows

- Spacing: multiples of 4 px.
- Radii: 10 px for buttons, fields and tabs; 14 px for panels; 999 px for pills and avatars.
- Split: the scissors between the pages sit in a 44 px round button, with a 22 px icon and a blue outline. The active button is filled with blue. The cells that carry a cut let this button overflow into the gap between pages, with no clipping by `content-visibility` and no shrinking of the icon by the generic padding.
- Sheets: square corners, a dog-ear corner of 20 to 34 px depending on the size (a `clip-path` and a triangle in the "fold" color).
- Shadows: sheet `0 4px 8px rgb(20 26 46 / 0.10)`, panel `0 10px 30px rgb(20 26 46 / 0.07)`, lifted page `0 16px 20px rgb(20 26 46 / 0.28)`.

### Hover

Each control responds to the pointer. One rule per kind of control:

| Kind | Examples | On hover |
|---|---|---|
| Primary, filled | the verb button, "Choose PDF files", "Download", "Remove" in the confirmation | background `--accent-hover` and a larger shadow: `0 12px 28px`, `--accent` at 38% |
| Secondary, bordered or on the surface | "+ Add a PDF" (box, file cards and panel), "Change the settings", Undo, the secondary buttons of the result, the theme, the language, "Menu" and the entries of the bar's menus, "Compact view", the small icon buttons (rotate, cut, "?"), the home page categories (except the chosen one), "See all the monks" | background `--accent-tint`, border and text or icon `--accent`; the home page search field takes the border only |
| Switch | "Show the monks in meditation" | label `--accent` |
| Pressed toggle | the placed scissors of Split, active "Compact view" | background and border `--accent-hover`, no shadow |
| Destructive, icon | the × of a file card and of a file tab, "Delete page" | background `--stamp-tint`, border and icon `--stamp` |
| Choice card, tile, toggle | the Compress levels, the PDF to JPG modes and qualities | border `color-mix(in srgb, var(--accent) 55%, var(--line))`, background `color-mix(in srgb, var(--accent) 4%, var(--surface))`; the checked choice keeps its look |
| Link card | the cards of the ready tools and the card of the monks in meditation, on the home page (an upcoming tool card is not a link and does not change), "The other monks", the tools of the 404 page | `translateY(-2px)` and `--shadow-panel`; the tool card, cut by its dog-ear corner, takes the shadow as `filter: drop-shadow()`. The shared `.lift` class lifts the card, and its `::after` covers the 2 px that the card leaves: a pointer at the bottom edge does not make the hover flicker |
| Text link | the links of the bar, of the footer and of the compact view, "Merge other PDFs" under the result, "How to, frequent questions" under the workshop | color `--accent` and underline; a link already underlined in `--accent` (in the text, "Choose other files") turns `--accent-hover` |
| Page thumbnail | the pages of the board | 2 px `--accent` outline around the sheet; the `grab` cursor stays, and a click opens the page preview. The preview of a file card reacts to nothing, so it does not change |
| FAQ question | `summary` of a tool page FAQ | color `--accent`; the "+" sign of a closed question turns `--accent-tint` |

- **Tokens**: `--accent-tint` is `color-mix(in srgb, var(--accent) 10%, var(--surface))`, `--stamp-tint` is `color-mix(in srgb, var(--stamp) 10%, var(--surface))`. Declared once on `:root`, they follow the theme. Contrasts measured in the browser: `--accent` on `--accent-tint` 6.1:1 in light, 5.6:1 in dark; `--stamp` on `--stamp-tint` 4.6:1 in light, 5.0:1 in dark. At 12%, the stamp fell to 4.45:1 in light.
- **Footer**: it is dark in both themes, and `--accent` reaches only 2.4:1 there in light. It keeps the same rule with its own ink: background `--on-footer` at 12%, border and text `--on-footer`; its links turn `--on-footer`, underlined.
- All hover styles are inside `@media (hover: hover)`: a touch screen does not keep a stuck hover.
- 150 ms transitions on `background-color, border-color, color, box-shadow, transform`, in one shared rule of `styles/base.css` on `a, button, summary, label`. The global `prefers-reduced-motion` rule turns them off.
- A disabled control does not change (`:not(:disabled)`). The focus ring does not change. The logo of the footer does not change. The logo of the bar does since 3 October 2026: its name turns `--accent` and the monk tilts (−8°, ×1.06; not with reduced motion).

## Illustrations

The reference drawing is the mockup of 30 September 2026, not published. The site's SVGs (`apps/web/src/illustrations/`) are its reference version. The color attributes become CSS variables.

### `Monk`

| Prop | Values |
|---|---|
| `accessory` | `stapler`, `scissors`, `sheet`, `eraser`, `loupe`, `arrows`, `frame`, `quill`, `stamp`, `lock`, `book`, `phone`, `none` |
| `mood` | `happy` (content), `focus` (focused), `joy` (delighted), `oops`, `sleep` (waiting) |
| `size` | width in px. The height is 1.1 × the width |
| `layer` | `all` (default) or `prop`: only the accessory and the right hand |
| `halo` | yellow halo behind the head, for the logo and the favicon only |

The SVG has `aria-hidden="true"`: the text around it carries the meaning.

### `Scene`

`kind`: `merge`, `split`, `organize`, `delete`, `extract`, `rotate`, `images`, the scenes of the 7 ready tools. Each tool added since brings its scene (`SceneKind`, 27 kinds on 5 October 2026). The upcoming tools have no scene on the site. The accents take the color of the card's category; the featured sheet takes the light highlighter.

### `Avatar`

The monk in a tinted circle; the head and the accessory come out of the circle. Two layers: the whole monk, clipped by a `clip-path: path()` (the top half open, the bottom half follows the circle), then the accessory alone (`layer="prop"`), not clipped. The `clip-path` path is computed from the diameter. Sizes: 80 px (cards of the related monks), 46 px (upcoming tools), 42 px (menu).

### `Icon`

Line interface icons: file drop, rotate (a circular arrow), delete (a bin), padlock, close, check mark, view (an eye), download, plus and minus (the sign of the FAQ questions). Later screens added others (`IconName` in `Icon.tsx`). The tool icons are not here: they are in `ToolIcon.tsx`, drawn with Lucide since 5 October 2026.

### Favicon

The head of the monk with a halo, on a yellow disc, in `favicon.svg`.

## The monk cast

`cast.ts` gives each ready tool its monk and its scene. The tables below are the cast of 30 September. On 5 October 2026, `cast.ts` holds 27 ready tools and one upcoming tool, Web page to PDF; the spec of each tool gives its monk.

| Tool | Accessory | Card mood | Scene | Category | Emoji |
|---|---|---|---|---|---|
| Merge | `stapler` | `joy` | `merge` | Organize | 📎 |
| Split | `scissors` | `focus` | `split` | Organize | ✂️ |
| Organize | `sheet` | `happy` | `organize` | Organize | 🗂️ |
| Delete pages | `eraser` | `focus` | `delete` | Organize | 🗑️ |
| Extract pages | `loupe` | `happy` | `extract` | Organize | 🔍 |
| Rotate | `arrows` | `joy` | `rotate` | Organize | 🔄 |
| JPG to PDF | `frame` | `happy` | `images` | Convert | 📸 |

The 12 upcoming tools, in the `sleep` mood:

| Category | Tools (accessory) |
|---|---|
| Convert | PDF to images (`frame`), PDF to Word (`quill`), Web page to PDF (`book`) |
| Edit | Sign (`quill`), Watermark (`stamp`), Page numbers (`sheet`), Redact (`eraser`) |
| Optimize | Compress (`book`), OCR (`loupe`), Scanner (`sheet`) |
| Security | Protect (`lock`), Unlock (`lock`) |

The names of the monks and of the upcoming tools are in `i18n` (see Contents).

## Common layout

The navigation bar separates from the content with a 1 px `--line` bottom border on scroll and when a menu is open, with no drop shadow (preference of 1 October 2026). The border stays transparent at rest and follows the light and dark colors of the theme.

- **Top bar**: fixed at the top of the page. It is transparent at the very top, and on the surface with a thin bottom border from 24 px of scroll (5 rem then 4 rem high; 4.5 then 3.75 rem at 75 rem and below). It holds Merge PDF, Sign PDF (in the place of Split PDF since 3 October 2026), Compress PDF, "Convert PDF ▾", "All tools ▾", the theme button and the language. Each menu shows a line icon per tool (`ToolIcon`, Lucide since 5 October 2026), on the tint of its category, and gray for the upcoming tools ("Soon"). At 75 rem and below, the entries fold behind a "Menu" button, in a drawer; the page behind is `inert`. The "Tools" menu with avatars no longer exists.
- **Footer**: three promises, the brand and a sentence, five columns of links (Product, Popular tools, Resources, Legal, Holy PDF; each link leads to its page, see [Footer pages](2026-10-02-web-pages-design.md); only the social network icons still point to `#`), then the language, the theme, the social networks (X, Instagram, LinkedIn, TikTok; Simple Icons icons, CC0, written into the page) and © 2026.
- Mockups: pages v12 (NV1 to NV4) and v13 (IC1) of the canvas.
- **Page background**: the "background" color. The content sits on "surface" sheets or panels.

## Home page

> Since 2 October 2026, the top of the page, the drop zone and the sections after the monastery follow the [home page redesign](2026-10-02-web-landing-design.md): points 1, 3 and 4, "The drop zone that guides" and `handoff.ts` below are history. The monastery (point 2) stays; its counts are those of 1 and 2 October. On 5 October 2026, 27 tools are ready and one is in meditation, and the "And N monks in meditation" box is a button that turns the switch on.

From top to bottom (mockup D2, page top from the "IT-C Rouge" mockup):

1. **Page top, centered.** A tilted stamp, stroke in the stamp color: "Free · local · no account". Heading 1, chosen for search, like the `title` tag: « Outils PDF gratuits en ligne, <surligné>dans votre navigateur</surligné>. 🙏 » (EN: "Free online PDF tools, right in your browser."). Volumes noted on 30 September 2026 with a keyword research tool: « pdf en ligne gratuit » 2,900 per month in France, « outils pdf gratuits » 210, "free online pdf tools" 2,900 in the United States. « navigateur » gets no searches but says what sets us apart. The sentence: "A recipe kept by the monks: merge, split, rotate, convert. No file leaves your device." The drop zone is a dog-eared sheet laid on two tilted sheets. Above its right corner, the quill monk (150 px, 100 px on mobile) says in a bubble "Put them here, I'll take care of them.". The bubble is decorative (`aria-hidden`) and never covers the button. In the sheet, a dashed frame in the primary color: icon, "Drop your PDF files here", "PDF, JPG or PNG. Several files at once.", then the button; in a column on mobile.
2. **"The monastery 🤲".** From 900 px, two columns (mockup FL7): on the left a 17 rem filter column (`aside`), on the right the cards, four per row above 75 rem, three below. Under 900 px, the column moves above the cards, which go two per row.
   - **The cards.** The 10 ready tools (Sign added on 1 October). Each card: on the tint of the category, in a 150 px band, the monk (112 px) and his scene (110 px); below, the monk's name as a caption, the tool name as heading 3 (1.25 rem), a sentence, "Open the tool →". The whole card is the link. On mobile, a reduced tile: 86 px monk, 74 px scene. Then the dashed box "And 9 monks in meditation", which leads to the next section. Then one card per upcoming tool (`ToolCard` with `asleep`, mockup FL2): gray `--upcoming` band, line icon of the tool (`ToolIcon`, 64 px) in gray, the category as a caption, the tool name, the label "Soon · in meditation". No link and no hover. The sleeping monk of the mockup is not there: it weighed on the document budget (see Performance).
   - **The column.** The "Search a tool" field (hidden label, same text as placeholder); a status line (`aria-live="polite"`): "9 monks", and when the best result comes from a synonym, "1 monk · “reduce” → Compress"; the "Categories" heading and six buttons (`aria-pressed`): "All monks" and the five categories, each with its color dot, its name and its number of tools, ready and upcoming; a rule; the "Show the monks in meditation" switch (`role="switch"`, `aria-checked`), off at the start. Above 900 px, the column stays under the bar while the page scrolls (`position: sticky`). When it is taller than the window, it scrolls by itself. Under 900 px (mockup FL10): the field, then the categories in a row of pills that scrolls sideways, with the fade of the file tabs, then the switch.
   - **Filtering.** An upcoming tool card shows only if the switch is on, if the chosen category has no ready tool (none since Protect and Unlock arrived, on 2 October 2026; the rule stays for the next category), or if the search finds it. The "And 9 monks in meditation" box stays as long as no filter is active and the switch is off. "10 monks, ready now.", next to the heading, hides while a category or a search is active: the status line then gives the count. Search results are sorted from best to worst. With no result (mockup FL6): a sleeping monk, "No monk does that… yet", a sentence and "See all the monks", which clears the search and goes back to "All monks". The compact view follows the category and the search, and hides its empty rows; it always shows the upcoming monks.
   - **Search** (`home/search.ts`, no server). Each tool has its names (tool name; for a ready tool, also its short name and its monk's name) and a word list per language (`frSearch.terms` and `enSearch.terms`, at least five per tool). Accents, capitals and stop words (« pdf », « un », « the »…) do not count. Each word of the query must match a word: the same word (3 points), a word that starts with it (2), or a word one typo away from 4 letters, two typos from 7 (1 point, swapped letters included). Typos are only a last resort: if a tool matches with whole words or word starts, the words that needed a typo are dropped (« conv » does not bring back « concaténer »). On a tie, a ready tool comes before an upcoming tool. A multi-word query written like a name gets 2 points: « pdf en jpg » and « jpg en pdf » do not give the same first result. A last word that matches nothing and starts a stop word is ignored: « pd », on its way to « pdf », does not show the no-result state.
   - **No island.** The cards and the column are server-rendered HTML. The `home/filters.ts` script, written into the page, toggles `hidden` on the `data-tool` elements and sorts the cards. A ready monk is an element that holds a link. The script loads the words (`/fr/search.json`, `/en/search.json`, 1.4 KB) only on the first pointer or focus pass over the column, or at the first typed letter. While they are missing, or if their load fails, the search runs on the names written on the cards, and a failure is retried at the next letter. Without JavaScript, the column is hidden, like "Compact view".
   A "Compact view" button (`aria-pressed`), to the right of the heading, replaces the cards and the next section with the list of all the monks, one row per category (mockup D3): on the left, the category in its color and its count ("6 tools ready", "1 ready, 3 soon", "4 soon"); on the right, the 80 px avatars (56 px on mobile) and a short name. The ready monks are links, on the tint of their category; the others sleep, name in gray. The choice stays in the browser (`localStorage`, key `view`) and the `<head>` script sets it on `<html data-view>` before the first render, like the theme: the page does not move on load. Without JavaScript, the button is hidden and the cards stay.
3. **"At the monastery, soon 🕯️".** The 12 upcoming tools, in four columns by category: 46 px sleeping avatar and name. No link, no page.
4. **"Nothing leaves this place 🤫".** Three points: on your device, free, no account.

### The drop zone that guides

`HomeDrop` is a Preact island loaded with `client:idle`.

- Before it loads, the "Choose files" button opens the native picker. On start, the island reads the files already chosen (same method as `FilePicker`). Drag and drop works once the island has loaded, on the whole page (see "Drop on the whole page").
- The island reads the type of each file with `readKind` (a few bytes, without the engine).
- `orient(kinds)` returns the list of offered tools, in the order of `toolIds`, with the number of files each one receives. A tool is offered if it accepts at least one of the files, and, if it accepts only one file, if only one file suits it.
- The sheet then shows "3 PDFs ready", then the offered monks as buttons (avatar, tool name, and "2 of 3 files" when the tool receives only part of them). A "Choose other files" link starts over.
- If no tool fits: "Holy PDF reads PDF, JPEG and PNG files." The monk is in the `oops` mood.
- A click on a monk calls `handoff.offer(tool, accepted files)`, then `navigate()` to the tool page.
- The result is announced in an `aria-live` region: "3 PDFs ready. Pick a tool." Keyboard focus moves to the first offered monk (or to "Choose other files" if none fits), and comes back to the "Choose files" button after "Choose other files".

### Drop on the whole page

A file dragged from the desktop can be dropped anywhere in the window of a tool page (and of the home page until 2 October 2026). `useFileDrop` listens on `window`, for a single island per page: the board on a tool page (and `HomeDrop` on the home page until 2 October 2026). `dropTracker` counts the `dragenter` and `dragleave` events (they repeat for each element crossed) and reacts only to a drag that carries files: a dragged text or link stays with the browser. During the hover, the island sets `data-dropping` on `<html>` and `Base.astro` shows a veil over the whole window: "Let go, I'll take care of them." The veil is outside the islands: an ancestor with `clip-path` or `filter` would clip it. On drop, the browser does not open the file; the island receives it as a choice.

### `handoff.ts`

Deleted on 2 October 2026 with the drop zone.

- `offer(tool, files)` keeps the files in memory, with the target tool.
- `take(tool)` returns the files if they target this tool, then empties the memory. A second call returns an empty list.
- The board calls `take` on start and opens what it receives, like a drop.

The home page loads `ClientRouter`, like the tool pages, so that the memory survives the page change. The PDF engine never loads on the home page.

## Tool pages

### Page top

- Centered heading 1: the `h1` of the Markdown content, followed by the tool's emoji, then a sentence ("Brother Staple binds your PDF files into one.").
- No visible breadcrumb (it stays in the JSON-LD), no privacy badge, no portrait.

### The board

> Since 30 September 2026, the action bar (View, Download) is replaced by the three-step flow: settings panel, verb button, result page. See the [flow spec](2026-09-30-web-parcours-lot1-design.md).

Same logic, same state, new styling:

- **Empty**: a white dashed card. The tool's monk (his mood comes from `cast`) stands in a 150 px disc on the tint of his category, set on the top edge of the card. Below, a large "Choose PDF files", "Choose a PDF file" or "Choose images" button, with the upload icon, then "or drop them here" (hidden on a touch screen). The trust line is under the card, and "How to do it" in three cards further down. The whole page still receives dropped files. Mockup: page v13 of the canvas (TP1, TP3 on the left).
- **Files**: folder tabs. Each file takes one of the six colors, repeated at the top of its pages. A tab shows the name, the pages and the size; while the file opens, a shimmering line; on error, a red tab, a padlock and an error message in stamp red on the surface background (on the file's tint, it would fall under 4.5:1). Each tab has a × that removes the file and all its pages, after confirmation ("All the pages of … will be removed from the preview.", Keep or Remove); a file with no pages yet goes at once. Cmd/Ctrl+Z does not bring them back, because the engine has closed the file. The full name of a truncated file or page shows on hover. To the right of the tab row, an "Undo" icon button (Ctrl or ⌘ + Z) undoes the last edit. The tabs are a color legend, not folders: on Merge, the pages of all the files sort together. With a single ready file, there is no tab and no color mark: the legend only serves to tell several files apart. The tab comes back while the file opens or after an error, for the message and the password.
- **Pages**: dog-eared sheets with the file color at the top and the number below. Selected: 3 px primary outline and announced state. Dragged: lifted, tilted 4°, "lifted page" shadow. Loading: shimmer. The page buttons (rotate, delete, select, cut) become icon buttons with an accessible label. The grid ends with a dashed "+ Add a PDF" box ("Add images" on JPG to PDF, "Choose another file" on a single-file tool), which opens the picker.
- **Action bar**: at the bottom of the board on desktop, fixed at the bottom of the screen on mobile. `MonkBubble` shows the tool's monk (84 px, 50 px head on mobile) and a bubble; next to it, **View** (the output PDF opens in a new browser tab) and **Download**, the primary button. Split has only Download, because it outputs a zip. Rotate a PDF keeps "Rotate all", its main gesture. No "Undo" (it is above the grid). On the multi-file page tools (Merge, Rotate, JPG to PDF), "Add a PDF" or "Add images" is also in the panel, just above the verb button. This is not the case during export, and not under 900 px, where the bar under the thumb keeps the verb alone. The reason: on a long document, the grid box is out of view and the user had to scroll to the very bottom to add a file (the author's request, 5 October 2026, in the desktop app). The single-file tools keep their "Choose another file" box in the grid only: next to the verb, it would replace all the work in one click.

| Board state | Mood | Bubble |
|---|---|---|
| file opening | `focus` | "Reading contrat.pdf…" |
| ready | `happy` | "3 files, 7 pages." and the tool's question |
| export in progress | `focus` | the tool's verb ("Stapling…") |
| export done | `joy` | the tool's end line ("There you go, all stapled 🙌") |
| error | `oops` | the current error message and "Remove this file" |

The download starts as it does today. There is no "done" screen: only the bubble changes, until the next action.

### The workshop

As soon as files are chosen, the work page fills the screen under the bar, at 64 rem wide and more. Mockup: page v14 of the canvas, version A "the workshop" (WK1).

- **The table, on the left**: the page background. The heading, compact and left-aligned; then the workspace: the file cards (Compress, PDF to JPG) or the page folder and its tabs. The file cards are centered on the table, with no dashed zone. "+ Add a PDF" is at the top right of the table, under the heading, and the sentence "You can also drag more PDFs into this area" is hidden (the whole page receives files). At the bottom of the table, the "How to, frequent questions" link and a chevron lead to the sections below (`#how-to`).
- **The panel, on the right**: a 27.5 rem column stuck to the right edge of the window. Surface background, a 1 px `--line` rule on its left, no radius, no shadow. It stays under the bar (`position: sticky`, top `--nav-height`) and takes all the remaining height (`100vh - --nav-height`). If its content overflows, it scrolls inside the panel; the verb button and the trust line stay stuck at the bottom.
- The table is at least as tall as the panel: the first screen shows the whole tool.
- **Implementation**: `main:has(.board)` becomes a `minmax(0, 1fr) 27.5rem` grid, areas `"head panel" "work panel" "below panel"`, rows `auto 1fr auto`, with no max width and no padding. `.board` switches to `display: contents` (in `board.css`), so `.workspace` and `.panel` take the `work` and `panel` areas of the `[tool].astro` grid. The sections below take the full row and keep the page width (82 rem, centered).
- From 900 px to 64 rem, the board keeps its floating panel (radius, shadow, minimum height). Under 900 px, the phone stack and its verb bar stuck at the bottom do not change (mockup WK3, on the left). The result page and the empty page do not change.

### Below the board

Mockup: page v14 of the canvas (FQ1).

- "How to do it" (`id="how-to"`): the 3 steps of the content, numbered in pills.
- The SEO text of the content, in one centered column of 48 rem at most.
- The FAQ: centered heading, one centered column of 55 rem at most. Each question is a white card (`--radius-panel`): the question in bold on the left, a 36 px round sign on the right ("+" `--accent` on `--bg`; when open, "−" `--on-accent` on `--accent`, and the card takes `--shadow-panel`), the answer below in `--ink-soft`.
- "The other monks": centered heading, the `related` tools as centered cards (`repeat(auto-fit, minmax(16rem, 22rem))`). Each card shows the 80 px avatar, the tool name in the heading font, the monk's name in the color of its category and an arrow on the right.
- These sections take only a top margin: in the workshop grid, margins do not collapse, and the spacing stays the same as on the empty page.

## 404 page

The monk in the `oops` mood with his loupe, "This page does not exist 🙈", a link to the home page and the 7 tools as avatars.

## Contents

### Name and titles

- `siteName` becomes `Holy PDF`: logo, footer, breadcrumb of the structured data.
- Home page `<title>`: « Holy PDF : outils PDF gratuits, dans votre navigateur » (EN: "Holy PDF: free PDF tools, in your browser"). The tool `<title>` tags do not change.
- Emojis never go in `<title>` or in descriptions. In visible headings, they are in a `<span aria-hidden="true">`, attached to the last word by a non-breaking space.

### Emojis

Home page 🙏, ready tools 🤲, upcoming tools 🕯️, privacy 🤫, free 😇; tools 📎 ✂️ 🗂️ 🗑️ 🔍 🔄 📸; end of export 🙌; error and 404 🙈.

### Monk texts

| Tool | Monk FR | Monk EN | Question (ready) | End |
|---|---|---|---|---|
| Merge | Frère Agrafe | Brother Staple | J'agrafe tout ça ? | Et voilà, c'est agrafé |
| Split | Frère Ciseaux | Brother Scissors | Je coupe ? | C'est coupé |
| Organize | Frère Classeur | Brother Binder | Je range tout ça ? | C'est rangé |
| Delete pages | Frère Gomme | Brother Eraser | J'efface ces pages ? | C'est effacé |
| Extract pages | Frère Loupe | Brother Lens | Je sors ces pages ? | C'est sorti |
| Rotate | Frère Toupie | Brother Spin | Je les remets d'aplomb ? | C'est d'aplomb |
| JPG to PDF | Frère Cadre | Brother Frame | Je fais le PDF ? | Le PDF est prêt |

`i18n/fr.ts` and `i18n/en.ts` also receive: each monk's introduction sentence, each card's sentence, the in-progress verb ("Stapling…"), the names of the 12 upcoming tools, the names of the 5 categories, the home page section headings, the texts of the drop zone and of the 404 page. The two dictionaries share the same type: a text missing in one language does not compile. `cast.ts` is typed `Record<ToolId, …>`: a tool with no monk does not compile either.

All these texts are marked "to review" in the wiki, like the SEO texts, until they are approved.

## Dark mode

A short script, in the `<head>` of each page, sets `data-theme="light"` or `"dark"` on `<html>` before the first render: the choice kept in `localStorage`, otherwise the device setting, which it follows as long as nothing is chosen. `tokens.css` redefines the variables under `:root[data-theme="dark"]`. Nothing else changes: the components read only variables. The values are in the Foundations tables.

The top bar button (a second one in the footer, kept in sync) shows a moon in light mode and a sun in dark mode. It switches the theme, keeps the choice, and announces its state with `aria-pressed` ("Dark mode"). During a `ClientRouter` navigation, the script sets the theme on the new page before the swap. Without JavaScript, the site stays light and the button is hidden.

The disc of the upcoming monks stands out from the background and the panels: at least 1.4:1 in dark mode. All the dark tints (categories, files) reach at least 1.3:1 against the surface, so that the avatar disc shows.

Under 480 px wide, the header shows only the brand monk; screen readers still read the name. The rendering must be checked on the site before going live.

## Accessibility

- Monks, scenes, avatars and emojis: `aria-hidden`. Links and buttons have a text.
- Keyboard focus: 3 px ring, ink color (light in dark mode), offset by 2 px.
- Color is never the only signal: named tabs, announced selected page, written "Soon" stamp.
- Icon buttons: 40 px on desktop, 44 px on mobile.
- `prefers-reduced-motion`: no shimmer, the dragged page does not tilt.
- Contrasts: each text and background pair of the Foundations tables reaches at least 4.5:1 (AA), in light and in dark.

## Performance

CI keeps its current thresholds (performance ≥ 0.95, SEO and best practices at 1, accessibility ≥ 0.95, CLS ≤ 0.02). LCP is ≤ 1.5 s on the home page and ≤ 1.6 s on the tool pages. CI adds:

| Budget | Value |
|---|---|
| Home page JavaScript (compressed) | ≤ 22 KB |
| Tool page JavaScript (compressed) | ≤ 45 KB |
| Fonts, all pages | ≤ 80 KB, both preloaded (26 KB after subsetting) |
| Home page HTML (compressed) | ≤ 40 KB, since 3 October 2026: 36 KB for the rebuilt home page, then 40 KB to make room for its video (the author's choice; see [web version](../development/web-version.md)). Before: 28 KB on 2 October (cards of Protect and Unlock, and room for the tools of the same milestone; the author's choice), 26 KB on 1 October, 25 KB at first |
| CLS | ≤ 0.01 on the home page |

These budgets are in brotli, which is what Cloudflare serves. The Lighthouse CI thresholds are 24 KB of JavaScript for the home page and 50 KB for a tool page. Its server (`compression` 1.8) also serves brotli, at quality 4, and it counts the headers, about 390 B per response: its figures are about 13% under `gzip -9`, which therefore does not measure the budget. The home page budget went from 15 to 20 KB while the plan was written (Astro's router weighs 6 KB on its own, Preact and the islands runtime 9 KB), then to 22 KB when the drop zone took the whole page: only 18 bytes of margin were left.

The LCP of the tool pages has its own threshold, chosen by the author. In the Lighthouse simulation, the two fonts wait behind the seven scripts of the board (six connections): 1.53 s with the fonts, 1.37 s without. Their weight changes nothing there. On the home page, the subset brings them down to 1.37 s. With real network throttling, the fonts cost about 80 ms and all pages stay under 0.85 s.

Lighthouse CI also measures the home page in French.

On the home page, one more script request on load, even of 200 bytes, adds a simulated round trip to the LCP: +150 ms, over the budget (the simulation queues the fonts behind the scripts). More bytes in the document do not move it. So the filters script is written into the page, and `astro.config.mjs` keeps it there whatever its size. With the filter column (1 October 2026), Lighthouse CI measures the `/fr/` document at 25,560 B out of 25,600 (25,307 for `/en/`): 40 bytes are left. Quality 4 brotli varies by about 100 bytes from one build to the next when the same content moves: the measurement is redone on the CI build (`INDEXABLE=true`). `gzip -9` gives about 28,600 B.

## Tests

The tests of the home page drop zone (`orient`, `handoff` and its five end-to-end flows) went with it on 2 October 2026.

**Unit (Vitest):**

- Contrasts: ratio computation for each text and background pair, in light and in dark.
- `searchTools`: a synonym, and which one; accents and capitals; a word being typed; one typo from 4 letters, two from 7, two swapped letters; typos as a last resort; all words required; an empty query or a query of stop words returns everything, as does a last word that starts a stop word and finds nothing (« pd »); nothing for a tool that does not exist; the direction of a conversion; the monk's name; a ready tool before an upcoming tool. The word lists: at least five per tool, ready or upcoming, in each language.

**SEO (Vitest, on the build):** "Holy PDF" in the home page `<title>` and in the breadcrumb; no emoji in `<title>` or in `meta description`; a single `h1` per page; canonical and hreflang intact.

**End to end (Playwright, Chromium, Firefox, WebKit):**

- home page: the compact view shows the 28 monks (27 links), hides the cards, and stays chosen after a reload;
- home page filters (`filter.spec.ts`): « Convertir » shows 4 cards, 5 with the switch, 1 of them « Bientôt · en méditation »; at 1,440 × 800, the column stays on screen 900 px further down; without the word lists (request blocked), « pivoter » still finds « Pivoter », and the next letter reloads them; "Security" (English page) shows its 2 ready monks, with none in meditation; four cards per row at 1,440 px; « redure » leaves only « Compresser », and the status says « « réduire » → Compresser »; the best result comes first; « excel » shows the sleeping monk, and « Voir tous les moines » brings back the 27 cards; the « Et un moine en méditation » card turns the switch on; the compact view follows the filters; search still works after a visit to a tool page; at 390 px, the categories fit on one row of pills, and the page does not scroll sideways from 320 to 1,024 px;
- phone: a file name with no space or hyphen does not make the page overflow while it opens (the bubble breaks it);
- tab in error: its message is on the surface background, in light and in dark;
- board: no tab and no color mark for a single ready file; the × of a tab asks for confirmation, then removes the file and its pages; the Undo button undoes the last edit; the full name shows on hover; the "Add a PDF" box adds a file, and so does "Add a PDF" in the panel, hidden on a phone; View opens the result preview in the page (a PDF, the files of a ZIP, the images), Download downloads it, and each tool has only its own actions; a click or Enter on a thumbnail opens the page preview, the arrows and the buttons page through it (even when the button that had the focus turns gray), Escape closes it, and a rotated page fits in its frame;
- drop on the whole page: a file dropped on the footer of a tool page opens, the veil appears then disappears;
- "Tools" menu: open, follow a link, with the keyboard;
- dark mode: under emulation, the page background is the dark "background" color;
- switch: go dark, keep the choice on the next page, switch only once after a `ClientRouter` navigation, follow the device when nothing is chosen;
- home page at 320 and 390 px: no horizontal scroll, even with the fallback fonts;
- fonts: each letter of the dictionaries and of the tool texts is in the subset (except ✕, ⌘, ↻, which the system font draws);
- hover (`hover.spec.ts`): on the home page, an empty tool page, the Merge board, Compress, PDF to JPG, Split and the result, one control of each kind changes its look under the pointer (`expectHoverFeedback`); Undo, disabled, and the preview of a file card do not change (`expectNoHoverFeedback`);
- the existing board tests pass with the new styling.

## Prior checks

To do at the very start of the plan, before writing the components:

1. **File handoff**: check in the three browsers that the memory of a module survives a `ClientRouter` navigation. If it does not, fallback: keep the `File` objects in IndexedDB for the time of the navigation.
2. **`clip-path: path()`**: check the avatar rendering in the three browsers.
3. **Font weight**: measure the chosen woff2 files against the 80 KB budget.
4. **Home page weight**: measure the compressed HTML with the 7 cards and the 12 avatars against the 25 KB budget. If it goes over, reduce the paths before changing the approach.

## Next steps

- review of the new texts and approval of dark mode on the site;
- the purchase of holy-pdf.com (not registered on 5 October 2026), then `SITE_URL` and `INDEXABLE=true` at deploy. Update, 6 October 2026: domain bought, `SITE_URL` set, the site deployed by CI (PR #23); `INDEXABLE=true` still to set. PR #20 renamed the Cloudflare Worker `holy-pdf-web` on 5 October 2026;
- the final illustrations by an illustrator, with the canvas mockups as the brief;
- the share images (Open Graph) with the monks.
