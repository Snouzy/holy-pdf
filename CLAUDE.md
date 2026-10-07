# Holy PDF

Before any task, read [wiki/index.md](wiki/index.md), then the [technical guide](wiki/development/technical-guide.md).

- Public repository under AGPL-3.0 (decision of 4 October 2026): everything committed is readable by anyone. License, brand and contributions: [LICENSING.md](LICENSING.md), [BRAND.md](BRAND.md), [CONTRIBUTING.md](CONTRIBUTING.md).
- The wiki, the docs and code comments are in English, and so are your commit messages and pull requests: most contributors read English (decision of 5 October 2026). French user-facing texts stay in French: the French dictionaries (`apps/web/src/i18n`, `apps/web/src/scanner/texts.ts`, `apps/web/src/signature/`, `apps/desktop/app/texts.ts`, the French menus in `apps/desktop/src-tauri/src/lib.rs`), the Markdown under `apps/web/src/content/*/fr/`, and the French post drafts in `wiki/product/social-posts.md`. The Brazilian Portuguese texts stay in Portuguese: `ptBR.ts`, `ptBRSite.ts`, the `pt-br` blocks of the component texts, and the Markdown under `apps/web/src/content/*/pt-br/`.
- The Swift app (`apps/mac`, `Packages/Core`) was removed on 5 October 2026; its last state is at the tag `mac-final`. The desktop app is the Tauri app in `apps/desktop/`, built on the site's code.
- Specs live in `wiki/specs/`. Execution plans are no longer committed (the `tasks/` folder is untracked): they are written for agents and name the author's machine.
- A code change updates its wiki page in the same commit.
- Never commit `fixtures-private/` or any real photo.
- Desktop: `pnpm desktop:smoke` (Rust through rustup) and `pnpm --filter @holy-pdf/desktop check`.
- Deploy: each push to `main` that touches the site deploys it to holy-pdf.com (Cloudflare Worker `holy-pdf-web`, `.github/workflows/web.yml`), after `pnpm verify`, then tells the IndexNow search engines (`apps/web/scripts/indexnow.mjs`). The repository variable `INDEXABLE` decides whether search engines may index it; `GA4_ID` turns on Google Analytics, after the visitor's consent.
- Site: `apps/web`, a pnpm workspace at the root (`pnpm dev`, and `pnpm verify` from the root: types, unit tests, build, SEO, Chromium end-to-end). `pnpm verify:full` adds Firefox, WebKit and Lighthouse.

## Merging into `main`

Exception to the global "never `main`" rule, for this repository only (the user's decisions of 30 September and 2 October 2026):

- Claude merges its own pull requests into `main` with `gh pr merge <n> --merge`, without asking again, as soon as their tests pass locally, then says what went out.
- Before merging a site change: `pnpm verify`. `pnpm verify:full` only when the change touches the layout, the fonts, the load budgets or the engine.
- Never a direct `git push` to `main`. No `--squash` or `--rebase` on a pull request whose commits another pull request reuses.
