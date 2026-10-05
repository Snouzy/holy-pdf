# Version Web — choix techniques

_Décidé le 29 septembre 2026. Construit dans `apps/web/` : les outils Organiser, Compresser, PDF en JPG, Signer, Filigrane, Numéroter, Protéger, Déverrouiller, Aplatir, Pages par feuille, Couper en deux, Pixelliser, Noircir, OCR, PDF en Word, Scanner, Superposer, Signets, Réparer, Modifier et Rogner. La version Web reste un chantier transverse de la [feuille de route](../product/roadmap.md)._

## Principe

Tout le traitement se fait dans le navigateur. Aucun fichier ne part sur un serveur : c'est la même promesse que l'appli de bureau.

## Site

| Choix | Raison |
|---|---|
| **Astro**, une page statique par outil | Le trafic d'un outil PDF vient de la recherche (« fusionner PDF »). Astro produit du HTML statique, sans JavaScript par défaut. |
| **Preact** (avec `compat`) pour l'interface d'un outil, en îlot | Il n'est chargé que sur la page de l'outil. Mesuré : React faisait rater la cible de LCP. |
| **PDFium** en WebAssembly, dans un Worker | Un seul moteur pour presque tout le catalogue, sous licence BSD, compatible avec l'AGPL-3.0 du projet. Le dépôt historique pdf-lib n'a plus de version depuis 2021, mais son fork Cantoo est actif. MuPDF (AGPL ou licence commerciale) serait compatible aussi, mais son adoption serait un remplacement de moteur plus large, à évaluer. Comparaison actualisée dans le benchmark ci-dessous. |
| **qpdf 12.4.2**, Worker temporaire différé | Recompacte les structures après PDFium, sans réencoder à nouveau les JPEG. Distribution `@wasm-zoo/qpdf@0.1.1` épinglée, adaptation ESM de packaging et notices dans `public/licenses/qpdf.txt`. |
| **Cloudflare Workers**, fichiers statiques | Aucun serveur applicatif. Bande passante statique gratuite et illimitée. |

Pas Next.js : son côté serveur (rendu serveur, Server Components, routes API) ne sert à rien quand tout tourne dans le navigateur.

## Moteur

Le moteur est réécrit en TypeScript d'après l'[algorithme du scanner](algorithm.md). Le code Swift ne se partage pas : Swift compile vers WebAssembly depuis la version 6.2, mais Vision, Core Image et ImageIO n'existent pas sur cette cible.

Le partage des rôles reste celui d'Apple : le GPU pour les pixels, WebAssembly pour le calcul sur le processeur, des Web Workers pour que l'interface ne se fige pas.

| Étape | Apple | Web |
|---|---|---|
| Décodage réduit, orientation EXIF | ImageIO | `createImageBitmap` avec `resizeWidth` et `imageOrientation: "from-image"` |
| HEIC | ImageIO | Safari le décode. Chrome et Firefox : libheif en WebAssembly |
| Redressement, filtres | Core Image (GPU) | WebGPU, WebGL2 en secours |
| Détection de page, affinage des bords | Vision | OpenCV.js (WebAssembly, versions SIMD et threads). Le prototype Python utilise déjà OpenCV |
| OCR | Vision | PaddleOCR sur ONNX Runtime Web (WebGPU), ou Tesseract.js |
| Pages en parallèle | `TaskGroup` | Web Workers, `OffscreenCanvas` |
| Aperçu des pages | PDFKit | `FPDF_RenderPageBitmap`, puis `FPDF_FFLDraw` avec l'environnement de formulaire du document (`engine/forms.ts`, ouvert au premier rendu, fermé avec le document) : sans lui, PDFium laisse les champs de formulaire blancs. Sur un formulaire marqué `NeedAppearances`, ce rendu refait l'apparence de chaque champ dans le document ouvert, comme le ferait un lecteur |
| Écriture PDF | `PDFCore` | PDFium, texte en mode de rendu 3 (invisible) |
| Compression, pages en images | PDFKit, ImageIO | PDFium conserve le document et remplace les images ; `OffscreenCanvas` encode le JPEG ; qpdf recompacte les structures |

Le détail et les raisons sont dans la [spec du socle Web](../specs/2026-09-29-web-organiser-design.md). L'habillage (design system Holy PDF) est dans sa [propre spec](../specs/2026-09-30-web-design-system-design.md). Les bibliothèques du scanner sont des choix de départ : sa propre spec les confirmera, selon la règle des dépendances du [guide technique](technical-guide.md).

## Mesures de la compression

### Intégration qpdf — 1er octobre 2026

Après le [benchmark comparatif](compression-benchmark-2026-10-01.md), qpdf est intégré au parcours réel. **33/33 traitements réussissent**, sans fichier livré plus lourd, sur les 11 PDF dans les trois navigateurs. Niveau Recommandée, Apple M1 Pro, macOS arm64, une passe par document et navigateur, contexte neuf, site construit servi localement. Les trois répétitions de l'étude précédente restent distinctes de cette validation intégrée. Les temps incluent le chargement local différé et l'instrumentation ; ils ne prédisent pas un téléphone ou un réseau lent.

| Navigateur | Gain médian PDF 01–05 | Clic → résultat, maximum des 11 |
|---|---:|---:|
| Chromium 153.0.8010.12 | 40,23 % | 6,23 s |
| Firefox 155.0 | 39,84 % | 5,91 s |
| WebKit 26.6 | 33,06 % | 6,03 s |

**Conservation : 33/33 sorties passent la comparaison indépendante avec pdf.js**, sans écart sur les invariants vérifiés : texte, boîtes/rotation des pages, signets et destinations résolues, liens, champs, titre/XMP, balises et pièces jointes. Les autres annotations, actions JavaScript, formulaires dynamiques et calques OCG restent hors de cette vérification.

Le seuil médian de 30 % est franchi dans les trois moteurs. Détail des gains livrés :

| PDF | Chromium | Firefox | WebKit |
|---|---:|---:|---:|
| 01 | 82.79 % | 81.73 % | 72.91 % |
| 02 | 40.23 % | 39.84 % | 33.06 % |
| 03 | 22.72 % | 22.69 % | 22.68 % |
| 04 | 13.49 % | 12.97 % | 12.76 % |
| 05 | 67.87 % | 63.19 % | 38.39 % |
| 06 | 0.00 % | 0.00 % | 0.00 % |
| 07 | 37.53 % | 36.68 % | 34.49 % |
| 08 | 76.84 % | 76.28 % | 72.72 % |
| 09 | 0.00 % | 0.00 % | 0.00 % |
| 10 | 77.99 % | 77.52 % | 69.86 % |
| 11 | 30.89 % | 28.56 % | 12.25 % |

Le PDF 09 déclare PDF/A-3 : le garde-fou conservateur désactive les Object Streams pour tous les PDF/A/PDF/X déclarés, pas uniquement les versions qui les interdisent. Il revient ici à l'original, contrairement au prototype non filtré. Le garde-fou résout les enveloppes de métadonnées et les flux Flate ; les métadonnées inconnues ou illisibles désactivent aussi cette transformation. Cela ne certifie pas la conformité PDF/A ou PDF/X du document réencodé.

