# Scanner Mac v1 — design

_Rédigé le 29 septembre 2026. Statut : appli Swift retirée le 5 octobre 2026 (tag `mac-final`) ; à l'époque, livré le 1er octobre 2026 (PR #2 et #7)._

## Contexte

`pdf-toolbox` est une appli qui regroupe des outils PDF, à la manière d'iLovePDF, avec à terme une version iPhone et une version Web, et une possible commercialisation. Le **Scanner** est son premier module : il transforme des photos de documents prises au téléphone en PDF propres, comme sortis d'un scanner.

Le pipeline a d'abord été mis au point à la main, en Python et OpenCV, sur un lot réel de 17 photos (11 documents administratifs). Cette spec en reprend les réglages et les pièges. Les valeurs de référence sont dans [Algorithme du scanner](../development/algorithm.md).

## Objectif et critères de réussite

Déposer un lot de photos, valider les regroupements proposés, corriger les pages signalées, et obtenir un PDF par document, en quelques minutes et sans script.

La v1 est réussie quand, sur le lot privé de 17 photos :

- les 11 PDF produits valent ceux du prototype Python (recadrage, papier blanc, ombres retirées, filigrane gardé, coins recouverts nettoyés) ;
- chaque page dont les coins auto sont faux est marquée ⚠︎ (le prototype en avait 9) ;
- les 17 pages sont mises à l'endroit sans intervention (7 photos du lot étaient couchées) ;
- au moins 10 des 11 regroupements sont justes sans retouche ;
- au moins 9 des 11 dates proposées sont justes ;
- une page est traitée en moins de 1 s sur puce M, et le lot entier est prêt en moins de 20 s ;
- un PDF pèse en moyenne moins de 500 Ko par page.

## Portée

**Dans la v1 :**

- appli macOS 15+, SwiftUI, en français et en anglais ;
- import par glisser-déposer ou sélecteur : HEIC, JPEG, PNG ;
- détection de la page, redressement, mise à l'endroit automatique, nettoyage (mode Document ou Couleur) ;
- correction manuelle : 4 coins déplaçables avec loupe, gomme blanche, rotation par quart de tour, annulation ;
- OCR sur l'appareil : suggestions de regroupement et de nom, couche de texte invisible dans les PDF ;
- export : un PDF par document, format réel, sans métadonnées de localisation.

