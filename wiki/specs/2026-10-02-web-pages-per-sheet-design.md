# Web — Pages par feuille

_Rédigé et livré le 2 octobre 2026._

Frère Mosaïque (`/fr/pages-par-feuille`, `/en/pages-per-sheet`) range 2, 4, 6, 9 ou 16 pages d'un ou plusieurs PDF sur chaque feuille A4, dans l'ordre de lecture. Avec 2 ou 6 pages, la feuille est à l'italienne (2 × 1, 3 × 2) pour que chaque page garde une case en portrait ; avec 4, 9 ou 16, elle est à la française (2 × 2, 3 × 3, 4 × 4).

## Moteur

Opération `nup` de la requête `transform` (`engine/sheets.ts`) : `FPDF_ImportNPagesToOne` compose un document neuf, enregistré puis fermé. Les pages y sont des objets réduits, pas des images : le texte reste sélectionnable. Le document neuf ne porte aucun champ de signature : un PDF signé est accepté, sa signature n'est ni invalidée ni recopiée.

## Limites

Feuille A4 seulement. Les annotations et les champs de formulaire de l'original ne passent pas sur les feuilles.

## Tests

- Moteur (`tests/engine/nup.test.ts`) : 4 pages par feuille A4 portrait, 2 par feuille à l'italienne, ordre de lecture relu par pdf.js.
- Navigateur (`tests/e2e/pages-per-sheet.spec.ts`) : 3 pages sur 2 feuilles à l'italienne.
