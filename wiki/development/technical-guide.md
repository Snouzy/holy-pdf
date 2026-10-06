# Technical guide

_Written on 29 September 2026 for the Swift engine and the Mac app. Rewritten on 5 October 2026 for the site and the desktop app, after the Swift app was removed (its code and its rules are at the tag `mac-final`)._

## Where things are

- `apps/web/`: the Astro site, the board as a Preact island, the PDFium and qpdf engine in WebAssembly in a Worker. The choices, the measurements and the pitfalls: [Web version](web-version.md) and the [foundation spec](../specs/2026-09-29-web-organiser-design.md).
- `apps/desktop/`: the Tauri desktop app, a Preact entry built from the site's components. It imports `apps/web/src` by relative path and changes nothing in it. Specs: [Tauri shell](../specs/2026-10-05-desktop-tauri-design.md) and [app shell](../specs/2026-10-05-desktop-shell-design.md).
- `wiki/`: one spec per tool before the code (what it does, each decision and its reason). A code change updates its wiki page in the same commit.

## Code rules

- Strict TypeScript, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`: you fix a warning, you do not ignore it.
- Model a state as a discriminated union (`DocStatus`, `Flow`), never as combined booleans. Errors are typed (`EngineError`); the interface turns them into sentences.
- The engine takes data and returns data. No sentence for the user outside a French and English dictionary: `i18n/`, or the `texts` next to the component that shows them (a tool editor, the Scanner, the desktop app). « vous » in French, a non-breaking space inside « ».
- No premature abstraction: add a protocol or an indirection only when a second implementation exists. The code must stay readable in six months by a junior developer or by an AI.
- Name a component after its function, not after the context it came from (`PageThumbnail`, not `ScannerBoardThumbnail`).

## Dependencies

- A library comes in only through a spec that says why the browser, Astro or Preact are not enough. The [foundation spec](../specs/2026-09-29-web-organiser-design.md) keeps the first list, plus `lucide-preact`. The other later libraries are justified in the spec of their feature. Versions are pinned.
- An embedded dependency is credited in `apps/web/public/licenses/`, the legal notice pages and [LICENSING.md](../../LICENSING.md).

## Performance

**Measure before you optimize.** A performance intuition is wrong half the time: measure, fix, measure again.
- The site budgets live in `apps/web/lighthouserc.json`; `pnpm verify:full` enforces them. The measurements are in [Web version](web-version.md).
- Nothing changes size during a drag (pages, corners): otherwise the content jumps under the pointer. Heavy renders wait for the end of the gesture.

## Interface

- Colors come from the tokens of `styles/tokens.css`, light and dark: dark mode must work everywhere.
- An action that can be undone does not ask for confirmation (Apple rule): deleting a page is undone with ⌘Z. Removing a file or a document stays confirmed, with its name. On the board, removing a file cannot be undone. In the Scanner, the message says that the removal can be undone.
- Judge the desktop app (`apps/desktop`) as a native app of its system, not as a site in a window: on Mac like the Swift app, on Windows like a Windows app. Window, menus, shortcuts, dialogs and files are those of the system. Nothing from the site's header, footer, pages or links appears in it. The principle and what it requires are in the [application shell spec](../specs/2026-10-05-desktop-shell-design.md).

## Comments

In English, and only for what the code cannot say: a reason, a constraint, a pitfall. Never a paraphrase of the next line. By default, a change adds no comment.

## Tests

See [Tests](tests.md).

## Privacy

- No file leaves the device. The site processes everything in the browser. The desktop app has no HTTP plugin, and its CSP limits `connect-src` to itself and to the Tauri IPC.
- Audience measurement goes through the port `apps/web/src/analytics/port.ts`: a `Measure` has no free field, so no file data can reach it. Google Analytics loads only after the visitor accepts, on a build with `GA4_ID`. See the [spec](../specs/2026-10-06-web-analytics-design.md).
- No real photo in the repository: git ignores `fixtures-private/`. The repository is public: anyone can read what is committed.

## Git

- One branch and one pull request per change, never a direct push to `main`.
- Tests come with the change, and the wiki page concerned is updated in the same commit. The rest is in [CONTRIBUTING.md](../../CONTRIBUTING.md).