qpdf n'est demandé qu'après le clic, dans les 33 parcours. Son Worker est fermé après traitement : observé dans Chromium/Firefox, non observable par Playwright pour les Workers imbriqués WebKit. Les documents comportant une signature numérique sont rendus octet pour octet, sans charger qpdf. Les échecs de téléchargement JS/WASM sont récupérables par une nouvelle tentative qui recrée le Worker.

Mémoire Chromium : pic du processus renderer **664,1 Mo** ; maximum échantillonné JS + backing storage des Workers **177,1 Mo**. Ce sont deux périmètres différents : ni l'un ni l'autre ne démontre le budget de 400 Mo du Worker complet. L'échantillonnage peut manquer un pic et ne couvre pas toutes les allocations natives. Le compacteur borne l'entrée intermédiaire à 128 Mio et termine son Worker au bout de 120 s ; ces garde-fous ne garantissent pas un pic mémoire inférieur à 400 Mo.

Rapport privé et PDF réellement téléchargés : `fixtures-private/compress/runs/compression-integrated-final/`. Reproduction et limites : [Tests](tests.md). Le diagnostic initial WebKit était une erreur du banc, qui bloquait les URL Blob locales : après correction, 11 PDF × 3 passages fonctionnent sans modifier l'encodeur. Aucun essai sur Safari/iPhone physique à ce stade.

La campagne finale suit la suppression de l'import cyclique dans WebKit. Les 33 sorties sont identiques à la campagne précédente après neutralisation du seul `/ID` du trailer (6 le sont déjà octet pour octet). Aucun flux ou contenu de page ne diffère ; les contrôles de qualité ci-dessous restent applicables. Preuve privée : `compression-integrated-final/comparison-previous.json`.

### Qualité des JPEG livrés

Contrôle local avec PyMuPDF et scikit-image : jusqu'à quatre pages par document (première, milieu, dernière et page comportant le plus de pixels d'images), dédupliquées ; rendu à 144 dpi au maximum, plafonné à 4 Mpx. Comparaison de la page entière et de la plus grande zone de placement d'image, recadrée selon sa rotation et les limites de la page : **120 pages et 81 recadrages** sur les trois navigateurs.

| Navigateur | SSIM page minimum / médiane | SSIM image minimum / médiane |
|---|---:|---:|
| Chromium | 0.94359 / 0.99965 | 0.86265 / 0.97551 |
| Firefox | 0.94433 / 0.99974 | 0.86265 / 0.97551 |
| WebKit | 0.96265 / 1.00000 | 0.95272 / 0.99730 |

Inspection visuelle des montages Chromium les plus sensibles : l'encadré raster du guide 11, page 10, garde son texte mais devient plus doux et présente des artefacts JPEG ; la photo de couverture du rapport 02 perd du détail ; le scan 05, page 14, conserve son contenu avec des contours modifiés. **Le minimum historique de 0,955 n'est pas reproduit universellement.** Les médianes proches de 1 incluent des pages inchangées et ne garantissent pas la qualité de chaque photo. Ces scores sont diagnostiques, pas un nouveau seuil d'acceptation inventé après mesure. La compression reste avec perte ; une garantie de fidélité visuelle stricte n'est pas établie.

Les recadrages n'interprètent pas tous les chemins de détourage et les occlusions. Les images 1 bit sont exclues des recadrages, pas du rendu des pages. Fichiers privés : `runs/compression-quality/{chromium,firefox,webkit}/quality.json`, montages et paires pleine résolution `worst-*.png`.

Validation moteur après intégration : **442 tests unitaires**, **375 tests navigateur** (125 par moteur), **104 tests SEO**, build et types sans erreur. Les 33 sorties finales sont vérifiées dans `runs/benchmark-options/integrated-final-structure.json`. Cette campagne valide le moteur ; les changements de disposition du panneau ne modifient pas les PDF produits.

### Historique avant qpdf : document conservé, encodeur Node

_Remesuré le 1er octobre 2026 après correction de la conservation du document, sur les 11 PDF privés, dans Node avec jpeg-js et réduction au plus proche voisin. Les gains historiques de 31 % ne sont plus valides : ils incluaient une suppression de structure._

Niveaux inchangés : Extrême 96 ppi / qualité 0,5 ; Recommandée 150 ppi / 0,6 ; Basse 200 ppi / 0,8. À cette étape historique, aucune nouvelle campagne SSIM n’avait été effectuée ; voir les mesures intégrées ci-dessus.

Les trois dernières colonnes indiquent le **gain du fichier livré**, après retour à l’original si le candidat ne gagne pas au moins 1 %. « Enregistrement seul » indique la variation du poids avant réencodage des images ; un signe + est un grossissement. Les temps détaillés sont dans le rapport privé et restent indicatifs, d’autres tests ayant tourné en parallèle.

| PDF | Contenu | Pages | Mo | Enregistrement seul | Extrême | Recommandée | Basse |
|---|---|---:|---:|---:|---:|---:|---:|
| 01 | rapport avec photos | 74 | 36,9 | +2,8 % | 83,6 % | 73,6 % | 52,6 % |
| 02 | rapport avec photos | 288 | 5,5 | +165,1 % | 0,0 % | 0,0 % | 0,0 % |
| 03 | rapport avec photos | 31 | 5,2 | +4,1 % | 0,0 % | 0,0 % | 0,0 % |
| 04 | rapport avec photos | 230 | 5,8 | +2,6 % | 2,5 % | 2,2 % | 1,7 % |
| 05 | scan JPEG | 41 | 16,8 | +0,8 % | 80,0 % | 54,7 % | 0,0 % |
| 06 | scan noir et blanc | 57 | 2,3 | +0,8 % | 0,0 % | 0,0 % | 0,0 % |
| 07 | présentation | 60 | 7,4 | -0,6 % | 35,8 % | 32,3 % | 26,6 % |
| 08 | présentation | 51 | 11,0 | -0,3 % | 78,0 % | 73,3 % | 63,6 % |
| 09 | texte seul | 151 | 1,5 | +0,5 % | 0,0 % | 0,0 % | 0,0 % |
| 10 | bandeau partagé | 56 | 5,8 | +7,7 % | 74,3 % | 66,6 % | 60,2 % |
| 11 | captures d’écran | 19 | 1,3 | +13,9 % | 25,2 % | 2,9 % | 0,0 % |

**Avant qpdf : gain médian Recommandée, PDF 1 à 5 de 2,23 %, sous le seuil de 30 %. Ce blocage de gain est levé par la mesure navigateur intégrée ci-dessus.**

Le rapport 02 grossit de ×2,65 à l’enregistrement seul et reste à ×2,55 après compression recommandée : l’outil livre donc l’original. Le PDF 03 revient aussi à l’original. Les gains Recommandée des PDF 01 et 05 restent élevés, mais ne suffisent pas à relever la médiane. Cette première correction ne comprenait pas encore la recompaction des flux d’objets.

La structure des **candidats**, avant tout retour à l’original, est comparée avec pdf.js sur les 11 fichiers : signets et leurs destinations, liens, titre, XMP, champs, pièces jointes, indicateur de balisage et pages balisées. Une fixture synthétique vérifie aussi le contenu des pièces jointes et les balises détaillées.

