# Mac — Images en PDF et PDF en images

_Rédigé le 2 octobre 2026. Statut : livré dans `apps/mac`. Demandé par l'auteur le 2 octobre pour finir la phase 1 de la [feuille de route](../product/roadmap.md), avant l'accueil par catégories._

## Objectif

Deux outils dans Holy PDF pour Mac, avec les règles du site (`jpg-to-pdf` et `pdf-to-jpg`). **Images en PDF** relie des images en un PDF, une page par image. **PDF en images** écrit une image JPG par page dans un dossier. ImageIO, Core Graphics et PDFKit, sans nouveau moteur.

La spec est réussie quand :

- chaque image prend une page A4, en portrait ou en paysage selon sa forme, ajustée et centrée, dans l'ordre réglé à l'écran ;
- une photo prise de côté est remise droite ; un JPEG déjà droit entre dans le PDF tel quel, sans seconde compression ;
- chaque page d'un PDF devient un JPG telle que le lecteur la voit, à 150 ou 300 points par pouce ;
- aucun fichier du dossier choisi n'est remplacé, et ni les images ni le PDF d'origine ne sont modifiés ;
- les tests du paquet, de l'appli et des textes passent, sans avertissement du compilateur.

## Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Page d'une image | A4 (595,28 × 841,89 points), tournée en paysage si l'image est plus large que haute ; image ajustée et centrée, sans marge ni option | La règle du site (`placeOnA4`). Aucune option sur le site non plus |
| Formats lus | Tout ce qu'ImageIO lit : JPEG, PNG, HEIC, TIFF… | Le Mac le fait sans dépendance ; le site se limite à JPG et PNG |
| JPEG droit | Ses pixels compressés entrent tels quels dans le PDF, par `PDFWriter` du Scanner | Pas de perte, pas de poids ajouté |
| Données de la photo | Le lieu (GPS), la date, l'auteur et les autres blocs EXIF et XMP ne sont pas copiés dans le PDF. ImageIO les retire sans recompresser | Un PDF se partage : il ne doit pas dire où la photo a été prise. Sonde du 2 octobre : mêmes pixels, profil de couleur gardé |
| TIFF de plusieurs pages | Une ligne et une page par page du TIFF, nommée « fichier (2) » | Les scanners de bureau et les fax écrivent des TIFF de plusieurs pages ; n'en garder que la première serait une perte muette |
| Autres images | Décodées, tournées selon leur orientation EXIF, posées sur du blanc, puis encodées en JPEG qualité 0,9 | `PDFWriter` n'écrit que du JPEG. La transparence d'un PNG devient blanche |
| Liste | Une ligne par image : numéro, vignette, nom, taille. Glisser une ligne ou cliquer ses flèches change l'ordre ; une croix la retire ; « Retirer toutes les images » demande confirmation si le PDF n'est pas enregistré | La liste native de macOS sait réordonner ; les flèches servent à qui ne glisse pas. Les fichiers sont lus à l'ajout, sauf ceux de plus de 512 Mo |
| Bornes | 200 images, 512 Mo en tout | Les images sont gardées en mémoire jusqu'à l'enregistrement, comme les PDF de Fusionner |
| Fichier refusé | Un fichier qui n'est pas une image lisible est laissé de côté et nommé dans le message ; les autres entrent | Un mauvais fichier ne bloque pas un lot |
| Image d'une page | La page telle que le lecteur la voit (recadrage, rotation, annotations), en JPEG. Normale : 150 ppp, qualité 0,85. Élevée : 300 ppp, qualité 0,92 | Les deux qualités du site. Le plus grand côté est plafonné à 6 000 pixels, comme dans Noircir |
| Noms des images | `nom-1.jpg`, `nom-2.jpg`… dans le dossier choisi ; `nom.jpg` pour une seule page ; `-2` ajouté si le nom existe | Jamais de fichier remplacé, comme dans Diviser |
| PDF signé | PDF en images l'ouvre : aucun PDF n'est écrit, la signature ne risque rien | Les autres outils le refusent parce qu'ils réécrivent le PDF |
| Progression | « Page 4 sur 12… » avec « Annuler », par le travail annulable de la session commune | Un long PDF en qualité élevée prend du temps : 40 s pour 500 pages à 300 ppp |
| Conversion interrompue | Annulée ou en échec, elle retire les images qu'elle venait d'écrire | Une moitié de conversion ne sert à rien, et ces fichiers sont toujours des fichiers neufs |
| Panneaux | La session est occupée tant qu'un panneau d'enregistrement ou de dossier est ouvert | Un dépôt ne remplace pas le document sous le panneau |
| Moines | « Frère Cadre » dans sa pose du site ; « Frère Enlumineur » avec le cadre, l'air appliqué | Le site donne la même pose aux deux : sur un même accueil il faut deux visages |

