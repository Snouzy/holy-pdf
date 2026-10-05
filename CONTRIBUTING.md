# Contributing

Thank you for looking. This page says how the project works so that your time is well spent.

## Where things are

- `apps/web/`: the site (Astro + Preact) and its engine (PDFium and qpdf in WebAssembly, in a Web Worker). This is where development happens.
- `apps/desktop/`: the desktop app (Tauri 2). Its entry in `app/` composes the site's tools (the board, the engine, the monks) into an app shell: the monastery, a tool screen, native menus, open and save dialogs. It imports `apps/web/src` by relative path and changes nothing there. Needs a Rust toolchain (`rustup`): `pnpm desktop:dev` (its own Vite server, no need for `pnpm dev`), `pnpm desktop:build` for the bundle, `pnpm desktop:smoke` for the checks.
- The native Swift app and its engine (`Packages/Core`, `apps/mac`) were removed on 5 October 2026: the desktop app replaces them. The tag `mac-final` keeps their last state.
- `wiki/`: the documentation, in English. Every tool starts with a spec in `wiki/specs/` (what it does, each decision and its reason) before any code. Code changes update their wiki page in the same commit.

## Before you write code

Open an issue first for anything bigger than a fix. A feature without a spec row is not merged, so the issue is where the spec is agreed. Two rules decide most proposals:

- Everything runs on the user's device. A tool that needs a server is out of scope.
- No account, no quota, no advertising on the site.

## Set up

```sh
pnpm install      # at the repository root: a pnpm workspace
pnpm dev          # http://localhost:4321
pnpm verify       # types, unit tests, build, SEO checks, Chromium end-to-end
pnpm verify:full  # adds Firefox, WebKit and Lighthouse
```

The root scripts forward to the workspace packages (`apps/web` for the site, `desktop:*` to `apps/desktop`); `pnpm --filter @holy-pdf/web <script>` runs any other script of the site. The desktop shell needs Rust: install it with rustup, which puts `~/.cargo/bin` on your PATH.

Node 22.12 or later (CI runs 24, see `.github/workflows/web.yml`) and pnpm. End-to-end tests run against `dist`, so run `pnpm build` before them when you test by hand.

## Rules of the house

- Tests come with the change. Engine behavior is tested in `apps/web/tests/engine` against the real WebAssembly build.
- Never commit a real document, photo or personal file. Test fixtures are synthetic and generated in code.
- User-facing text exists in French and English: the dictionaries in `apps/web/src/i18n`, `apps/web/src/scanner/texts.ts`, `apps/web/src/signature/` and `apps/desktop/app/texts.ts`, the desktop menus in `apps/desktop/src-tauri/src/lib.rs`, and the pages in `apps/web/src/content`. French uses « vous », and a non-breaking space inside « » only, as the existing pages do.
- Comments are in English, and only for a why. The code says the what.
- Keep the loading budgets: the site must stay fast on a phone.

## Submit

- One pull request per change, merged with a merge commit (no squash, no rebase of a shared branch).
- Sign off every commit (`git commit -s`). This certifies the [Developer Certificate of Origin](https://developercertificate.org/) and places your contribution under the project license; see [LICENSING.md](LICENSING.md).
- Write issues and pull requests in English or French, as you prefer. The wiki, the docs and code comments are in English.

## Security

See [SECURITY.md](SECURITY.md). Do not open a public issue for a vulnerability.