| Document | Signets avant → après | Liens internes avant → après | Titre | Pages balisées avant → après |
|---|---:|---:|---|---:|
| PDF 02 | 30 → 30 | 32 → 32 | conservé | 288 → 288 |
| PDF 09 | 219 → 219 | 1651 → 1651 | conservé | 0 → 0 |
| PDF 11 | 14 → 14 | 69 → 69 | conservé | 19 → 19 |

Le scan 05 contient 37 JPEG avec masque explicite `/Mask` : le précédent remplacement direct les supprimait. Ces masques sont maintenant conservés, y compris après réduction des photos.

Reproduction : `cd apps/web && MEASURE_DIR=../../fixtures-private/compress pnpm vitest run tests/engine/measure.test.ts --silent=false`. Rapports JSON/Markdown, détails de structure et candidats Recommandée : `fixtures-private/compress/runs/preserve-structure/` (ignoré par git).

## Mesures du site

_Remesuré à la clôture le 1er octobre 2026 (`INDEXABLE=true pnpm build`, puis `pnpm lighthouse`), 5 pages × 3 passes, toutes les assertions passent. Les textes définitifs de compression et le panneau persistant sont inclus. Une retouche indépendante de la bordure de navigation et son rebuild sont intervenus pendant la collecte : les accueils ont été mesurés avant cette retouche, les dernières pages outils après. Cette campagne n'est donc pas présentée comme une mesure d'un build immuable unique ; la vérification de la bordure est suivie séparément._

| Page | LCP médian | CLS | JavaScript | Document |
|---|---:|---:|---:|---:|
| `/en/` | 1359 ms | 0 | 23163 o | 25639 o |
| `/fr/` | 1356 ms | 0 | 23163 o | 25904 o |
| `/en/merge-pdf/` | 1519 ms | 0 | 39806 o | 20313 o |
| `/fr/fusionner-pdf/` | 1520 ms | 0 | 39806 o | 20560 o |
| `/en/compress-pdf/` | 1521 ms | 0 | 39806 o | 20498 o |

Mesure de clôture : toutes les assertions Lighthouse CI passent sur les trois passes de chaque page. Budget JavaScript des pages outils rétabli à **51 200 octets (50 Ko)** ; poids mesuré **39 806 octets**. LCP médian des outils autour de 1,52 s (budget 1,6 s), accueil autour de 1,36 s (budget 1,5 s), CLS nul. Les octets sont ceux du transfert relevé par Lighthouse CI. La grille des pages reste chargée avec le premier fichier.

Accueil avec la vidéo (3 octobre 2026) : LCP 1 204 ms en anglais, 1 279 ms en français (l'affiche de la vidéo s'y charge), document 37 175 o et 38 026 o, aucun JavaScript séparé.

Accueil refait (3 octobre 2026, avec la phrase à trous et son menu, `INDEXABLE=true pnpm build` puis `pnpm lighthouse`, 3 passes) : LCP 1 202 à 1 216 ms, CLS 0, document 36 283 o en anglais et 36 829 o en français avec la carte du scanner, soit 35 o sous le budget, aucun fichier JavaScript : les scripts des filtres et de la phrase sont dans la page. Le budget du document de l'accueil passe de 28 672 à 36 864 o, puis à 40 960 o le 3 octobre (choix de l'auteur, pour faire place à la vidéo). Sans l'îlot de la zone d'import, la page pèse environ 17 Ko de moins au total : avant, 28,1 Ko de document et 23,2 Ko de JavaScript. Le budget JavaScript de 24 Ko reste en place.

Page de contenu `/fr/mentions-legales/` (2 octobre 2026, une passe) : LCP 1 053 ms, CLS 0, document 12 043 o, aucun fichier JavaScript chargé (les scripts de `Base.astro` sont dans la page), polices 25 886 o ; les quatre scores Lighthouse à 1.

Temps de traitement remesurés à la clôture, sur un PDF de 20 pages avec photos (55,6 Mo), dans Chromium sans interface (`pnpm bench`, quatre cas, un seul worker de test, sans autre suite en parallèle) :

| Outil | Temps | Cible |
|---|---|---|
| Compresser, niveau Recommandée | 1,9 s | moins de 10 s |
| PDF en JPG | 1,9 s | moins de 8 s |

Mémoire sur cette passe : le processus de rendu passe de 317 Mio au repos à un pic de 558 Mio en Compresser ; PDF en JPG passe de 317 à 472 Mio. Ce chiffre couvre tout le processus, pas le Worker seul ; sa limite de 400 Mo n'est donc pas directement vérifiée. La mesure CDP complémentaire des Workers reste partielle, comme détaillé dans la campagne des 11 PDF ci-dessus. Le budget total du Worker reste à confirmer.

Le benchmark global (`tests/bench/bench.spec.ts`, inclus par `pnpm bench`) est réparé : il distingue les pages de la tuile d'ajout, mesure la rotation sur Pivoter et suit le parcours fusion → résultat → téléchargement. Les quatre cas passent, avec les seuils initiaux conservés ; les limites de 10 s et 8 s du lot 1 sont désormais vérifiées par des assertions.

| Mesure | Machine locale | CPU ralenti ×4 | Cible locale / ×4 |
|---|---:|---:|---:|
| Premières 12 vignettes d'un PDF de 100 pages | 398 ms | 553 ms | 500 / 1 500 ms |
| Rotation des 100 pages, mutation DOM | 3,7 ms | 15,6 ms | 16 / 16 ms |
| Fusion de 10 fichiers de 50 pages, résultat prêt | 1 414 ms | 5 536 ms | 3 000 / 10 000 ms |

Une première passe avait mesuré 17 ms pour la rotation sous CPU ×4 : la marge reste faible. La dernière mesure compare la valeur brute au seuil, sans arrondi. Elle mesure le changement du style, pas la peinture finale. Le ralentissement du processeur ne simule ni toute la mémoire ni les performances d'un téléphone réel. Les temps des premières vignettes sont horodatés dans le prédicat navigateur, sans ajout du trajet de retour Playwright.

Partage sur téléphone : vérification reportée le 1er octobre, à faire sur un aperçu en ligne. `navigator.share` demande HTTPS ou localhost. Une fois un aperçu de la branche en ligne, ouvrir `/fr/pdf-en-jpg` sur un iPhone (Safari) et, si possible, sur Android (Chrome), convertir un PDF de 3 pages, toucher « Enregistrer les 3 images » et vérifier que « Enregistrer les images » les met dans Photos. Cette recette physique reste distincte des tests navigateur automatisés.

## Validation du panneau après correction

Le panneau reste à droite pendant la lecture des explications, de la FAQ et des outils liés, qui occupent la colonne gauche. Sur écran bas, ses options défilent séparément de l'action ; l'ordre mobile reste intact. La correction de persistance est vérifiée visuellement à 1024 × 600 et 1280 × 720, puis par **30 tests navigateur ciblés** sur les trois moteurs, **104 tests SEO**, types et build sans erreur. Les tests vérifient simultanément l'action visible et le contenu adjacent cliquable. Les campagnes complètes précédentes (384 tests navigateur, 442 tests unitaires et Lighthouse) ne sont pas présentées comme de nouvelles exécutions pour cette correction CSS ; le moteur PDF est inchangé.

## Signer — Frère Plume

