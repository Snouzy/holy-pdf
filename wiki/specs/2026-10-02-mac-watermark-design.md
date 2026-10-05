# Mac — Filigrane

_Rédigé le 2 octobre 2026. Statut : appli Swift retirée le 5 octobre 2026 (tag `mac-final`) ; à l'époque, livré dans `apps/mac`._

## Objectif

Poser un filigrane sur un PDF dans Holy PDF pour Mac : un texte (« Confidentiel », « Brouillon ») ou une image (un logo), avec son opacité, son angle et les pages concernées, puis enregistrer une copie. Aucun serveur, aucun compte, aucun nouveau moteur : PDFKit, Core Graphics, Core Text et ImageIO.

La spec est réussie quand :

- le filigrane apparaît sur les pages choisies, à l'endroit, à la taille, à l'angle et à l'opacité vus à l'écran, y compris sur une page pivotée ou recadrée ;
- il fait partie du contenu de la page : un lecteur PDF ne le propose pas comme annotation à supprimer ;
- le texte d'origine reste sélectionnable, et les champs de formulaire, les liens et les signets restent ;
- le fichier d'origine n'est jamais modifié ;
- les tests du paquet, de l'appli et des textes passent, sans avertissement du compilateur.

## Portée

**Dans la spec :** un filigrane par document, texte ou image ; couleur du texte ; opacité ; angle ; position et taille à la souris ; toutes les pages ou une plage ; enregistrement d'une copie ; Frère Tampon sur l'accueil et sur l'écran de départ ; textes français et anglais.

**Hors spec :** la mosaïque (filigrane répété sur la page), plusieurs filigranes à la fois, le choix de la police, le filigrane sous le contenu, une liste libre de pages (« 1, 3, 5-8 »), le retrait d'un filigrane existant, les numéros de page.

## Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Technique | Une sous-classe de `PDFPage` dessine le filigrane après le contenu de la page. PDFKit l'écrit dans le contenu à l'export | Essai du 2 octobre : le filigrane n'est plus une annotation, et 23 champs sur 23, 113 liens sur 113 et les signets restent. C'est la technique des exemples d'Apple |
| Écarté | Une annotation, comme la signature | Elle se sélectionne et se supprime dans n'importe quel lecteur : ce n'est pas un filigrane |
| Écarté | L'option d'écriture `burnInAnnotationsOption` | Elle aplatit toutes les annotations : les champs de formulaire du document disparaissent (essai : 24 annotations, puis 0) |
| Placement | À la souris, comme la signature : déplacer, tirer le coin. La même position, en proportion de la page visible, vaut pour toutes les pages choisies | Choix de l'auteur. Réutilise le geste de Signer |
| Plusieurs filigranes (3 octobre 2026) | « En poser un autre » ajoute un filigrane comme le filigrane sélectionné, au milieu de la page, et le sélectionne ; un clic sur un filigrane de la page le sélectionne, et le panneau édite celui-là (texte, couleur, opacité, angle, pages). « Retirer de la page » retire le filigrane sélectionné, jamais le dernier. Un filigrane vidé de son texte part de lui-même quand un autre est sélectionné, et tant qu'il est sélectionné rien ne s'enregistre. La copie d'un filigrane posé sur certaines pages s'étend jusqu'à la page affichée ; changer de page sélectionne un filigrane de cette page. Cinquante au plus. Un pas d'annulation reprend toute la disposition | Demande de l'auteur le 3 octobre : plusieurs « CONFIDENTIEL » sur une page, posés librement comme les signatures sur le web. Chaque filigrane est indépendant : changer le texte de l'un ne change pas les autres |
| Pages | Toutes, ou une plage « de la page … à la page … » | Choix de l'auteur. Deux champs, pas de syntaxe à expliquer. Depuis le 2 octobre au soir, chaque champ se tape ou se règle aux flèches (`NumberField`, partagé avec les Numéros de page) : sur 300 pages, cliquer une flèche 200 fois n'est pas un réglage |
| Texte | Police système en gras, une ligne, 80 caractères au plus. Il devient du vrai texte dans la page | Simple, lisible, et la recherche le trouve |
| Image | PNG ou JPEG, mêmes limites que la signature (10 Mio, 16 Mpx, ramenée à 1 Mpx). La transparence d'un PNG est gardée | Réutilise `SignatureImage`. Essai : une image sur 14 pages n'est écrite qu'une fois dans le fichier (+257 Ko pour un logo de 309 Ko) |
| Aperçu | Chaque filigrane est rendu une fois en image par le même code que l'export, puis posé sur l'aperçu de la page ; deux filigranes de même aspect partagent leur image, et un filigrane garde son dernier dessin pendant qu'un curseur bouge plus vite que le dessin (relecture du 3 octobre). À l'export, une image posée cinquante fois est décodée une fois. Aucun calcul PDF pendant un geste | Ce qu'on voit est ce qu'on exporte, et le geste reste fluide |
| Moine | « Frère Tampon » (« Brother Stamp »), accessoire tampon, catégorie Modifier, exporté du dessin du site : une ligne de plus dans `export-monk-assets.mjs` et dans `MonkAssetTests` | Le site prévoit déjà cet accessoire pour l'outil `watermark` |
| Moteur | PDFKit, comme Signer, Fusionner et Organiser | Choix de l'auteur : pas de nouveau moteur |

## Parcours