## Ce qui change dans les briques communes

- `PDFOpenedDocument` et `PDFCopySession` prennent `allowsSigned`, pour un outil qui n'écrit pas de PDF.
- `CopyToolView` : `saveTitle` et `savedTitle` deviennent facultatifs. Un outil qui enregistre depuis son panneau (plusieurs fichiers dans un dossier) n'a pas le bouton commun.
- `jpegData` est partagé par Noircir et par les deux outils.

## Parcours

**Images en PDF.** Choisir ou déposer des images ; glisser les lignes dans l'ordre voulu ; « Créer le PDF… » propose le nom de la première image.

**PDF en images.** Ouvrir ou déposer un PDF ; choisir la qualité ; « Convertir en JPG… » demande un dossier, puis affiche le nombre d'images et le dossier.

## Limites connues

- Pas de choix du format de page ni de marge : A4 seulement, comme sur le site.
- JPG seulement en sortie. Le mode « Extraire les images » est arrivé le 3 octobre (voir plus bas).
- Un PNG de capture d'écran devient un JPEG : le texte y est un peu moins net qu'en PNG.
- Une photo prise de côté (les portraits au téléphone) est décodée et recompressée une fois, qualité 0,9 : 0,5 s par photo de 36 mégapixels, sans progression ni annulation à l'enregistrement.
- Une animation GIF donne sa première image.
- HEIC et TIFF de plusieurs pages ont été essayés sur des fichiers de synthèse et les fonds d'écran du système, pas sur des fichiers d'appareil.
- Le glisser des lignes dans la liste reste à vérifier à la main : c'est la première liste native réordonnable de l'appli.

## Tests

| Niveau | Quoi | Où |
|---|---|---|
| Moteur, images en PDF | Page A4 tournée selon la forme ; pixels du JPEG gardés sans seconde compression ; lieu et auteur de la photo absents du PDF ; une page par page d'un TIFF, une seule pour un GIF animé ; image ajustée et centrée ; photo de côté remise droite ; PNG transparent sur blanc ; liste vide et fichier illisible refusés | `PDFImagePagesTests` |
| Moteur, PDF en images | Un JPEG par page aux deux résolutions ; page vue par le lecteur, rotation comprise ; PDF signé accepté ; arrêt si une image ne s'écrit pas ; mot de passe | `PDFPageImagesTests` |
| Outils | Ordre réglé, image retirée, PDF enregistré, fichier illisible nommé ; TIFF de trois pages, flèches de ligne ; un JPG par page sans remplacer un fichier, qualité élevée, page unique, dossier refusé, conversion annulée sans reste, autre PDF | `ImagesSessionTests`, `PageImagesSessionTests` |
| Écrans | Départ, liste, PDF prêt ; départ, prêt, images prêtes ; clair, sombre, anglais | `ImagesSnapshots` |
| Fichiers réels | Quatre PDF de `fixtures-private/pdfs` : 15 pages en 0,4 s (normale) et 0,9 s (élevée) ; trois images reliées de nouveau en PDF | Sonde du 2 octobre, non gardée |
| Textes | Tous traduits, sans tutoiement | `check-strings.py` |

## Extraire les images (3 octobre 2026)

À la demande de l'auteur, PDF en images offre le second mode du site : « Que voulez-vous ? Pages en JPG, ou Extraire les images », seulement les photos du PDF, telles qu'elles sont dans le PDF.

