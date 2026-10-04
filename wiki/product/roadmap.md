# Feuille de route — tous les outils

_Créée le 29 septembre 2026. Référence : le catalogue de PDF24 Tools, relevé sur les captures du 29/09._

L'objectif final est une appli qui couvre tout ce catalogue, sur Mac, iPhone et Web. Chaque phase livre des outils utilisables. Un outil ne commence qu'avec sa spec, dans `wiki/specs/`.

**Web, 1er octobre 2026 :** Signer est implémenté après le lot Organiser / Compresser / PDF en JPG. [Sa spec](../specs/2026-10-01-web-sign-design.md) couvre la main levée, le texte manuscrit et l'import PNG/JPG/JPEG, sans certificat (ajouts de recette jusqu’au 2 octobre). Les prochains outils de ce lot sont Filigrane, Numéros de page puis Noircir.

## Faisabilité

| Repère | Signification |
|---|---|
| **A** | Faisable avec les frameworks Apple (PDFKit, Core Graphics, Vision, WebKit), sans dépendance |
| **B** | Faisable avec les frameworks Apple, mais demande du code bas niveau ou un compromis à valider |
| **C** | Demande une bibliothèque tierce ou un service : décision de dépendance à prendre dans la spec de l'outil |

## Le catalogue

### Créer

| Outil | Faisabilité | Note |
|---|---|---|
| Créer un PDF avec une caméra (**Scanner**) | A | Phase 0, livré sur Mac le 1er octobre 2026. Sur le site (3 octobre 2026) : même moteur porté sur OpenCV.js, planche, correction et export ; lecture et suggestions au lot B ; voir la [spec web](../specs/2026-10-02-web-scanner-design.md) |
| Images en PDF | A | Implémenté sur Mac (2 octobre 2026) : une page A4 par image, dans l'ordre réglé ; voir la [spec](../specs/2026-10-02-mac-images-design.md). Sur le site : JPG en PDF |
| Page web en PDF | A | Sur Mac : `WKWebView.createPDF`. Sur le site : il faudrait un serveur ; pas pour le moment (décision du 4 octobre 2026) |
| Générer un code QR | A | Retiré le 4 octobre 2026 : un produit d'appel sans rapport avec les PDF |
| Écrire un PDF | A | Éditeur de texte, puis mise en page PDF |
| Créer un formulaire PDF remplissable | B | Sur le site, dans Modifier (décision du 4 octobre 2026) : les champs existants se remplissent en place depuis le 4 octobre (texte, case, bouton radio, listes), et l'outil Champ en crée (texte, case à cocher, liste déroulante ; pas de boutons radio : PDFium ne donne pas de valeur d'export propre à un bouton neuf). Sur Mac : annotations de widget PDFKit |
| Créer PDF (depuis Word, Excel, PowerPoint…) | C | Rendu Office : LibreOffice ou service. Pas pour le moment (décision du 4 octobre 2026) |
| Créer une demande d'emploi PDF | A | Assemblage de documents, cas d'usage de Fusionner |

### Organiser

| Outil | Faisabilité | Note |
|---|---|---|
| Fusionner PDF | A | Implémenté sur Mac (1er octobre 2026) ; voir la [spec](../specs/2026-10-01-mac-merge-design.md) |
| Assembler des documents | A | Fusion de PDF et d'images |
| Diviser PDF | A | Implémenté sur Mac (2 octobre 2026) : ciseaux entre les pages ou « pages par fichier » ; voir la [spec](../specs/2026-10-02-mac-split-extract-design.md) |
| Réorganiser les pages | A | Implémenté sur Mac dans Organiser (2 octobre 2026), grille native, glisser et annulation ; voir la [spec](../specs/2026-10-02-mac-organize-design.md) |
| Supprimer les pages | A | Disponible dans Organiser sur Mac, avec annulation et conservation d’au moins une page |
| Extraire les pages | A | Implémenté sur Mac (2 octobre 2026) : les pages cochées dans un nouveau PDF ; même spec que Diviser |
| Rotation PDF | A | Disponible par page dans Organiser sur Mac, sans rastérisation |
| Pages par feuille | A | Implémenté sur le site (2 octobre 2026) : 2 à 16 pages par feuille A4 ; voir la [spec](../specs/2026-10-02-web-pages-per-sheet-design.md). Implémenté sur Mac le même jour ; voir la [spec](../specs/2026-10-02-mac-sheets-design.md) |
| Couper les pages en deux | A | Implémenté sur le site (2 octobre 2026) : gauche et droite, ou haut et bas ; voir la [spec](../specs/2026-10-02-web-split-in-half-design.md). Implémenté sur Mac le même jour, signets et liens gardés ; voir la [spec](../specs/2026-10-02-mac-sheets-design.md) |
| Ajouter des signets | A | Implémenté sur Mac (2 octobre 2026) : poser, renommer, retirer, changer de niveau ; voir la [spec](../specs/2026-10-02-mac-bookmarks-design.md). Sur le site (3 octobre 2026) : mêmes règles, vue d'arrivée gardée telle quelle ; voir la [spec web](../specs/2026-10-03-web-bookmarks-design.md) |
| Extraire les images | B | Lecture des objets image du PDF (`CGPDFScanner`) |