1. **Ouvrir** ou déposer un PDF. Un fichier protégé demande son mot de passe. Un PDF signé numériquement est refusé : le filigrane invaliderait sa signature.
2. **Régler**, dans le panneau de droite, de haut en bas :
   - Texte ou Image (bascule) ;
   - le texte et sa couleur, ou « Choisir une image… » ;
   - Opacité : curseur de 10 à 100 %, 30 % au départ ;
   - Angle : curseur de −90° à 90°, 45° au départ pour un texte, 0° pour une image ;
   - Pages : « Toutes les pages » ou « De la page … à la page … ».
3. **Placer** : la page s'affiche à gauche, le filigrane par-dessus, au centre au départ. On le glisse pour le déplacer et on tire son coin pour changer sa taille. Les boutons page précédente et page suivante montrent le résultat sur les autres pages ; une page hors de la plage s'affiche sans filigrane.
4. **Enregistrer une copie…** : le panneau macOS propose `nom-filigrane.pdf` (`nom-watermarked.pdf` en anglais). L'écran dit ensuite quel fichier est enregistré et propose « Afficher dans le Finder ».

⌘O ouvre, ⌘E enregistre, ⌘Z annule le dernier réglage ou déplacement. Ouvrir un autre PDF ou quitter avec un filigrane non enregistré demande confirmation, comme dans Signer.

## Moteur

Dans `PDFCore`, sans AppKit ni UIKit.

- `Watermark` : le contenu (texte et couleur, ou image), le centre et la largeur en proportion de la page visible (origine en haut à gauche), l'angle, l'opacité, la plage de pages.
- `PDFWatermarkDocument`, un acteur : il ouvre le PDF (mot de passe, refus des signatures numériques), donne les tailles de pages et l'aperçu d'une page, et écrit la copie filigranée. Chaque export repart des données d'origine : rien ne s'accumule.
- Le dessin vit dans une seule fonction, utilisée par l'export et par l'image d'aperçu du filigrane.
- **Coordonnées** : la position est exprimée dans la page telle qu'elle s'affiche, après CropBox et rotation, comme les placements de Signer. La conversion passe par la même géométrie (`SignatureGeometry`, renommée pour servir aux deux outils).
- **Commun avec les autres outils** : l'ouverture, le déverrouillage, le contrôle des signatures numériques, la mesure des pages et le rendu d'un aperçu sont les briques partagées de `PDFCore`, mises en commun le 2 octobre pour Signer, Fusionner et Organiser. Les erreurs sont celles de `PDFToolError`. Côté appli, la lecture du fichier, la protection de l'original (`FileIdentity`), le panneau d'enregistrement et le menu de l'outil (`ToolMenu`) sont aussi partagés.

Copie d'un PDF protégé : elle s'ouvre sans mot de passe, et l'écran le dit, comme dans Signer.

## Limites connues

- **Lenteur de PDFKit sur certains fichiers.** L'écriture PDFKit réencode certains contenus. Mesuré le 1er octobre : un document de 142 pages riche en polices met environ 2 minutes et passe de 3 à 13 Mo ; un livre scanné en JBIG2 et JPEG 2000 passe de 17 à 468 Mo. Les PDF ordinaires et les scans JPEG ne sont pas touchés (0,1 à 0,3 s, poids presque égal). La limite vaut aussi pour Signer, Fusionner et Organiser. L'écran montre une progression et permet d'attendre ; il ne promet pas de durée.
- Le filigrane est dessiné par-dessus le contenu. Un lecteur ne le supprime pas d'un clic, mais un éditeur de PDF peut toujours retirer un élément d'une page : ce n'est pas une protection.
- Les balises d'accessibilité et les profils d'archivage (PDF/A) du document d'origine ne sont pas garantis après l'écriture PDFKit.

## Performance

- Ouverture, aperçu et export hors de l'acteur principal.
- Un aperçu de page à la fois, 1 600 px au plus sur le grand côté.
- Le filigrane est rendu en image une fois par changement de réglage, jamais pendant un glisser.
- PDF de 256 Mio au plus, comme Signer.
- Repères sur un PDF de synthèse de 20 pages : aperçu en moins de 1 s, export en moins de 3 s.

## Tests

| Niveau | Quoi | Où |
|---|---|---|
| Moteur | Le filigrane tombe au bon endroit sous les quatre rotations et avec une CropBox ; la plage de pages est respectée ; l'opacité et l'angle changent les pixels attendus ; le texte du filigrane est dans le contenu et pas dans les annotations ; texte d'origine, liens, champs et signets gardés ; l'original intact ; deux exports de suite donnent un seul filigrane ; une image sur 20 pages pèse moins de deux fois l'image | `PDFCoreTests` |
| Session | Réglages, déplacement, taille, plage invalide refusée, annulation, export, confirmation avant d'abandonner | `PDFToolboxTests` |
| Marque | Frère Tampon est dans le catalogue, en clair et en sombre, à jour avec le dessin du site | `PDFToolboxTests`, script d'export |
| Écrans | Captures de l'écran de départ et de l'atelier, en clair et en sombre | `PDFToolboxTests` |
| Textes | Tous traduits, sans tutoiement | `check-strings.py` |
| À la main | Glisser et redimensionner le filigrane à la souris ; ouvrir le résultat dans Aperçu et vérifier qu'aucune annotation ne se sélectionne | `wiki/development/tests.md` |
