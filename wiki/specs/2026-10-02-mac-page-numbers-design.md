# Mac — Numéros de page

_Rédigé le 2 octobre 2026. Statut : appli Swift retirée le 5 octobre 2026 (tag `mac-final`) ; à l'époque, livré dans `apps/mac`. Premier des six outils commandés le 2 octobre (ensuite : Protéger et Déverrouiller, Compresser, OCR, Noircir)._

## Objectif

Écrire un numéro sur les pages d'un PDF dans Holy PDF pour Mac, puis enregistrer une copie. PDFKit, Core Graphics et Core Text, sans nouveau moteur.

La spec est réussie quand :

- le numéro apparaît à la position choisie, telle que le lecteur voit la page, y compris sur une page pivotée ou recadrée ;
- il fait partie du contenu de la page, pas d'une annotation ;
- le texte d'origine, les liens, les champs de formulaire et les signets restent ;
- le fichier d'origine n'est jamais modifié ;
- les tests du paquet, de l'appli et des textes passent, sans avertissement du compilateur.

## Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Technique | Celle du Filigrane : PDFKit dessine la page, puis le numéro, et écrit les deux dans le contenu | Éprouvée le 2 octobre. La brique `PageOverlay` est maintenant commune au Filigrane et aux numéros |
| Réglages | Format (« 1 », « 1 / 12 », « Page 1 »), position (six : haut ou bas, gauche, centre ou droite), premier numéro, taille de 6 à 36 points, toutes les pages ou une plage | Les réglages annoncés à l'utilisateur. « Toutes sauf la couverture » se fait avec la plage. Le premier numéro et la plage se saisissent au clavier ou par les flèches : reprendre à 237 ne demande pas 236 clics |
| Numérotation | La première page de la plage porte le premier numéro. Dans « 1 / 12 », le total est le dernier numéro écrit | Une plage de la page 2 à la page 12 donne « 1 / 11 » à « 11 / 11 » |
| Aspect | Police système, noir, à 24 points du bord | Lisible et neutre. Pas de choix de police ni de couleur dans ce lot |
| Aperçu | Le numéro est dessiné sur l'aperçu de la page par la même fonction que l'export | Ce qu'on voit est ce qu'on enregistre |
| Réglages gardés | Les réglages restent d'un PDF au suivant ; la plage est ramenée aux pages du document ouvert | On numérote souvent plusieurs documents de la même façon |
| Moine | « Frère Folio » (« Brother Folio »), accessoire feuille, l'air appliqué pour ne pas doubler Frère Classeur, exporté du dessin du site | Le folio est le numéro de page des imprimeurs |

## Briques communes aux six outils

Ces six outils font tous la même chose autour de leur réglage : ouvrir un PDF, demander son mot de passe, montrer ses pages, enregistrer une copie. Deux briques neuves le font une fois pour toutes ; les outils existants ne changent pas.

- **`PDFOpenedDocument`** (`PDFCore`) : le PDF ouvert, ses pages telles que le lecteur les voit, et l'aperçu d'une page, sur lequel l'outil peut dessiner. Il refuse un PDF signé numériquement.
- **`PDFCopySession`** (appli) : l'ouverture, le mot de passe, la page à l'écran et son aperçu, puis l'enregistrement de la copie par le panneau macOS. La session est occupée pendant que le panneau est ouvert. Elle refuse d'écrire sur le fichier d'origine. L'outil lui donne la fonction qui fabrique la copie. Pour une copie qui prend des minutes, `saveCopy(to:reporting:)` montre l'étape en cours (`step`) et s'annule sans rien écrire ([spec des feuilles](2026-10-02-mac-sheets-design.md)). `survey` lit dans le document qui s'ouvre ce dont l'outil a besoin, et le garde dans `findings` ([spec des signets](2026-10-02-mac-bookmarks-design.md)). `underlay` dessine sous la page de l'aperçu, comme `overlay` dessine dessus ([spec de la superposition](2026-10-02-mac-overlay-design.md)). `showCopy` montre dans l'aperçu la copie qu'un outil s'apprête à enregistrer, à la place du document (Compresser). `CopyToolView(undo:)` branche « Annuler » du menu Édition (Noircir).
- **`CopyToolView`** (appli) : l'écran. La page et le changement de page à gauche ; à droite, le nom du fichier, les réglages de l'outil, puis le bouton d'enregistrement et son résultat. Il porte aussi l'écran de départ avec le moine, le mot de passe, le dépôt d'un fichier, la confirmation avant d'abandonner des réglages, et les menus ⌘O et ⌘E.

Un outil se réduit alors à sa fonction dans `PDFCore`, à ses réglages et à son panneau.

## Parcours

1. Ouvrir ou déposer un PDF. Un fichier protégé demande son mot de passe.
2. Régler le format, la position, le premier numéro, la taille et les pages. L'aperçu se met à jour, et on change de page pour vérifier.
3. « Enregistrer une copie numérotée… » propose `nom-numéroté.pdf`.

## Limites connues

- Celles de PDFKit, décrites dans la spec du Filigrane : écriture lente et fichiers plus lourds sur certains PDF.
- Le numéro peut recouvrir un contenu qui se trouve déjà à cet endroit : l'aperçu le montre avant l'enregistrement.
- La copie d'un PDF protégé s'ouvre sans mot de passe, et l'écran le dit.
- Pas d'annulation des réglages (⌘Z) dans cet outil : chaque réglage se remet à la main.

## Tests

| Niveau | Quoi | Où |
|---|---|---|
| Moteur | Le texte de chaque format, le premier numéro et la plage ; le numéro dans le contenu des pages de la plage seulement ; annotations et signets gardés ; la position sous les quatre rotations et avec un recadrage ; réglages hors du document et PDF signé refusés ; copie d'un PDF protégé | `PDFPageNumberingTests` |
| Document ouvert | Tailles des pages, aperçu, dessin par-dessus, mot de passe, refus | `PDFOpenedDocumentTests` |
| Session commune | Ouverture, mot de passe, aperçu de la page à l'écran, dessin de l'outil, copie et refus de l'original, échec d'une copie, attente pendant le panneau, nouveau document | `PDFCopySessionTests` |
| Outil | Réglages par défaut, bornes, copie numérotée, plage ramenée à un document plus court, numéro sur l'aperçu | `PageNumberSessionTests` |
| Écrans | Départ et atelier, en clair, en sombre et en anglais | `PageNumberSnapshots` |
| Textes | Tous traduits, sans tutoiement | `check-strings.py` |
