# Web: audience measurement with GA4, design

Date: 6 October 2026. Status: implemented, waiting for the measurement ID.

## Why

The author wants Google Analytics 4 on the site. An ad network that may come later asks for read access to the site's GA4 property to check its traffic. Ads themselves are not decided: the roadmap still rejects them, and the README promises none.

## Rules

- **Nothing before consent.** Before the visitor accepts, the site loads no Google script, sets no cookie and sends no ping without cookies. Google calls this the basic mode of consent mode.
- **Refusing is as easy as accepting.** The banner has two identical buttons. Every tool works the same after a refusal.
- **What is measured.** The page views of GA4, and one event, `tool_done`, with the ID of the tool when a run ends (a download for the Scanner). Never a file name, a size, a page count or a text. The type `Measure` in the port is the only way to send an event, and it has no free field.
- **Ad features off.** Google signals and ad personalization are off in the configuration. Consent mode says `ad_storage`, `ad_user_data` and `ad_personalization` are denied.
- **Lifetimes.** The cookies `_ga` and `_ga_<id>` live 13 months, the longest the CNIL accepts for audience cookies. The choice lives six months in `localStorage` (`analytics`, value `granted:<ms>` or `denied:<ms>`), then the banner asks again.
- **Withdrawal.** The "Cookie settings" button in the footer opens the banner again. A refusal after an acceptance sets `window['ga-disable-<id>']`, updates consent to denied and erases the `_ga*` cookies. The flag matters: with storage denied alone, gtag.js keeps sending pings without cookies.
- **No ID, no measurement.** A build without `GA4_ID` has no banner, no script and no footer button: forks, CI and the desktop app.

## Architecture: dependency inversion

| Part | File | Knows |
|---|---|---|
| Port | `apps/web/src/analytics/port.ts` | `Measure`, `Analytics`, `track()` |
| Adapter | `apps/web/src/analytics/ga4.ts` | gtag.js; implements `Analytics`, adds `consent(granted)` |
| Composition root | `apps/web/src/analytics/consent.ts`, loaded by `layouts/Consent.astro` | the banner and the choice; plugs the adapter in after consent |
| Users | `board/Board.tsx`, and the Scanner through a callback of Board | the port only |

- The board calls `track()` and knows nothing of Google. The root plugs the adapter into `globalThis.holyPdfAnalytics` after consent and removes it on withdrawal. The desktop app plugs nothing in: `track()` does nothing there.
- **A global, not a shared module**: a module that the board's island and a page script both import becomes a separate chunk, so one more request before LCP on every tool page ([pitfall](../development/web-version.md#known-pitfalls) "Modules shared with a deferred chunk"). The Scanner gets a callback from Board for the same reason.
- **No lazy `import()` of the adapter**: Vite wraps it in its preload helper, which lives in the Preact chunk. The consent script then became a file of its own that loads Preact on every page. The adapter weighs less than 1 KB minified, inside the page.
- Another tool (Plausible, the tag of an ad network) is another adapter of the same port. The board does not change.

## Banner

- `Base.astro` reads `GA4_ID` at build time and refuses a value that is not `G-` followed by letters and digits. It then renders `Consent.astro` in every page and the footer button.
- The banner is in the HTML, hidden by CSS unless `<html data-consent="ask">`. An inline script placed just before it sets this attribute from `localStorage`, so a visitor who chose never sees it flash, and the banner is painted with the page, not after a script.
- The client router does not run again an inline script it already ran. `consent.ts` copies `data-consent` to the new document on `astro:before-swap`, like the theme script does.
- Fixed at the bottom, `z-index: 14`: under the header (15) and its mobile drawer. No layout shift: it moves nothing.
- The texts are in the site dictionaries (`consent`, `footer.cookieSettings`). The Cookies and Privacy pages describe the measurement, its recipient, the transfer and the retention.

## Weights

Home document, French, brotli quality 4 without the headers, local build:

| Build | Bytes |
|---|---|
| without `GA4_ID` | 40,216 |
| with `GA4_ID` | 41,320 |

The banner, its styles and its two scripts add about 1.1 KB to each document, with no extra request. The home document budget goes from 40,960 to 43,008 B. `pnpm verify:full` runs Lighthouse on a build with `GA4_ID=G-TEST1234`, so it measures the page a visitor gets.

## Setting it up

1. In Google Analytics, create a property and a web data stream for `https://holy-pdf.com`. Copy the measurement ID (`G-…`).
2. Add the repository variable `GA4_ID` (Settings, Secrets and variables, Actions, Variables). The next deploy of the site turns the banner on.
3. In the property:
   - Data retention: two months, the default, as the Privacy page says.
   - Google signals: off.
   - Enhanced measurement: keep the page views and their "browser history events" option, which count the language switch of the client router. Turn off "File downloads" and "Form interactions": the site does not need them.
   - Custom definitions: a dimension with scope "Event" on the parameter `tool`, to read the tools in the reports.
4. When an ad network asks, give it read access in the property access management.

## Later: ads

Google AdSense and Ad Manager require a consent platform certified by Google (IAB TCF) for visitors in the EEA, the UK and Switzerland. Networks such as Mediavine or Raptive bring their own. Such a platform replaces `Consent.astro` and `consent.ts`; the port, the adapter and the board stay. Ads also change the promises of the README, CONTRIBUTING and the roadmap.

## Tests

- Unit, `tests/unit/analytics.test.ts`: the port, the gtag queue (`arguments` objects, consent before config), the privacy options, the event without free fields, the withdrawal.
- Build, `tests/seo/pages.test.ts`: the banner is on every page of a build with `GA4_ID`, and on none without.
- End to end, `tests/e2e/consent.spec.ts`, Chromium, on a build with `GA4_ID`, gtag.js stubbed: asks first and remembers a refusal; loads gtag.js only after acceptance; sends `tool_done` without the file name; withdraws from the footer, erases the cookies and gives the focus back; asks again after six months; keeps the question and the answer across a language switch. Without the copy of `data-consent` on `astro:before-swap`, the last test fails.
