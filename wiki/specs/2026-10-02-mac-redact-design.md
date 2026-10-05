# Mac — Noircir

_Rédigé le 2 octobre 2026. Statut : appli Swift retirée le 5 octobre 2026 (tag `mac-final`) ; à l'époque, livré dans `apps/mac`. Dernier des six outils commandés le 2 octobre (avant : [Numéros de page](2026-10-02-mac-page-numbers-design.md), [Protéger et Déverrouiller](2026-10-02-mac-protect-unlock-design.md), [Compresser](2026-10-02-mac-compress-design.md), [OCR](2026-10-02-mac-ocr-design.md))._

## Objectif

Cacher pour de bon une partie d'un PDF dans Holy PDF pour Mac : l'utilisateur couvre de noir ce qui doit disparaître, puis enregistre une copie où ce contenu n'existe plus. PDFKit seulement, sans nouveau moteur.

Choix de l'auteur (2 octobre) : une page qui porte une zone noire devient une image à 200 ppp. Écarté : des rectangles dessinés par-dessus un texte qui reste dans le fichier.

La spec est réussie quand :

- rien de ce que portait une page noircie ne reste dans le fichier : ni son texte, ni la valeur d'un champ couvert, ni une note, ni l'adresse d'un lien ;
- la page noircie garde l'aspect et la taille que voit le lecteur, la zone en noir ;
- les autres pages ne changent pas, et les signets et les liens qui menaient à la page noircie y mènent encore ;
- le fichier d'origine n'est jamais modifié ;
- les tests du paquet, de l'appli et des textes passent, sans avertissement du compilateur.

## Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Moteur | `PDFRedaction.redacted` rend chaque page marquée telle que le lecteur la voit, à 200 ppp, zones peintes en noir sur des pixels entiers et sans lissage, puis la remplace par une page faite de cette image en JPEG (qualité 0,8, écrite par `PDFWriter` du Scanner) | Ce qui n'est pas dans l'image n'est plus dans le fichier. Sonde du 2 octobre : aucun des quatre secrets d'une page d'essai ne reste, même dans les flux décompressés |
| Annotations | Les annotations de la page noircie partent avec elle : champs, notes, liens | Une note ou un champ peut porter le secret |
| Ce qui déborde sur les autres pages | La bulle d'une note posée sur une autre page est retirée : PDFKit y recopie le texte de la note. Un champ de formulaire qu'une zone couvre est retiré aussi des autres pages où il apparaît : sa valeur y resterait, visible ou cachée | Deux fuites prouvées par la relecture du 2 octobre. PDFKit ne sait pas vider un champ pour de bon : la valeur par défaut et l'apparence gardent le texte. Un champ qu'aucune zone ne couvre reste sur les autres pages : l'image de la page le montre de toute façon |
| Mémoire | Chaque page noircie attend l'écriture en JPEG, pas en pixels | Mesuré le 2 octobre, hors des suites (dans le processus de test, les autres tests faussent la mesure) : 168 Mo pour 32 petites pages avant, moins de 60 Mo après |
| Signets et liens | Ceux qui visaient la page sont dirigés vers son image, au même endroit vu par le lecteur et au même zoom | Le document reste navigable |
| Grandes pages | Le plus grand côté de l'image est plafonné à 6 000 pixels | Une affiche à 200 ppp demanderait des gigaoctets |
| Zones | Rectangles noirs, normalisés à la page telle que le lecteur la voit. Tracés au glisser ; une croix sur chaque zone la retire ; un bouton retire celles de la page. « Annuler » (bouton et ⌘Z, depuis le 2 octobre au soir) reprend un changement à la fois, sur n'importe quelle page | Le geste le plus direct. L'historique garde cent pas, comme le Filigrane |
| Suivi de la souris | Une vue AppKit sous les zones, pas un geste SwiftUI | Un test peut alors conduire le glisser ; un geste SwiftUI ne répond pas aux événements d'un test |
| Modifications | Les zones comptent comme des modifications non enregistrées : ouvrir un autre PDF ou quitter demande confirmation. Sans zone, il n'y a rien à perdre et rien n'est demandé | Le tracé de plusieurs pages se perd vite |
| Après l'enregistrement | Les zones restent à l'écran ; l'écran invite à regarder la copie avant de la partager | L'utilisateur peut en ajouter et enregistrer de nouveau |
| Moine | « Frère Encrier », la gomme du site, l'air appliqué | Le moine qui passe l'encre noire |

## Ce qui change dans les briques communes

- `CopyToolView` et `PagePreviewPane` reçoivent `onPage` : une vue posée sur la page, à sa taille, où l'outil laisse l'utilisateur travailler sur la page.

## Parcours

1. Ouvrir ou déposer un PDF. Un fichier protégé demande son mot de passe.
2. Faire glisser sur la page pour couvrir ce qui doit disparaître ; changer de page et recommencer.
3. « Enregistrer la copie noircie… » propose `nom-noirci.pdf`.

## Limites connues

- « Annuler » ne se rétablit pas : pas de « Rétablir ».
- Toute la page noircie devient une image : son autre texte n'est plus sélectionnable ni cherchable (l'outil OCR peut le relire), et ses champs de formulaire disparaissent.
- Une page noircie pèse environ 0,9 Mo en format lettre : 14 pages noircies font passer un PDF de 1 à 13 Mo.
- Le titre du document, ses signets et ses métadonnées (dont le bloc XMP) ne sont pas relus : un secret écrit dans un signet ou dans le titre y reste. L'écran le dit.
- Un champ de formulaire couvert par une zone disparaît aussi des autres pages où il apparaît.
- Un texte qui déborde de la zone reste lisible : c'est l'image qui fait foi, l'aperçu montre ce qui sera couvert.
- Les limites de PDFKit à l'écriture s'appliquent aux autres pages (spec du Filigrane, spec de Protéger pour les étiquettes de pages).
- La copie d'un PDF protégé s'ouvre sans mot de passe, et l'écran le dit.

## Tests

| Niveau | Quoi | Où |
|---|---|---|
| Moteur | Les cinq secrets d'une page (texte, champ, note dont la bulle est sur une autre page, lien, champ partagé avec une autre page) absents des octets et des flux décompressés de la copie, écrits en clair, en UTF-16 ou en hexadécimal ; un champ non couvert gardé sur l'autre page ; un signet replacé après rotation, zoom gardé ; signet et lien suivis jusqu'à l'image ; zone noire et reste de la page gardé ; image de 833 × 1 111 pixels pour 300 × 400 points, en JPEG, sans masque ; aspect et taille gardés sous les quatre rotations ; autres pages inchangées ; zones vides ou hors page, PDF signé refusés, PDF protégé ouvert | `PDFRedactionTests` |
| Outil | Zones par page, coupées au bord de la page, retirées une à une ou par page ; copie noircie enregistrée, original intact, zones gardées ; un autre PDF efface les zones | `RedactSessionTests` |
| Écrans | Départ, zones en clair, en sombre et en anglais, copie enregistrée ; un glisser trace une zone à l'endroit attendu, un clic n'en trace pas | `RedactSnapshots` |
| Fichiers réels | Six PDF de `fixtures-private/pdfs` : texte des pages noircies disparu, tailles gardées, signets gardés ; 14 pages en 0,7 s | Sonde du 2 octobre, non gardée |
| Textes | Tous traduits, sans tutoiement | `check-strings.py` |