Chargement ajusté le 2 octobre : `board/DocumentSkeleton.tsx` affiche une feuille statique pendant l’ouverture et le rendu d’aperçu, sans onglet transitoire. Le retrait, les erreurs et le mot de passe restent accessibles. Aucun moteur ni dépendance ajouté ; l’éditeur reste différé. Types valides, neuf parcours ciblés passent sur Chromium/Firefox/WebKit : ouverture → rendu, annulation, déverrouillage et fichier invalide. Rendu inspecté à 1280 px et à 390 px en thème sombre, sans débordement ni animation du skeleton. Contrôles temporaires et captures dans `/tmp/holy-pdf-skeleton-check` et `/tmp/holy-pdf-skeleton-*.png`.

`/fr/signer-pdf` et `/en/sign-pdf` ajoutent une signature visuelle dessinée, saisie en texte ou importée depuis un PNG/JPG/JPEG. Le texte original et les pages ne sont pas rastérisés. Le dessin sort sur fond transparent ; un PNG conserve sa transparence et un JPEG conserve son fond. Il ne s'agit pas d'une signature avec certificat. Les PDF possédant déjà une signature numérique sont refusés ; un PDF protégé, ouvert avec son mot de passe, suit l'avertissement existant d'export sans protection.

L'éditeur `signature/SignatureEditor.tsx` et ses textes sont différés jusqu'à l'ouverture du PDF. Une page est prévisualisée à la fois ; les demandes périmées sont ignorées et les URL libérées. Les limites de pixels sont contrôlées avant le décodage PNG/JPEG et avant le rendu d'aperçu. Le dessin ne reconstruit pas l'interface à chaque point. La signature et les placements restent en mémoire, sans stockage persistant, et survivent à une bascule FR/EN ainsi qu'au retour depuis le résultat.

`engine/sign.ts` rouvre les octets d'origine pour chaque export. Une minuscule page temporaire par marque différente fournit un Form XObject partagé entre ses placements. Ce sont les ressources de cette signature qui sont importées, jamais les pages de l'utilisateur. Dix placements partagent donc une image et un masque. La géométrie utilise trois coins convertis par PDFium ; l'interpolation conserve la précision avec rotation et CropBox décalée. Le texte, les liens, signets, formulaires, balises et pièces jointes de la fixture riche sont comparés avec un lecteur indépendant dans les tests moteur.

La sauvegarde PDFium peut toujours décompacter les structures internes d'un original ; Signer ne charge pas qpdf. L'outil n'annonce pas une réduction de taille. La conservation de structure vérifiée sur les fixtures n'est pas une certification PDF/A/PDF/X ou une preuve de conformité d'accessibilité de la signature ajoutée.

La barre de navigation flotte en bas de la zone document et s’arrête avant la FAQ. Sur mobile, un `ResizeObserver` réserve la hauteur réelle de l’action finale ; aucun gestionnaire de défilement n’est ajouté. Le document prêt n’affiche plus son étiquette. Zoom 50–200 % et rotation de page sont des transformations de l’aperçu existant, sans nouveau rendu PDF. Une poignée de 10 px au coin ajuste la taille ; le bouton de rotation de 32 px reste séparé sous la signature. Leurs cibles tactiles font 44 px. La rotation ajuste librement l’angle (Maj : 15°, clavier : 1°). Les déplacements tiennent compte du zoom et de la rotation de page ; seuls les coins réellement tournés bornent la signature à la feuille. Le rectangle avant rotation peut avoir des coordonnées négatives : ces valeurs sont acceptées par le moteur si le contenu transformé reste dans la page. Le glisser du coin conserve le coin opposé ; le clavier et le curseur du panneau conservent le centre. À l’export, les angles des signatures sont appliqués en coordonnées physiques et la rotation de chaque page est ajoutée à celle de l’original après insertion.

Spec : [Signer](../specs/2026-10-01-web-sign-design.md).

### Texte, initiales et plusieurs signatures

L'ajout se fait en une seule action, commune aux trois modes : « Ajouter sur cette page », dans le pied du panneau au-dessus de l'export. Cette zone est séparée du contenu défilant ; elle ne recouvre pas l'aperçu sur un écran bas. Le texte actualise automatiquement le brouillon prêt ; le dessin calcule son image uniquement en fin de geste ou après annulation, jamais pendant les mouvements. Changer de mode restaure son propre brouillon ; effacer la saisie invalide immédiatement l'ajout. Les marques déjà placées restent exportables même sans nouveau brouillon.

La consigne au-dessus du PDF dépend uniquement de la sélection, jamais de la préparation temporaire du brouillon pendant la frappe. Les consignes de placement et de manipulation occupent la même cellule CSS Grid ; la consigne inactive reste dans le calcul de hauteur mais est masquée visuellement et aux technologies d'assistance. La hauteur suit donc le texte le plus long à chaque largeur, sans mesure JavaScript ni saut de page. L'aide d'ajout dans le panneau reste également présente pendant la saisie.

Un clic dans le PDF sans sélection propose « Ajouter ici » au point choisi. Les coordonnées sont converties vers le repère original de la page, après zoom et rotation. Le premier clic extérieur à une sélection ne fait que la désélectionner ; les gestes de déplacement ne proposent pas d'ajout. La proposition disparaît lors d'un changement de page, zoom, rotation ou brouillon.

Validation de cet ajout direct, le 2 octobre : **78 scénarios Signer** passent sur Chromium/Firefox/WebKit, build et types finaux valides (**153 fichiers sans diagnostic**), **545 tests unitaires/moteur passent, 1 ignoré**. Le bouton est vérifié sans scroll automatique à 1280 × 720, sans chevauchement des options. Captures dans `fixtures-private/sign/insertion/`. Aucun nouveau chargement ni dépendance ; les mesures Lighthouse ci-dessous sont celles de l'étape texte antérieure.

La sélection propose une poubelle à côté de la rotation, sous l'élément (au-dessus près du bas de page). Elle supprime uniquement ce placement et libère sa ressource si elle n'est plus utilisée ni préparée pour un prochain ajout. La suppression du panneau utilise la même fonction.

Le mode Texte conserve sa saisie quand on change d'onglet. `TypedSignature.tsx` n'est monté qu'à sa première ouverture ; `typedText.ts` charge alors Caveat Regular (24 904 octets, OFL, auto-hébergée), puis dessine une ligne de 120 caractères maximum sur un canvas transparent. Le style Simple utilise Figtree déjà présent ; si Figtree n'a pas pu se charger, il dessine avec la police de secours que la page affiche déjà, sans bloquer (mesuré le 2 octobre 2026 : sous charge, le serveur de test laisse parfois Figtree en erreur, et WebKit renvoie alors une liste vide). Caveat doit être chargée avant le rendu ; une panne de chargement propose Réessayer. L'aperçu et l'image ajoutée partagent les mêmes pixels ; le texte original du PDF reste sélectionnable mais la marque ajoutée est une image. La taille initiale du texte dépend de ses proportions, pour que des initiales ne soient pas aussi larges qu'une mention entière.

