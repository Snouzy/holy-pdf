# Web — Numéroter les pages d'un PDF

_Rédigé et livré le 2 octobre 2026. Mêmes réglages que l'appli Mac ([spec Mac](2026-10-02-mac-page-numbers-design.md))._

## Ce que fait l'outil

Frère Folio (`/fr/numeroter-pdf`, `/en/page-numbers-pdf`) écrit un numéro sur les pages d'un PDF, un fichier à la fois :

- format « 1 », « 1 / 12 » ou « Page 1 » ;
- six positions, en haut ou en bas, à gauche, au centre ou à droite, à 24 points du bord ;
- premier numéro de 0 à 9 999, taille de 6 à 36 points ;
- toutes les pages, ou une plage. La première page de la plage porte le premier numéro ; dans « 1 / 12 », le total est le dernier numéro écrit.

## Moteur

Une opération `numbers` de la requête `transform` (`engine/numbers.ts`). Le numéro est un vrai texte en Helvetica, la police standard de PDFium, ajouté au contenu de la page : il reste sélectionnable, et le texte d'origine aussi. Ses axes suivent la page telle que le lecteur la voit (`pageFrame`, partagé avec Signer) : le numéro est à l'endroit et au bon coin sur une page pivotée ou recadrée. La fin de la plage est ramenée à la dernière page.

## Limites

- Pas d'aperçu en direct : on voit le résultat après la numérotation, dans le PDF téléchargé.
- Un fichier à la fois, pour que la plage se règle sur les pages du document ouvert.

## Tests

- Moteur (`tests/engine/numbers.test.ts`) : texte de chaque format, premier numéro et plage lus par pdf.js ; position relue par pdf.js en coordonnées de la page affichée, sous les quatre rotations ; plage ramenée à la dernière page.
- Navigateur (`tests/e2e/page-numbers.spec.ts`) : format, coin et plage choisis avant que le PDF ait fini de s'ouvrir, puis copie relue par pdf.js.