**Hors v1**, chacun avec sa propre spec plus tard : appli iPhone, version Web, autres outils PDF (fusion, découpe, compression, OCR d'un PDF existant, signature), paiement et licence, reprise de session, OCR structuré de macOS 26.

## Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Plateformes à terme | Apple + Web | Choix produit |
| Langage | Swift natif (Vision, Core Image, PDFKit / Core Graphics) | Vision détecte les pages et lit le texte mieux que tout équivalent portable. Rust n'aurait partagé que la partie facile |
| Web | Réécriture plus tard, en suivant `algorithm.md` et les mêmes photos de test | Aucun code commun possible avec Vision |
| Dépôt | Monorepo `Snouzy/pdf-toolbox`, sans outil de monorepo | Les paquets Swift se partagent en local entre Mac et iPhone ; le Web réutilisera les photos de test |
| Documentation | Wiki dans le dépôt (`wiki/`, compatible Obsidian) | La doc change dans le même commit que le code |
| Version minimale | macOS 15 | API Swift récentes de Vision, parc large |
| Confidentialité | Bac à sable, fichiers choisis par l'utilisateur uniquement, **aucun droit réseau** | Promesse « rien n'est envoyé » vérifiable, et exigence App Store |
| Dépendances | Aucune bibliothèque tierce en v1 | Frameworks Apple d'abord |
| Session | Pas de sauvegarde en v1 ; confirmation avant de quitter avec des documents non exportés | Outil de lot, YAGNI |

## Structure du dépôt

```
pdf-toolbox/
├── Packages/
│   └── Core/                un seul Swift package, plusieurs modules :
│       ├── ScanCore         moteur du scanner
│       ├── PDFCore          écriture PDF, partagée par les futurs outils
│       ├── ScanSession      état d'un lot : pages, documents, retouches, export (Mac et iPhone)
│       └── ScanCLI          outil en ligne de commande, banc d'essai du moteur
├── apps/
│   └── mac/                 projet Xcode : coquille + module Scanner
├── fixtures/                photos de test sans données personnelles + résultats attendus
├── fixtures-private/        ignoré par git : les vraies photos, pour les tests locaux
├── wiki/
│   ├── index.md
│   ├── development/
│   │   ├── technical-guide.md
│   │   ├── algorithm.md
│   │   └── tests.md
│   ├── product/
│   │   ├── roadmap.md       tous les outils visés, par phase
│   │   └── brand.md         identité de marque (le moine copiste)
│   └── specs/
├── tools/prototype/         le prototype Python d'origine, pour référence
├── CLAUDE.md
└── AGENTS.md
```

Un seul paquet avec plusieurs modules plutôt que plusieurs paquets : les frontières d'import restent imposées par les modules, et `swift test` lance tout d'un coup.

`fixtures-private/` ne doit jamais être commité : les photos réelles portent des données personnelles. Un dépôt privé reste un tiers et peut devenir public.

## Le moteur `ScanCore`

Chaque brique prend des données et rend des données. Pas de protocole ni de singleton : Vision et Core Image sont appelés directement, dans les seules briques qui en ont besoin.

### Coordonnées

Le modèle stocke toute position en **coordonnées normalisées de page** (0 à 1, origine en haut à gauche) : coins, zones de gomme, boîtes de texte. Les conversions vers les pixels d'une photo, les pixels du rendu ou les points PDF vivent dans un seul fichier, `Geometry.swift`. Vision utilise une origine en bas à gauche : la conversion se fait là aussi, et nulle part ailleurs.

### Briques

| Brique | Entrée → sortie | Détail |
|---|---|---|
| `ImageLoader` | URL → image orientée + date de prise de vue | ImageIO, orientation EXIF appliquée, réduction à 4096 px sur le grand côté |
| `PageDetector` | image → `Quad` + indicateurs de confiance | Vision `VNDetectDocumentSegmentationRequest` (éprouvée par le prototype), puis affinage des bords (voir ci-dessous) |
| `Rectifier` | image + `Quad` → page droite | Correction de perspective (Core Image), calage du rapport √2, taille de rendu |
| `OrientationDetector` | page droite → nombre de quarts de tour | OCR rapide dans les 4 sens sur une version réduite ; on garde le sens qui lit le plus de texte. 7 photos sur 17 du lot réel étaient couchées |
| `Enhancer` | page + réglages → page nettoyée | Mode Document ou Couleur, filigrane gardé ou non |
| `EraseMask` | page + zones gommées → page finale | Zones en coordonnées de page, rejouées à chaque rendu |
| `TextReader` | page → lignes (texte, boîte, hauteur) | Vision `VNRecognizeTextRequest`, niveau précis, langues `ro-RO`, `fr-FR`, `en-US` (le roumain est pris en charge, vérifié le 29/09), correction linguistique désactivée |
| `DocumentSuggester` | lignes de toutes les pages, dans l'ordre d'import → documents proposés | Règles déterministes, voir ci-dessous |

Les erreurs sont typées : `ScanError` (`unreadableFile`, `unsupportedFormat`, `renderFailed`, `ocrUnavailable`) dans `ScanCore`, `PDFWriteError` (`emptyDocument`, `invalidImage`, `renderFailed`, `cannotWrite`) dans `PDFCore`. Une page sans page détectée n'est pas une erreur : elle sort marquée ⚠︎. L'interface traduit les erreurs via le catalogue de chaînes.

### Affinage des bords

Vision rend un quadrilatère approché. Il est faux quand une autre feuille recouvre un coin. Chaque bord est donc réajusté sur l'image réduite au quart, en niveaux de gris, floutée 5×5 :

1. 80 échantillons le long du bord, de 6 % à 94 % de sa longueur ;
2. pour chacun, un profil de luminosité le long de la normale extérieure, sur ±3 % du petit côté de l'image ;
3. la chute `I(s) − I(s+3)` est calculée ; l'échantillon est gardé si sa chute maximale dépasse 12 ;
4. on retient la position **la plus extérieure** dont la chute dépasse 60 % du maximum, parce qu'un texte gras juste sous le bord chute plus fort que le bord du papier ;
5. une droite robuste est ajustée (4 passes, rejet des résidus au-delà de max(1,5 ; 2,5 × médiane)) ;
6. les coins sont les intersections des droites voisines, ce qui reconstruit aussi un coin caché.

### Signalement ⚠︎

Une page est marquée à vérifier si l'un de ces cas se produit :

- le rapport des côtés n'est proche ni de √2 ni d'un format connu (écart > 6 %) ;
- un bord garde moins de 70 % d'échantillons valides après l'ajustement ;
- un coin affiné s'écarte de plus de 1 % de la diagonale du coin donné par Vision.

Une observation de Vision de confiance inférieure à 0,5 compte comme « aucune page détectée » : image entière, page marquée ⚠︎.

Sur le lot réel, le prototype avait 9 pages fausses et le moteur Swift 10, toutes signalées. Les seuils se règlent sur les photos de test.

### Nettoyage, mode Document

1. estimation du papier : dilatation (disque de 15 px), puis flou gaussien σ 5 (le prototype prenait une médiane de 21 px, que Core Image n'a pas) ;
2. si le filigrane est gardé : on calcule aussi une fermeture (disque de 91 px) de cette estimation, qui remplit les traits du filigrane. Dans les zones d'ombre, repérées par rapport au niveau local du papier éclairé (dilatation 101 px au quart de résolution, flou σ 40), on revient à l'estimation fine. Sans ça, la traînée entre deux ombres reste grise ;
3. division de la page par l'estimation du papier ;
4. niveaux : noir à 0,12, blanc à 0,86, gamma 1,35 ;
5. netteté : 1,5 × image − 0,5 × flou σ 1,2 ;
6. marge blanche de 24 px sur le pourtour.

Mode Couleur (certificats à fond de sécurité) : étirement des niveaux entre les centiles 0,5 et 99 par canal, rien d'autre.

**Filigrane gardé ou non :** détecté automatiquement, avec un interrupteur par page pour forcer. Règle retenue : gardé si, sur l'intérieur de la page (marges de 10 % exclues, au quart de résolution), l'écart entre la fermeture et l'estimation fine dépasse 0,08 sur plus de 2,4 % des pixels, hors masque d'ombre (< 0,5). Elle est juste sur les 16 pages en mode Document du lot privé. La détection reste donc automatique.

### Format et taille de rendu

- rapport à moins de 6 % de √2 : calé sur √2, grand côté de 2339 px (A4 à 200 dpi) ;
- autre rapport : taille mesurée, petit côté de 1654 px ;
- grand côté plafonné à 7016 px (environ 89 cm à 200 dpi) : des coins glissés en bande étroite ne demandent pas des millions de pixels. Des coins confondus ne donnent pas de rendu ;
- format PDF par page : `Auto` (A4 pour √2, sinon taille en pixels à 200 dpi), `A4`, `A5`, `Lettre`. Une photo ne donne pas la taille physique : l'utilisateur choisit A5 pour une facture de carnet.

### Suggestions de documents

Entrée : les lignes OCR de toutes les pages, dans l'ordre d'import.

**Regroupement** : une page rejoint le document précédent si leurs marqueurs de page se suivent. Marqueurs reconnus dans le haut (10 %) ou le bas (12 %) de la page :

- `x / n` et `x/n` ;
- `Pagina x din n`, `Page x of n`, `Page x sur n` ;
- un nombre seul centré en bas de page.

Sinon, la page ouvre un nouveau document.

**Titre** : la ligne de plus grande hauteur dans les 40 % du haut de la première page, parmi les lignes d'au moins 3 lettres, d'au plus 4 mots et de confiance OCR d'au moins 0,5, en excluant les lignes qui reviennent dans au moins max(2, ⌈documents/3⌉) documents du lot (en-têtes d'institution comme « MINISTERUL JUSTIȚIEI »). Le titre est converti en ASCII (ș → s), garde au plus 6 mots, séparés par des tirets.

**Date** : la plus récente des dates du document (`jj.mm.aaaa`, `jj/mm/aaaa`, `aaaa-mm-jj`) qui ne dépasse pas la date de référence. La date de référence est la date de prise de vue de la première photo du document, ou aujourd'hui si elle manque. Les dates d'avant 1990 sont ignorées, ainsi que celles des lignes de validité (`valabil`, `valable`, `valid until`, `valid till`, `valid through`, `valid to`, `expir`). Sans date valable, on prend la date de référence.

Cette règle simple donnait 9 dates justes sur 11 sur le lot réel. Les deux écarts : une date de fin de validité (« valabilă până la data … ») et la date d'un certificat cité dans un extrait. Ignorer les lignes de validité corrige le premier. Le second reste : la règle prend une date citée dans le corps du texte, pas la date d'émission. Une règle à points (mots d'émission, position) a été essayée sur papier : elle se trompe sur un document où une même date citée dans le texte revient trois fois.

**Nom** : `AAAA-MM-JJ_Titre`. En l'absence de titre : `AAAA-MM-JJ_Document-N`. Chaque suggestion garde sa raison lisible (« Pagina 1 din 3 · 21.09.2026 »), affichée sur la planche.

## `PDFCore`

En v1, une seule responsabilité : écrire un PDF à partir de pages image.

- une page PDF par image, à la taille du format choisi (A4 = 595,28 × 841,89 pt, A5 = 419,53 × 595,28 pt). L'image y garde son rapport, centrée ;
- image en JPEG qualité 0,53 dans ImageIO (≈ libjpeg 80 à 81, le 80 du prototype ; le 0,8 d'ImageIO vaut ≈ libjpeg 94 et alourdissait les pages), sans métadonnées. Le flux JPEG doit être embarqué tel quel, sans recompression : c'est à vérifier dès le départ par la taille des fichiers ;
- couche de texte invisible : chaque ligne OCR est dessinée en mode texte invisible (Core Text) dans sa boîte, police mise à l'échelle sur la largeur ;
- titre du document dans les métadonnées PDF.

Les futurs outils (fusion, découpe, compression) viendront s'ajouter ici.

## L'appli Mac

### Coquille

L'accueil est une grille d'outils par catégorie, avec recherche, favoris et « Récemment utilisé », sur le modèle de PDF24 Tools. En v1, la grille ne montre que les outils disponibles, donc le Scanner seul, et la recherche, les favoris et les récents arrivent avec la phase 1 de la [feuille de route](../product/roadmap.md). Ajouter un outil, c'est un dossier sous `Features/` et une entrée dans la grille : pas de registre ni de système de plug-in. Les illustrations viendront de l'[identité de marque](../product/brand.md) ; en attendant, un symbole SF par outil.

### Écrans du Scanner

1. **Démarrage** : zone de dépôt, bouton « Choisir des photos… », les 3 étapes, la mention « rien n'est envoyé ».
2. **Planche** (vue principale) :
   - une ligne par document, avec nom modifiable, raison de la suggestion, nombre de pages et vignettes ;
   - un bandeau de conseils en haut de la planche, qu'on ferme avec « × » ; il ne revient pas après un relancement, sauf par Aide → « Afficher les conseils ». Tant qu'il est affiché, la ligne d'aide du bas est masquée ;
   - un clic sur une page ouvre la correction ;
   - au survol, la page se soulève, un anneau l'entoure, le pointeur devient une main, et deux boutons apparaissent : « Corriger » et « Supprimer » ;
   - un clic droit sur une page ouvre un menu : « Corriger… » et « Supprimer la page » ;
   - supprimer une page ne demande pas de confirmation : ⌘Z la rend ;
   - chaque changement de la planche s'annule avec ⌘Z et se rétablit avec ⇧⌘Z : suppression d'une page ou d'un document, déplacement d'une page, nouveau document, nom. Une annulation revient sur la planche ; un renommage s'annule en une fois ;
   - glisser une page la déplace vers un autre document ; la déposer dans la case vide en fin de ligne crée un document. Cette case n'apparaît que dans un document d'au moins deux pages : seule, une page forme déjà son document. L'image glissée est la page seule, sans anneau ni boutons ;
   - un ⚠︎ orange marque les pages à vérifier ; son infobulle donne les raisons, une par ligne ;
   - un bouton « ⚠︎ N pages à vérifier » filtre la planche. Le filtre s'éteint dans deux cas : quand la dernière page marquée est supprimée depuis la planche, et quand on revient à une planche où plus rien n'est à vérifier. Il reste allumé pendant une correction. Sans page à vérifier, le bouton disparaît ; « Ajouter des photos… » et « Exporter », calés à droite, ne bougent pas ;
   - l'en-tête d'un document a un bouton crayon (« Renommer »), un bouton « Télécharger… » et un menu ⋯ : « Télécharger le PDF… », « Renommer » (met le curseur dans le nom), « Supprimer le document… ». La confirmation donne le nom et le nombre de pages, et dit « Vous pourrez l'annuler avec ⌘Z. ». Ces boutons se surlignent au survol ;
   - le téléchargement ouvre un panneau d'enregistrement en feuille, avec le nom déjà rempli. Il n'attend que les rendus de son document : l'import d'autres photos ne le retarde pas. Un toast montre « Enregistrement de « Nom.pdf »… » pendant l'écriture, puis « « Nom.pdf » enregistré » avec « Afficher dans le Finder » ; il se ferme seul après 4 s, et attend tant que le pointeur est dessus. Une erreur nomme le fichier choisi dans le panneau et reste affichée jusqu'à sa fermeture. Un document supprimé pendant l'enregistrement ne donne pas d'erreur ;
   - le nom se modifie dans le champ. Un clic ailleurs sur la planche, sur la barre du bas ou dans la barre d'outils, ou « Retour », valide ; « Échap » rend l'ancien nom ;
   - le menu Fichier a « Ajouter des photos… » (⌘O) et « Exporter… » (⌘E), actifs quand les boutons de la planche le sont. Ils sont grisés pendant une correction.
3. **Correction** (un clic sur une page) :
   - la photo à gauche, avec les 4 coins et une loupe sur le coin tenu ; le résultat à droite, avec une petite roue à côté de « Résultat » tant que le rendu se calcule ;
   - outils Coins et Gomme (taille réglable, grisée hors de la gomme), Pivoter (quart de tour), Annuler et Rétablir, Télécharger… (le document de la page, comme sur la planche), Page suivante. Pivoter, Annuler et Rétablir ont une infobulle ; celle d'Annuler et de Rétablir nomme l'action, comme le menu Édition (« Annuler Déplacer les coins ») ;
   - sur la dernière page, « Page suivante » devient « Terminer » et ramène à la planche ;
   - avec l'outil Coins, le titre du résultat dit de choisir la gomme pour effacer autour de la page ;
   - pointeurs : une main ouverte sur un coin, fermée pendant le glissement, même au-delà de la photo ; un viseur sur le résultat avec la gomme ;
   - des coins croisés sont refusés : un message de 3 secondes l'explique sous la photo, et le coin revient à sa place. Une bonne retouche, Annuler ou Rétablir l'efface ;
   - avec la gomme, la pastille « Mise à jour de la page… » couvre le résultat tant que la page tournée ou redressée n'est pas prête ; un échec de ce rendu la remplace par « La page n'a pas pu être mise à jour. ». Si la gomme peut travailler, aucune pastille : la ligne d'état dit l'échec ;
   - la ligne d'état explique la page : ⚠︎ orange tant qu'une raison de vérifier demeure, « Coins posés à la main. » sans ⚠︎ si rien d'autre ne gêne, octogone rouge si le rendu a échoué ;
   - le toast d'enregistrement s'affiche sur le résultat, au-dessus de la barre de réglages ;
   - en bas : rendu, filigrane, format, et « Rétablir la détection auto ».
4. **Export** (feuille) :
   - la liste des PDF, cochables, et le dossier de destination ;
   - s'il reste des pages marquées ⚠︎, une ligne les compte (« 2 pages sont encore à vérifier. »), avec un bouton « Vérifier » qui ferme la feuille et ouvre la première, filtre allumé ;
   - options : texte cherchable, ouvrir le dossier ensuite ;
   - rappel du 200 dpi, du format réel et de la position GPS jamais copiée.

### État

Un modèle observable `ScannerSession`, sur l'acteur principal :

- `pages` : photo source (URL), statut (`queued`, `processing`, `ready`, `failed(ScanError)`), coins auto et coins corrigés, réglages (rendu, filigrane, format), zones gommées, lignes OCR, drapeau « à vérifier » ;
- `documents` : nom, identifiants de pages ordonnés, raison de la suggestion.

Coins, réglages et gomme passent par l'`UndoManager` de la fenêtre, comme les changements de la planche. Une annulation de la planche est l'opération inverse, pas une copie de la planche : un import arrivé entre-temps reste. Une page supprimée pendant son import, quand c'était la dernière en cours, revient dans un document à elle.

### Traitement et performance

- une file de traitement en arrière-plan (groupe de tâches borné au nombre de cœurs). Chaque page apparaît sur la planche dès qu'elle est prête ;
- **mémoire** : aucune photo décodée n'est gardée. Une page garde son URL source, une vignette et son rendu JPEG ; la photo est relue quand une retouche l'exige. 17 photos de 24 Mpx décodées pèseraient 1,6 Go ;
- ordre des étapes par page : chargement → détection → redressement → mise à l'endroit → nettoyage → gomme → encodage JPEG et OCR ;
- une retouche ne relance que les étapes en aval : une gomme refait le rendu et l'OCR, pas la détection (l'OCR tourne sur la page gommée, donc un texte gommé n'entre jamais dans le PDF), un coin ou une rotation refait le redressement, le nettoyage et l'OCR ;
- pendant le glisser d'un coin, seul le tracé bouge (moins de 16 ms par image) ; le rendu se recalcule au lâcher. Rien ne change de taille pendant un glisser ;
- les suggestions de documents sont recalculées quand toutes les pages ont leur OCR, et jamais après une modification manuelle des regroupements.

### Relevé de la revue du moteur

Points relevés à la revue du moteur, pour l'appli. Tous sont traités :

- avec des coins posés par l'utilisateur, ne pas lancer la détection Vision ;
- vérifier l'annulation entre deux pages ;
- les zones gommées sont en coordonnées de la page à l'endroit : tourner une page après une gomme doit tourner les zones du même quart de tour ;
- `PageSizing.renderSize` doit plafonner le grand côté du rendu et refuser NaN (l'utilisateur glisse les coins) ;
- un échec de l'OCR garde la page, sans couche de texte, et la marque ;
- `PDFWriter.write` ne remplace jamais un fichier. Pour le choix « remplacer », l'appli écrit d'abord le nouveau PDF, puis le met à la place de l'ancien avec `FileManager.replaceItemAt` : l'ancien reste intact si l'écriture échoue ;
- quand `write` ajoute un suffixe (« -2 »), le titre du PDF garde le nom demandé : l'appli doit le recalculer ou choisir le nom avant l'écriture ;
- `NameFormatting.duplicates` compare les noms en tenant compte de la casse, alors qu'APFS n'en tient pas compte : « Scan » et « scan » sont un seul fichier.

## Gestion des erreurs

| Cas | Comportement |
|---|---|
| Fichier illisible ou format inconnu | Page « Illisible » avec la raison, le lot continue |
| Aucune page détectée | Coins aux bords de la photo, page marquée ⚠︎ |
| Détection douteuse | Page marquée ⚠︎ (règles plus haut) |
| Pas de texte lu | Document à part, nommé `date-de-la-photo_Document-N` |
| Deux documents au même nom | Signalés sur la planche, export bloqué tant que ce n'est pas réglé |
| PDF déjà présent | Choix : remplacer, ou suffixe « -2 » (pas d'espace ni de parenthèse dans les noms de fichier) |
| Dossier inaccessible, disque plein | Message clair, les documents restent dans l'appli |
| Suppression d'une page | Immédiate, ⌘Z la rend |
| Suppression d'un document | Confirmation nommée : « Supprimer « Contrat » et ses 3 pages ? », qui rappelle ⌘Z |

## Tests

| Niveau | Quoi | Où |
|---|---|---|
| Logique pure | `Geometry`, calage de format, `DocumentSuggester` sur des lignes OCR écrites à la main (marqueurs FR/RO/EN, dates, titres, en-têtes répétés) | `ScanCoreTests` |
| Images de synthèse | Page penchée sur fond gris, générée en code, avec ombre de téléphone, filigrane, texte gras près du bord, coin recouvert. Vérifie les coins (tolérance 0,5 % de la diagonale) et le blanc du papier | `ScanCoreTests` |
| Photos de test | 5-6 vraies photos sans donnée personnelle, avec leurs coins attendus en JSON. Reporté après la v1 | `fixtures/` |
| Lot privé | Les 17 photos réelles, lancées seulement si `fixtures-private/` existe (sinon la suite est désactivée par `.enabled(if:)`) | local |
| PDF | Nombre de pages, taille des pages, texte extractible, absence de métadonnées de localisation, taille du fichier | `PDFCoreTests` |
| Performance | Temps par page sur le lot privé, repère < 1 s, en build optimisé seulement | `PrivateBatchTests` (`ScanCLITests`) |

L'interface est vérifiée à la main en v1 : les tests d'interface automatisés coûtent plus cher à entretenir qu'ils ne rapportent à ce stade.

## Vérifications préalables

Faites le 29/09 pendant la rédaction du plan :

- **le roumain est dans les langues de l'OCR** de Vision (`ro-RO`) ;
- **le JPEG est embarqué sans recompression** dans un PDF Core Graphics : 408 Ko de JPEG donnent un PDF de 418 Ko, et le texte invisible s'extrait ;
- **Core Image suit en vitesse** : dilatation, fermeture 91 px et flou coûtent 50 à 110 ms chacun sur une page A4 de 200 dpi ;
- `CIDivideBlendMode` calcule fond ÷ entrée, et `oriented(.right)` tourne d'un quart de tour dans le sens horaire.

Restent à mesurer dans le plan, sur le lot privé, chacune avec sa solution de repli :

1. **Qualité de l'OCR roumain** sur les marqueurs de page, les dates et les titres. Repli : les titres sans accents sont acceptables.
2. **Nettoyage en Core Image** fidèle au prototype Python. Core Image n'a pas de médiane de 21 px : flou gaussien à la place, comparé au rendu Python par l'écart moyen de pixels. Repli : médiane 3×3 répétée.
3. **Détection du filigrane** juste sur les 16 pages en mode Document. Repli : interrupteur manuel, éteint par défaut.

## Règles techniques

Détaillées dans le guide technique de l'époque (`git show mac-final:wiki/development/technical-guide.md`) :

- Swift 6, concurrence stricte ; pas de `!` ni de `as!` sans commentaire qui justifie ;
- états en enums à valeurs associées, erreurs typées ;
- pas d'abstraction prématurée : un protocole seulement s'il y a au moins deux implémentations ou un service externe (premier cas prévu : le paiement) ;
- une seule source pour les coordonnées (`Geometry.swift`) ;
- frameworks Apple avant toute dépendance ;
- mesurer avant d'optimiser, avec les repères de cette spec ;
- commentaires en anglais, seulement pour le pourquoi ;
- chaînes d'interface dans le catalogue Xcode, FR et EN, dès le départ.

## Suite prévue

Appli iPhone (réutilise `ScanCore` et `PDFCore`, ajoute la caméra), version Web (réécriture selon `algorithm.md`), autres outils PDF dans `PDFCore` et la coquille, puis la couche commerciale.
