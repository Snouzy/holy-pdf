# Mac — Pages par feuille, Couper les pages en deux, Pixelliser

_Rédigé le 2 octobre 2026. Statut : livré dans `apps/mac`. Demandé par l'auteur le 2 octobre, après [Aplatir](2026-10-02-mac-flatten-design.md) : le site a les trois outils depuis le même jour ([pages par feuille](2026-10-02-web-pages-per-sheet-design.md), [couper en deux](2026-10-02-web-split-in-half-design.md), [pixelliser](2026-10-02-web-pixelize-design.md))._

## Objectif

Trois outils d'un seul réglage dans Holy PDF pour Mac, avec les règles du site et PDFKit seulement :

- **Pages par feuille** range 2, 4, 6, 9 ou 16 pages sur chaque feuille A4, dans l'ordre de lecture ;
- **Couper les pages en deux** fait de chaque page deux pages qui se suivent : gauche puis droite, ou haut puis bas ;
- **Pixelliser** change chaque page en image, à 150 ou 300 points par pouce : le texte ne se sélectionne plus.

La spec est réussie quand :

- les feuilles sont en A4, à l'italienne pour 2 et 6 pages, et le texte des pages y reste du texte ;
- la coupe suit la page telle que le lecteur la voit, même pivotée, et un lien reste sur la moitié qui le montre ;
- la copie pixellisée n'a plus de texte, et chaque page garde sa taille affichée ;
- un long travail s'annule sans rien écrire, et dit la page en cours quand le moteur la connaît (feuilles, pixelliser) ;
- le fichier d'origine n'est jamais modifié ;
- les tests du paquet, de l'appli et des textes passent, sans avertissement du compilateur.

## Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Feuilles | `PDFSheets.arranged` dessine chaque page dans sa case, à travers un contexte PDF : la page est ajustée et centrée, jamais rognée | Sonde du 2 octobre : le texte reste du texte, 15 pages en 0,2 s, taille inchangée |
| Sens de la feuille | À l'italienne pour 2 et 6 (2 × 1, 3 × 2), à la française pour 4, 9 et 16 | La règle du site : une page en portrait garde une case en portrait |
| Coupe | `PDFPageHalves.halved` copie chaque page et donne à chaque copie la moitié de la zone visible, calculée dans le repère du lecteur puis ramenée dans celui de la page | Le document reste le même : les signets restent, le texte reste du texte. Le site, lui, bâtit un document neuf et perd annotations et champs |
| Liens et champs coupés | Une annotation reste sur la moitié qu'elle touche ; à cheval sur la coupe, elle reste sur les deux. La bulle d'un commentaire suit son commentaire, où qu'elle soit posée | Sans ce tri, chaque lien existerait deux fois, dont une fois hors de la page |
| PDF signé | Refusé par Couper en deux (la copie garde le champ de signature, qui ne serait plus valide). Accepté par Pages par feuille et Pixelliser : le document neuf n'a aucun champ de signature | Même raison que sur le site pour les deux derniers |
| Pixelliser | `PDFPixelizing.pixelized` reprend le rendu de PDF en images (150 ppp, ou 300 ppp), et pose chaque JPEG sur une page neuve de la taille affichée, sans rotation | Un seul rendu à maintenir. À 300 ppp, la qualité JPEG est celle de PDF en images (0,92) et non le 0,85 du site : 5 % de poids en plus sur la sonde |
| Écriture | Les feuilles et la copie pixellisée s'écrivent dans un fichier temporaire, relu sans le charger en mémoire | Sonde : 142 pages à 300 ppp donnent 312 Mo ; la pointe de mémoire passe de 930 à 520 Mo |
| Progression et annulation | L'enregistrement passe par `saveCopy(to:reporting:)` de la session commune : l'écran dit « Page 3 sur 142… » et offre « Annuler ». Une copie finie après l'annulation n'est pas écrite | Les trois outils peuvent durer des minutes. La lecture de texte et PDF en images reprennent la même brique, qui remplace leurs deux copies du même code |
| Aperçu | Couper en deux trace la coupe en pointillés sur la page. Pages par feuille montre la feuille et ses cases numérotées | Le sens de la coupe et l'ordre des cases se voient avant d'enregistrer |
| Moines | Frère Mosaïque (feuille), Frère Massicot (ciseaux), Frère Vitrail (cadre) : les noms et les accessoires du site, avec un autre visage quand un moine de l'accueil a déjà la même pose | Sur le site, chaque outil a sa page ; sur l'accueil du Mac, deux cartes voisines ne doivent pas se confondre |

