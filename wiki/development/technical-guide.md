# Guide technique

_Rédigé le 29 septembre 2026 pour le moteur Swift et l'appli Mac ; réécrit le 5 octobre 2026 pour le site et l'appli de bureau, l'appli Swift ayant été retirée (son code et ses règles sont au tag `mac-final`)._

## Où est quoi

- `apps/web/` : le site Astro, la planche en îlot Preact, le moteur PDFium et qpdf en WebAssembly dans un Worker. Les choix, les mesures et les pièges : [Version Web](web-version.md) et la [spec du socle](../specs/2026-09-29-web-organiser-design.md).
- `apps/desktop/` : l'appli de bureau Tauri, une entrée Preact composée des briques du site, qui importe `apps/web/src` par chemin relatif et n'y change rien. Specs : [coque Tauri](../specs/2026-10-05-desktop-tauri-design.md) et [coque applicative](../specs/2026-10-05-desktop-shell-design.md).
- `wiki/` : une spec par outil avant le code (ce qu'il fait, chaque décision et sa raison). Un changement de code met à jour sa page du wiki dans le même commit.

## Règles de code

- TypeScript strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` : un avertissement se corrige, il ne s'ignore pas.
- Un état se modélise en union discriminée (`DocStatus`, `Flow`), jamais en booléens combinés. Les erreurs sont typées (`EngineError`) ; l'interface les traduit en phrases.
- Le moteur prend des données et rend des données ; aucune phrase destinée à l'utilisateur hors des dictionnaires `i18n/` (français et anglais, « vous », espace insécable à l'intérieur des « »).
- Pas d'abstraction prématurée : un protocole ou une indirection seulement quand une seconde implémentation existe. Le code doit rester lisible dans six mois par un développeur junior ou par une IA.
- Un composant se nomme d'après sa fonction, pas son contexte d'origine (`PageThumbnail`, pas `ScannerBoardThumbnail`).

## Dépendances

- Une bibliothèque n'entre que par une spec qui dit pourquoi le navigateur, Astro ou Preact ne suffisent pas ; la liste est tenue dans la [spec du socle](../specs/2026-09-29-web-organiser-design.md). Les versions sont épinglées.
- Une dépendance embarquée est créditée dans `apps/web/public/licenses/`, les pages de mentions et [LICENSING.md](../../LICENSING.md).

## Performance

**Mesurer avant d'optimiser.** Une intuition de performance est fausse une fois sur deux : on chiffre, on corrige, on re-chiffre.
- Les budgets du site vivent dans `apps/web/lighthouserc.json` ; `pnpm verify:full` les tient. Les mesures sont dans [Version Web](web-version.md).
- Rien ne change de taille pendant un glisser (pages, coins) : sinon le contenu saute sous le curseur. Les rendus lourds attendent la fin du geste.

## Interface

- Couleurs par les tokens de `styles/tokens.css`, clair et sombre : le mode sombre doit fonctionner partout.
- Une action qui s'annule ne demande pas de confirmation (règle Apple) : supprimer une page se rattrape avec ⌘Z. Supprimer un document reste confirmé, avec son nom, et le message rappelle ⌘Z.
- L'appli de bureau (`apps/desktop`) se juge comme une appli native de son système, pas comme un site dans une fenêtre : sur Mac comme l'appli Swift, sur Windows comme une appli Windows. Fenêtre, menus, raccourcis, dialogues et fichiers sont ceux du système ; rien de l'en-tête, du pied, des pages ou des liens du site n'y apparaît. Le principe et ce qu'il impose sont dans la [spec de la coque applicative](../specs/2026-10-05-desktop-shell-design.md).

## Commentaires

En anglais, et seulement pour ce que le code ne peut pas dire : une raison, une contrainte, un piège. Jamais une paraphrase de la ligne suivante. Par défaut, un changement n'ajoute aucun commentaire.

## Tests

Voir [Tests](tests.md).

## Confidentialité

- Aucun fichier ne quitte l'appareil. Le site traite tout dans le navigateur ; l'appli de bureau n'a pas de greffon HTTP et sa CSP limite `connect-src` à elle-même et à l'IPC de Tauri.
- Aucune photo réelle dans le dépôt : `fixtures-private/` est ignoré par git. Un dépôt privé reste un tiers, et peut devenir public.

## Git

- Une branche et une pull request par changement, jamais de push direct sur `main`.
- Les tests arrivent avec le changement, et la page du wiki concernée est mise à jour dans le même commit. Le reste est dans [CONTRIBUTING.md](../../CONTRIBUTING.md).
