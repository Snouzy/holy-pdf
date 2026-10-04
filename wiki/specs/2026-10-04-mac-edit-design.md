# Mac — Modifier un PDF (étape A : ajouts dans la page)

_Rédigé le 4 octobre 2026. Découpage choisi le même jour : un seul outil « Modifier un PDF », livré en trois étapes. A (cette spec) : ajouts écrits dans la page, et images qu'on recadre, pivote et retourne. B : annotations (notes, soulignement, texte barré, tampons, commentaires avec auteur) et liens, écrits en annotations. C : modifier le texte d'origine, déplacer ou supprimer les objets d'origine, après un essai de PDFium natif. Le site a l'outil depuis le 4 octobre ([spec web](2026-10-04-web-edit-design.md)) ; le Mac reprend ses règles et va plus loin sur le texte et les images._

Frère Scribe (« Brother Scribe »), la plume, concentré, catégorie Modifier, ajoute du texte, des images, des formes, des traits à main levée et du surlignage sur les pages d'un PDF, puis enregistre une copie.

## Objectif

La spec est réussie quand :

- on ajoute sur la page affichée : texte, image, rectangle, ellipse, ligne, flèche, crayon, surligneur ;
- un ajout se sélectionne, se déplace (souris ou flèches du clavier), se redimensionne par ses poignées, change de couleur ou de taille, passe devant ou derrière, se supprime ;
- une image posée se recadre, pivote d'un quart de tour et se retourne ;
- annuler et rétablir couvrent chaque changement ;
- la copie montre les ajouts à la même place que l'aperçu, page pivotée comprise ; le texte ajouté reste du texte qu'on sélectionne et qu'on cherche, dans n'importe quel alphabet ;
- rien d'autre ne change dans le fichier : liens, signets, champs et annotations d'origine restent.

## Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Écriture | Les ajouts deviennent du contenu de la page, avec la technique de Filigrane : une page qui dessine par-dessus son contenu (`PageOverlay`) | Choix de l'auteur. Rendu identique dans tous les lecteurs ; liens, signets et champs gardés, comme le prouve Filigrane |
| Coordonnées | Rectangles et points normalisés dans la page telle qu'on la voit (CropBox, rotation), origine en haut à gauche, convertis au même endroit que Signer et Filigrane (`PageGeometry`) | Une seule conversion, déjà testée sur les quatre rotations |
| Texte | Dessiné par Core Text dans la page : police embarquée en sous-ensemble par Quartz, toutes les lettres passent (« ș », grec, cyrillique, émoji). Helvetica, Times, Courier, en normal ou gras ; taille 8 à 96 pt, au panneau ou en tirant le coin du texte ; plusieurs lignes (Entrée) ; pas de retour à la ligne automatique | Le Mac embarque la police : pas de limite WinAnsi comme sur le site. Mêmes polices et mêmes tailles que le site |
| Saisie du texte | Un champ de texte natif posé sur la page, à la place exacte du texte final (même ligne de base, même police, même taille) | Le texte ne saute pas quand on quitte le champ |
| Images | Glisser depuis le Finder sur la page, coller (⌘V) ou « Choisir une image… ». Tout ce qu'ImageIO lit (JPEG, PNG, HEIC, WebP, TIFF, GIF en sa première image). Orientation de l'appareil photo appliquée ; ramenée à 2 400 px de côté au plus ; JPEG sans transparence, PNG sinon. 50 Mio et 50 Mpx au plus à l'entrée : une photo d'iPhone de 24 Mpx passe, et ImageIO la réduit en la lisant | Une photo d'iPhone ne gonfle pas le fichier et arrive à l'endroit |
| Recadrer | Mode recadrage sur l'image sélectionnée, quatre poignées. Les pixels coupés quittent le fichier | Recadrer pour cacher un passage ne doit pas laisser le passage dans le PDF |
| Pivoter, retourner | Quart de tour à droite, retournement horizontal ou vertical, appliqués au dessin | Rien ne se perd, le fichier ne grossit pas |
| Image posée plusieurs fois | Une seule copie dans le fichier quand l'image et son recadrage sont les mêmes | Retiré des limites du site, à la demande de l'auteur |
| Formes | Rectangle et ellipse, en contour ou pleins, d'une couleur ; ligne, flèche, crayon ; épaisseur fine, moyenne ou épaisse (1, 2,5 et 5 pt) | Comme le site |
| Surligneur | Rectangle tiré à la souris, couleur en mode de fusion « produit » (Multiply) | Le texte reste lisible dessous |
| Couleurs | Noir, bleu, rouge, vert, jaune, blanc | Comme le site ; le blanc cache à l'œil sans rien retirer (Noircir retire) |
| Outils | Après un texte, une image ou une forme, l'outil Sélection revient. Crayon et surligneur restent actifs. Échap revient à la Sélection, Suppr efface l'ajout choisi, les flèches le déplacent d'un point (dix avec Maj) | Habitudes du Mac |
| Annuler | Historique de l'éditeur : ⌘Z, ⇧⌘Z, et les entrées du menu Édition. Une saisie compte pour un pas, aucun si rien n'a changé | Comme le site |
| Enregistrement | « Enregistrer une copie », offert dès le premier ajout. Nom `nom-modifié.pdf` (« edited » en anglais). L'original ne change jamais. Un texte vide disparaît quand on le quitte ; un clic du crayon sans trait ne laisse rien | Comme les autres outils Mac |
| PDF signé | Refusé avec le message des autres outils (`rejectDigitalSignatures`) | Toute réécriture casse la signature |
| PDF protégé | Ouvert avec son mot de passe ; la copie s'ouvre sans mot de passe, et l'écran le dit | Comme Filigrane et Signer : PDFKit réécrit le fichier sans son chiffrement |
| Moine | « Frère Scribe » / « Brother Scribe », la plume, concentré, catégorie Modifier, dessin exporté du site | Le nom que le site a donné à Modifier le 4 octobre ; PDF en JPG et PDF en images gardent Frère Enlumineur. Sur le Mac, la plume en joie est déjà celle de PDF en Word |

