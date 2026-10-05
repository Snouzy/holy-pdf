# Tests

_Créée le 29 septembre 2026._

## Commandes

Depuis `Packages/Core` :

| But | Commande |
|---|---|
| Tout | `swift test --no-parallel` |
| Un fichier de tests | `swift test --filter GeometryTests` |
| Lot privé seulement | `swift test --filter PrivateBatchTests` |
| Temps (build optimisé) | `swift test -c release -Xswiftc -enable-testing --filter PrivateBatchTests` |

Depuis la racine du dépôt, pour l'appli :

| But | Commande |
|---|---|
| Build | `xcodebuild -project apps/mac/PDFToolbox.xcodeproj -scheme PDFToolbox -destination 'platform=macOS' build` |
| Tests et captures d'écran | la même commande avec `test` à la place de `build` |
| Traductions | `python3 apps/mac/scripts/check-strings.py` : liste les textes sans français, et ceux qui ont une espace ordinaire là où le français veut une espace insécable (avant `: ; ? !` et `»`, après `«`), et ceux qui tutoient Si `git status` montre ensuite le catalogue modifié, Xcode l'a réécrit : une clé du catalogue n'est plus relevée dans le code (elle porte `"extractionState" : "stale"`), ou une clé du code manque au catalogue |

Framework : Swift Testing (`import Testing`, `@Test`, `#expect`).

## Ce qu'on teste, et à quel niveau

| Niveau | Quoi | Où |
|---|---|---|
| Logique pure | Coordonnées, formats de page, marqueurs, dates, titres, noms | `ScanCoreTests` |
| Images de synthèse | Pages générées en code (`TestSupport/SyntheticPage.swift`) : penchées, avec ombre, filigrane, texte gras près du bord, coin recouvert. On vérifie les coins et les valeurs de pixels | `ScanCoreTests` |
| PDF | Pages, tailles, texte extractible, JPEG non recompressé, titre | `PDFCoreTests` |
| État d'un lot | Import, file de traitement, planche, retouches et annulation, export, avec un moteur factice (`FakePages`) | `ScanSessionTests` |
| Lot complet | Outil en ligne de commande sur des photos de synthèse | `ScanCLITests` |
| Lot privé | Les 17 photos réelles et leurs attentes | `ScanCLITests/PrivateBatchTests.swift` |
| Écrans | Chaque écran rendu en PNG pour la relecture, dans `~/Library/Containers/com.snouzy.pdftoolbox/Data/tmp/screens/` : `home`, `home-dark`, `home-narrow`, `start`, `start-dark`, `tips`, `tips-dark`, `board`, `thumbnails`, `correction`, `export`. `ImageRenderer` dessine les champs de texte, cases, listes et zones de dépôt comme des cadres jaunes barrés | `apps/mac/PDFToolboxTests` |

**Tolérance des coins** : 0,5 % de la diagonale de l'image, mesurée par `Geometry.maxCornerShift`.

**Vision dans les tests** : la détection de page et l'OCR tournent pour de vrai. Un test qui dépend de Vision vérifie un résultat métier (le coin, le texte lu), jamais un détail de Vision (le nombre d'observations, un score de confiance exact).

## Le lot privé

`fixtures-private/`, à la racine du dépôt, est **ignoré par git**. Il contient :

| Chemin | Contenu |
|---|---|
| `photos/` | les 17 photos HEIC du lot du 26/09/2026 |
| `reference/` | les pages rendues par le prototype Python |
| `prototype/` | réglages du prototype : `pages.json`, `overrides.json`, `corners.txt` |
| `expected.json` | pour chaque photo : quarts de tour, coins auto faux, filigrane, mode ; les 11 documents attendus avec leur date |
| `edits.json` | retouches du prototype converties pour le moteur Swift (coins, sens, mode, filigrane, gomme) |
| `make_edits.py` | génère `edits.json` à partir de `prototype/` |

Les tests du lot privé ne tournent que si `fixtures-private/expected.json` existe. Sinon ils sont ignorés, et `swift test` reste vert sur une machine sans le lot.

Le lot privé écrit son résultat dans `fixtures-private/runs/latest/`.

Les PDF de `fixtures-private/pdfs/reels/` cités dans les recettes sont publics, à télécharger soi-même : `irs-formulaire-w9.pdf` est le formulaire W-9 de l'IRS (irs.gov), `irs-publication-17.pdf` sa publication 17, `nasa-fiche-nanosatellites-2013.pdf` la fiche NASA de 2013 sur les nanosatellites (nasa.gov), `arxiv-attention-is-all-you-need.pdf` l'article arXiv 1706.03762.

## Ce qu'un test ne fait pas

- Il n'affirme jamais une valeur de pixel exacte après Core Image : toujours un seuil (« papier ≥ 245 », « texte ≤ 60 »).
- Il ne lit ni n'écrit en dehors d'un dossier temporaire, sauf le lot privé, en lecture seule (et son dossier de sortie `runs/latest/`).
- Tout fichier temporaire va sous `TestImages.temporaryFolder`, supprimé à la fin du processus.

## Version Web

Signer : `pnpm exec playwright test tests/e2e/sign.spec.ts --project chromium --project firefox --project webkit` couvre le dessin, PNG/JPG/JPEG (alpha PNG exporté relu avec pdf.js), placement et taille, deux pages, export répété, téléphone, langue, dépôt local, décodage en attente et échec/reprise des deux aperçus. `tests/engine/sign.test.ts` vérifie rotations/CropBox, pixels transparents, conservation du catalogue avec pdf.js, documents protégés, refus des signatures numériques et partage de l'image sur dix pages.

`tests/e2e/sign-navigation.spec.ts` vérifie la navigation flottante par clic de coordonnées après défilement, sa disparition hors de la zone PDF, le zoom et l’absence de débordement à 1280 et 390 px. Le clic de coordonnées évite qu’un défilement automatique du banc masque une commande inaccessible.

`tests/e2e/sign-insert.spec.ts` vérifie l'ajout en une action et la proposition « Ajouter ici » à 1280 et 390 px. À 720 px de hauteur, l'action est cliquée par coordonnées sans défilement du panneau ; sa visibilité et l'absence de chevauchement avec les options sont mesurées. Le placement au clic est vérifié après zoom et rotation, avec export. Une saisie effacée ou un mode vide ne permet pas d'insérer un ancien brouillon ; les placements existants restent exportables. Le premier clic extérieur conserve le comportement de désélection seul.

Cette suite vérifie aussi la stabilité de la consigne et de la position du document pendant une saisie caractère par caractère, son effacement et la sélection/désélection. Les mutations sont observées en FR/EN à 1280 et 390 px pour détecter les alternances transitoires, pas seulement l'état final du texte.

