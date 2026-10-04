# Web — Scanner

_Rédigé le 2 octobre 2026. Lots A et C livrés le 3 octobre (moteur, planche, correction, export), lot B le même jour (lecture, mise à l'endroit, suggestions, texte cherchable). Choix de l'auteur (2 octobre) : parité avec le [Scanner Mac](2026-09-29-scanner-mac-v1-design.md), détection par OpenCV.js, décodeur HEIC. L'algorithme est celui d'[Algorithme du scanner](../development/algorithm.md), avec les mêmes photos de test._

Frère Scanner (`/fr/scanner`, `/en/scanner`) transforme des photos de documents en PDF propres, comme sortis d'un scanner : page détectée et redressée, papier blanc, ombres retirées, un PDF par document.

## Ce qui change par rapport au Mac

| Sujet | Mac | Web | Raison |
|---|---|---|---|
| Détection approchée | Vision `VNDetectDocumentSegmentationRequest` | OpenCV.js : niveaux de gris réduits, flou, Canny, dilatation, plus grand contour convexe à quatre sommets (`approxPolyDP`) couvrant au moins 20 % de la photo ; sinon la photo entière, page ⚠︎ | Pas de Vision dans un navigateur. L'affinage des bords d'`algorithm.md` suit, à l'identique |
| Redressement, nettoyage | Core Image | OpenCV.js (`warpPerspective`, dilatation, flou, opérations par pixel) | Mêmes paramètres |
| HEIC | ImageIO | libheif (WebAssembly), chargé seulement quand un HEIC arrive ; la date de prise de vue est lue dans l'élément EXIF du fichier (`heicCaptureDay`) | Seul Safari décode le HEIC, et libheif ne donne pas l'EXIF |
| Lecture | Vision, roumain, français, anglais | Tesseract.js, `ron+fra+eng`, déjà servi par l'OCR du site, plus le roumain | Le lot de référence est roumain |
| Mise à l'endroit | OCR rapide dans les 4 sens | Tesseract à 1 200 px dans les 4 sens, même score | Le cœur LSTM n'a pas de détection d'orientation |
| Écriture PDF | PDFCore (Core Graphics) | Moteur PDFium du site : une page par image, JPEG embarqué sans recompression, texte invisible (`writeTextLayer`), titre dans les métadonnées | Les briques existent |
| Calcul | File bornée au nombre de cœurs | Un worker du Scanner (OpenCV, libheif), une page à la fois ; Tesseract dans son propre worker | La mémoire d'un téléphone : une photo de 24 Mpx décodée pèse 96 Mo |
| Téléchargement | Panneau d'enregistrement | Un PDF, ou un .zip quand il y en a plusieurs ; sur téléphone, le partage | Comme les autres outils du site |
| Annulation | ⌘Z, ⇧⌘Z, menu Édition | ⌘Z / Ctrl+Z, ⇧⌘Z / Ctrl+Y, et deux boutons | Pas de menu dans une page web |

## Poids

Rien au chargement de la page. Au premier fichier : OpenCV.js (13,3 Mo, environ 3,5 Mo compressés) et le worker du Scanner. Au premier HEIC : libheif (1,5 Mo). À la première lecture : Tesseract et ses langues (environ 7 Mo, gardés par le navigateur). Les fichiers sont copiés dans `public/scan/` et `public/ocr/` avant `dev` et `build`, comme pour l'OCR.

## Parcours

Celui du Mac, adapté à une page web :

1. **Démarrage** : zone de dépôt, « Choisir des photos », et sur téléphone « Prendre une photo » (l'appareil photo s'ouvre).
2. **Planche** : une ligne par document (nom modifiable, raison de la suggestion, pages) ; ⚠︎ sur les pages à vérifier, avec les raisons ; filtre « ⚠︎ N pages à vérifier » ; glisser une page vers un autre document ou en fin de ligne pour en créer un ; supprimer une page ou un document ; annuler et rétablir ; « Ajouter des photos ».
3. **Correction** : la photo avec ses 4 coins et une loupe sur le coin tenu, le résultat à côté ; outils Coins et Gomme (taille réglable), Pivoter, Annuler, Rétablir, Page suivante ; réglages : rendu (Document ou Couleur), filigrane (auto, gardé, retiré), format (Auto, A4, A5, Lettre), « Rétablir la détection auto ». Des coins croisés sont refusés avec un message.
4. **Export** : tous les documents, ou un seul depuis sa ligne ; texte cherchable (oui par défaut) ; rappel des pages encore à vérifier ; jamais la position GPS.

## Lecture (lot B)

| Sujet | Décision | Raison |
|---|---|---|
| Ordre | Une page dessinée est lue : d'abord son sens (4 lectures à 1 200 px), puis ses lignes sur la page finale ; une page à la fois, après le dessin | Le texte gommé n'entre jamais dans le PDF : on lit ce qui est dessiné |
| Sens | Le meilleur score (confiance × caractères) devient le sens automatique, tant que le visiteur n'en choisit pas ; 0 si rien ne se lit | Comme le Mac. 17 pages sur 17 justes sur le lot |
| Suggestions | `suggest.ts`, portage de `DocumentSuggester` : regroupement par repères de page, date la plus récente avant la prise de vue, titre, nom `AAAA-MM-JJ_Titre` ; la raison s'affiche à côté du nombre de pages | Appliquées quand toutes les pages sont lues, jamais après un changement de la planche (déplacement, suppression, nom) |
| Repères | En plus des règles du Mac : espaces facultatifs (« Pagina 2 din3 »), et « x/n » en fin de ligne | Tesseract colle le repère aux mots de sa ligne et perd des espaces |
| Date de prise de vue | EXIF du JPEG, et élément EXIF du HEIC lu dans le fichier | La date de référence de la règle des dates |
| Texte cherchable | Case cochée par défaut ; les lignes passent en texte invisible sur l'image, au bon endroit dans la page | Comme l'outil OCR |

## Limites connues

- Un téléphone traite une page en plusieurs secondes : la planche se remplit page après page.
- Pas de reprise de session : recharger la page perd le lot. L'écran demande confirmation avant de quitter avec des documents non téléchargés.

## Tests

- Moteur, dans Node (`tests/scan/`) : chaque brique sur des images faites par le test ; le pipeline sur les 17 photos de `fixtures-private` quand elles sont là (sauté sinon), contre les critères de la spec Mac : pages fausses toutes signalées, au plus 2 bonnes signalées à tort, 17 pages à l'endroit, filigrane juste sur 16, 10 regroupements sur 11, 9 dates sur 11, moins de 500 Ko par page.
- Navigateur : import d'une photo faite par le test, planche, correction d'un coin, export, PDF relu par pdf.js.