### Modifier

| Outil | Faisabilité | Note |
|---|---|---|
| Ajouter un filigrane | A | Implémenté sur Mac (2 octobre 2026) : texte ou image, opacité, angle, plage de pages ; voir la [spec](../specs/2026-10-02-mac-watermark-design.md). Sur le site (2 octobre 2026) : texte seul, centré ; voir la [spec](../specs/2026-10-02-web-watermark-design.md) |
| Ajouter des numéros de pages | A | Implémenté sur Mac (2 octobre 2026) : format, position, premier numéro, taille, plage ; voir la [spec](../specs/2026-10-02-mac-page-numbers-design.md). Sur le site (2 octobre 2026) : mêmes réglages, texte dans le contenu de la page ; voir la [spec](../specs/2026-10-02-web-page-numbers-design.md) |
| Superposition PDF | A | Implémenté sur Mac (2 octobre 2026) : les pages d'un PDF sur ou sous celles d'un autre ; voir la [spec](../specs/2026-10-02-mac-overlay-design.md). Sur le site (3 octobre 2026) : même règle, plusieurs PDF qui reçoivent ; voir la [spec web](../specs/2026-10-03-web-overlay-design.md) |
| Signer PDF | A | Implémenté sur Mac (1er octobre 2026) : signature dessinée ou importée. Sur le site : dessinée, saisie ou importée. La signature électronique qualifiée (eIDAS) est hors portée |
| Noircir un PDF | B | Implémenté sur Mac (2 octobre 2026) : la page qui porte une zone noire devient une image à 200 ppp, son contenu quitte le fichier ; voir la [spec](../specs/2026-10-02-mac-redact-design.md). Sur le site (2 octobre 2026) : même règle, moteur PDFium ; voir la [spec web](../specs/2026-10-02-web-redact-design.md) |
| Rogner PDF | A | Implémenté sur le site (4 octobre 2026) : la zone tracée devient la CropBox, sur une page ou sur toutes ; voir la [spec](../specs/2026-10-04-web-crop-design.md). Ajouté après la comparaison avec iLovePDF |
| Modifier PDF | B | Implémenté sur le site (4 octobre 2026) en deux versions : ajouts (texte, zones de texte, images, formes, crayon, surligneur), puis le document lui-même (texte d'origine corrigé, objets déplacés et supprimés, annotations, liens, images tournées et recadrées), zoom et raccourcis ; voir la [spec](../specs/2026-10-04-web-edit-design.md). Sur Mac le même jour, étape A ; voir la [spec Mac](../specs/2026-10-04-mac-edit-design.md). Tampons, remplissage des formulaires et création de champs le 4 octobre aussi |

### Optimiser et réparer

| Outil | Faisabilité | Note |
|---|---|---|
| Compresser PDF | A | Implémenté sur Mac (2 octobre 2026) : trois niveaux, options d'écriture PDFKit et filtre Quartz, la copie la plus légère gagne ; voir la [spec](../specs/2026-10-02-mac-compress-design.md). Sur le site depuis le 30 septembre |
| OCR PDF | A | Implémenté sur Mac (2 octobre 2026) : la lecture Vision du Scanner en texte invisible sur les pages sans texte ; voir la [spec](../specs/2026-10-02-mac-ocr-design.md). Sur le site (2 octobre 2026) : Tesseract.js hébergé par le site, français et anglais ; voir la [spec web](../specs/2026-10-02-web-ocr-design.md) |
| Pixelliser un PDF | A | Implémenté sur le site (2 octobre 2026) : pages en JPEG à 150 ou 300 ppp ; voir la [spec](../specs/2026-10-02-web-pixelize-design.md). Implémenté sur Mac le même jour ; voir la [spec](../specs/2026-10-02-mac-sheets-design.md) |
| Aplatir le PDF | B | Implémenté sur le site (2 octobre 2026) : champs et annotations dans le contenu ; voir la [spec](../specs/2026-10-02-web-flatten-design.md). Implémenté sur Mac le même jour, liens gardés ; voir la [spec](../specs/2026-10-02-mac-flatten-design.md) |
| Réparer PDF | B | Implémenté sur le site (3 octobre 2026) : qpdf relit un fichier coupé ou sans table, PDFium en secours ; voir la [spec](../specs/2026-10-03-web-repair-design.md) |
| Optimiser PDF pour le Web | C | Linéarisation : pas dans les frameworks Apple (qpdf) |
| PDF en PDF/A | C | Conformité ISO : polices, profils ICC, validation |

### Sécurité et confidentialité

| Outil | Faisabilité | Note |
|---|---|---|
| Protéger PDF | A | Implémenté sur Mac (2 octobre 2026) : mot de passe en AES-128, le plus fort que PDFKit écrive ; voir la [spec](../specs/2026-10-02-mac-protect-unlock-design.md). Sur le site (2 octobre 2026) : chiffrement PDFium, voir la [spec](../specs/2026-10-02-web-protect-unlock-design.md) |
| Déverrouiller PDF | A | Implémenté sur Mac et sur le site (2 octobre 2026), avec le mot de passe connu seulement : copie sans chiffrement, limites d'impression et de copie levées |

### Convertir

| Outil | Faisabilité | Note |
|---|---|---|
| PDF en images | A | Implémenté sur Mac (2 octobre 2026) : un JPG par page, 150 ou 300 ppp ; même spec. Sur le site : PDF en JPG, avec l'extraction des photos |
| Convertir des images | A | ImageIO |
| Convertisseur PDF vers Word, Excel, PowerPoint | C | Reconstruction de mise en page : bibliothèque ou service. PDF en Word implémenté sur le site (2 octobre 2026) : texte, styles et images, sans tableaux ; voir la [spec](../specs/2026-10-02-web-pdf-to-word-design.md) PDF en Word implémenté sur Mac le même jour, sans bibliothèque ; voir la [spec](../specs/2026-10-02-mac-pdf-to-word-design.md) |

### Afficher et vérifier

| Outil | Faisabilité | Note |
|---|---|---|
| Voir PDF | A | `PDFView` |
| Rechercher dans des PDF | A | Non (décision du 4 octobre 2026) |
| Comparer PDF | B | Écart de texte + écart visuel page à page |
| Vérifier PDF/A | C | Validateur (veraPDF ou équivalent) |
| Préférences de la visionneuse | A | |

### Factures

| Outil | Faisabilité | Note |
|---|---|---|
| Créer une facture | A | Modèle et mise en page |
| Créer visuellement une facture | A | Éditeur de modèle |
| Créer une facture électronique | C | Factur-X / ZUGFeRD : PDF/A-3 + XML embarqué |
| Facture PDF en facture électronique | C | Idem |
| Facture électronique XML en PDF | B | Lecture du XML et mise en page |
| Valider une facture électronique | C | Validation des schémas et des règles métier |

La facture électronique devient obligatoire en France pour les entreprises, par étapes, à partir de septembre 2026. C'est un argument commercial fort, mais aussi le chantier le plus normé du catalogue.

### Bureau

| Outil | Faisabilité | Note |
|---|---|---|
| Lecteur PDF | A | Voir PDF en appli par défaut |
| Imprimante PDF / Creator | — | macOS l'offre déjà (« Enregistrer au format PDF » dans chaque dialogue d'impression). À reconsidérer seulement pour Windows |