`SignatureDraft.images` associe chaque `imageId` aux pixels RGBA ; les placements conservent leur propre référence quand on prépare un autre texte ou dessin. Les aperçus Blob sont mis en cache par ressource et révoqués quand elle n'est plus utilisée. Le redimensionnement d'un élément ancien utilise ses propres proportions. Le moteur crée un Form partagé par ressource distincte et conserve l'ordre des placements. Le client copie seulement les images référencées avant transfert ; les pixels de l'éditeur restent disponibles pour un autre export. Validation commune : 1 Mpx par image et 16 Mpx cumulés, soit 64 Mo de pixels RGBA source au maximum (pas une mesure de la mémoire totale). La police et sa provenance sont dans `apps/web/public/fonts/signature/`.

Validation texte du 2 octobre : **545 tests unitaires/moteur passent, 1 ignoré**, **114 tests SEO**, types sans diagnostic sur **152 fichiers** et build valides. **69 scénarios Signer** passent sur Chromium, Firefox et WebKit. Les nouveaux scénarios relisent trois images distinctes dans le PDF, vérifient leur alpha et le texte original, conservent les proportions d'une ancienne marque et reprennent après échec de police. Captures à 1280 et 390 px examinées, conservées dans `fixtures-private/sign/text/`.

Lighthouse après ajout du texte, trois passes sur Signer avec le même build : **41 942 octets de JavaScript / 51 200**, polices initiales **25 886 / 81 920**, LCP médian **1 523,51 / 1 600 ms**, CLS et TBT nuls. Performance, accessibilité et bonnes pratiques : 100. L'audit SEO vaut 66 uniquement à cause du `noindex` volontaire du build local (`INDEXABLE` absent) ; l'ensemble des assertions Lighthouse n'est donc pas vert. Caveat n'est pas chargée au premier affichage. Rapports et assertions dans `fixtures-private/sign/text-lighthouse/` ; aucun changement des budgets ni de l'indexation pour cette mesure.

### Dessin lissé et poignées

`signature/drawing.ts` conserve les traits dans une limite de 12 000 points. Chaque nouvel échantillon ajoute un segment quadratique de Bézier, avec stabilisation légère adaptée à la vitesse pour la souris. Le stylet et le toucher ne reçoivent pas ce filtre de position. Les événements regroupés sont consommés lorsqu'ils sont disponibles ; sinon le mouvement normal suffit. Le point final et les clics isolés sont conservés. Aucun recalcul du trait complet pendant les mouvements ; la relecture intervient pour annuler un trait ou passer d'une surface de dessin à l'autre.

`DrawingSurface.tsx` partage le même dessin entre le panneau et une boîte de dialogue agrandie. Annuler enlève uniquement le dernier trait ; Échap ferme la boîte et rend le focus au bouton d'ouverture. Les deux canvas ont chacun 1280 × 480 pixels, le fond blanc est uniquement visuel et l'export conserve l'alpha. Une limite atteinte est signalée, avec les choix d'annuler, effacer ou utiliser le dessin.

La poignée de taille est un carré visible de 10 px au coin inférieur droit local, avec une cible de 44 px principalement extérieure au dessin. `resizeFromCorner` projette le déplacement sur la diagonale tournée, conserve les proportions et le coin opposé, puis borne le facteur d'échelle avec les quatre coins réels. Le clavier et le curseur du panneau gardent leur redimensionnement centré. Le bouton de rotation reste séparé sous les bounds réels après rotation de la page ; il passe au-dessus près du bas de la feuille. Un clic ou un focus hors de la sélection et de ses commandes masque cadre et poignées ; Échap fait de même. Le dessin reste cliquable pour être sélectionné à nouveau. Aucun rendu PDF n'est déclenché par ces opérations.

Après le retour sur la poignée de coin et la désélection : **88 tests ciblés unitaires/moteur/polices**, **45 scénarios navigateur sur les trois moteurs**, types (148 fichiers) et build passent. Captures à 1280 et 390 px examinées.

Validation antérieure du dessin, le 2 octobre : **522 tests unitaires/moteur réussis, 1 ignoré**, types sans diagnostic sur **148 fichiers**, build et **114 tests SEO** valides. Les **60 scénarios Signer** passent sur Chromium, Firefox et WebKit, aux largeurs 1280 et 390 px pour les contrôles concernés. Ils vérifient notamment les bords après rotation, le centre après redimensionnement, les commandes hors de la signature, l'annulation, la transparence exportée et le retour du focus après fermeture du dialogue.

Mesure isolée Chromium 153 sur 10 000 points : p95 sous la résolution de l'horloge (0,1 ms), dans les 500 premiers comme dans les 500 derniers points ; maximum observé 0,5 ms. Cela mesure la distribution synchrone de l'événement, le filtre et les commandes canvas, sans inclure le GPU ni la latence jusqu'à l'affichage. Rapport et captures dans `fixtures-private/sign/drawing/`. Le test navigateur vérifie également le nombre linéaire de segments pour 5 000 points. Aucune dépendance ajoutée ; les mesures Lighthouse précédentes n'ont pas été relancées pour ce changement chargé à la demande.

### Retours de recette — PNG, zoom et rotations

PNG/JPG/JPEG acceptés, limites 10 Mio / 16 Mpx avant décodage et normalisation à 1 Mpx conservées. L'alpha nul, partiel et opaque du PNG est relu indépendamment dans le PDF exporté. La navigation reste cliquable après défilement, sans déplacement automatique du banc pour atteindre les boutons, sur ordinateur et écran étroit.

Après ces changements : build et types (143 fichiers) valides, **507 tests unitaires/moteur** réussis et une mesure privée ignorée, **114 tests SEO** et **42 scénarios Signer sur les trois navigateurs** réussis, puis **6 contrôles zoom/rotations** réussis après ajout du cas mobile (trois cas déjà couverts, trois nouveaux). Captures de navigation et de poignée vérifiées ; les mesures Lighthouse et les temps ci-dessous décrivent la campagne antérieure, pas une nouvelle exécution. Aucun moteur ou bibliothèque ajouté ; zoom, rotation d'aperçu et déplacement réutilisent le même rendu de page.

### Mesures Signer — 1er octobre 2026

Trois répétitions dans Chromium 153, sur un PDF synthétique de 20 pages photo (29 466 437 octets), avec 20 placements de la même signature JPG. L'image importée de 2560 × 1600 est ramenée à 1264 × 790 (998 560 pixels). Rapport, empreintes SHA256 et captures clair/sombre à 1280 × 900 et 390 × 844 : `fixtures-private/sign/`.

| Mesure navigateur | Résultat |
|---|---|
| Ouverture jusqu'à l'aperçu, médiane | 230 ms |
| Import jusqu'à la signature prête, médiane | 103 ms |
| Export jusqu'au résultat, médiane | 242 ms (235 / 244 / 242 ms) |
| Taille de chaque sortie | 29 934 187 octets, soit +467 750 octets pour 20 placements |
| Déplacement, p95 événement → mutation de style | 0,5 / 0,7 / 0,7 ms sur 60 mouvements par répétition |
| Nouveau rendu PDF pendant le déplacement | 0 demande |

Ces temps incluent les attentes d'interface pour l'ouverture, l'import et l'export. Le déplacement mesure la mise à jour du DOM, **pas** la peinture ou le GPU. Cette campagne sur un ordinateur et un fichier synthétique ne garantit ni les temps de tous les PDF ni les performances d'un téléphone physique. Elle ne mesure pas la mémoire totale du Worker.

