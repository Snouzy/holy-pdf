# Tests

_Le site et l'appli de bureau. Les tests du moteur Swift et de l'appli Mac sont au tag `mac-final`, avec elle._

## Commandes

Depuis la racine du dépôt :

| But | Commande |
|---|---|
| Site, avant toute fusion | `pnpm verify` : types, unitaires, build, SEO, bout en bout Chromium |
| Site, mise en page, polices, budgets ou moteur touchés | `pnpm verify:full` : ajoute Firefox, WebKit et Lighthouse |
| Bureau | `pnpm desktop:smoke` (Rust via rustup) et `pnpm --filter @holy-pdf/desktop check` |

## Le lot privé

`fixtures-private/`, à la racine du dépôt, est **ignoré par git** : des photos réelles et des PDF téléchargés y restent, rien n'en sort.

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
10. La barre latérale liste les outils par thématique, l'outil ouvert en surbrillance ; un clic change d'outil, « Monastère » revient à l'accueil. Réduire la fenêtre sous 1 280 px la cache et fait revenir le chevron.