## Parcours

1. Ouvrir ou déposer un PDF : la première page s'affiche, la palette est dans le panneau.
2. Choisir un outil, puis cliquer ou tirer sur la page. Le texte se tape directement sur la page ; une image se dépose, se colle ou se choisit.
3. Sélectionner un ajout pour le déplacer, le redimensionner, changer son style, le passer devant ou derrière, le supprimer ; recadrer, pivoter ou retourner une image.
4. « Enregistrer une copie » propose `nom-modifié.pdf`.

## Écran

Même disposition que Signer : la page à gauche avec son pas à pas, le panneau à droite (320 pt). Le panneau montre, de haut en bas :

- la palette : Sélection, Texte, Image (ouvre le choix d'une image), Rectangle, Ellipse, Ligne, Flèche, Crayon, Surligneur ;
- les réglages de l'outil ou de l'ajout choisi : couleur, épaisseur, contour ou plein, police, gras, taille ;
- pour une image : Recadrer, Pivoter, Retourner ;
- Devant, Derrière, Supprimer ;
- « Enregistrer une copie », avec l'état d'enregistrement des autres outils.

Écran de départ, mot de passe, refus et « Afficher dans le Finder » : ceux des autres outils.

## Moteur

Dans `Packages/Core` (`PDFCore`), sans AppKit :

- un modèle d'ajout (`EditItem`) : texte, image, forme, trait, surlignage ; page, géométrie normalisée, style, ordre ;
- une fonction d'écriture qui part toujours des octets d'origine, dessine les ajouts de chaque page par-dessus son contenu dans l'ordre choisi, et rend les octets de la copie ;
- un rendu d'aperçu d'une page avec ses ajouts, fait par le même code que l'écriture, pour que l'aperçu et la copie ne divergent pas.

## Limites connues (étape A)

- Le contenu d'origine ne change pas (étape C).
- Pas d'annotation, de commentaire, de tampon ni de lien (étape B).
- Pas de rotation libre d'un ajout, pas de zoom, pas de retour à la ligne automatique, pas d'alignement, pas de couleur par mot.
- Trois polices et six couleurs.
- Une réécriture par PDFKit peut être lente ou lourde sur certains fichiers (limite connue de Filigrane).

## Tests

- Moteur (`PDFCoreTests`) :
  - texte relu par PDFKit à sa place, sur les quatre rotations et avec une CropBox décalée ;
  - texte hors latin (« ș », « Ω », « Ж », un émoji) présent dans la copie et cherchable ;
  - image, formes, flèche, crayon et surligneur vérifiés en pixels ;
  - recadrage : les pixels coupés absents du fichier ; pivoter et retourner vérifiés en pixels ;
  - même image posée deux fois : un seul flux image dans la copie ;
  - ordre devant et derrière ;
  - liens, signets, champs et annotations d'origine gardés ;
  - PDF signé refusé, PDF protégé ouvert et copie sans mot de passe.
- Session (`EditSessionTests`) : styles, saisie comptée pour un pas, déplacement, ordre, images, recadrage, annuler et rétablir.
- Toile (`EditCanvasTests`) : glisser, poignées, bord de page, flèches, Suppr, Échap, saisie du texte sur la page, coller.
- Captures (`EditSnapshots`) : départ, atelier et recadrage, en clair, en sombre et en anglais.
- `check-strings.py`, la liste des moines de `MonkAssetTests`, le script d'export des moines, et les tests du site qui gardent à jour les copies du Mac (`macAssets`, `macSearch`).