Microbenchmark Node/WASM, image de 1 Mpx et trois passages : le partage de ressources fait passer dix placements d'une photo bruitée de 12,23 Mo / 638 ms à **1,23 Mo / 77 ms** ; un dessin passe de 91,8 Ko / 199 ms à **16,3 Ko / 30 ms**. Dans ces deux cas, neuf placements supplémentaires coûtent seulement 1 344 octets. Ces mesures moteur ne sont pas confondues avec le parcours navigateur ci-dessus.

Validation : **491 tests unitaires**, une mesure privée ignorée, **114 tests SEO**, types (141 fichiers) et build valides. La campagne complète des trois navigateurs passe **411 scénarios** ; après les dernières protections d'aperçu et le dessin par segment, les **30 tests Signer** passent sur Chromium, Firefox et WebKit. Les aperçus page/signature défaillants désactivent Ajouter et Signer, avec reprise explicite, sans perdre les placements.

Lighthouse final : **18 passages sur six pages**, sans reconstruction pendant la collecte, et toutes les assertions réussies. Le transfert JavaScript vaut **23 259 / 24 576 octets** sur les accueils et **41 554 / 51 200 octets** sur les pages outils, Signer compris. LCP médian : accueil EN 1 382 ms, FR 1 356 ms (budget 1 500 ms) ; Fusionner EN 1 524 ms, FR 1 522 ms, Compresser 1 523 ms et Signer 1 524 ms (budget 1 600 ms). Les six passes représentatives obtiennent 100 dans les quatre catégories, avec CLS nul et TBT de 0 à 1 ms. Une passe isolée Compresser obtient 92 en performance ; la configuration évalue les assertions sur la passe représentative, qui obtient 100. Rapports bruts, configuration, assertions et synthèse archivés dans `fixtures-private/sign/lighthouse/` ; budgets inchangés.

## Pages de contenu

_Ajoutées le 2 octobre 2026 : [spec](../specs/2026-10-02-web-pages-design.md)._

Les liens du pied de page mènent à 12 pages, en français et en anglais : Nouveautés, FAQ, Blog, Guides PDF, Applis (`#mac`, `#iphone`), Confidentialité, Conditions d'utilisation, Mentions légales, Cookies, À propos, Contact, Presse. Seules les icônes des réseaux sociaux pointent encore vers `#`.

| Fichier | Rôle |
|---|---|
| `src/sitePages.ts` | les ids, les slugs traduits, l'émoji de chaque page ; `pagePath`, `articlePath` |
| `src/content/pages/<lang>/<id>.md` | le texte d'une page, son titre, sa description, son sous-titre (`lead`), sa date (`updated`) |
| `src/content/articles/<lang>/<fichier>.md` | un article du blog ou un guide (`section`), son `slug` traduit, sa date (`published`) |
| `src/layouts/ContentPage.astro` | l'en-tête centré et la colonne de texte ; aucun îlot |
| `src/pages/[lang]/[page].astro` | les pages ; la liste des articles sous Blog et Guides, les liens vers chaque outil sous la FAQ |
| `src/pages/[lang]/[section]/[article].astro` | les articles, avec `BlogPosting` en JSON-LD |
| `src/i18n/pages.ts` | les libellés du gabarit, à part de `fr.ts` et `en.ts` que `Board.tsx` importe en entier |

**Ajouter du contenu :**

- un article : un fichier `.md` par langue, même nom de fichier, dans `src/content/articles/<lang>/`. Aucun fichier TS à toucher ;
- une page : son id et ses slugs dans `sitePages.ts`, un `.md` par langue, un lien dans `SiteFooter.astro` si elle y figure ;
- une langue : la langue dans `languages` (`tools.ts`). TypeScript demande alors un slug pour chaque page et chaque outil, et les libellés de `i18n/pages.ts` ; puis un `.md` par page et par article.

Les textes français mettent une espace insécable à l'intérieur des guillemets « », pour qu'ils ne se séparent pas de leur mot en fin de ligne.

## Accueil

_Refait le 2 octobre 2026 : [spec](../specs/2026-10-02-web-landing-design.md)._

Le haut est une phrase à trous : « Je veux [verbe] mes PDF. ». Le menu donne douze verbes, chacun lié à un outil (`home.pick.verbs` dans les dictionnaires). C'est un bouton `combobox` et sa liste `listbox`, pas un `<select>` : le menu natif reprenait la taille de la phrase. Le script de `src/home/Pick.astro` gère le clavier, met le moine du verbe dans la pastille (il le copie depuis la liste) et change le lien du bouton. Puis le monastère, puis six sections : Trois gestes, Cas d'usage, Confidentialité, Pourquoi des moines, FAQ en conversation, bandeau final. Tout est rendu au build : l'accueil n'hydrate aucun îlot. Son seul script reste celui des filtres du monastère, écrit dans la page.

| Fichier | Rôle |
|---|---|
| `src/pages/[lang]/index.astro` | la page ; la liste des cas d'usage (moines, liens) et les moines des trois gestes |
| `src/i18n/frSite.ts`, `enSite.ts` | les textes, sous `home` |
| `src/cast.ts` | l'émoji de chaque titre (`titleEmoji`) |
| `src/home/filters.ts` | les filtres, le bouton « Les montrer » qui allume l'interrupteur, et le fondu des rangées qui défilent de côté |
| `src/home/Pick.astro` | la phrase « Je veux [verbe] mes PDF. », son menu (ouverture, clavier, choix, moine de la pastille, lien du bouton) ; en version `compact` sur la page 404 |
| `src/films.ts`, `src/home/film.ts` | la vidéo par langue ; le bouton du haut qui l'ouvre dans un `<dialog>` et l'arrête à la fermeture |
| `src/pages/[lang]/404.astro` | la page 404, une par langue |
| `src/faq.ts` | l'ancre d'une question, le JSON-LD `FAQPage`, les questions d'une page Markdown |

La FAQ de l'accueil a ses propres textes, plus courts que ceux de la page FAQ. Une question ajoutée à la page FAQ ne s'ajoute donc pas toute seule à l'accueil.

## Pièges connus

- **Nouvelle route en développement** : le serveur Astro lancé avant l'ajout de Signer répondait encore 404 sur les nouvelles routes FR/EN, bien que le catalogue affiche l'outil et que le build fonctionne. Un redémarrage de `pnpm dev` sur le même port a rétabli les routes ; le parcours de signature et réexport a ensuite été vérifié sur 4321. Après ajout d'un outil, contrôler aussi le serveur déjà utilisé pour la recette, pas seulement le site construit sur 8787.

- **Séparation de la navigation** : `SiteNav.astro` utilise une bordure inférieure de 1 px, transparente au repos et `--line` au défilement ou avec un menu ouvert. Pas d’ombre sous la barre ; la bordure existe dans les deux états pour garder la hauteur stable.
- **Liens de la barre** : Fusionner, Signer, Compresser, puis les menus Convertir et Tous les outils. Signer remplace Diviser depuis le 3 octobre 2026 ; le pied de page garde Diviser. Au survol, le logo prend la couleur d'accent et son moine penche, pour montrer qu'il mène à l'accueil.
- **Style d'un composant de mise en page en développement** : après un changement de `SiteNav.astro`, `astro dev` a continué de servir l'ancien style, alors que celui de la page suivait. Vérifier sur un build, ou relancer le serveur.