| Sujet | Décision | Raison |
|---|---|---|
| Ce qui compte | Les images du document de 64 à 30 000 pixels de côté et 50 mégapixels au plus ; les images posées sur le même cadre d'une page (le fond et la couche nette d'un scanner, même en masque `/ImageMask true` : la compression adaptative d'Acrobat) sont une photo, et un masque seul n'en est pas une ; un même groupe d'images dessiné sur plusieurs pages, ou la même photo rangée deux fois, sort une fois (mêmes objets, ou même fichier à l'octet près) ; une image que la page ne montre pas (hors page, plus petite qu'un point, ou que la page ne sait pas décoder : cadre resté blanc) n'est pas écrite, et compte pour la page suivante qui la montre | Les règles du site. Les images écrites dans le contenu même (`BI … EI`) sont des puces : laissées |
| Pixels | Un JPEG sort tel qu'il est dans le PDF, à l'octet près, quand un lecteur JPEG le verrait comme la page : flux `/DCTDecode` nu, couleurs de l'appareil ou profil ICC qui laisse les primaires, le gris moyen et le blanc là où sRGB les met (profil de 64 Ko au plus), ni masque ni tableau de décodage, et un décodage complet qui prouve qu'il se lit aux pixels annoncés ; tout le reste (image peinte, Flate, profil large comme Adobe RGB ou Display P3, CMJN, JPEG 2000, masque, palette, couches) est découpé : seul le cadre de l'image est dessiné, dans son contour (une image tournée n'emporte pas ses voisines dans ses coins), à la résolution de l'image le long de ses côtés, 6 000 pixels et 16 mégapixels au plus, sur blanc. Aucun autre flux n'est copié hors du document : un flux Flate de 64 × 64 peut gonfler à 3 Go | Mieux que le site pour les JPEG, qui ne subissent pas de seconde compression ; pour le reste, la page sait dessiner ce que Core Graphics ne relit pas |
| Compte | `PDFPhotos.count` après l'ouverture, en arrière-plan (`PDFCopySession.read`), sans décoder une image : l'écran dit « Comptage des photos… » puis « Photos dans ce PDF : 4 », et sans photo le choix revient sur les pages | Sonde du 3 octobre : 15 pages comptées en 0,1 s, mais 1,8 s pour 142 pages : l'ouverture ne doit pas attendre |
| Fichiers | `nom-photo-1.jpg`, `nom-photo-2.jpg`… dans le dossier choisi, dans l'ordre des pages ; la progression dit la page lue ; l'annulation agit entre deux images ; un passage sans fichier le dit : « Aucune photo n'a pu être extraite de ce PDF : convertissez plutôt ses pages » | Comme les pages |

Sonde du 3 octobre sur `fixtures-private/pdfs` : la fiche NASA donne ses 4 photos en 84 ms (1 771 × 1 271 au plus), l'article arXiv ses 3 figures, le formulaire W-9 rien ; après la relecture, le livre de cuisine scanné (296 pages, deux couches JBIG2 et JPEG 2000 par page) donne 296 photos de 2 400 × 3 600 en 97 s, le texte net sur son fond jauni.

Relecture du 3 octobre : trois plantages sur des tailles menteuses (débordement d'entier, échelle de 10⁻¹⁵) et des sorties fausses (JPEG CMJN en négatif, profil ICC perdu — les photos de la fiche NASA sont en Adobe RGB, pas en sRGB —, `/ImageMask false` pris pour un masque, scan en deux couches en deux fichiers, texte d'un scan en masque perdu, découpe rognée par la page entière à 6 000 pixels, voisines dans les coins d'une image tournée, image perdue quand elle se montre seule après avoir été couverte, JPEG tronqué copié tel quel, flux Flate gonflé à 6,5 Go en mémoire, annulation ignorée sur les pages sans image, mode changé pendant le panneau de dossier). Tous corrigés avec des tests sur des PDF écrits à la main (`PDFPhotosTests`).

Limites : ce que la page dessine par-dessus une image découpée, dans son contour, reste dessus ; une image aux pixels identiques mais recodée autrement sort deux fois ; un PDF scanné donne la photo de chaque page ; une image découpée sort dans le sens où la page la montre et aux proportions de son cadre (étirée sur la page, étirée dans le fichier), un JPEG gardé tel quel dans le sien ; le compte peut dépasser le nombre de fichiers (image que la page ne montre pas, ou aux pixels d'une autre) ; la part d'une image découpée qui dépasse la page ou son découpage sort blanche ; un profil ICC que Core Graphics ne lit pas, ou de plus de 64 Ko, envoie le JPEG à la découpe.