## Phases

| Phase | Contenu | Pourquoi dans cet ordre |
|---|---|---|
| 0 | **Scanner** : moteur, outil en ligne de commande, appli Mac | Livrée le 1er octobre 2026 (PR #2 et #7). Reste la vérification à la main de `tests.md` et les photos de test commitées |
| 1 | **Accueil en grille** (catégories, recherche, favoris, récents) + **Organiser** : fusionner, diviser, réorganiser, supprimer, extraire, rotation, images ↔ PDF | Tout en A, réutilise la planche et `PDFCore`, couvre les usages les plus fréquents. Livrée sur Mac le 2 octobre 2026, sauf favoris et récents ; voir la [spec de l'accueil](../specs/2026-10-02-mac-home-design.md) |
| 2 | **Modifier** : filigrane, numéros de pages, signer, noircir, superposition, pages par feuille, couper en deux, signets | En A et B, une fois `PDFCore` capable de redessiner des pages |
| 3 | **Optimiser et sécuriser** : compresser, OCR d'un PDF existant, pixelliser, aplatir, protéger, déverrouiller, réparer | Réutilise l'OCR et le rendu |
| 4 | **Créer et voir** : page web, QR code, écrire un PDF, formulaires, lecteur, recherche, comparaison | |
| 5 | **Factures** : création, puis facture électronique | Premier chantier en C : décision de dépendance, normes |
| 6 | **Conversions Office et normes** : Office ↔ PDF, PDF/A, linéarisation | Le plus coûteux, le moins différenciant |

Chantiers transverses, à planifier en parallèle :

- **Identité de marque** : voir [Identité de marque](brand.md). À faire avant la phase 1, parce que l'accueil en grille vit de ses illustrations. Appliquée au site et à l'appli Mac ;
- **Appli iPhone** : après la phase 0, avec la caméra pour le Scanner ;
- **Version Web** : site Astro statique, outils en Preact, moteur réécrit selon `wiki/development/algorithm.md` et exécuté dans le navigateur, outils A et B via PDFium en WebAssembly. Livrés : les 7 outils Organiser, puis Compresser et PDF en JPG (30 septembre 2026), tous avec le parcours en trois temps ; barre de navigation, pied de page et page outil centrée (1er octobre 2026). Voir [Version Web](../development/web-version.md) ;
- **Couche commerciale** : décidée le 4 octobre 2026, voir ci-dessous.

## Décisions du 4 octobre 2026

- Pas pour le moment : tout ce qui demande un serveur ou un modèle d'IA (page web en PDF, Office en PDF, résumé, traduction).
- Non : rechercher dans des PDF. Retiré : le code QR.
- Fait ensuite, dans Modifier sur le site : les tampons, le remplissage des formulaires et la création de champs.

### Modèle économique et code ouvert

- **Le site reste gratuit, sans compte, sans quota, sans publicité.** C'est la promesse du récit fondateur, pas un choix de prix : le coût marginal d'une opération est nul puisque tout tourne chez l'utilisateur.
- **Le dépôt entier devient public sous AGPL-3.0-or-later**, avec deux termes additionnels (section 7) : la distribution par les app stores, et aucun droit de marque. Écrits avant toute contribution externe, tant que le titulaire est seul. Pas de CLA : DCO sur les contributions. Les fichiers des illustrations sont sous AGPL comme le code ; le nom, le logo et le moine restent des marques réservées ([BRAND.md](../../BRAND.md)) ; un fork se renomme. Dépôt de la marque au nom de la société, nom et moine (marque figurative), classes 9 et 42, à l'INPI ou à l'EUIPO.
- **Le bureau se fait en Tauri 2 sur le code du site** (`apps/desktop/`), Mac et Windows d'abord, Linux quand WebKitGTK aura fait tourner le moteur. Preuve faite le 5 octobre 2026 : le moteur du site (PDFium, qpdf, workers) tourne dans la webview de Tauri, servi par son protocole ; voir la [spec](../specs/2026-10-05-desktop-tauri-design.md). Il vend ce que le site ne peut pas : ouvrir les PDF par double-clic, traiter un dossier entier, enregistrer sur place, fonctionner hors ligne. Achat unique, mises à jour comprises, vente directe via un marchand officiel avant les stores. Son code est dans le même dépôt public.
- **L'appli Mac en Swift est gelée** : corrections seulement. Deux moteurs doublaient chaque fonction. Son code reste pour d'éventuelles extensions macOS (Actions rapides, Partager) et pour la caméra du Scanner iPhone, si Tauri ne suffit pas.
- **Les organisations** : une page « Pour les organisations » sur le site provoque les demandes ; l'offre (bundle intranet aux couleurs du client, build signé et mis à jour, support, dossier RGPD) ne se code qu'à la première demande, dans un second dépôt privé qui dépend du public.
- Écartés : la publicité, les dons, les quotas sur le site, l'abonnement pour les particuliers.
- **Historique neuf pour le dépôt public.** La relecture du 5 octobre 2026 a trouvé, dans trois commits de septembre, la description du lot privé de photos (noms, types d'actes, dates). Nettoyer la version courante ne suffit pas : le dépôt public part d'un premier commit qui reprend l'arbre nettoyé ; le dépôt privé garde l'historique complet, en archive.
- **Les plans quittent le dépôt.** `wiki/plans/` était des journaux d'exécution écrits pour des agents, avec les chemins de la machine de l'auteur. Les specs restent la documentation ; les plans vivent dans `tasks/`, non suivi.
- **Éditeur et titulaire des droits : Snouzylabs S.R.L.** (décision du 5 octobre 2026), la société qui édite aussi workout.cool. Le code est sous « Copyright (C) 2026 Snouzylabs S.R.L. and the Holy PDF contributors », la marque et les vidéos lui appartiennent, et les mentions légales la nomment comme éditeur ; siège et immatriculation à ajouter.
- **Arborescence (5 octobre 2026).** Le site passe de `Web/` à `apps/web`, avec un workspace pnpm à la racine (`pnpm dev`, `pnpm verify`) : la convention `apps/*` des monorepos JS, que l'appli de bureau Tauri rejoindra dans `apps/desktop`. Turborepo et l'extraction d'un paquet partagé (le moteur) attendent ce second paquet. Les dossiers Swift ne bougent pas, mais `Packages/` (Swift) et un futur `packages/` (JS) seraient le même dossier sur un disque Mac insensible à la casse : avant de créer un paquet JS partagé, déplacer le paquet Swift (par exemple dans `swift/`) ou nommer le dossier JS autrement.
