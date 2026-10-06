# Web: a short film per tool, design

Date: 6 October 2026. Status: implemented for Redact; the other tools follow as their films are made.

## Why

A 15-second vertical film shows what a tool does faster than a text: the document, the gesture, the result, then the brand. The author makes one per tool, in French and in English, in the 9:16 format of reels.

## Decisions

| Subject | Decision | Reason |
|---|---|---|
| Entry | The pill of the home film ("Watch Holy PDF in 30 seconds"), under the tool's introduction: "Watch Brother Inkpot at work · 15 s", with a round thumbnail | Same component as the home page (`layouts/Watch.astro`), above the fold on a computer and on a phone. A phone frame beside the drop zone was tried and set aside: it moved the layout of every tool, and its 260 px poster could become the LCP element (1.52 s for a budget of 1.6 s) |
| Opening | A native `<dialog>`, vertical, centered on a computer, full screen below 40 rem. Native controls (play, sound, time, full screen), a close button, Escape and a click on the backdrop close it | The controls of the platform are accessible and known; the dialog gives the focus back to the pill |
| End | "Your turn: nothing leaves your device.", the drop zone's own button ("Choose a PDF", "Choose PDFs"…), which closes the film and opens the file chooser, and "Watch again" | The film leads to the tool, in one gesture |
| Weight | Nothing of the film loads before the click: the `src` is set at the first opening. Only the thumbnail loads with the page (96 × 96 WebP, 2 KB) | Tool page budgets |
| Files | `public/videos/tools/<id>-<lang>.mp4` and `<id>.webp`, listed in `toolFilms` (`src/films.ts`) with their length and languages | A tool without a film, or without one in the page's language, shows nothing |
| Encoding | `node scripts/tool-film.mjs <tool-id> <fr.mp4> [en.mp4]`: 720p, 30 fps, H.264 CRF 27, AAC 96 kb/s, `faststart`; thumbnail at 4 s | The 1080p 60 fps render weighs 16.5 MB for 15 s; the site's version weighs 1 MB with sharp texts |
| Byte ranges | Served by `worker/videos.ts` for everything under `/videos/` | Safari and iOS play a video only from 206 answers (see the pitfall in [Web version](../development/web-version.md)) |
| Hidden | Once a file is on the board, like the introduction. Never in the desktop app, which embeds no video | The film sells the tool; once the tool is in use, it is in the way |
| Film background | `#eef1f6` around the video when the screen is narrower than 9:16 | The films are drawn on the light theme's background, whatever the theme of the page |

## Add a film

1. Render the film in French and in English (1080 × 1920).
2. `node scripts/tool-film.mjs <tool-id> <fr.mp4> <en.mp4>` in `apps/web`. It prints the length.
3. Add the tool to `toolFilms` in `src/films.ts`.
4. `pnpm verify`: `tests/unit/films.test.ts` checks that the files exist.

## Tests

- `tests/e2e/tool-film.spec.ts`: no request for the film before the click; the dialog opens and loads it; at the end, the button has the focus and opens the file chooser; Escape closes it, pauses it and gives the focus back to the pill (opened with the keyboard: Safari does not focus a clicked button); the pill leaves once a file is in; no pill on a tool without a film; full screen on a phone.
- `tests/unit/films.test.ts`: the files of every listed film exist.
