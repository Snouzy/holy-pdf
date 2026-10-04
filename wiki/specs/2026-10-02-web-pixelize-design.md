# Web — Pixelliser un PDF

_Rédigé et livré le 2 octobre 2026._

Frère Vitrail (`/fr/pixelliser-pdf`, `/en/pixelize-pdf`) change chaque page d'un ou plusieurs PDF en image JPEG, à 150 ppp (normale) ou 300 ppp (élevée). Le texte ne se sélectionne plus et ne se copie plus. Ce n'est pas une protection : un logiciel de reconnaissance de texte lit toujours une image, et la FAQ le dit.

## Moteur

`engine/pixelize.ts`, appelé par la requête `transform` : chaque page est rendue telle que le lecteur la voit (`renderPage`), encodée en JPEG (qualité 0,85) par l'encodeur du Worker, puis posée sur une page neuve de même taille, sans rotation. L'encodage étant asynchrone, cette opération ne passe pas par `transformPdf`, qui reste synchrone.

## Tests

- Moteur (`tests/engine/pixelize.test.ts`) : aucune ligne de texte, une image par page, tailles affichées gardées (une page tournée sort à l'italienne, sans rotation).
- Navigateur (`tests/e2e/pixelize.spec.ts`) : copie sans texte, au format A4.
