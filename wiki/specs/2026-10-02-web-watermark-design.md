# Web — Ajouter un filigrane

_Rédigé et livré le 2 octobre 2026. Première version, texte seul ; l'appli Mac fait aussi l'image et le placement à la souris ([spec Mac](2026-10-02-mac-watermark-design.md))._

## Ce que fait l'outil

Frère Tampon (`/fr/filigrane-pdf`, `/en/watermark-pdf`) écrit un texte en travers des pages d'un ou plusieurs PDF :

- texte de 80 caractères au plus, « CONFIDENTIEL » (« CONFIDENTIAL ») si le champ reste vide ;
- couleur : rouge tampon, gris ou bleu ;
- opacité de 10 à 100 % (30 % au départ), angle de −90° à 90° (45° au départ), largeur de 20 à 100 % de la page (60 % au départ) ;
- toutes les pages, ou une plage, avec la même brique que Numéroter.

Le filigrane est centré sur la page telle que le lecteur la voit, y compris sur une page pivotée.

## Moteur

Opération `watermark` de la requête `transform`, dans `engine/pageText.ts`, à côté des numéros de page : un texte Helvetica-Bold dans le contenu de la page, mis à l'échelle pour couvrir la largeur choisie, tourné dans le repère de la page affichée. L'opacité passe par l'alpha de remplissage (`FPDFPageObj_SetFillColor`) : PDFium écrit un état graphique `/ca`.

## Limites

- Texte seul : ni image, ni placement à la souris dans cette version.
- Helvetica, police standard de PDFium, n'écrit que le Latin-1. Un texte avec un émoji ou un alphabet non latin est signalé, et le bouton reste grisé.
- Pas d'aperçu en direct.

## Tests

- Moteur (`tests/engine/watermark.test.ts`) : texte sur la plage seulement, angle relu dans la matrice du texte par pdf.js, transparence mesurée sur les pixels du rendu (rouge à 30 % sur blanc, aucun pixel du rouge opaque), largeur relue par pdf.js.
- Navigateur (`tests/e2e/watermark.spec.ts`) : texte accentué relu par pdf.js, émoji refusé, texte par défaut quand le champ est vide.
