# Compresser — benchmark et choix du moteur

_Étude du 1er octobre 2026. Prototypes de mesure uniquement : aucune nouvelle dépendance dans le produit._

## Question et critères

Choisir comment réduire les PDF en conservant leur structure, avec un traitement exclusivement dans le navigateur. Le moteur corrigé conserve le document mais sa sauvegarde peut décompacter les objets ; le rapport 02 grossit de ×2,65 avant modification des images.

Les critères, dans cet ordre : conservation du contenu et des fonctionnalités vérifiées ; gain réel du fichier livré ; exécution locale dans un Worker ; durée et mémoire ; poids chargé à la demande ; licence et maintenance. Le seuil historique reste une médiane de 30 % sur les cinq premiers PDF du lot, pas sur une sélection faite après mesure.

Une optimisation structurelle sans perte change la représentation binaire, pas le contenu du document. Elle reste compatible avec la promesse « seules les photos changent » au sens visuel et fonctionnel. Cela ne signifie pas conserver une signature numérique valide après réécriture.

## Protocole

- Onze PDF privés, référencés ici uniquement par leur numéro. Aucune transmission à un service de traitement.
- Comparaison des originaux, de la sauvegarde PDFium sans transformation et des candidats Recommandée avant retour éventuel à l'original.
- Réglages photo conservés : 150 ppi, qualité JPEG 0,6. Les anciens candidats utilisent `jpeg-js` et un redimensionnement au plus proche voisin ; une campagne séparée utilise le véritable `OffscreenCanvas` du produit.
- Trois exécutions par variante, médiane du temps ; campagnes CPU séquentielles. Les mesures natives ne sont pas présentées comme des mesures navigateur.
- Gain livré : zéro lorsque le candidat ne réduit pas le fichier d'au moins 1 %. Le contrôle de structure porte sur les candidats, même lorsqu'ils ne seraient pas livrés.
- Lecteur indépendant pdf.js : destinations résolues en numéros de pages, signets, liens, géométrie, texte, arborescences d'accessibilité, champs, métadonnées, XMP et hash des pièces jointes. Tolérance de 0,001 point sur les nombres géométriques pour la conversion float32 de PDFium ; version PDF et linéarisation exclues de l'égalité.
- Ces contrôles ne valident pas les signatures, la conformité PDF/A, l'exécution de JavaScript Acrobat, les formulaires XFA dynamiques ou la qualité visuelle des photos. Le pic mémoire du Worker complet reste à mesurer avant intégration.

## Enquête : ce que les sources établissent

| Solution | Pertinence pour Holy PDF | Limite déterminante |
|---|---|---|
| PDFium seul | Déjà intégré pour lire et traiter les images | Pas d'option publique pour réécrire les Object Streams |
| PDFium + qpdf | Images avec PDFium, optimisation structurelle avec un outil spécialisé | Un second module WASM et son adaptateur à maintenir |
| PDFium + `@cantoo/pdf-lib` | Témoin JavaScript, fork MIT actif, écriture Object Streams | Vérifier conservation, temps de parsing et mémoire |
| MuPDF | Moteur officiel JS/WASM, sauvegarde compactée | AGPL ou licence commerciale ; remplacement plus large à évaluer |
| Ghostscript `pdfwrite` | Efficace pour certaines conversions et réductions | Reconstruit le PDF et ne conserve pas toutes les informations |
| Apryse Web Optimizer | Optimiseur navigateur avec sous-échantillonnage | Option commerciale sous licence additionnelle, non mesurée ici |
| lopdf | Bibliothèque Rust MIT avec Object Streams | Nouvelle chaîne Rust/WASM et intégration supplémentaire, non mesurée ici |

### PDFium : ne pas attendre un correctif hypothétique

