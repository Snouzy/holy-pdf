# pdf-toolbox

Avant toute tâche, lire [wiki/index.md](wiki/index.md) puis le [guide technique](wiki/development/technical-guide.md).

- Dépôt public sous AGPL-3.0 (décision du 4 octobre 2026) : tout ce qui est commité est lisible par tous. Licence, marque et contributions : [LICENSING.md](LICENSING.md), [BRAND.md](BRAND.md), [CONTRIBUTING.md](CONTRIBUTING.md).
- Appli Mac (`apps/mac`, `Packages/Core`) gelée le 4 octobre 2026 : corrections seulement, aucune nouvelle fonction. Le bureau se fait en Tauri sur le code du site (`apps/desktop/`).
- Specs dans `wiki/specs/`. Les plans d'exécution ne sont plus commités (dossier `tasks/`, non suivi) : ils s'adressent aux agents et citent la machine de l'auteur.
- Un changement de code met à jour sa page du wiki dans le même commit.
- Ne jamais commiter `fixtures-private/` ni aucune photo réelle.
- Tests : `cd Packages/Core && swift test`.
- Appli : `xcodebuild -project apps/mac/PDFToolbox.xcodeproj -scheme PDFToolbox -destination 'platform=macOS' test`, puis `python3 apps/mac/scripts/check-strings.py`.
- Site : `apps/web`, workspace pnpm à la racine (`pnpm dev`, `pnpm verify` depuis la racine : types, unitaires, build, SEO, e2e Chromium). `pnpm verify:full` ajoute Firefox, WebKit et Lighthouse.

## Fusion vers `main`

Exception à la règle globale « jamais `main` », pour ce dépôt seulement (décisions de l'utilisateur, 30 septembre et 2 octobre 2026) :

- Claude fusionne lui-même ses PR vers `main` avec `gh pr merge <n> --merge`, sans redemander, dès que leurs tests passent en local, puis dit ce qui est parti.
- Avant de fusionner un changement du site : `pnpm verify`. `pnpm verify:full` seulement si le changement touche la mise en page, les polices, les budgets de chargement ou le moteur.
- Jamais de `git push` direct sur `main`. Pas de `--squash` ni de `--rebase` sur une PR dont une autre PR reprend les commits.