Protéger et Déverrouiller : `tests/engine/transform.test.ts` (chiffrement relu par PDFium et pdf.js, PDF signé refusé) et `tests/e2e/protect-unlock.spec.ts` (mots de passe identiques avant le lancement, copies qui s'ouvrent avec ou sans mot de passe).

Numéroter : `tests/engine/numbers.test.ts` (formats, plage, position relue par pdf.js sous les quatre rotations) et `tests/e2e/page-numbers.spec.ts` (réglages entrés avant que le PDF ait fini de s'ouvrir).

Filigrane : `tests/engine/watermark.test.ts` (plage, angle, transparence mesurée sur les pixels, largeur) et `tests/e2e/watermark.spec.ts` (texte accentué, émoji refusé, texte par défaut).

Aplatir : `tests/engine/flatten.test.ts` (champ rempli devenu texte de la page, annotation retirée) et `tests/e2e/flatten.spec.ts`.

Pages par feuille : `tests/engine/nup.test.ts` (format et orientation des feuilles, ordre de lecture) et `tests/e2e/pages-per-sheet.spec.ts`.

Couper en deux : `tests/engine/halves.test.ts` (moitiés et mots visibles relus par pdf.js) et `tests/e2e/split-in-half.spec.ts`.

Pixelliser : `tests/engine/pixelize.test.ts` (aucun texte, une image par page, tailles affichées gardées) et `tests/e2e/pixelize.spec.ts`.

Champs de formulaire : `tests/engine/forms.test.ts` (un champ texte et une case à cocher dessinés dans le rendu d'une page, qui passe par l'environnement de formulaire du document ; liste des champs d'une page droite et d'une page tournée ; valeurs posées, relues par pdf.js et rendues, refus d'un index qui n'est pas un widget ; champs ajoutés sur une page droite et une page tournée, relus, remplis, refus d'un nom en double). Le remplissage en place et l'outil Champ sont aussi dans `tests/e2e/edit.spec.ts`.

Noircir : `tests/engine/redact.test.ts` (six secrets d'une page absents des octets et des flux décompressés, signet et lien gardés, rotations, plafond de 6 000 pixels, PDF signé et XFA refusés) et `tests/e2e/redact.spec.ts` (dont le déplacement d'une zone par sa poignée et aux flèches, et la cible de 44 px des petits boutons).

OCR : `tests/engine/ocr.test.ts` (texte invisible là où le lecteur voit la ligne, sous les quatre rotations ; accents écrits ou ramenés à leur lettre ; caractères comptés par page) et `tests/e2e/ocr.spec.ts` (lecture réelle par Tesseract.js d'une page scannée).

PDF en Word : `tests/engine/word.test.ts` (styles, paragraphes, colonnes, pages, images, scans ; ouverture par `textutil` sous macOS) et `tests/e2e/pdf-to-word.spec.ts`.

Scanner : `tests/scan/` (détection, redressement, nettoyage, format des photos ; banc des 17 photos de `fixtures-private` contre `edits.json` et `expected.json`, sauté sans elles), `tests/scanner/session.test.ts` (planche et annulation), `tests/engine/scanPdf.test.ts` et `tests/e2e/scanner.spec.ts` (photo faite par OpenCV, PDF A4, coin corrigé puis annulé, page couchée remise à l'endroit et nommée d'après son titre, texte cherchable). Lecture : `tests/scan/suggest.test.ts` (tests Swift traduits) et `tests/scan/reading.test.ts` (banc des 17 photos avec Tesseract dans Node, environ 7 minutes). Les deux bancs des 17 photos (`photos.test.ts`, `reading.test.ts`) ne tournent qu'avec `SCAN_BENCH=1 pnpm test` et `fixtures-private`.

Superposer : `tests/engine/overlay.test.ts` (pages, dessus et dessous, ajustement sous rotation, signatures) et `tests/e2e/overlay.spec.ts`.

Signets : `tests/engine/bookmarks.test.ts` (lecture, vues gardées, haut de page sous rotation, signatures, relu par pdf.js), `tests/unit/bookmarksOutline.test.ts` (rang et niveau d'un nouveau signet) et `tests/e2e/bookmarks.spec.ts`.

Modifier : `tests/engine/edit.test.ts` (texte relu à sa place sur quatre rotations, formes et surligneur relus en pixels, ordre, image, tampon, refus), `tests/engine/editOriginals.test.ts` (objets d'une page, mots, déplacement, suppression, correction de texte avec ou sans changement de police), `tests/engine/editAnnotations.test.ts` (note, surlignage, soulignement, barré, liens, relus par pdf.js et rendus), `tests/engine/editImages.test.ts` (image ajoutée tournée, retournée, recadrée, partagée ; image d'origine tournée, retournée, recadrée, JPEG gardé), `tests/unit/editModel.test.ts` (création, déplacement, poignées, sélection, ordre, annulation, style, retouches d'origine, zone de texte), `tests/unit/editMetrics.test.ts` (chasses, coupure des lignes, mise en page du tampon) et `tests/e2e/edit.spec.ts`.

Rogner : `tests/engine/crop.test.ts` (cadre relu par pdf.js sur trois rotations et une page déjà rognée, une page seule, marque gardée à sa place, refus), `tests/unit/cropBox.test.ts` (tracer, déplacer, poignées) et `tests/e2e/crop.spec.ts`.

Réparer : `tests/engine/repair.test.ts` (fichier coupé, table perdue, secours PDFium, mot de passe, signature) et `tests/e2e/repair.spec.ts`.

`tests/e2e/sign-move.spec.ts` déplace une signature par sa flèche à quatre directions, au glisser puis par deux flèches du clavier coup sur coup, et vérifie que les trois onglets gardent leur taille et tiennent sur une ligne en Dessiner comme en Texte, barre de défilement classique comprise (mesure sautée si Figtree n'a pas pu se charger) ; il vérifie aussi qu'un bouton de la signature qui reçoit le focus remonte au-dessus de la barre de pages flottante. Sous forte charge, avec les trois navigateurs en parallèle, une touche synthétique envoyée juste après « Ajouter » peut se perdre : `sign-selection.spec.ts` presse donc jusqu'à 90°, la rotation au clavier ayant son propre test. `tests/e2e/sign-controls.spec.ts` exerce la poignée de rotation libre puis le clavier à 125 % et sur une page tournée, ainsi que le glisser du petit coin avec maintien du coin opposé ; les rotations de pages sont relues dans le PDF exporté, y compris une page sans signature. Les tests moteur comparent aussi les pixels pour des angles libres avec CropBox et rotation native.

`tests/e2e/sign-selection.spec.ts` couvre la butée réelle à gauche après rotation, le centre stable lors du redimensionnement, la petite poignée au coin, la rotation séparée, la désélection au clic extérieur ou avec Échap, la sélection suivante et leur export. Les tests unitaires/moteur couvrent les quatre bords et les rotations natives avec recadrage.

`tests/e2e/sign-text.spec.ts` vérifie le chargement différé et local de la police, les mentions accentuées, les deux styles, la coexistence avec une image, les proportions après sélection d’un ancien élément, la transparence dans l’export, la conservation de la saisie entre onglets et la reprise après échec de police. Les tests client/moteur vérifient les références manquantes, le partage des assets, le transfert sans détachement des originaux et la limite cumulée de pixels.

`tests/e2e/sign-drawing.spec.ts` vérifie l'agrandissement, l'annulation du dernier trait avec égalité du dessin restant, Échap/focus, le mobile, l'alpha exporté et les événements regroupés avec repli. Un trait synthétique de 5 000 mouvements vérifie que le nombre de segments émis reste linéaire ; les mesures jointes concernent le traitement synchrone et les commandes canvas, pas le GPU ni la latence d'affichage. `tests/unit/drawing.test.ts` vérifie le lissage, le point final, la relecture fidèle et la limite de points.

Performance Signer : `pnpm exec playwright test tests/bench/sign.spec.ts --project bench --workers 1`, sans autre suite en parallèle. Génère son PDF et son JPG synthétiques, mesure trois exports et la latence de mutation DOM pendant le déplacement, vérifie les limites d'image et l'absence de nouvelles demandes de rendu. Résultats, hashes et captures dans `fixtures-private/sign/`, ignoré par Git. [Résultats et limites](web-version.md#mesures-signer--1er-octobre-2026).

Depuis `apps/web/` :

| But | Commande |
|---|---|
| Types | `pnpm check` |
| Logique et moteur | `pnpm test` |
| Images de l'appli Mac | `UPDATE_MAC_ASSETS=1 pnpm test` réécrit `apps/mac/PDFToolbox/Assets.xcassets/Generated/` et la tête de l'icône |
| Recherche de l'appli Mac | `tests/unit/macSearch.test.ts` : la copie de l'index de recherche du site dans `apps/mac/PDFToolbox/App/SearchTerms.json` est à jour. `UPDATE_MAC_ASSETS=1 pnpm test` la réécrit |
| SEO (après `pnpm build`) | `pnpm test:seo` |
| Bout en bout, 3 navigateurs (après `pnpm build`) | `pnpm e2e` |
| Budgets de chargement | `INDEXABLE=true pnpm build && pnpm lighthouse` |
| Temps de traitement, en local seulement | `pnpm build && pnpm bench` |
| Avant une fusion, et dans la CI | `pnpm verify` : types, unitaires, build, SEO, e2e Chromium (1 min environ) |
| Avant une fusion qui touche la mise en page, les polices, les budgets ou le moteur | `pnpm verify:full` : ajoute Firefox, WebKit et Lighthouse (10 min environ) |
| Site servi comme en production | `pnpm serve`, puis `http://localhost:8787` |

Les fichiers de test sont générés par les tests : PDF dont chaque page porte son nom en gros, PDF protégé, PDF tronqué, un JPEG de 960 octets. Le moteur est vérifié avec pdf.js, jamais avec lui-même.

Le design system a ses propres tests :

- **Contrastes** (`tests/unit/tokens.test.ts`) : chaque couple texte et fond de `tokens.css` atteint 4,5 : 1, en clair et en sombre ; les feuilles PDF restent blanches ; en sombre, chaque teinte et le disque des moines à venir se détachent des panneaux.
- **Polices** (`tests/unit/fonts.test.ts`) : chaque lettre des dictionnaires et des textes des outils est dans le sous-ensemble des polices.
- **Illustrations** (`tests/unit/illustrations.test.ts`) : le moine ne dessine que son accessoire, toujours par-dessus ses mains, prend ses couleurs dans les variables CSS, et l'avatar coupe la robe au cercle.
- **Accueil** (`tests/e2e/home.spec.ts`) : les garanties juste sous le titre, au-dessus de la phrase, et le bouton de la vidéo centré sous la phrase ; la phrase du haut, dont le verbe change le moine et mène à son outil ; son menu au clavier (flèches, Entrée, Échap, premières lettres), à taille de texte, fermé par un clic ailleurs, et dans l'écran à 320 et 390 px ; un espace entre deux verbes, pour que le verbe choisi et celui sous le pointeur ne se touchent pas ; la vidéo, jamais chargée à l'arrivée, ouverte par l'aperçu rond et arrêtée par Échap, et sa bulle dans la FAQ ; la vidéo anglaise sur la page anglaise ; une ligne par catégorie dans la vue compacte, qui défile de côté et s'estompe tant qu'il reste des moines ; la première rangée de moines visible sur un écran de 1280 × 800 ; la vue compacte gardée après un rechargement ; la promesse signée par Frère Plume, puis la bande des quatre garanties en dessous ; l'auréole du moine de « Pourquoi des moines ? » ; les six raccourcis de la bande finale, sur deux rangées à 1280 px, trois à 900 px et six à 390 px, le dernier menant à JPG en PDF, et le moine auréolé ; les trois gestes en frise sans cartes, sur une ligne à 1280 px, empilés et sans trait à 390 px ; la FAQ en six questions et six réponses, la dernière bulle opaque une fois à l'écran, le lien vers la page FAQ ; le cas « dossier administratif » qui mène au guide ; aucune largeur de trop à 320 et 390 px, polices bloquées. `filter.spec.ts` vérifie que « Les montrer », sur la carte des moines en méditation, allume l'interrupteur.
- **Page 404** (`tests/e2e/notfound.spec.ts`) : une adresse inconnue sous `/fr/` répond 404 en français et mène à un outil par la phrase ; sous `/en/` et hors langue, en anglais ; aucune largeur de trop à 320 et 390 px.
- **Dépôt sur toute la page** (`dropTracker.test.ts`, `files.spec.ts`) : seuls les glisser qui portent des fichiers comptent ; sur la page d'un outil, un fichier lâché n'importe où s'ouvre.
- **Bulle du moine** (`bubble.test.ts`) : ce qu'il dit selon l'état de la planche.
- **Thème** (`tests/e2e/theme.spec.ts`) : la bascule clair et sombre, gardée d'une page à l'autre, le mode sombre de l'appareil, le mouvement réduit.
- **Largeur** (`tests/e2e/site.spec.ts`) : l'accueil tient à 320, 390, 768 et 1024 px, même avec les polices de repli.

Le parcours et les deux outils du lot 1 ont leurs tests :

- **Parcours** (`flow.test.ts`, `deliver.test.ts`, `document.test.ts`, `tests/e2e/flow.spec.ts`) : régler, lancer, résultat, retour avec tout intact ; un seul fichier téléchargé tel quel, plusieurs en `.zip` sur ordinateur et par la feuille de partage sur un écran tactile ; l'enregistreur par défaut télécharge ; le document que la coque de bureau fait suivre (résultat ou sources, enregistré ou non) et ce qu'une planche libère en se démontant ; le haut de page qui se replie ; le bouton verbe sous le pouce sur téléphone.
- **Index de recherche** (`searchIndex.test.ts`) : chaque outil, prêts d'abord, avec ses noms, ses mots et son libellé, dans les deux langues ; la même construction sert `search.json` et l'appli de bureau.
- **Compression** (`tests/engine/compress.test.ts`, `tests/e2e/compress.spec.ts`) : un PDF avec photo maigrit et conserve texte, signets, destination interne, titre/XMP, champ rempli, balises et pièce jointe (vérifiés par pdf.js) ; image partagée réencodée une seule fois ; formulaires imbriqués dimensionnés pour le plus grand placement ; PDF protégé déchiffré à l'export ; retour à l'original sans gain.
- **Image transparente** (`tests/engine/imageStreams.test.ts`) : conservation des masques doux et explicites, des intentions de rendu et des ressources d'annotations ; mise en page inconnue rendue intacte ; `/Matte`, masques de couleur, clés inconnues et dictionnaires ambigus laissés tels quels.
- **PDF en JPG** (`tests/engine/images.test.ts`, `tests/e2e/pdf-to-jpg.spec.ts`) : une image par page à 150 ou 300 ppp, 16 millions de pixels au plus ; chaque photo une fois, sans les petites images ; l'aide « ? » au clavier.
- **Barre et pied de page** (`tests/e2e/nav.spec.ts`) : Fusionner, Signer et Compresser dans la barre ; l'état au défilement sans saut de mise en page ; un seul menu ouvert à la fois ; Échap et le focus ; le tiroir sur téléphone, page derrière `inert` ; le nettoyage après une navigation `ClientRouter` ; le thème et l'anneau de focus du pied de page ; les icônes centrées dans leurs boutons.
- **Panneau au défilement** (`tests/e2e/sidebar-layout.spec.ts`) : panneau et action toujours visibles pendant la lecture des instructions, de la FAQ et des outils liés, à 1024 et 1280 px ; contenu entièrement à gauche et clic au bord droit de la FAQ sans interception ; dernier choix entièrement accessible au-dessus de l'action à 1024 × 600 ; ordre des éléments et bouton visible à 390 px. Vérifié dans les trois navigateurs ; captures de diagnostic privées dans `fixtures-private/sidebar-review/`.
- **Page d'un outil** (`tests/e2e/toolpage.spec.ts`) : un seul moine ; le libellé du bouton pour chaque outil ; le bouton sur toute la largeur sur téléphone.
- **Extraction native et JPEG** (`tests/engine/images.test.ts`, `tests/unit/jpeg.test.ts`) : dimensions natives, détourage ignoré, masques conservés sur fond blanc, photos dans les formulaires, fichiers protégés, absence de faux doublons entre masques différents ; contexte absent/perdu, limites d'allocation et refus des sorties non JPEG.
- **Mesure sur de vrais PDF**, à la demande : `MEASURE_DIR=../../fixtures-private/compress pnpm vitest run tests/engine/measure.test.ts`. Mesure l'enregistrement seul, les trois niveaux et le gain livré après retour à l'original. Compare la structure du candidat Recommandée avec pdf.js, même si ce candidat est plus lourd. Rapports et candidats dans `fixtures-private/compress/runs/preserve-structure/`, hors dépôt. Les coordonnées de destination sont normalisées à six décimales pour tolérer la sérialisation float32 de PDFium.
- **Temps de traitement** (`tests/bench/lot1.spec.ts`, lancé par `pnpm bench`) : Compresser et PDF en JPG sur 20 pages avec photos.

Le benchmark global `pnpm bench` suit le parcours actuel : il distingue les 100 pages de la tuile d'ajout, mesure la rotation sur Pivoter, puis attend le résultat de la fusion avant son téléchargement. Le temps des premières vignettes est horodaté dans la page, sans le trajet de retour Playwright. La rotation mesure la mutation du style, pas la peinture finale ; le ralentissement CPU ×4 reste une simulation et ne remplace pas un téléphone physique. Les cibles du lot 1 (10 s et 8 s) sont maintenant des assertions ; auparavant elles n'étaient qu'affichées dans les logs.

Les pages du pied de page ont leurs tests :

- **Adresses et dates** (`tests/unit/sitePages.test.ts`) : slugs sûrs, uniques, distincts des outils et de `search.json` ; une date du frontmatter reste le même jour à l'ouest de UTC.
- **Contenu** (`tests/unit/content.test.ts`, `tests/unit/fonts.test.ts`) : un fichier par page et par langue, les articles sous les mêmes noms dans chaque langue ; chaque lettre dans le sous-ensemble des polices.
- **SEO** (`tests/seo/pages.test.ts`) : en plus des contrôles de chaque page construite, ni l'accueil ni une page de contenu n'hydrate d'îlot. Chaque question d'une page d'outil a une ancre unique et figure dans son JSON-LD `FAQPage`. La page FAQ lie chaque question de chaque outil à une ancre qui existe, et déclare ses propres questions en `FAQPage`.
- **Questions** (`tests/unit/faq.test.ts`, `tests/e2e/toolpage.spec.ts`) : l'ancre d'une question, sans accents ni ponctuation ; les questions d'une page Markdown, liens réduits à leur texte ; une adresse en `#question` ouvre cette question, et elle seule.
- **Navigateur** (`tests/e2e/pages.spec.ts`) : chaque lien du pied de page mène à sa page, chaque lien interne de ces pages répond ; le changement de langue garde la page ou l'article ; les ancres `#mac` et `#iphone` ; du blog à l'article et retour ; aucune page ne défile de côté à 320 et 390 px, polices bloquées.

Si le port 8787 est déjà pris, une copie locale de `playwright.config.ts`, non commitée, peut lancer le site sur un autre port, 8788 par exemple : `pnpm exec playwright test tests/e2e/pages.spec.ts --config <copie>` (le fichier de test se place avant `--project`).

Lighthouse CI a un budget par type de page, en gzip : 24 Ko de JavaScript et 40 Ko de document sur l'accueil, 50 Ko (51 200 o) sur une page outil, 80 Ko de polices ; LCP ≤ 1,5 s sur l'accueil, ≤ 1,6 s sur une page outil.

## Validation de qpdf et campagne intégrée

- `tests/engine/qpdf.test.ts` utilise le vrai WASM et vérifie aussi les statuts CLI, la taille/header/EOF et le nettoyage des fichiers temporaires avec des doubles ciblés.
- `tests/engine/compact.test.ts` vérifie transfert d'une copie, terminaison du Worker en succès/erreur/délai et retour au candidat si la sortie grossit.
- `tests/engine/compressionProfile.test.ts` vérifie profils PDF/A/PDF/X, enveloppes, Flate, noms échappés, encodages XML, limites de lecture et métadonnées ordinaires Adobe `pdfx`.
- `tests/e2e/compress.spec.ts` vérifie le chargement différé, les documents avec signature rendus strictement intacts et la reprise après échec JS/WASM.
- `tests/e2e/jpeg-worker.spec.ts` utilise le Worker de production dans les trois navigateurs : JPEG supérieur à 55 Ko, dimensions et pixels non noirs.

Campagne privée reproductible, depuis `apps/web/`, avec le site construit servi par `pnpm serve` dans un autre terminal :

```sh
node scripts/benchmark-compression-integrated.mjs --output ../../fixtures-private/compress/runs/compression-integrated-final
BENCH_EXPECT_PDFS=33 BENCH_VERIFY_REPORT=integrated-final-structure.json node scripts/benchmark-compression-options.mjs verify ../../fixtures-private/compress/runs/compression-integrated-final/chromium ../../fixtures-private/compress/runs/compression-integrated-final/firefox ../../fixtures-private/compress/runs/compression-integrated-final/webkit
```

Le premier script effectue les vrais dépôts, clics et téléchargements, sans requête extérieure. Une passe par défaut, `--repeats 3` possible. Il relève le chargement différé, les temps et des mesures mémoire partielles ; les allocations natives complètes des Workers ne sont pas couvertes. Il faut laisser le processeur libre des autres tests pendant les mesures. Les Blob de même origine doivent rester autorisés : WebKit peut les utiliser pour lire les JPEG.

Le second compare chaque sortie avec son original via pdf.js : pages/rotation/boîtes, texte, signets et destinations résolues, liens, champs, XMP, balises et pièces jointes. Il échoue si un invariant diffère ou si le nombre attendu n'est pas atteint. Ce contrôle ne couvre pas tous les comportements JavaScript, formulaires dynamiques, autres annotations ou calques OCG.

Qualité, depuis la racine du dépôt, avec un environnement Python temporaire contenant PyMuPDF, NumPy, Pillow et scikit-image :

```sh
python apps/web/scripts/verify-compression-quality.py --candidate fixtures-private/compress/runs/compression-integrated-final/chromium --output fixtures-private/compress/runs/compression-quality/chromium
```

Répéter pour Firefox/WebKit. Les versions sont enregistrées dans le rapport. Les scores SSIM, recadrages et montages restent privés ; ils nécessitent une lecture visuelle et ne constituent pas une certification. Résultats, limites et performances : [Version Web](web-version.md).

## L'appli, vérifiée à la main

La spec ne demande pas de tests d'interface automatisés. Avant une fusion qui touche l'appli, dans Xcode (⌘R) :

### Démarrage et planche

1. Ouvrir l'accueil : la tuile « Scanner » est là.
2. Cliquer la tuile « Scanner » : l'écran de démarrage s'ouvre.
3. Déposer 3 à 5 photos de documents : la ligne « Lecture des photos : N sur M… » avance, puis les documents apparaissent.
4. Déposer un dossier de photos : les documents apparaissent de la même façon.
5. Déposer un PDF ou un fichier texte : une ligne « Photos illisibles » donne la raison.
6. Cliquer « Choisir des photos… » : le sélecteur s'ouvre.
7. Appuyer sur ⌘O, sur l'écran de démarrage puis sur la planche : le sélecteur s'ouvre les deux fois.
8. Ouvrir le menu Fichier sur la planche : « Ajouter des photos… » (⌘O) et « Exporter… » (⌘E) sont là.
9. Ouvrir une page, puis le menu Fichier : les deux commandes sont grisées.
10. Le bandeau de conseils affiché, regarder le bas de la planche : aucune ligne d'aide.
11. Cliquer « × » sur le bandeau de conseils : il se ferme. Relancer l'appli : il reste fermé.
12. Choisir Aide → « Afficher les conseils » : le bandeau revient, et la ligne d'aide du bas disparaît.
13. Survoler le crayon, « Télécharger… », ⋯ et le « × » du bandeau : chacun se surligne.
14. Survoler une page :
   - elle se soulève et un anneau l'entoure ;
   - les boutons « Corriger » et « Supprimer » apparaissent ;
   - le pointeur devient une main.
15. Cliquer la page : la correction s'ouvre.
16. Revenir à la planche : aucune page ni ligne ne reste soulevée ou teintée.
17. Cliquer le bouton « Supprimer » d'une page survolée : la page disparaît, sans confirmation.
18. Appuyer sur ⌘Z : la page revient à sa place.
19. Faire un clic droit sur une page, puis choisir « Supprimer la page » : elle disparaît, sans confirmation.
20. Pivoter une page dans la correction, revenir à la planche, puis supprimer une autre page : elle disparaît.
21. Appuyer sur ⌘Z : la page supprimée revient.
22. Appuyer encore sur ⌘Z : la page pivotée s'ouvre et reprend son sens.
23. Glisser une page, par sa vignette survolée, vers un autre document : elle s'y déplace, sans les boutons.
24. Appuyer sur ⌘Z : la page revient dans son document, à sa place.
25. Dans un document d'au moins deux pages, glisser une page sur la case « Glissez une page ici pour un nouveau document » : un document se crée. Un document d'une seule page n'a pas cette case.
26. Appuyer sur ⌘Z : le nouveau document disparaît et la page revient.
27. Survoler le ⚠︎ d'une page et attendre : l'infobulle donne les raisons, une par ligne.
28. Cliquer « ⚠︎ N pages à vérifier » : la planche ne montre que ces pages.
29. Le filtre étant actif, supprimer la dernière page marquée : le filtre s'éteint et la planche n'est pas vide.
30. Sans filtre, supprimer la dernière page marquée : le bouton « ⚠︎ » disparaît sans laisser de bulle vide, et « Ajouter des photos… » et « Exporter » ne bougent pas.
31. Avec au moins deux pages marquées et le filtre actif, ouvrir une page marquée, puis revenir à la planche : le filtre est toujours actif.
32. Ouvrir la dernière page marquée, puis revenir à la planche : le filtre est éteint et la planche n'est pas vide.
33. Nommer un document avec « / » : le nom devient « - ».
34. Donner le même nom à deux documents : « Même nom qu'un autre document » apparaît et « Exporter » se grise.
35. Réduire la fenêtre à 960 pt avec deux documents de même nom : l'avertissement reste lisible.
36. Taper dans un nom, puis cliquer le fond de la planche entre deux lignes : la saisie se termine.
37. Taper dans un nom, puis cliquer le vide d'un en-tête de ligne : la saisie se termine.
38. Taper dans un nom, puis cliquer sous la dernière ligne : la saisie se termine.
39. Le bandeau fermé, taper dans un nom, puis cliquer la barre du bas : la saisie se termine.
40. Taper dans un nom, puis cliquer un endroit vide de la barre d'outils : la saisie se termine.
41. Cliquer dans le champ d'un nom : le curseur se place dans le champ.
42. Taper dans un nom, puis appuyer sur Échap : l'ancien nom revient.
43. Taper dans un nom, puis appuyer sur Retour : la saisie se termine et le nom reste.
44. Renommer un document, cliquer le fond de la planche, puis appuyer sur ⌘Z : l'ancien nom revient d'un coup.
45. Cliquer ⋯ → « Renommer » : le curseur est dans le champ du nom.
46. Cliquer ⋯ → « Supprimer le document… » : la confirmation donne le nom, le nombre de pages et « Vous pourrez l'annuler avec ⌘Z. ».
47. Dans cette confirmation, appuyer sur Retour : rien n'est supprimé.
48. Rouvrir la confirmation, puis cliquer « Supprimer » : le document disparaît.
49. Appuyer sur ⌘Z : le document revient à sa place, avec son nom et ses pages.
50. Avec VoiceOver, aller sur une vignette : elle se lit comme un seul bouton, avec les actions « Corriger » et « Supprimer ».

### Correction

51. Survoler un coin : la main est ouverte.
52. Glisser un coin : la main se ferme, même au-delà du bord de la photo, et la loupe suit le coin.
53. Lâcher le coin : le résultat se recalcule.
54. Croiser deux coins, puis lâcher : « Ces coins ne forment pas une page : gardez les quatre coins dans l'ordre, autour de la page. » s'affiche 3 s, et le coin glisse à sa place.
55. Pendant ce message, déplacer un coin sans le croiser : le message disparaît.
56. Refaire le cas 54, puis appuyer sur ⌘Z : le message disparaît.
57. Cliquer un coin sans le bouger : aucun message.
58. Choisir « Gomme » : le pointeur devient un viseur sur la page seulement, et l'anneau suit le trait.
59. Choisir « Gomme » : le titre du résultat dit « Résultat · gommez ce qui reste autour de la page ».
60. Choisir « Coins » : le curseur « Taille de la gomme » est grisé.
61. Choisir « Coins » : le titre du résultat dit « Résultat · choisissez la gomme pour effacer autour ».
62. Choisir « Gomme », puis « Pivoter » : « Mise à jour de la page… » reste jusqu'à l'arrivée de la page tournée.
63. Tracer un trait de gomme juste après : il marche aussitôt.
64. Choisir « Gomme », puis changer le rendu (« Document » ou « Couleur ») : la pastille n'apparaît pas.
65. Changer le rendu : une petite roue tourne à côté de « Résultat » pendant le calcul, la page et les coins restent en place.
66. Cliquer « Pivoter » : la page tourne d'un quart de tour.
67. Appuyer sur ⌘Z : la page revient.
68. Appuyer sur ⇧⌘Z : la page tourne à nouveau.
69. Survoler « Pivoter » : l'infobulle dit « Pivoter d'un quart de tour ».
70. Déplacer un coin, puis survoler « Annuler » : l'infobulle dit « Annuler Déplacer les coins ».
71. Déplacer un coin, puis cliquer « Rétablir la détection auto » : les coins retrouvés à l'import reviennent.
72. Changer le rendu, le filigrane et le format : la page reflète chaque changement.
73. Sur une page à vérifier : la ligne d'état montre le ⚠︎ orange devant la raison.
74. Poser les coins à la main : la ligne d'état montre « Coins posés à la main. », sans ⚠︎.
75. Cliquer « Rétablir la détection auto » : le ⚠︎ et la raison reviennent.
76. Sur une page au texte illisible, poser les coins à la main : la ligne montre « Coins posés à la main. » puis « Le texte n'a pas pu être lu : cette page n'a pas de couche de texte. », avec le ⚠︎.
77. Avec un rendu en échec : la ligne d'état montre l'octogone rouge et « La page n'a pas pu être rendue. ».
78. Déplacer la photo d'une page dans le Finder, choisir « Gomme », puis tracer un trait : la ligne d'état dit l'échec, et aucune pastille ne couvre le résultat.
79. Pivoter la page, puis cliquer « Page suivante » : la page suivante s'ouvre.
80. Appuyer sur ⌘Z : la page pivotée se rouvre et reprend son sens.
81. Le filtre étant actif, cliquer « Page suivante » : seules les pages à vérifier défilent.
82. Cliquer « Page suivante » jusqu'à la dernière page : le bouton devient « Terminer », et la barre d'outils ne bouge pas.
83. Cliquer « Terminer » : la planche revient.
84. Avec VoiceOver, aller sur « Page suivante » : un seul titre est lu.
85. Ouvrir la fenêtre à 960 pt, en français, sur une page d'un document au nom long : la barre d'outils ne déborde pas (pas de chevron).

### Export et téléchargement

86. Cliquer ⋯ → « Télécharger le PDF… » : le panneau d'enregistrement s'ouvre en feuille, nom rempli.
87. Cliquer le bouton « Télécharger… » d'une ligne : le même panneau s'ouvre.
88. Enregistrer : le toast « Enregistrement de « Nom.pdf »… » s'affiche, puis « « Nom.pdf » enregistré » avec « Afficher dans le Finder », et il se ferme seul après 4 s.
89. Cliquer « Afficher dans le Finder » : le Finder sélectionne le fichier.
90. Enregistrer un document pendant l'import d'autres photos : « « Nom.pdf » enregistré » s'affiche sans attendre la fin de l'import.
91. Enregistrer à la place d'un PDF verrouillé (Finder, Lire les informations, « Verrouillé »), en acceptant de le remplacer : « « Nom.pdf » n'a pas pu être écrit. Vérifiez l'accès au dossier et l'espace libre. » reste jusqu'à un clic sur « Fermer ». Le nom est celui du fichier choisi dans le panneau.
92. Dans la correction, cliquer « Télécharger… » : la feuille s'ouvre.
93. Enregistrer depuis la correction : les toasts s'affichent sur le résultat, pas sur la barre de réglages.
94. Avec VoiceOver, enregistrer depuis la planche, puis ouvrir une page : le toast n'est lu qu'une fois.
95. Appuyer sur ⌘E : la feuille d'export s'ouvre.
96. Avec une page encore marquée ⚠︎, ouvrir l'export : la ligne « 1 page est encore à vérifier. » et le bouton « Vérifier » sont là.
97. Cliquer « Vérifier » : la feuille se ferme et la page marquée s'ouvre.
98. Décocher un document, puis cliquer « Exporter » : le document décoché n'est pas écrit, et le Finder montre les autres PDF.
99. Dans Aperçu, chercher un mot de la page : la recherche le trouve.
100. Exporter dans un dossier qui contient déjà un des PDF : « Remplacer » et « Ajouter un suffixe (-2) » apparaissent.
101. Choisir « Remplacer » : l'ancien fichier est remplacé.
102. Refaire l'export dans le même dossier, puis choisir « Ajouter un suffixe (-2) » : `Nom-2.pdf` apparaît.
103. Ouvrir `Nom-2.pdf` dans Aperçu, puis ⌘I : le titre est `Nom-2`.
104. Exporter dans un dossier en lecture seule (`chmod a-w`) : un message apparaît par document et la feuille reste ouverte.
105. Quitter avec ⌘Q après cet échec : l'appli demande encore confirmation.
106. Déplacer une photo dans le Finder, puis retoucher sa page : la page garde son rendu et l'erreur s'affiche.
107. Ouvrir la feuille d'export après cette retouche : elle marque ce document.

### Fermeture

108. Fermer la fenêtre, puis cliquer l'icône du Dock : la fenêtre revient et le lot est intact.
109. Quitter (⌘Q) avec un document non exporté : « Quitter sans exporter ? » demande confirmation.

### Marque

110. Ouvrir l'accueil : le titre « Vos PDF, sur votre Mac 🙏 » avec « sur votre Mac » surligné en jaune, cinq catégories (Organiser, Convertir, Modifier, Optimiser, Sécurité) et vingt-deux cartes, chacune avec son moine ; sous Convertir, 2 outils « Bientôt » avec leur moine endormi. Appuyer sur ⌘F et taper « alléger » : seul Compresser reste. Taper « fusioner » : Fusionner. Taper « tableur » : « Aucun moine ne fait ça… pour l'instant », et « Voir tous les moines » ramène les catégories.
111. Survoler la carte du Scanner : elle se soulève, son bord passe en bleu, le pointeur devient une main.
112. Avec VoiceOver, aller sur un outil à venir : il se lit « Compresser, bientôt », et aucun moine n'est lu.
113. En français, à 960 pt de large : chaque nom d'outil à venir tient sur deux lignes au plus, sans être coupé.
114. En mode sombre : les moines de l'accueil, du démarrage, du bandeau et des toasts prennent leurs couleurs sombres, et le surligneur couvre tout le mot.
115. Sur macOS 26 : l'icône dans le Dock et le Finder n'a pas de cadre gris, et le menu de l'appli dit « Holy PDF ».
116. En français, aucun texte ne tutoie.

### Mode sombre et langue

117. En mode sombre, tout reste lisible : planche, bandeau, survol, toasts, correction et ligne d'état.
118. Refaire les étapes 1 à 116 en anglais (schéma : Arguments `-AppleLanguages (en)`) : aucun texte ne reste en français.


## Signer un PDF — Mac, 1er octobre 2026

- `swift test --filter PDFSigningTests --no-parallel` : persistance après réouverture, quatre rotations avec CropBox décalée, transparence, texte sélectionnable, liens, champs, signets, titre, exports indépendants, mots de passe, signatures numériques et limites d’images.
- Tests Xcode : protection de l’original et de ses liens symboliques/physiques, échec d’écriture puis reprise, annulation des placements et restauration de la sélection, ouverture obsolète ignorée, assets vectoriels clair/sombre.
- `node apps/mac/scripts/export-monk-assets.mjs` : vérifie Frère Plume, Frère Agrafe et Frère Classeur contre le dessin source, sans modifier `apps/web/`. Avec `sign`, `merge` ou `organize`, il ne traite qu’un moine. `--write` régénère ses fichiers.

Les PDF exportés par le code de production ont aussi été rendus avec Poppler pour vérifier indépendamment les quatre rotations, la CropBox, l’orientation et la transparence. Les tests PDFKit vérifient le flux d’apparence après réouverture.

`SigningSnapshots` produit ses PNG dans le dossier temporaire de l’application, `screens/signing/`. La capture passe par `SCShareableContent.currentProcess` : seule la fenêtre de test est capturée, sans autorisation supplémentaire. Le banc attend au plus dix captures que les pixels du titre PDF, de la signature et des boutons apparaissent ; `NSView.cacheDisplay` peut omettre ces couches. Les captures incluent le vrai canevas AppKit, alimenté par des événements souris synthétiques. Une vérification physique au trackpad reste distincte.

Le contexte d’aperçu est borné à 1 600² pixels (environ 10,24 Mo RGBA), une signature normalisée à 1 Mpx (environ 4 Mo RGBA). Le déplacement travaille sur un rectangle SwiftUI local et n’appelle ni le moteur PDF ni l’encodeur d’image.

### Parcours de contrôle

1. Ouvrir Signer depuis l’accueil : Frère Plume, puis choisir ou déposer un PDF.
2. Dessiner à la souris/au trackpad, effacer et recommencer ; essayer aussi PNG transparent et JPEG.
3. Déplacer et redimensionner la signature, ajouter un placement sur une autre page, supprimer puis annuler.
4. (3 octobre) Taper « Ada Lovelace » dans « Nom, initiales ou date », Manuscrit, puis « Ajouter ce texte » : la ligne manuscrite se pose au centre et la signature reste. Passer en Simple et ajouter « AL » : trois marques dans la liste.
5. Cliquer sur la page, ailleurs qu'une marque : la marque sélectionnée se désélectionne ; cliquer encore : la marque courante se pose là. Cliquer une autre marque de la liste, puis « Placer sur cette page ».
6. La corbeille d'une marque de la liste la retire avec toutes ses places ; ⌘Z les ramène. Enregistrer, puis ouvrir la copie dans Aperçu : chaque marque est là où elle était.
4. Enregistrer une copie, la rouvrir dans un autre lecteur, vérifier les positions et le texte sélectionnable.
5. Essayer le chemin du fichier original : l’outil demande un autre nom ou dossier.
6. Ouvrir un PDF protégé : mot de passe demandé ; l’interface annonce que la copie s’ouvrira sans mot de passe.
7. Ouvrir un autre PDF avec du travail non enregistré : confirmation nominative ; annuler le sélecteur conserve le travail.
8. Revenir au Scanner : ses commandes et son historique d’annulation restent disponibles. Fermer/rouvrir la fenêtre conserve les deux sessions ; quitter avertit pour les placements non exportés.

Les signatures ajoutées sont visuelles, sans certificat numérique. Les annotations gardent leur apparence persistante et restent éditables ; ce n’est pas un aplatissement global ni une certification PDF/A.

### Accueil en grille — correction du 1er octobre 2026

Vérifier l’accueil en clair et sombre à 960 × 640 puis 1 280 × 760 points : Scanner et Signer sont côte à côte, leurs titres et descriptions restent lisibles, les moines restent nets. Les nouvelles colonnes apparaissent automatiquement avec la largeur ; les prochains outils utilisent la même grille. Captures `home-light`, `home-dark`, `home-wide-light`, `home-wide-dark` dans `screens/signing/`.


## Fusionner des PDF — Mac, 1er octobre 2026

- Tests Xcode : les tests de session couvrent l’ordre, l’annulation, les erreurs d’import, les mots de passe, l’échec d’écriture et sa reprise, la protection des sources et de leurs liens symboliques/physiques, les sources retenues pour annulation, les tâches obsolètes et le cache de 32 aperçus.
- `MergeSnapshots` produit ses captures dans `screens/merging/` : accueil et démarrage, liste prête à exporter, aperçu, fichiers verrouillé et illisible, en clair et sombre. Elles ne remplacent pas une manipulation physique du glisser-déposer ni le parcours du panneau d’enregistrement.

Les sorties ont aussi été rendues avec Poppler : une page ordinaire et une page signée gardent un rendu identique. PDFKit peut régénérer l’apparence des champs après renommage ; les formulaires ne sont pas garantis identiques pixel par pixel.

Le moteur est vérifié sur des sources sérialisées : ordre, texte, boîtes de page, rotations, page blanche, champs homonymes indépendants, widgets liés, cases cochées, signets, destinations internes et signature visuelle issue de Signer. Les signatures numériques et les structures actives non conservables sont refusées. Les PDF balisés et les profils d’archivage/impression sont acceptés avec une notice de perte ; cela ne certifie pas le résultat PDF/A. Le plafond de 512 Mio concerne les données sources conservées, pas toute la mémoire du processus pendant PDFKit et l’export.

### Parcours de contrôle

1. Ouvrir Fusionner depuis l’accueil, ajouter au moins deux PDF par le sélecteur ou le Finder.
2. Changer l’ordre avec les flèches et par glissement ; retirer un document, puis annuler avec ⌘Z.
3. Ajouter un PDF protégé, essayer un mauvais mot de passe puis le bon ; retirer un fichier illisible pour débloquer l’export.
4. Cliquer « Aperçu » : la feuille montre toutes les pages dans l’ordre de la liste ; changer l’ordre, rouvrir l’aperçu, il suit.
5. Enregistrer une copie, l’ouvrir dans Aperçu et vérifier l’ordre, la recherche de texte et les formulaires présents.
6. Essayer d’enregistrer sur une source : l’application demande une autre destination.
7. Revenir à Scanner et Signer : les menus et les raccourcis doivent suivre l’outil affiché.
8. Fermer et rouvrir la fenêtre : le lot reste présent. Quitter avec un lot non enregistré demande confirmation.


### Corrections d’interaction — 2 octobre 2026

L’aperçu s’ouvre au clic sur la vignette et permet de parcourir toutes les pages. Le rendu est plafonné à 1 600 pixels de côté, une page à la fois ; les miniatures gardent leur plafond de 240 pixels et leur cache de 32 images. Le moteur effectue le rendu hors du thread principal à partir des données déjà chargées, même si le fichier original est déplacé ensuite. Les retours obsolètes sont ignorés après changement de page, annulation ou réinitialisation.


### Régression du glisser-déposer — correction du 2 octobre 2026

Le retour utilisateur a confirmé que l’ordre ne changeait pas. Reproduction dans une vraie fenêtre `NSHostingView` avec trois PDF synthétiques : le transfert personnalisé démarrait, mais l’ancien parcours ne livrait pas le dépôt. Les tests directs de `NSItemProvider` ne couvraient pas ce passage par macOS.

La réorganisation utilise maintenant le transfert `String` natif SwiftUI, comme le Scanner, et le dépôt de fichiers reste indépendant. Toute la ligne reçoit une forme de hit-test ; les UUID inconnus de la session en cours et les textes non reconnus sont ignorés. Aucun calcul PDF n’est effectué pendant le geste.

`MergeDragInteractionTests` est un contrôle **opt-in** qui exige une session graphique :

1. Dans un terminal ayant déjà l’accès Accessibilité, lancer `swift apps/mac/scripts/check-drag.swift merge`.
2. Pendant ses 90 secondes d’attente, lancer `xcodebuild -project apps/mac/PDFToolbox.xcodeproj -scheme PDFToolbox -destination 'platform=macOS' -only-testing:PDFToolboxTests/MergeDragInteractionTests test`.

Le pilote envoie deux vrais gestes souris, uniquement à la fenêtre de test identifiée par son PID, son numéro, son titre et ses bornes. Le premier part du nom et déplace A/B/C en B/C/A. Le second part de la vignette et rétablit A/B/C. Deux annulations doivent restaurer les états précédents. Ces gestes ne couvrent pas le dépôt physique depuis le Finder.

Les injections `NSApp.postEvent` seules peuvent démarrer un glisser sans déplacer le pointeur du serveur de fenêtres : elles ne constituent pas une preuve de dépôt, et ne sont pas conservées comme test de régression.


## Organiser les pages — Mac

`PDFOrganizingTests` (moteur), `OrganizingSessionTests`, `OrganizingSnapshots` et `MonkAssetTests` tournent avec les suites habituelles.

### Le vrai geste de glisser

`OrganizingDragInteractionTests` est un contrôle **opt-in** : il prend la souris environ deux secondes, trois fois, dans une fenêtre de test isolée.

1. Dans un terminal qui a l'accès Accessibilité, lancer `swift apps/mac/scripts/check-drag.swift organize`.
2. Pendant ses 90 secondes d'attente, lancer `xcodebuild -project apps/mac/PDFToolbox.xcodeproj -scheme PDFToolbox -destination 'platform=macOS' -only-testing:PDFToolboxTests/OrganizingDragInteractionTests test`.

Les trois gestes, sur un PDF de synthèse de trois pages :

| Geste | Ordre attendu |
|---|---|
| La page 1, prise par sa vignette, vers « Déposez ici pour déplacer à la fin » | 2, 3, 1 |
| La dernière carte vers la moitié gauche de la première | 1, 2, 3 |
| La page 1 vers la moitié droite de la page 2 | 2, 1, 3 |

Deux annulations sont vérifiées entre le deuxième et le troisième geste.

### À la main

1. Glisser une page au-dessus d'une autre : une barre bleue apparaît à gauche ou à droite de la carte survolée, selon la moitié survolée.
2. Lâcher : la page se pose à l'endroit de la barre, et les cartes glissent à leur nouvelle place.
3. Lâcher une page entre deux cartes : elle se pose à cet endroit, le dépôt n'est pas refusé.
4. Cliquer une flèche, puis ⌘Z : les cartes glissent dans les deux sens.
5. Avec un PDF de plus de 30 pages, glisser une page tout en faisant défiler la grille au trackpad : le dépôt marche plus bas dans la grille.

## Filigrane — Mac

1. Ouvrir un PDF de plusieurs pages : « CONFIDENTIEL » apparaît en rouge, en diagonale, au centre de la page.
2. Glisser le filigrane : il suit la souris. Tirer son coin : il grandit ou rétrécit sans se déformer, et le coin reste sous le pointeur, à 45° comme à 0°.
3. Changer l'opacité et l'angle : le filigrane change pendant le geste. ⌘Z annule le geste entier, pas chaque cran.
4. Choisir « Certaines pages », de la page 2 à la page 3 : la page 1 s'affiche sans filigrane.
5. Choisir « Image », puis un PNG avec transparence : le logo apparaît droit, sa transparence gardée. Un logo plus haut que large tient dans la page.
6. Enregistrer une copie, puis l'ouvrir dans Aperçu : le filigrane est sur les pages choisies, au même endroit, et aucun clic ne le sélectionne comme une annotation. La recherche trouve le texte du filigrane.
7. Ouvrir `fixtures-private/pdfs/pdfjs/hello_world_rotated.pdf` : le filigrane tombe à l'endroit choisi sur les pages pivotées, dans Aperçu aussi.
8. Ouvrir `fixtures-private/pdfs/fabriques/protege-mot-de-passe-1234.pdf` avec `1234` : la copie s'ouvre sans mot de passe, et l'écran l'annonçait.
9. Essayer d'enregistrer sur le fichier d'origine : l'appli refuse et le fichier ne change pas.

## Diviser et Extraire — Mac

`PagePickingSessionTests` et `PagePickingSnapshots` tournent avec la suite de l'appli. Mesure du 2 octobre 2026 : 100 pages de synthèse divisées en 100 fichiers en 0,18 s.

### Diviser, à la main

1. Ouvrir Diviser depuis l'accueil : Frère Ciseaux, puis choisir ou déposer un PDF de plusieurs pages.
2. Cliquer les ciseaux entre deux pages : le bouton devient bleu, les pages suivantes passent à « Fichier 2 », et le bouton du bas dit « Diviser en 2 PDF… ».
3. Recliquer les mêmes ciseaux : la coupe disparaît. ⌘Z la remet.
4. Régler « Pages par fichier » sur 2, puis « Appliquer » : une coupe toutes les deux pages. « Retirer les coupes » les enlève toutes.
5. Cliquer une page : elle s'agrandit, et on peut parcourir les autres.
6. Cliquer « Diviser en N PDF… », choisir un dossier : N fichiers `nom-1.pdf`, `nom-2.pdf`… y apparaissent, et « Afficher dans le Finder » les sélectionne.
7. Refaire la division dans le même dossier : les nouveaux fichiers s'appellent `nom-1-2.pdf`, `nom-2-2.pdf`…, et les premiers ne changent pas.
8. Sans coupe : le bouton du bas est grisé, et une ligne dit de poser une coupe.
9. Ouvrir un PDF d'une seule page : la ligne dit qu'il n'y a rien à diviser.
10. Régler « Pages par fichier » sur 5, puis ouvrir un autre PDF : le réglage revient à 1.

### Extraire, à la main

1. Ouvrir Extraire depuis l'accueil : Frère Loupe, puis choisir ou déposer un PDF.
2. Cliquer des pages : chacune prend un contour bleu et une coche, et « Sélection » compte les pages.
3. Cliquer l'œil d'une page : elle s'agrandit, sans changer la sélection.
4. « Tout sélectionner », puis « Tout désélectionner », puis ⌘Z deux fois : la sélection d'origine revient.
5. « Enregistrer la sélection… » : le panneau propose `nom-extrait.pdf`. Le PDF enregistré contient les pages cochées, dans l'ordre du document.
6. Essayer d'enregistrer sur le fichier d'origine : l'appli refuse et le fichier ne change pas.
7. Ouvrir un autre PDF avec une sélection non enregistrée : l'appli demande confirmation.

## Numéros de page — Mac

`PDFPageNumberingTests` et `PDFOpenedDocumentTests` tournent avec le paquet ; `PDFCopySessionTests`, `PageNumberSessionTests` et `PageNumberSnapshots` avec l'appli.

### À la main

1. Ouvrir Numéroter depuis l'accueil : Frère Folio, puis choisir ou déposer un PDF de plusieurs pages. Le numéro « 1 » apparaît en bas au centre de la première page.
2. Changer le format, la position et la taille : l'aperçu suit à chaque réglage.
3. Taper 237 dans « Premier numéro », puis Entrée : la première page porte 237, la suivante 238. Les flèches avancent d'un numéro.
4. Choisir « Certaines pages », de la page 2 à la dernière : la page 1 s'affiche sans numéro, et la page 2 porte le premier numéro.
5. Enregistrer une copie, puis l'ouvrir dans Aperçu : les numéros sont aux mêmes endroits, la recherche les trouve, et aucun clic ne les sélectionne comme une annotation.
6. Ouvrir `fixtures-private/pdfs/pdfjs/hello_world_rotated.pdf` : le numéro tombe en bas de la page telle qu'elle s'affiche.
7. Ouvrir un autre PDF plus court sans rien changer : les réglages sont gardés, et la plage tient dans le nouveau document.
8. Essayer d'enregistrer sur le fichier d'origine : l'appli refuse et le fichier ne change pas.

## Protéger et Déverrouiller — Mac

`PDFProtectionTests` tourne avec le paquet ; `ProtectionSessionTests` et `ProtectionSnapshots` avec l'appli.

### À la main

1. Ouvrir Protéger depuis l'accueil : Frère Cadenas, puis choisir ou déposer un PDF. Le bouton d'enregistrement est inactif.
2. Taper un mot de passe, puis un autre dans la confirmation : l'écran dit que les deux diffèrent. Taper le même : le bouton s'active.
3. Taper « sésame » deux fois : l'écran demande des lettres sans accent, et le bouton reste inactif.
4. Enregistrer une copie protégée, puis l'ouvrir dans Aperçu : Aperçu demande le mot de passe, refuse un mauvais et ouvre avec le bon. Dans l'appli, les deux champs sont vides.
5. Ouvrir Déverrouiller : Frère Passe-partout, puis déposer la copie protégée : l'appli demande son mot de passe.
6. Taper le mot de passe, enregistrer une copie déverrouillée, puis l'ouvrir dans Aperçu : rien n'est demandé, et l'inspecteur n'affiche plus de chiffrement.
7. Dans Déverrouiller, ouvrir un PDF sans mot de passe : l'écran dit qu'il n'y a rien à déverrouiller.
8. Dans Déverrouiller, ouvrir `fixtures-private/pdfs/pdfjs/empty_protected.pdf` : il s'ouvre sans mot de passe et interdit la copie du texte. Enregistrer une copie déverrouillée : dans Aperçu, le texte se copie.
9. Dans Protéger, ouvrir `fixtures-private/pdfs/fabriques/protege-mot-de-passe-1234.pdf` avec « 1234 », puis enregistrer avec un nouveau mot de passe : la copie refuse « 1234 » et s'ouvre avec le nouveau.
10. Essayer d'enregistrer sur le fichier d'origine : l'appli refuse et le fichier ne change pas.

## Compresser — Mac

`PDFCompressionTests` tourne avec le paquet ; `CompressSessionTests` et `CompressSnapshots` avec l'appli.

### À la main

1. Ouvrir Compresser depuis l'accueil : Frère Pressoir, puis déposer `fixtures-private/pdfs/reels/nasa-fiche-nanosatellites-2013.pdf`. Le bouton d'enregistrement est inactif.
2. Cliquer « Compresser le PDF » au niveau Recommandée : l'écran annonce environ 68 % de gain et les deux poids.
3. Enregistrer la copie, puis l'ouvrir dans Aperçu : le texte se sélectionne, les photos sont lisibles, le poids du fichier est celui annoncé.
4. Choisir Extrême : le gain disparaît et le bouton d'enregistrement redevient inactif. Compresser : le gain est plus grand.
5. Ouvrir `fixtures-private/pdfs/reels/irs-formulaire-w9.pdf` et compresser : l'écran dit que le PDF était déjà bien pressé, et rien ne peut être enregistré.
6. Ouvrir `fixtures-private/pdfs/reels/livre-cuisine-1886-scanne-17mo.pdf` et compresser : « Je presse… » reste affiché. Cliquer « Annuler » : l'écran redevient utilisable tout de suite.
7. Ouvrir un autre PDF : le niveau choisi est gardé, le gain précédent a disparu.
8. Pendant « Je presse… », appuyer sur Échap : le travail s'annule comme avec le bouton.

## OCR — Mac

`PDFTextLayerTests` tourne avec le paquet ; `OCRSessionTests` et `OCRSnapshots` avec l'appli.

### À la main

1. Ouvrir OCR depuis l'accueil : Frère Lecteur, puis déposer un PDF scanné sans texte (un scan de courrier, ou `fixtures-private/pdfs/reels/nasa-gemini-photos-scannees-1966.pdf`). Le bouton d'enregistrement est inactif.
2. Cliquer « Lire le texte » : la barre du bas donne la page en cours, puis l'écran annonce le nombre de pages et surligne les lignes lues.
3. Changer de page : le surlignage suit les lignes de chaque page.
4. Enregistrer la copie, puis l'ouvrir dans Aperçu : la recherche trouve un mot de la page, la sélection suit les lignes, et la page a le même aspect que l'original.
5. Ouvrir un PDF tapé (`fixtures-private/pdfs/reels/irs-formulaire-w9.pdf`) et lire : l'écran dit qu'il n'y a pas de texte à ajouter.
6. Sur un long scan, cliquer « Annuler » pendant la lecture : l'écran redevient utilisable en une page.
7. Après une lecture, déposer un autre PDF sans enregistrer : l'appli demande confirmation.
8. Dans Numéroter, enregistrer une copie numérotée d'un scan, puis l'ouvrir dans OCR : le scan est lu malgré ses numéros.

## Noircir — Mac

`PDFRedactionTests` tourne avec le paquet ; `RedactSessionTests` et `RedactSnapshots` avec l'appli.

### À la main

1. Ouvrir Noircir depuis l'accueil : Frère Encrier, puis déposer `fixtures-private/pdfs/reels/irs-formulaire-w9.pdf`. Le bouton d'enregistrement est inactif.
2. Faire glisser sur une ligne de la page 1 : une zone noire apparaît, le compteur passe à 1, le bouton s'active. Le pointeur est une croix sur la page.
3. Tracer une deuxième zone qui commence sur la première : elle se trace. Cliquer la croix d'une zone : elle disparaît.
4. Passer à la page 2, tracer une zone, revenir à la page 1 : chaque page garde ses zones.
5. Enregistrer la copie, puis l'ouvrir dans Aperçu : les zones sont noires ; sur les pages noircies, rien ne se sélectionne et la recherche d'un mot couvert ne trouve rien ; les autres pages se sélectionnent comme avant.
6. Copier tout le texte de la copie (⌘A, ⌘C) et le coller dans TextEdit : le texte couvert n'y est pas.
7. Ouvrir un autre PDF sans enregistrer de nouvelles zones : l'appli demande confirmation. Retirer toutes les zones puis ouvrir un autre PDF : rien n'est demandé.
8. Ouvrir `fixtures-private/pdfs/pdfjs/hello_world_rotated.pdf`, noircir une page pivotée, enregistrer : la page a le même sens et la même taille dans Aperçu.

## Images en PDF et PDF en images — Mac

`PDFImagePagesTests` et `PDFPageImagesTests` tournent avec le paquet ; `ImagesSessionTests`, `PageImagesSessionTests` et `ImagesSnapshots` avec l'appli.

### À la main

1. Ouvrir Images en PDF depuis l'accueil : Frère Cadre. Déposer plusieurs photos, dont une prise de côté au téléphone et une capture d'écran PNG : chaque image a sa ligne, avec sa vignette droite.
2. Glisser une ligne plus haut : les numéros suivent. Cliquer les flèches d'une ligne : elle monte ou descend d'un rang. Cliquer la croix d'une ligne : elle disparaît.
3. « Créer le PDF… », puis ouvrir le PDF dans Aperçu : une page A4 par image, dans l'ordre de la liste, en paysage pour les images larges, la photo de côté remise droite.
4. Déposer un fichier texte renommé en `.jpg` avec une vraie image : l'image entre, le message nomme le fichier refusé.
5. Ouvrir PDF en images : Frère Enlumineur, puis déposer un PDF de plusieurs pages. Choisir un dossier vide avec « Convertir en JPG… » : la barre du bas donne la page en cours, puis l'écran annonce le nombre d'images.
6. « Afficher dans le Finder » : les images `nom-1.jpg`, `nom-2.jpg`… sont sélectionnées. Recommencer dans le même dossier : les nouvelles images prennent un nom en `-2`, rien n'est remplacé.
7. Choisir Élevée et convertir : les images sont deux fois plus larges. Sur un long PDF, cliquer « Annuler » pendant la conversion : le dossier ne garde aucune image de cette conversion.
8. Ouvrir un PDF signé numériquement dans PDF en images : il s'ouvre et se convertit.
9. (3 octobre) Ouvrir `fixtures-private/pdfs/reels/nasa-fiche-nanosatellites-2013.pdf` : « Comptage des photos… » un instant, puis « Photos dans ce PDF : 4 ». Choisir « Extraire les images », convertir : quatre JPG à leur taille d'origine, sans le texte. Avec le formulaire W-9, le choix est grisé et l'écran dit que les pages deviennent les images.

## Aplatir — Mac

`PDFFlatteningTests` tourne avec le paquet ; `FlattenSessionTests` et `FlattenSnapshots` avec l'appli.

### À la main

1. Dans Aperçu, remplir deux champs de `fixtures-private/pdfs/reels/irs-formulaire-w9.pdf` et enregistrer une copie.
2. Ouvrir Aplatir depuis l'accueil : Frère Rouleau, puis déposer cette copie. L'écran annonce le nombre de champs et d'annotations.
3. Enregistrer la copie aplatie, puis l'ouvrir dans Aperçu : les valeurs sont visibles, se sélectionnent comme du texte, et aucun champ ne se modifie.
4. Ouvrir un PDF sans champ ni annotation : l'appli le refuse et dit qu'il n'y a rien à aplatir.
5. Aplatir un PDF annoté qui a un sommaire cliquable : dans la copie, les liens du sommaire mènent encore à leurs pages.

## Pages par feuille, Couper les pages en deux, Pixelliser — Mac

`PDFSheetsTests`, `PDFPageHalvesTests` et `PDFPixelizingTests` tournent avec le paquet ; `SheetsSessionTests`, `HalvesSessionTests`, `PixelizeSessionTests` et `SheetToolsSnapshots` avec l'appli.

### À la main

1. Ouvrir Pages par feuille depuis l'accueil : Frère Mosaïque. Déposer un PDF de plusieurs pages, choisir 2 : le schéma montre deux cases côte à côte, la feuille est à l'italienne.
2. Enregistrer, puis ouvrir la copie dans Aperçu : les pages se suivent de gauche à droite, et leur texte se sélectionne.
3. Ouvrir Couper les pages en deux : Frère Massicot. Déposer un PDF : un trait rouge en pointillés montre la coupe ; « Haut | bas » le fait tourner.
4. Enregistrer : la copie a deux fois plus de pages, gauche puis droite. Un lien du sommaire marche encore.
5. Ouvrir Pixelliser : Frère Vitrail. Enregistrer la copie d'un PDF de texte, puis l'ouvrir dans Aperçu : rien ne se sélectionne.
6. Avec `fixtures-private/pdfs/reels/irs-publication-17.pdf`, choisir « Élevée, 300 ppp » et enregistrer : l'écran dit « Page 12 sur 142… ». Cliquer « Annuler » : l'écran redevient utilisable tout de suite, et aucun fichier n'apparaît dans le dossier.
7. Ouvrir un PDF signé numériquement : Pages par feuille et Pixelliser l'acceptent, Couper les pages en deux le refuse et dit pourquoi.

## Ajouter des signets — Mac

`PDFBookmarksTests` tourne avec le paquet ; `BookmarksSessionTests` et `BookmarksSnapshots` avec l'appli.

### À la main

1. Ouvrir Ajouter des signets depuis l'accueil : Frère Signet. Déposer `fixtures-private/pdfs/reels/arxiv-attention-is-all-you-need.pdf` : 22 signets, sur trois niveaux.
2. Cliquer « p. 6 » sur un signet : la page 6 s'affiche.
3. Aller à la page 3, taper « Ma note », Entrée : le signet se range parmi ceux de la page 3, au niveau de ses voisins.
4. Changer un titre, retirer un signet, et par clic droit ranger un signet sous celui du dessus.
5. Enregistrer la copie, puis l'ouvrir dans Aperçu (Présentation > Table des matières) : la liste est celle de l'écran, et chaque signet mène à sa page.
6. Vider le titre d'un signet : « Enregistrer » se grise.
7. Avec des changements non enregistrés, déposer un autre PDF ou quitter : l'appli demande avant de les perdre.

## Superposer deux PDF — Mac

`PDFOverlayTests` tourne avec le paquet ; `OverlaySessionTests` et `OverlaySnapshots` avec l'appli.

### À la main

1. Ouvrir Superposer deux PDF depuis l'accueil : Frère Calque. Cliquer « Choisir un PDF… » : le panneau s'ouvre. Prendre une lettre de plusieurs pages.
2. « Choisir le PDF à poser dessus… » : prendre un papier à en-tête d'une page. Son nom s'affiche, l'aperçu le montre sur la page.
3. Passer d'une page à l'autre : l'en-tête est sur chacune.
4. Choisir « Sous les pages » : le texte de la lettre passe devant l'en-tête.
5. Enregistrer, puis ouvrir la copie dans Aperçu : même rendu que l'aperçu, et le texte des deux PDF se sélectionne.
6. Déposer une autre lettre : l'en-tête est encore choisi.
7. Choisir comme PDF à poser un PDF protégé : l'appli le refuse et dit de le déverrouiller d'abord.
8. Choisir comme PDF à poser un PDF dont une page est pivotée : la copie le montre comme l'aperçu.
9. Dans Ajouter un filigrane, choisir « Image » : le panneau d'ouverture apparaît, et l'image choisie se pose sur la page.

## PDF en Word — Mac

`DocxTests` et `PDFWordTests` tournent avec le paquet ; `WordSessionTests` et `WordSnapshots` avec l'appli.

### À la main

1. Ouvrir PDF en Word depuis l'accueil : Frère Copiste. Déposer `fixtures-private/pdfs/reels/nasa-fiche-nanosatellites-2013.pdf`.
2. « Convertir en Word… » : le panneau propose `nom-word.docx`. Enregistrer.
3. Ouvrir le document dans Word ou Pages : le titre, les paragraphes, la légende en italique et les photos à leur place.
4. Convertir `irs-publication-17.pdf` : l'écran dit « Page 12 sur 142… ». « Annuler » : aucun fichier n'apparaît.
5. Convertir un PDF signé numériquement : il s'ouvre et se convertit.
6. Sur l'accueil, « PDF en Word » est une carte, et seul « Page web en PDF » reste en « Bientôt ».

## Modifier un PDF — Mac

`EditItemTests`, `EditImageTests` et `PDFEditingTests` tournent avec le paquet ; `EditSessionTests`, `EditCanvasTests` et `EditSnapshots` avec l'appli.

### À la main

1. Ouvrir Modifier un PDF depuis l'accueil : Frère Scribe. Déposer un PDF de plusieurs pages.
2. Texte : cliquer sur la page, taper deux lignes avec Entrée, puis cliquer ailleurs. Le texte ne saute pas quand le champ disparaît.
3. Rectangle, Ellipse, Ligne, Flèche : tirer sur la page ; l'outil Sélection revient. Crayon et Surligneur restent actifs ; Échap revient à la Sélection.
4. Sélectionner un ajout : le déplacer à la souris puis aux flèches (Maj : dix points), le redimensionner par ses poignées, changer sa couleur, Devant, Derrière ; Suppr l'efface.
5. Glisser une photo d'iPhone depuis le Finder sur la page : elle arrive à l'endroit, là où on l'a lâchée. Copier une capture d'écran (⌃⇧⌘4), puis ⌘V : elle se pose au milieu. Glisser un PDF sur la page : il s'ouvre, après la question sur les changements.
6. Recadrer l'image, la pivoter, la retourner. ⌘Z et ⇧⌘Z défont et refont chaque pas.
7. Enregistrer, ouvrir la copie dans Aperçu : tout est à la place de l'aperçu ; le texte ajouté se sélectionne et se cherche ; les liens d'origine marchent.
8. Refaire 7 sur une page pivotée, puis sur un PDF protégé : la copie s'ouvre sans mot de passe. Un PDF signé est refusé, avec la raison.

## Petites dettes du 2 octobre — Mac

`CompressSessionTests`, `RedactSessionTests`, `OCRSessionTests`, `PDFCopySessionTests` et `TextReaderTests` les couvrent.

### À la main

1. Compresser un PDF de photos : la page affichée devient celle de la copie. « Original » la remet, « Copie compressée » y revient ; changer de niveau revient à l'original.
2. Dans Noircir, poser trois zones sur deux pages, en retirer une, puis ⌘Z quatre fois : chaque pas revient, jusqu'à la page nue. Le bouton « Annuler » fait de même.
3. Dans Lire le texte, lire un scan en japonais avec le réglage de départ : le texte trouvé est illisible. Choisir « japonais » dans « Langue du texte » (la première lecture reste à l'écran), relire, enregistrer : un mot japonais se trouve dans la copie.
4. Dans Ajouter un filigrane, « Certaines pages » : taper 12 dans « De la page », Entrée ; le filigrane quitte les pages d'avant. Taper un nombre plus grand que le nombre de pages : le réglage s'arrête à la dernière page, et l'appli ne plante pas sur un nombre négatif énorme.
5. (3 octobre) Dans Ajouter un filigrane, « En poser un autre » : un second filigrane apparaît au centre, sélectionné ; le glisser dans un coin, changer son texte : le premier garde le sien. Cliquer le premier : le panneau montre ses réglages. « Retirer de la page » sur l'un ; ⌘Z le ramène. Enregistrer : la copie porte les deux.

## Bureau

`pnpm desktop:smoke` (ou `pnpm --filter @holy-pdf/desktop smoke`) compile deux binaires de la coque Tauri et les lance avec `--smoke` (voir la [spec](../specs/2026-10-05-desktop-tauri-design.md)) :

- `smoke:engine` charge la page de test du moteur (`apps/desktop/smoke/`) : le processus sort avec 0 si PDFium, qpdf et les workers tournent dans la webview, servis par `tauri://`.
- `smoke:app` construit l'entrée bureau (`apps/desktop/app/`), l'embarque, puis la sonde injectée par la coque rapporte trois fois (le monastère, Compresser ouvert par sa carte, le retour par le chevron) sous la CSP de l'appli, en relevant les violations de CSP, les erreurs de script et de chargement ; 0 si les trois rapports sont propres, 1 sinon, 2 si la chaîne n'a pas fini en 120 s, 3 si la fenêtre est fermée ou l'appli quittée avant le verdict.

Rust via rustup est nécessaire ; rien ne tourne en CI. Le serveur de développement du site n'a pas à tourner. `pnpm --filter @holy-pdf/desktop check` vérifie les types de l'entrée et de la page moteur contre les sources du site.

À la main, dans l'appli (`pnpm desktop:dev`) :

1. ⌘O ouvre le dialogue natif, filtré sur les PDF depuis un outil PDF ; les fichiers choisis arrivent dans la planche. Depuis le monastère, « 3 fichiers prêts » s'affiche et les cartes qui ne les acceptent pas sont grisées.
2. Un PDF lâché sur le monastère ou sur un outil s'ouvre ; le voile « Lâchez, je m'en occupe. » s'affiche pendant le survol.
3. Compresser un PDF, « Voir » : l'aperçu s'ouvre dans la page, sans dialogue ; changer le niveau, relancer, « Voir » montre la nouvelle copie. Sur Diviser, l'aperçu enchaîne les fichiers produits ; sur PDF en JPG, les images. « Enregistrer… » : le dialogue natif propose le nom de la copie dans le dernier dossier ; « Enregistré » et le nom s'affichent, « Ouvrir » lance le lecteur du système, « Afficher dans le Finder » sélectionne le fichier.
4. Scanner : deux photos, « Tout enregistrer… » avec une page à vérifier pose la question « Enregistrer quand même ? » ; Supprimer un document pose la sienne.
5. Passer le système en sombre : l'appli suit sans redémarrer.
6. Déplacer et redimensionner la fenêtre, quitter, relancer : elle revient au même endroit.
7. Aide › Site part dans le navigateur, l'appli reste sur son écran.
8. ⌘Q quitte ; ⌘W ferme la fenêtre et quitte (la garde vient au lot 2).
9. ⌘Z dans le champ de recherche annule la frappe ; ⌘Z sur la planche annule la retouche ; jamais les deux. ⌘F et ⌘K activent la recherche, ⌘[ ramène au monastère, Entrée ouvre le meilleur moine.