Le [ticket Chromium 480028277](https://issues.chromium.org/issues/480028277), ouvert le 30 janvier 2026, demande le rétablissement de l'écriture Object Streams/XRef Streams. Il est encore ouvert, sans correctif associé vérifié. C'est un signalement utilisateur, pas une promesse du mainteneur. Le [header officiel de sauvegarde](https://pdfium.googlesource.com/pdfium/+/main/public/fpdf_save.h) ne propose pas cette option. Ces éléments concordent avec notre observation ; ils ne suffisent pas à attribuer toute la croissance d'un fichier aux seuls objets.

### qpdf : un complément pour la structure

L'[objectif documenté de qpdf](https://qpdf.readthedocs.io/en/stable/overview.html) est la transformation structurelle des PDF. La [documentation d'optimisation](https://qpdf.readthedocs.io/en/stable/cli.html#optimizing-file-size) distingue Object Streams, recompression Flate et JPEG avec pertes. Dans la [discussion #1402](https://github.com/qpdf/qpdf/issues/1402#issuecomment-2744693122), le mainteneur confirme que qpdf ne sous-échantillonne pas les images : il complète notre traitement photo.

La [release 12.4.2](https://github.com/qpdf/qpdf/releases/tag/v12.4.2) et la [licence Apache-2.0](https://github.com/qpdf/qpdf/blob/main/LICENSE.txt) sont les références consultées. Le port navigateur testé est `@wasm-zoo/qpdf@0.1.1`, distribution tierce de qpdf 12.4.2 ; ce n'est pas un SDK Web officiel de qpdf.

Deux conversations changent les précautions de choix :

- [#1785](https://github.com/qpdf/qpdf/issues/1785) rapporte une croissance de 31 % sur un autre fichier avec `/Filter [/FlateDecode]` et prédicteur. Le contournement proposé est `--stream-data=preserve`. Ticket ouvert, non reproduit sur ce corpus : comparer les réglages, ne pas généraliser le signalement.
- [#702](https://github.com/qpdf/qpdf/issues/702) rapporte la perte d'un comportement de formulaire LiveCycle signé alors que le JavaScript reste présent. Fermé pour inactivité, pas comme correctif confirmé. Compter les champs ne prouve pas que tous les formulaires interactifs fonctionnent.

La [discussion #394](https://github.com/qpdf/qpdf/issues/394) indique également que qpdf n'est pas conçu comme un ensemble de petites fonctions compilables séparément. Un port WASM est possible, mais un minuscule sous-ensemble officiel n'est pas établi.

### pdf-lib : distinguer le dépôt historique du fork actif

La dernière release du dépôt historique est [1.17.1, novembre 2021](https://github.com/Hopding/pdf-lib/releases/tag/v1.17.1). Le fork [Cantoo](https://github.com/cantoo-scribe/pdf-lib), version npm 2.11.1 lors de l'étude, est actif et sous MIT. Il mérite donc un témoin, contrairement au raccourci « pdf-lib est abandonné ».

Le benchmark charge le document existant avec `updateMetadata:false` et `preserveXFA:true`, puis sauvegarde avec `useObjectStreams:true`, `updateFieldAppearances:false` et `addDefaultPage:false`. Il ne copie pas les pages. Le [code de référence](https://github.com/cantoo-scribe/pdf-lib/blob/eafae49f9704b037b9474bd51309c3e9dca0e44b/src/api/PDFDocument.ts) appelle encore une synchronisation des métadonnées PDF/A : l'égalité XMP doit être mesurée, pas supposée.

### Autres options

[MuPDF.js officiel](https://github.com/ArtifexSoftware/mupdf.js) expose les [options de sauvegarde compactée](https://mupdf.readthedocs.io/en/1.28.1/reference/common/pdf-write-options.html). L'éditeur distribue sous AGPL et propose une licence commerciale ; l'AGPL est compatible avec la licence du projet (AGPL-3.0), mais une adoption serait un remplacement de moteur plus large, à évaluer pour lui-même. Le benchmark natif PyMuPDF est un témoin du moteur, pas une validation du SDK navigateur ni une décision de licence.

La [documentation Ghostscript](https://ghostscript.readthedocs.io/en/latest/VectorDevices.html) explique que `pdfwrite` reconstruit un nouveau document et ne conserve pas toutes les informations, notamment certains éléments non visuels. Cette voie ne correspond pas à notre exigence de conservation ; un emballage WASM ne change pas ce comportement.

L'[exemple officiel Apryse](https://docs.apryse.com/web/get-started/samples/optimizertest) indique que l'optimiseur exige une licence additionnelle. [lopdf 0.45.0](https://github.com/J-F-Liu/lopdf/releases/tag/v0.45.0) est une alternative MIT à suivre, mais ajouter Rust/WASM n'est pas justifié sans avantage mesuré sur les candidats déjà disponibles.

## Résultats

### Compression réelle dans Chromium

Apple M1 Pro, macOS 26.4.1, Chromium 153, PDFium `@embedpdf/pdfium@2.15.1`, trois répétitions. Les photos sont encodées par le véritable Worker du produit, puis chaque candidat est passé aux différents compacteurs. Les pourcentages sont toujours relatifs au fichier original et incluent le retour à l'original sous 1 % de gain.

| PDF | PDFium seul | + qpdf standard | + qpdf Flate 9 | + Cantoo | Temps compression PDFium | Étape qpdf standard |
|---|---:|---:|---:|---:|---:|---:|
| 01 | 78,41 % | 82,79 % | 82,88 % | 81,13 % | 3,24 s | 0,15 s |
| 02 | 0,00 % | 40,23 % | 42,11 % | 30,80 % | 1,38 s | 0,67 s |
| 03 | 0,00 % | 22,72 % | 23,48 % | 4,12 % | 0,73 s | 0,12 s |
| 04 | 2,92 % | 13,49 % | 30,09 % | 5,44 % | 1,27 s | 0,10 s |
| 05 | 66,99 % | 67,87 % | 67,88 % | 67,81 % | 6,00 s | 0,07 s |
| 06 | 0,00 % | 0,00 % | 0,00 % | 0,00 % | 0,05 s | 0,04 s |
| 07 | 34,94 % | 37,53 % | 42,50 % | 37,20 % | 0,35 s | 0,08 s |
| 08 | 75,96 % | 76,84 % | 78,51 % | 76,70 % | 0,36 s | 0,06 s |
| 09 | 0,00 % | 35,27 % | 38,12 % | 30,77 % | 0,17 s | 0,13 s |
| 10 | 69,58 % | 77,99 % | 78,52 % | 75,74 % | 2,54 s | 0,08 s |
| 11 | 16,10 % | 30,89 % | 31,64 % | 29,31 % | 0,21 s | 0,06 s |

| Méthode après le JPEG du navigateur | Médiane PDF 01–05 | Médiane des 11 | Médiane de l'étape ajoutée | Maximum de l'étape ajoutée |
|---|---:|---:|---:|---:|
| Aucune | 2,92 % | 16,10 % | — | — |
| qpdf standard | **40,23 %** | 37,53 % | **0,083 s** | 0,669 s |
| qpdf avec recompression Flate niveau 9 | 42,11 % | 42,11 % | 0,338 s | 1,695 s |
| qpdf `--stream-data=preserve` | 3,47 % | 17,94 % | 0,083 s | 0,590 s |
| Cantoo pdf-lib 2.11.1 | 30,80 % | 30,80 % | 0,307 s | 1,703 s |

Les temps PDFium excluent l'ouverture et l'initialisation du Worker ; ceux des compacteurs incluent création du Worker, initialisation du module et copies d'entrée/sortie. Aucun ne comprend un téléchargement réseau réel des dépendances. Ce sont des étapes mesurées séparément, pas un chronométrage complet de l'interface intégrée.

**Réglage standard mesuré :** `--object-streams=generate --compress-streams=y`, sans `--recompress-flate`, sans optimisation JPEG supplémentaire. La variante Flate 9 ajoute `--recompress-flate --compression-level=9 --decode-level=generalized`. Le benchmark utilise aussi `--warning-exit-0` pour recueillir les PDF produits avec avertissements ; les messages sont conservés dans les rapports, pas ignorés dans l'analyse. Les originaux 07 et 08 ont déclenché des avertissements de références croisées réparées dans la campagne exploratoire ; les candidats PDFium standard n'en ont pas déclenché.

Le contournement `--stream-data=preserve` n'est **pas** un bon réglage global pour notre pipeline : préserver aussi les flux non comprimés empêche une grande partie du bénéfice recherché. Il ne faut pas le confondre avec le profil natif qui compresse les flux bruts tout en préservant les Flate existants.

Flate 9 améliore particulièrement le PDF 04 (13,49 → 30,09 %) mais coûte 1,70 s sur ce fichier, contre 0,10 s pour le standard. Le standard est le meilleur point de départ pour la réactivité et le téléphone ; les mesures ne justifient pas une recompression maximale systématique.

### Décomposition native et témoins

132 variantes, trois répétitions chacune : 11 documents × trois entrées (original, sauvegarde PDFium, JPEG Node) × quatre méthodes. Python 3.13.3, pikepdf 10.16.0/libqpdf 12.4.2 et PyMuPDF 1.28.2, environnement temporaire hors des dépendances du produit.

| Méthode native | Médiane PDF 01–05 | Médiane des 11 |
|---|---:|---:|
| qpdf sur les originaux, Object Streams + Flate 9 | 23,41 % | 8,79 % |
| JPEG Node + qpdf Flate 9, sans Object Streams | 24,96 % | 24,96 % |
| JPEG Node + qpdf Object Streams + Flate 9 | 36,78 % | 37,99 % |
| JPEG Node + qpdf Object Streams, Flate existants préservés | 35,00 % | 35,00 % |
| JPEG Node + MuPDF compactage/déduplication | 6,47 % | 21,49 % |

Ces chiffres utilisent les anciens JPEG Node et ne se comparent pas directement aux pourcentages du tableau Chromium. MuPDF fait mieux sur certaines présentations (56,66 % et 79,49 % sur 07/08), mais le réglage testé ne résout pas le rapport 02. Cela n'établit pas une limite de toutes les options possibles de MuPDF.

Le rapport 02 explique le blocage : original 5,54 Mo ; sauvegarde PDFium 14,69 Mo ; sauvegarde suivie de qpdf Object Streams/Flate 9 environ 4,05 Mo, soit 26,96 % de réduction **sans modifier les photos**. L'ajout des JPEG Node porte ce résultat à 36,78 % ; avec les JPEG Chromium et qpdf standard, le résultat final atteint 40,23 %. Le gain de structure est désormais identifié séparément, sans supprimer des fonctionnalités pour l'obtenir.

### Coût navigateur et compatibilité

| Distribution mesurée | Fichiers nécessaires bruts | Somme Brotli locale | Exécution |
|---|---:|---:|---|
| qpdf WASM Zoo 0.1.1 / moteur 12.4.2 | 2,27 Mo, dont WASM 2,20 Mo | 0,525 Mo | Worker, sans `SharedArrayBuffer` ni isolation COOP/COEP |
| Cantoo pdf-lib 2.11.1, bundle UMD minifié | 0,617 Mo | 0,222 Mo | Worker JavaScript |

Les tailles Brotli sont des estimations locales avec la compression par défaut de Node, pas des mesures du transfert Cloudflare. Le module doit être chargé au lancement de Compresser pour préserver le budget initial de 50 Ko ; au moment de ce comparatif, ce chargement n’était pas intégré. La validation du produit intégré figure dans [Version Web](web-version.md#intégration-qpdf--1er-octobre-2026).

qpdf standard réussit également les essais 02/05 dans Firefox 155 et WebKit 26.6. Firefox utilise ses propres JPEG ; le premier essai qpdf WebKit utilise les candidats Chromium. Cette comparaison ne mesure donc pas encore le parcours complet WebKit.

**Correction du diagnostic WebKit pendant l'intégration :** le banc refusait toutes les URL hors de son origine HTTP, y compris les URL `blob:` locales utilisées par WebKit pour lire `blob.arrayBuffer()`. L'erreur `NotReadableError` venait de cette interception réseau, pas de l'encodeur. Le banc autorise maintenant uniquement les URL HTTP et Blob de sa propre origine et vérifie préalablement un Blob de 55 Ko dans le Worker.

Sans changer `jpeg.ts`, les **11 PDF passent trois fois dans WebKit 26.6**, avec des sorties identiques entre passages. Médiane des PDF 01–05 pour PDFium seul : **2,19 %** ; PDF 01 : 68,53 %, PDF 05 : 37,50 %. Les anciens logs restent conservés, et les résultats corrigés sont dans `runs/browser-baseline-webkit-corrected/`. Un test du Worker de production vérifie aussi un JPEG supérieur à 55 Ko, ses dimensions et ses couleurs dans les trois navigateurs. Safari sur appareil réel n'a pas été testé.

Le port WASM Zoo utilisé pour mesurer n'est pas à importer aveuglément : sa façade dépend de `window`/`document`, crée un Worker par appel et traite les avertissements qpdf comme des erreurs par défaut. L’adaptateur intégré maîtrise le cycle de vie du Worker, les sorties avec avertissement et la version exacte du moteur ; il importe le cœur qpdf après une adaptation ESM de packaging, sans utiliser cette façade. Aucun pic mémoire complet n'est revendiqué ici.

### Conservation

Les comparaisons de rendu de l'étape structurelle passent : **33/33 pages pour qpdf standard, 33/33 pour qpdf Flate 9, 33/33 pour Cantoo**, sans aucun pixel différent des mêmes candidats JPEG Chromium avant recompaction. PyMuPDF 1.28.2 rend la première page, celle du milieu et la dernière des 11 documents, RGB opaque, 96 dpi, annotations actives.

132 comparaisons complémentaires passent également : originaux et JPEG Node après qpdf ou MuPDF. Il s'agit d'un échantillonnage des pages et d'une validation de la recompaction ; aucun score SSIM des JPEG par rapport aux originaux n'est déduit de ces égalités.

**226/226 sorties examinées passent la comparaison sémantique indépendante** : 132 variantes natives et 11 sauvegardes seules ; 22 sorties exploratoires qpdf dans Chromium ; 61 sorties finales (13 baselines navigateur, 15 qpdf standard dans les trois moteurs, 11 qpdf Flate 9, 11 qpdf préservation des flux, 11 Cantoo). Les contrôles incluent aussi les destinations nommées résolues.

Ce résultat signifie que les invariants contrôlés sont conservés sur le corpus. Les autres annotations, les actions JavaScript, les comportements des formulaires dynamiques, les calques OCG et les signatures ne sont pas validés par cette comparaison. Les scripts de vérification échouent en cas d'écart, d'erreur ou de nombre de PDF différent de celui attendu.

## Décision proposée

**Conserver PDFium pour les images et ajouter qpdf pour la structure, avec le réglage standard.** C'est le meilleur compromis mesuré : seuil de 30 % dépassé avec marge, meilleur gain que Cantoo, temps additionnel faible et moteur dédié aux transformations structurelles. Le surcoût de téléchargement est d'environ 0,3 Mo Brotli par rapport au témoin Cantoo et doit rester différé.

Ne pas écrire notre propre compacteur d'objets à ce stade. Ne pas remplacer tout le moteur par MuPDF sans bénéfice démontré et décision de licence commerciale. Garder le retour à l'original si la sortie ne gagne pas 1 %, et distinguer les fichiers compatibles avec les Object Streams des profils tels que PDF/A-1.

Cette étude choisit une architecture ; elle ne valide pas à elle seule une fusion. L'intégration autorisée ensuite est suivie dans [Version Web](web-version.md). La panne WebKit apparente a été corrigée dans le banc, sans changer l'encodeur. La validation intégrée porte aussi sur la mémoire et la qualité visuelle des JPEG ; les résultats de recompaction seule restent distincts.

## Reproduction et fichiers

- `apps/web/scripts/benchmark-compression-options.mjs` : sauvegarde PDFium de référence et vérification sémantique indépendante.
- `apps/web/scripts/benchmark-compression-options.py` : moteurs natifs isolés dans un environnement temporaire.
- `apps/web/scripts/benchmark-browser-baseline.mjs` : compression réelle du produit dans un Worker navigateur.
- `apps/web/scripts/benchmark-qpdf-browser.mjs` : recompaction qpdf WASM et témoin Cantoo dans des Workers, serveur lié à `127.0.0.1` uniquement.
- Corpus, sorties et rapports détaillés sous `fixtures-private/compress/runs/`, ignorés par git.

Préparer les runtimes de benchmark hors du produit, depuis la racine du dépôt :

```sh
mkdir -p /tmp/holy-pdf-compression-research/zoo /tmp/holy-pdf-compression-research/cantoo
npm pack @wasm-zoo/qpdf@0.1.1 --pack-destination /tmp/holy-pdf-compression-research --silent
npm pack @cantoo/pdf-lib@2.11.1 --pack-destination /tmp/holy-pdf-compression-research --silent
tar -xzf /tmp/holy-pdf-compression-research/wasm-zoo-qpdf-0.1.1.tgz -C /tmp/holy-pdf-compression-research/zoo
tar -xzf /tmp/holy-pdf-compression-research/cantoo-pdf-lib-2.11.1.tgz -C /tmp/holy-pdf-compression-research/cantoo

python3 -m venv /tmp/pdf-toolbox-compression-benchmark-venv
/tmp/pdf-toolbox-compression-benchmark-venv/bin/pip install pikepdf==10.16.0 PyMuPDF==1.28.2
node apps/web/scripts/benchmark-compression-options.mjs prepare
/tmp/pdf-toolbox-compression-benchmark-venv/bin/python apps/web/scripts/benchmark-compression-options.py
```

Le témoin natif suppose que les anciens candidats Node existent déjà dans `runs/preserve-structure/` ; leur commande de génération figure dans [Version Web](web-version.md#mesures-de-la-compression). Les versions de libqpdf embarquées sont consignées au lancement : épingler pikepdf ne dispense pas de vérifier son moteur effectif.

Campagnes navigateur depuis `apps/web/` :

```sh
node scripts/benchmark-browser-baseline.mjs

CANDIDATE_DIR=../../fixtures-private/compress/runs/browser-baseline/chromium \
BENCH_OUTPUT=../../fixtures-private/compress/runs/browser-qpdf-default \
VARIANTS=candidate QPDF_PROFILE=default \
node scripts/benchmark-qpdf-browser.mjs

CANDIDATE_DIR=../../fixtures-private/compress/runs/browser-baseline/chromium \
BENCH_OUTPUT=../../fixtures-private/compress/runs/browser-cantoo \
VARIANTS=candidate ENGINE=cantoo \
node scripts/benchmark-qpdf-browser.mjs
```

Les chemins temporaires par défaut sont dans le script ; `QPDF_RUNTIME` permet de fournir le dossier du runtime qpdf ou le dossier `dist` de Cantoo. Les rapports finaux enregistrent la provenance et le SHA-256 de chaque entrée. La campagne exploratoire `benchmark-browser/` utilisait les JPEG Node ; seuls `browser-qpdf-*` et `browser-cantoo/` utilisent la nouvelle baseline Chromium pour la recommandation.

Vérifier une sortie complète depuis la racine :

```sh
BENCH_EXPECT_PDFS=11 BENCH_VERIFY_REPORT=qpdf-standard-structure.json \
node apps/web/scripts/benchmark-compression-options.mjs verify \
fixtures-private/compress/runs/browser-qpdf-default/chromium-candidate

/tmp/pdf-toolbox-compression-benchmark-venv/bin/python apps/web/scripts/verify-compression-render.py \
--pair qpdf-standard fixtures-private/compress/runs/browser-baseline/chromium \
fixtures-private/compress/runs/browser-qpdf-default/chromium-candidate
```
