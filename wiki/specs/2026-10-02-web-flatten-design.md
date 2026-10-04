# Web — Aplatir un PDF

_Rédigé et livré le 2 octobre 2026._

Frère Rouleau (`/fr/aplatir-pdf`, `/en/flatten-pdf`) fait passer les champs de formulaire remplis et les annotations dans le contenu des pages d'un ou plusieurs PDF : ils restent visibles et ne se modifient plus. Pas de réglage.

## Moteur

Opération `flatten` de la requête `transform` (`engine/flatten.ts`) : `FPDFPage_Flatten` sur chaque page d'une copie, avec l'apparence affichée à l'écran (et non celle d'impression). Le texte des pages reste du texte. Un PDF signé numériquement est refusé, comme pour les autres opérations.

## Limite

Un champ sans apparence enregistrée (`/AP`) n'a rien à dessiner : il disparaît sans laisser de trace dans la page.

## Tests

- Moteur (`tests/engine/flatten.test.ts`) : un champ rempli devient du texte de la page, relu par pdf.js, et l'annotation disparaît.
- Navigateur (`tests/e2e/flatten.spec.ts`) : copie `<nom>-flattened.pdf` dont le texte reste lisible.