- **Panneau et sections sous l'outil** : avec un document chargé, `main` devient une grille à deux colonnes. L'aire `panel` s'étend du titre aux outils liés ; les explications, le texte et la FAQ ont leurs propres aires dans la colonne gauche. Le panneau reste ainsi visible au défilement sans recouvrir le contenu. `.workshop` reste `display: contents` : le limiter à ce wrapper faisait disparaître le panneau pendant la lecture. `.panel-content` défile dans l'espace disponible ; `.go` garde sa propre place. Le téléphone conserve l'ordre moine → fichiers → options → action. Les régressions vérifient ensemble panneau/bouton visibles et clics accessibles dans le contenu adjacent.

- **Identifiant d'un article** : le chargeur `glob` prend le champ `slug` du frontmatter comme identifiant. La collection `articles` impose `generateId` pour garder `<langue>/<fichier>`, qui apparie les deux langues d'un article.
- **Ancres d'une page de contenu** : Markdown dérive l'id d'un titre de son texte. Une ancre visée par un lien (`#mac`, `#iphone`) s'écrit en HTML dans le `.md` : `<h2 id="mac">`.
- **Titre d'une page de contenu sur téléphone** : dans l'en-tête en flex, la largeur minimale du `h1` est celle de son mot le plus long. `overflow-wrap: break-word` ne la réduit pas : Firefox, à 320 px et polices de repli, débordait de 16 px sur « Confidentialité ». Le titre prend `overflow-wrap: anywhere`, et la césure seulement sous 30 rem.
- **Taille** : le build complet d'OpenCV.js pèse environ 10 Mo, sans les modèles d'OCR. Faire un build réduit aux fonctions utiles. Charger le moteur à la première photo déposée, pas à l'ouverture de la page. L'OCR sert aussi à trouver l'orientation, il ne peut donc pas attendre l'export.
- **Threads WebAssembly** : ils demandent `SharedArrayBuffer`, donc les en-têtes COOP et COEP. Les outils Organiser n'en ont pas besoin. Les mettre seulement sur les pages du scanner : sous COEP, chaque ressource externe (police, analytics) doit envoyer un en-tête CORP ou CORS.
- **Conservation du document** : Compresser enregistre le document source, sans recopier ses pages. La copie dans un document neuf perdait signets, destinations, formulaires, balises, pièces jointes et métadonnées. Cet enregistrement décompacte les structures internes ; qpdf les recompacte ensuite avec `--object-streams=generate --compress-streams=y` lorsque le profil le permet. Le retour à l'original sous 1 % de gain reste appliqué au résultat final.
- **Chargement qpdf et WebKit** : le petit adaptateur `compact.ts` est importé statiquement dans le Worker principal ; le Worker qpdf et son WASM ne sont créés/chargés qu'à l'action Compresser. Un import dynamique de l'adaptateur produisait un chunk réimportant l'entrée du Worker : WebKit la réexécutait et dupliquait la classe d'erreur, transformant un échec réseau en « fichier endommagé ». Le test de téléchargement interrompu du script du Worker et du WASM couvre cette reprise.
- **`EPDFImageObj_SetJpeg`** écrit un dictionnaire neuf et peut supprimer les masques `/SMask` et `/Mask`. Compresser ne l'appelle plus : il réécrit le flux de l'image dans le fichier source enregistré (`imageStreams.ts`) et garde les masques, `/Interpolate`, `/Metadata`, `/Intent` et `/Name`. Les masques eux-mêmes ne sont pas réencodés.
- **Réécriture du flux** : elle suppose la mise en page de PDFium (une seule table xref classique aux bons décalages, `/Length` direct, pas de flux d'objets). Sinon, elle rend les octets tels quels. Elle laisse les masques avec `/Matte`, les masques de couleur `/Mask [...]` et les clés inconnues (`/OC`, `/StructParent`…). Les masques explicites indirects sont conservés si leur objet est un masque stencil. Si des octets identiques ont des dictionnaires de décodage différents (`/Decode`, palette, dimensions…), les images restent intactes. Les ressources d'apparence d'annotations sont exclues de la réécriture, car leur taille affichée n'est pas inventoriée.
- **Variables d'environnement** : un module qu'un îlot importe (`site.ts`, `tools.ts`…) tourne aussi dans le navigateur, où `process` n'existe pas. Le build retire le code inutilisé et le cache ; `astro dev` ne le retire pas, et l'îlot ne s'hydrate plus. Les variables d'environnement se lisent dans le frontmatter d'un `.astro` (`INDEXABLE` dans `Base.astro`). Le test `tests/unit/browser.test.ts` le vérifie.
- **Images partagées et formulaires XObject** : le JPEG est calculé une fois pour le plus grand placement de l'image, en composant les matrices des formulaires imbriqués. La réécriture du flux garde les références partagées et ne modifie pas le contenu des pages ou formulaires.
- **Extraction des photos** : `FPDFImageObj_GetRenderedBitmap` applique le détourage et la taille du placement ; `GetBitmap` seul perd les masques. `nativeImages.ts` enregistre une copie temporaire une seule fois et ajoute des pages isolées qui référencent chaque ressource image à ses dimensions natives. Le rendu conserve masque et espace couleur, sans recadrage ; le JPEG est posé sur blanc. La déduplication compare les pixels rendus, pas seulement les octets du flux, car un même flux peut porter des masques différents.
- **Limites de l'extraction native** : l'association repose sur les flux décodés et les dimensions, car l'enregistrement peut ajouter un filtre Flate. Les variantes de masques ou de couleurs sont distinguées au rendu. Les images inline sans ressource XObject sérialisée sont refusées explicitement ; elles ne sont pas remplacées par une extraction recadrée. Les données décodées sont limitées à 64 Mo avant allocation.
- **Encodeur JPEG** : vérifier le contexte 2D avant et après dessin, le type et les marqueurs du résultat. Entrée et sortie sont limitées à 16 millions de pixels et 16 384 pixels par côté ; une image native au-delà de cette limite produit l'erreur de taille, sans export partiel silencieux. Les surfaces canvas sont libérées après encodage.
- **Noms et recherche** : réserver tous les noms d'origine avant d'ajouter des suffixes évite les collisions `scan`, `scan`, `scan-2`. La recherche ignore les mots de contexte, normalise les pluriels de formats et départage les conversions selon l'ordre PDF/format demandé.
- **Tests du moteur** : Node n'a pas d'`OffscreenCanvas`. Les tests passent un encodeur `jpeg-js` (dépendance de développement seulement), avec une mise à l'échelle au plus proche voisin.
- **Script partagé entre deux pages** : un module importé par les scripts de deux pages devient un fichier à part, et le script de la page aussi : l'accueil a perdu 150 à 230 ms de LCP le jour où `pick.ts` a servi aussi à la 404. Le code d'un composant partagé va dans le `<script>` du composant lui-même, sans import : Astro l'écrit dans chaque page.
- **Page 404 par langue** : Cloudflare (`not_found_handling: "404-page"`) sert le `404.html` le plus proche de l'adresse demandée, mais Astro écrit `fr/404/index.html` avec `build.format: "directory"`. L'intégration `not-found-pages` de `astro.config.mjs` déplace ces fichiers en `fr/404.html` et `en/404.html` après le build, et copie l'anglaise à la racine pour les adresses hors langue.
- **Vidéo** : `preload="none"` ne charge que l'affiche ; l'affiche d'une vidéo se télécharge même dans un `<dialog>` fermé, d'où une seule affiche légère (13 Ko) pour l'aperçu, la fenêtre et la bulle. Le Chromium de Playwright ne lit pas le H.264 : les tests vérifient l'ouverture et l'arrêt, pas la lecture.
- **Barres de défilement** : les zones qui défilent (la liste du menu, les rangées de la vue compacte) portent la classe `scroll` : une barre fine, arrondie, couleur d'encre, sans piste. Chrome et Safari la dessinent avec `::-webkit-scrollbar`, Firefox avec `scrollbar-color`. Chrome ignore `::-webkit-scrollbar` dès que `scrollbar-width` ou `scrollbar-color` est posé : ces deux propriétés restent réservées à Firefox (`@supports (-moz-appearance: none)`). La liste du menu défile dans un cadre `overflow: hidden`, sinon la piste carrée dépasse des coins arrondis.
- **Menu maison et Safari** : Safari ne donne pas le focus à un bouton qu'on clique. Un menu qui se ferme quand son bouton perd le focus doit aussi se fermer sur un clic ailleurs dans la page (`pointerdown` sur le document). La liste se décale à l'ouverture pour rester à 16 px des bords de l'écran.
- **Marge de l'accueil** : avant le budget de 40 Ko, le document de l'accueil n'avait plus que 35 o de marge sous 36 Ko. Le script de la page (filtres, recherche, menu) pèse 8,8 Ko compressés et les styles 8,4 Ko. Une section de plus demandera de relever le budget ou de sortir le script dans un fichier, au prix d'une requête.
- **Ancre d'une question** : la navigation vers `#ancre` n'ouvre pas un `<details>` fermé quand l'ancre est sur le `<details>` lui-même. Un petit script dans la page d'un outil l'ouvre au chargement et à chaque `hashchange`. L'ancre vient du texte de la question : la reformuler change son adresse, et les liens de la page FAQ suivent au build.
- **Budgets de l'accueil** : Lighthouse CI sert le site en brotli de qualité 4 et compte les en-têtes ; `gzip -9` surestime le document d'environ 13 %. Une requête de script de plus au chargement, même minuscule, coûte au LCP simulé un aller-retour (+150 ms) : un script de l'accueil s'écrit dans la page, et des données lourdes se chargent au premier usage (`/{lang}/search.json`). Astro n'analyse pas le contenu d'un `<template>` : un `<script>` qu'on y met reste tel quel.
- **Textes absents des pages outils** : `Board.tsx` importe les dictionnaires entiers. Un texte réservé à l'accueil, comme `frSearch`, s'exporte à part dans `fr.ts` et `en.ts` : le build le retire du script des pages outils.
- **`pnpm dev` répond 504 « Outdated Optimize Dep »** après un changement de dépendances ou d'imports : l'îlot de la planche ne s'hydrate plus, et rien ne reçoit les fichiers lâchés. L'arrêter, lancer `pnpm dev --force`, puis recharger. Le site construit n'est pas touché.
- **LCP et îlots (Lantern)** : Lighthouse garde dans le graphe du LCP chaque requête qui finit avant la peinture observée, et un module ES ne montre jamais l'évaluation qui la sortirait du graphe : les chunks d'un îlot comptent quelle que soit la directive `client:`. Les leviers sont les octets de `Board.js`, les chunks de son second saut et les 14 600 premiers octets du document. La grille des pages se charge donc avec le premier fichier (`import()` dans `Board.tsx`), jamais en préchargement sur `load` ; l'assistant de préchargement de Vite reste dans le chunk `preact` (`manualChunks`).
- **Modules partagés avec un chunk différé** : un module que `Board.tsx` et un chunk chargé plus tard (l'éditeur de Signer) importent tous les deux devient un chunk à part, donc une requête de plus avant le LCP de chaque page outil. Mesuré le 2 octobre 2026 : deux chunks de ce genre portaient le LCP de 1 520 à 1 670 ms (budget 1 600). `SignatureEditor` reçoit donc `engine` et `Skeleton` de Board par ses props. Les contrôles d'image de `client.ts` vivent dans `engine/signatureImages.ts`, et la géométrie des placements, que l'éditeur importe, dans `engine/signatureGeometry.ts`. Un `import()` dans `client.sign` ne convient pas : la copie des pixels doit rester synchrone, l'interface continue de modifier la signature après l'appel. Un `manualChunks` qui range ces modules avec Board ne marche pas : il emporte tout le graphe de Board dans un chunk de 87 Ko derrière une façade.
- **Image en ligne (`BI … EI`)** : elle n'a pas d'XObject que le document natif puisse dessiner seul. « Extraire les images » lit alors son bitmap (`FPDFImageObj_GetBitmap`), déjà sans découpe, au lieu d'échouer sur tout le fichier.
- **Fichier choisi avant l'hydratation** : l'îlot le lit dans son `<input type="file">`, puis doit vider l'input. Sinon Firefox restaure ce fichier au rechargement et l'outil le rouvre.
- **Polices de secours de Linux** : plus larges que celles de macOS (la CI les utilise quand les polices du site sont bloquées). À 320 px, un mot long du titre de l'accueil ou d'une cellule de tableau dépassait : ces éléments coupent un mot qui ne tient pas seul (`overflow-wrap: anywhere`), avec césure sous 360 px. Les tests de débordement nomment l'élément qui dépasse.
- **Textes de la planche** : l'îlot importe `i18n/board.ts`, qui ne contient que les textes de la planche (`fr.ts`, `en.ts`). Les textes des pages servies seulement (menu, pied de page, accueil, catégories, outils à venir) vivent dans `frSite.ts` et `enSite.ts`, et `dictionaries` réunit les deux pour Astro. Importer `dictionaries` dans un îlot y ramènerait tout : mesuré le 2 octobre 2026, la séparation retire 2,4 Ko gzip des pages outils et les ramène de 1 670 à 1 520 ms de LCP. Un texte nouveau va dans `fr.ts` s'il sert à la planche, dans `frSite.ts` sinon. Les textes des moines vivent aussi dans `frSite.ts` : la page d'un outil passe à la planche le seul moine de cet outil, dans les deux langues (prop `monks`), pour que chaque outil nouveau n'alourdisse pas toutes les pages (mesuré le 2 octobre 2026 : −3,1 Ko gzip, LCP des pages outils de 1 670 à 1 520 ms). Les props d'un îlot doivent se sérialiser : le titre du résultat est une liste de règles (`TitleRule[]`, `{count}` dans les textes), lue par `titleFor`.
- **Cache de `astro dev`** : il vit dans `node_modules/.vite-dev`, à part de `node_modules/.vite` que lisent le build, `astro check` et vitest. Après ce changement, lancer `pnpm dev --force` une fois.

## À décider dans la spec du scanner Web

- Le moteur d'OCR : PaddleOCR (plus précis) ou Tesseract.js (plus rapide), mesurés sur le lot privé.
- Les cibles de performance du scanner, sur ordinateur et sur téléphone.
