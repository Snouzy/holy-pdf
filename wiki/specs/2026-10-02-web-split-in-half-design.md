# Web — Couper les pages en deux

_Rédigé et livré le 2 octobre 2026._

Frère Massicot (`/fr/couper-pages-en-deux`, `/en/split-pages-in-half`) coupe chaque page d'un ou plusieurs PDF en deux pages qui se suivent : gauche puis droite (par défaut, pour un livre scanné ouvert), ou haut puis bas.

## Moteur

Opération `halves` de la requête `transform` (`engine/sheets.ts`) : un document neuf importe chaque page deux fois en un seul appel (ressources partagées copiées une fois), puis chaque copie reçoit pour MediaBox et CropBox la moitié qui lui revient. La moitié se calcule sur la page telle que le lecteur la voit (`pageFrame`) : une page pivotée est coupée dans le sens de lecture. Les pages restent vectorielles ; un PDF signé est accepté, comme pour Pages par feuille.

## Limite

Les annotations et les champs de formulaire de l'original ne suivent pas.

## Tests

- Moteur (`tests/engine/halves.test.ts`) : taille de chaque moitié et mot visible dans chacune, relus par pdf.js, pour les deux coupes.
- Navigateur (`tests/e2e/split-in-half.spec.ts`) : 2 pages coupées haut et bas donnent 4 pages à l'italienne.