## Parcours

1. Ouvrir ou déposer un PDF. Un fichier protégé demande son mot de passe.
2. Choisir : le nombre de pages par feuille, le sens de la coupe, ou la résolution.
3. Enregistrer : `nom-par-feuille.pdf`, `nom-coupe.pdf` ou `nom-pixellise.pdf`. Changer le réglage après coup efface la mention « enregistré ».

## Limites connues

- Feuille A4 seulement, sans marge ni filet entre les cases.
- Sur les feuilles, les liens et les signets ne suivent pas ; les champs et les annotations y sont dessinés, plus modifiables.
- Couper en deux : un signet ou un lien qui visait une page mène à sa première moitié.
- Couper en deux ne dit pas la page en cours : presque tout le temps passe dans l'écriture de PDFKit, qui ne rend pas compte. « Annuler » reste offert.
- Chaque moitié garde le contenu entier de la page, masqué par son cadre : un autre lecteur peut encore y trouver le texte de l'autre moitié. Le site fait de même.
- Sur les feuilles, le texte qu'un cadre masquait (page rognée, moitié d'une page coupée) est dessiné hors de vue, mais se trouve et se sélectionne encore : PDFKit ne retire pas ce qui dépasse d'un cadre. Relecture du 2 octobre.
- Pixelliser n'est pas une protection : un logiciel de reconnaissance de texte relit une image. L'écran le dit.
- Une image ne dépasse pas 6 000 pixels de côté : au-delà, la résolution baisse.
- Une annulation qui tombe pendant l'écriture du fichier (moins d'une seconde) arrive trop tard : la copie est écrite.
- Les limites de PDFKit s'appliquent (spec du Filigrane). Mesuré le 2 octobre : la publication IRS de 142 pages met 92 s pour les feuilles et 197 s pour la coupe ; le livre scanné en JBIG2 passe de 17 à 468 Mo par les deux outils. Les fichiers courants prennent moins de 2 s.
- La copie d'un PDF protégé s'ouvre sans mot de passe, et l'écran le dit.

## Tests

| Niveau | Quoi | Où |
|---|---|---|
| Moteur | Feuilles : nombre et sens pour les cinq choix, ordre de lecture relu aux pixels, texte gardé, page pivotée, progression, annulation, PDF signé accepté. Coupe : taille et mots de chaque moitié pour les deux sens, pages pivotées comparées aux pixels, lien sur la bonne moitié, bulle d'un commentaire gardée avec lui, signet gardé, trait de coupe, PDF signé refusé. Pixelliser : aucun texte, tailles gardées, 150 ppp, même aspect, PDF signé accepté | `PDFSheetsTests`, `PDFPageHalvesTests`, `PDFPixelizingTests` |
| Session commune | Étapes affichées puis copie écrite ; original jamais remplacé ; copie annulée jamais écrite | `PDFCopySessionTests` |
| Outils | Copie enregistrée, original intact, réglage changé qui efface « enregistré », coupe montrée sur l'aperçu | `SheetsSessionTests`, `HalvesSessionTests`, `PixelizeSessionTests` |
| Écrans | Pour chaque outil : départ, prêt en clair, en sombre et en anglais, copie enregistrée ; six pages par feuille ; coupe haut et bas | `SheetToolsSnapshots` |
| Fichiers réels | Cinq PDF de `fixtures-private/pdfs` : feuilles de 2 et de 9, moitiés, copie pixellisée à 300 ppp, avec durées, tailles et pointe de mémoire | Sonde du 2 octobre, non gardée |
| Textes | Tous traduits, sans tutoiement | `check-strings.py` |
