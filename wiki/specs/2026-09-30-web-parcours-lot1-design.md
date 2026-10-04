# Version Web : parcours d'un outil, Compresser et PDF en JPG — design

_Rédigé le 30 septembre 2026. Statut : livré dans `apps/web/`. Les maquettes validées (page « Nouveaux outils — lot 1 », seconde version, et planche « 4 · Le parcours d'un outil » de la page « Design system ») ne sont pas publiées._

## Contexte

**Complément validé le 1er octobre 2026 :** après le [benchmark comparatif](../development/compression-benchmark-2026-10-01.md), Compresser ajoute qpdf 12.4.2 après le remplacement des photos dans le document conservé. PDFium ne réécrit pas les Object Streams ; les API du navigateur ne fournissent pas d'optimiseur PDF structurel. Cette dépendance remplace l'écriture d'un compacteur maison. Distribution épinglée `@wasm-zoo/qpdf@0.1.1`, adaptation de packaging ESM minimale et reproductible, licence Apache-2.0 et notices tierces conservées. Le module n'est chargé qu'à la compression, dans un Worker temporaire libéré après traitement. Réglage : `--object-streams=generate --compress-streams=y`, sans JPEG supplémentaire ni recompression Flate forcée. Le gain minimal de 1 % reste appliqué au résultat final ; un profil interdisant les Object Streams ne doit pas être transformé en PDF 1.5 par cette étape.

Le site a 7 outils, tous de la catégorie Organiser, sauf JPG en PDF. Ils partagent la planche : une grille de pages et une barre d'action avec **Voir** et **Télécharger** (voir la [spec du design system](2026-09-30-web-design-system-design.md)).

Le 30 septembre, le premier lot d'outils à venir a été choisi : **Compresser** et **PDF en images**. Une première maquette gardait la planche et mettait les options dans un panneau à droite. Elle a été jugée moins claire que le parcours d'iLovePDF. La seconde, retenue, suit trois temps : on règle, on lance, on récupère. Ce parcours entre dans le design system, pour tous les outils.

Consigne d'interface : chaque écran se comprend en moins de 5 secondes, par un public peu à l'aise avec le numérique. Donc pas de surcharge, une aide à côté de chaque choix difficile, un seul endroit où regarder d'abord, une réponse visible à chaque action, et le téléphone d'abord.

## Objectif et critères de réussite

Un visiteur dépose un PDF, voit un seul bouton qui dit ce qu'il va faire, le touche, voit le travail avancer, puis arrive sur une page qui lui dit ce qu'il a gagné et lui donne son fichier.

La spec est réussie quand :

- les 9 outils (les 7 actuels, Compresser, PDF en JPG) suivent les trois temps ;
- Compresser réduit un PDF qui contient des photos, sans toucher au texte : le texte reste sélectionnable ;
- PDF en JPG rend une image par page, ou les photos du PDF ;
- plusieurs fichiers produits arrivent dans un `.zip` sur ordinateur, et dans la feuille de partage sur téléphone ;
- les budgets de performance actuels tiennent ;
- les tests de la section Tests passent sur Chromium, Firefox et WebKit.

## Portée

**Dans la spec :**

- le parcours en trois temps et ses composants : panneau de réglage, cartes de choix, tuiles, bascule, aide « ? », bouton verbe avec progression, page de résultat ;
- le passage des 7 outils actuels à ce parcours ;
- l'outil Compresser (3 niveaux) ;
- l'outil PDF en JPG (2 modes, 2 qualités) ;
- la progression envoyée par le moteur ;
- le partage de plusieurs fichiers sur téléphone ;
- les pages, les textes et les moines des 2 outils.

**Hors spec :** PNG et WebP en sortie (JPG seul, choix de l'auteur), un niveau de compression réglable au pourcentage, la compression des polices, la linéarisation, les autres outils à venir (lot 2 : écrire sur les pages ; lot 3 : mots de passe ; lot 4 : OCR et scanner).

## Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Parcours | Trois temps pour tous les outils : régler, lancer, récupérer | Choix de l'auteur, d'après iLovePDF. Un seul bouton par écran, et il dit ce qu'il fait |
| Écarté | Garder la barre d'action Voir et Télécharger | Rien ne dit ce qui va se passer. Pour Compresser, le résultat ne se voit pas dans la grille |
| Page de résultat | Elle remplace la planche, dans le même îlot. Le fichier produit reste en mémoire jusqu'à « recommencer » ou une nouvelle retouche | Voir et Télécharger ne refont pas le travail. Voir n'a plus besoin d'ouvrir l'onglet avant la fin du travail |
| Haut de page | Dès qu'un fichier est choisi, la phrase et le portrait du moine disparaissent. Le titre 1 reste, plus petit | La place va au travail. Le HTML statique ne change pas : le SEO non plus |
| Compression | PDFium réencode les images en JPEG et réduit leur résolution. Le texte, les dessins et les polices ne changent pas | Promesse de l'écran : « Le texte reste sélectionnable ». qpdf différé recompacte ensuite les structures (complément du 1er octobre) |
| Écarté | Pixelliser les pages | Le texte ne serait plus sélectionnable |
| Écarté | Ghostscript en WebAssembly | Licence AGPL, plus de 10 Mo |
| Encodage JPEG | `OffscreenCanvas.convertToBlob` dans le Worker, déjà utilisé pour les vignettes | Natif, aucune dépendance |
| Plusieurs fichiers produits | Sur téléphone, `navigator.share` avec les fichiers (on les range dans Photos ou Fichiers). Ailleurs, un `.zip`, avec `fflate`, déjà présent | Un `.zip` est difficile à ouvrir sur téléphone. Les navigateurs bloquent plusieurs téléchargements à la suite |
| Identifiants | `compress` et `pdf-to-jpg`. L'identifiant à venir `pdf-to-images` disparaît | L'outil ne fait que du JPG |
| Tests du moteur | `jpeg-js`, en dépendance de développement seulement, encode les JPEG dans Vitest | Node n'a pas d'`OffscreenCanvas`. Le site n'embarque pas `jpeg-js` |

## Le parcours d'un outil

### 1. Régler

**Ordinateur.** Deux colonnes sous le titre :

- **À gauche, les fichiers.**
  - Outils page par page : les onglets de fichiers, le bouton Annuler et la grille de pages, comme aujourd'hui.
  - Compresser et PDF en JPG : une zone grise en pointillés avec une carte par fichier : première page, nom, poids et nombre de pages, et un × qui retire le fichier. La pastille « + Ajouter un PDF » est en haut à droite de la zone, la phrase « Vous pouvez aussi glisser d'autres PDF dans cette zone. » en bas.
- **À droite, le panneau**, 460 px, sur la surface, de haut en bas :
  1. le moine de l'outil (84 px, sur la teinte de sa catégorie) et sa bulle, avec son nom et une phrase qui dit quoi faire ;
  2. les options de l'outil, s'il en a ;
  3. en bas, le **bouton verbe**, sur toute la largeur, 60 px de haut, avec une flèche ;
  4. sous le bouton, le cadenas et « Vos fichiers restent sur cet appareil. ».

**Panneau persistant (décision du 1er octobre 2026).** Sur ordinateur, le panneau reste visible à droite pendant le défilement de la planche, des explications, de la FAQ et des autres outils. Toute cette partie de la page réserve sa colonne : le contenu reste à gauche et ne passe jamais dessous. Le pied de page reste hors de cette grille. Sur un écran bas, les réglages défilent dans leur propre zone ; le bouton et la ligne de confidentialité disposent d'une place réservée qui ne masque pas les choix.

**Téléphone.** Une colonne : le titre, le moine et sa bulle, les fichiers (une ligne par fichier, ou la grille), puis les options. Le bouton verbe est collé en bas de l'écran, 56 px de haut, avec la ligne du cadenas.

**Composants des options :**

- **Carte de choix** : un vrai bouton radio dans un `fieldset` avec sa `legend`. Le nom en gras, une phrase grise en mots simples, un rond à droite, et parfois un petit dessin à gauche. Une carte choisie a un contour principal de 2 px, un fond bleu pâle et une coche. Le choix conseillé porte « Conseillé » sur le surligneur jaune, et il est coché d'office.
- **Tuile** : une carte de choix en colonne, avec un dessin de 72 × 46 px, pour deux choix qui changent la nature du résultat.
- **Bascule** : deux choix côte à côte, pour un réglage secondaire. Le choix conseillé le dit sous son nom.
- **Aide « ? »** : un bouton à côté d'un nom, avec `aria-expanded`, ouvre une bulle sous lui. Elle se ferme avec Échap ou à la sortie du bouton. Il ne sert que quand la phrase grise ne suffit pas.
- **Phrases d'aide** : une coche verte pour une garantie, un « ? » gris pour une précision.

**Bouton verbe.** Un verbe à l'infinitif et un objet (voir le tableau des textes). Il est désactivé (opacité 45 %) tant qu'aucun fichier n'est prêt, ou tant que l'outil n'a rien à produire (aucune page choisie, aucune coupe). Le moine dit alors pourquoi.

### 2. Lancer

Le bouton verbe devient la barre de progression, au même endroit (`role="progressbar"`, `aria-valuenow`). Il se remplit de gauche à droite et montre le pourcentage. Il ne se clique plus. Le moine passe en humeur `focus` et dit son verbe en cours (« Je presse… »). Sur téléphone aussi, la progression apparaît dans ce seul bouton. Rien d'autre ne bouge. Une région `aria-live` annonce le début et la fin.

Le moteur envoie la progression en étapes faites sur étapes à faire : pages pour les images, pages puis une étape de compactage par fichier pour Compresser, un pas par fichier produit pour les outils page par page.

### 3. Récupérer

La page de résultat remplace la planche. Le focus passe à son titre.

- En haut à gauche, un bouton qui revient au temps 1 avec tout intact (fichiers, pages, choix) : « Changer les réglages » ou « Revenir aux pages ».
- Une carte blanche. À gauche, le moine en humeur `joy`, 200 px, dans son rond, avec la bulle « Alléluia, c'est fait 🙌 ». À droite :
  - un titre 2 qui dit ce qui a changé, avec le surligneur sur le chiffre ;
  - une preuve : les barres avant et après pour Compresser, les vignettes des images pour PDF en JPG, et « nom-du-fichier.pdf · 12 pages · 2,4 Mo » pour les autres outils ;
  - le bouton principal **Télécharger**, puis **Voir** quand le résultat est un seul PDF ;
  - le nom du fichier produit, en gris.
- Sous la carte, un lien qui vide la planche et rouvre la zone de dépôt : « Compresser un autre PDF », etc.

**Plusieurs fichiers produits** (Diviser, PDF en JPG, et Compresser avec plusieurs PDF) :

- Si l'appareil a un écran tactile (`pointer: coarse`) et que `navigator.canShare({ files })` accepte les fichiers, le bouton dit « Enregistrer les 3 images » (ou « les 3 PDF ») et ouvre la feuille de partage. Dessous : « Dans Photos, ou dans Fichiers. ». Une feuille de partage fermée sans choix ne fait rien.
- Sinon, le bouton dit « Télécharger les 3 images » et télécharge un `.zip`. Dessous : « Elles arrivent dans un dossier .zip : ouvrez-le pour voir les images. ».
- Un seul fichier produit se télécharge tel quel, sans `.zip`.

**Retour.** Toute retouche après le résultat (un fichier ajouté, une page déplacée) oublie le fichier produit. « Changer les réglages » garde l'état et remet le focus sur le bouton verbe.

### Les 7 outils actuels

| Outil | Options du panneau | Phrase du moine (prêt) |
|---|---|---|
| Fusionner | aucune | Glissez les pages dans l'ordre voulu. |
| Diviser | « Couper toutes les [N] pages » et Appliquer | Touchez les ciseaux entre deux pages pour couper. |
| Organiser | aucune | Glissez les pages pour changer l'ordre. |
| Supprimer des pages | aucune | Touchez la corbeille des pages à retirer. |
| Extraire des pages | le nombre de pages choisies | Touchez les pages à garder. |
| Pivoter | le bouton secondaire « Tout pivoter » | Touchez la flèche d'une page pour la pivoter. |
| JPG en PDF | aucune | Glissez les images dans l'ordre voulu. |

La bulle garde ses autres états : « Je lis contrat.pdf… » à l'ouverture, le message d'erreur en humeur `oops`. La question actuelle (« J'agrafe tout ça ? ») disparaît : le bouton verbe la remplace.

## Compresser

Frère Pressoir, catégorie Optimiser, accessoire `book`, émoji 🗜️. Un ou plusieurs PDF.

### Niveaux

| Niveau | Phrase grise | Résolution maximale | Qualité JPEG |
|---|---|---|---|
| Extrême | Compression forte. Les images perdent du détail. | 96 ppp | 0,5 |
| Recommandée (conseillée, cochée d'office) | Un équilibre entre taille et qualité d'image. | 150 ppp | 0,6 |
| Basse | Qualité mieux préservée. Compression plus douce. | 200 ppp | 0,8 |

Réglées le 1er octobre 2026 sur 11 PDF réels (vérification préalable 1) : voir [Mesures de la compression](../development/web-version.md#mesures-de-la-compression).

Les trois niveaux utilisent une compression d'image avec perte. Aucun ne garantit une qualité intacte ; le texte raster d'un scan peut perdre en netteté. Les FAQ française et anglaise distinguent ce cas du texte déjà sélectionnable, qui reste sélectionnable.

Sous les cartes : « ✓ Le texte reste sélectionnable, à tous les niveaux. ». Un petit dessin de trois barres dit l'intensité de chaque niveau.

### Ce que fait le moteur

Pour chaque page, et dans chaque XObject de formulaire de la page, pour chaque image :

1. Laisser l'image telle quelle si elle a 1 bit par pixel (fax, JBIG2), ou si elle fait moins de 64 px de côté.
2. Calculer sa résolution affichée à partir de son plus grand placement, sur toutes les pages et dans les formulaires XObject.
3. Lire ses pixels (`FPDFImageObj_GetBitmap`), les réduire à la résolution maximale du niveau si elle est dépassée, puis les encoder en JPEG à la qualité du niveau.
4. Enregistrer le document source, puis remplacer directement le flux de l'image seulement si le JPEG est plus petit. Conserver le masque doux et les clés de dictionnaire prises en charge ; laisser les cas ambigus ou non pris en charge tels quels.
5. Recompacter avec qpdf dans un Worker temporaire, puis libérer ce Worker. La progression n'atteint 100 % qu'après cette étape. Les profils d'archivage/impression déclarés ou les métadonnées indéterminées désactivent la génération d'Object Streams ; ce garde-fou n'est pas une certification PDF/A/PDF/X.

Une image dessinée sur plusieurs pages n'est réencodée qu'une fois et reste partagée. **Ne jamais reconstruire le document par copie de pages pour compresser** : cette copie supprime signets, destinations, formulaires, balises d'accessibilité, pièces jointes et métadonnées. L'enregistrement du document source et la réécriture des seuls flux image doivent préserver ces structures, vérifiées avec pdf.js. Les fichiers protégés ouverts avec leur mot de passe sont exportés déchiffrés, comme les autres outils.

L'outil garde l'original si le candidat final ne gagne pas au moins 1 %, sauf pour un PDF protégé non signé, dont l'export reste déchiffré.

Un document contenant une signature numérique est rendu exactement tel quel : toute réécriture invaliderait cette signature. Cette règle vaut aussi pour un document protégé par mot de passe : il reste protégé à l'export. qpdf n'est pas chargé pour ce document. Le compacteur accepte au maximum 128 Mio d'entrée intermédiaire et est arrêté après 120 secondes ; une limite atteinte utilise l'erreur de ressources existante.

### Résultat

- Titre : « Votre PDF est <surligné>75 % plus léger</surligné> » ; avec plusieurs PDF : « Vos PDF sont 62 % plus légers » ; sans gain : « Ce PDF était déjà bien pressé ».
- Preuve : deux barres, « Avant 12,4 Mo » en gris et « Après 3,1 Mo » en vert, à l'échelle.
- Nom : `rapport-annuel-compresse.pdf`. Plusieurs PDF : `rapport-annuel-compresse.zip`, chaque PDF gardant son nom suivi de `-compresse`.
- Voir : seulement avec un seul PDF.

## PDF en JPG

Frère Enlumineur, catégorie Convertir, accessoire `frame`, émoji 🖼️. Un ou plusieurs PDF.

### Options

**« Que voulez-vous ? »**, deux tuiles :

| Tuile | Phrase grise | Ce que fait le moteur |
|---|---|---|
| Pages en JPG (cochée d'office) | Chaque page devient une image. | Rend chaque page (`renderPage`, annotations comprises) sur fond blanc |
| Extraire les images | Seulement les photos du PDF. Aide « ? » : « Le texte est laissé de côté : vous récupérez seulement les photos, telles qu'elles sont dans le PDF. » | Rend chaque ressource image sur une page temporaire à ses dimensions natives, sans détourage de page et avec ses masques sur blanc. Les images de moins de 64 px de côté et les doublons de pixels rendus (empreinte SHA-256) sont ignorés |

Sous les tuiles : « + 3 pages, donc 3 images JPG. » (le nombre suit les fichiers ; en mode extraction, cette ligne disparaît : le nombre n'est connu qu'après le travail).

**« Qualité de l'image »**, une bascule :

| Choix | Pages en JPG | Extraire les images |
|---|---|---|
| Normale (conseillée) | 150 ppp, qualité 0,85 | qualité 0,85 |
| Élevée | 300 ppp, qualité 0,92 | qualité 0,92 |

Dessous : « ? Élevée : images plus nettes, mais plus lourdes. ». Aucune image ne dépasse 16 millions de pixels : au-delà, la résolution baisse pour une page convertie en JPG. L'extraction native et l'encodeur refusent explicitement une image au-delà de 16 millions de pixels ou 16 384 pixels par côté, sans changer silencieusement ses dimensions.

### Résultat

- Titre : « Vos <surligné>3 images</surligné> sont prêtes », ou « Votre image est prête ».
- Preuve : les 6 premières images réellement produites, dans les deux modes, puis le nombre d'images restantes.
- Noms : `cours-anglais-1.jpg`, `cours-anglais-2.jpg`… en mode pages ; `cours-anglais-image-1.jpg`… en extraction. Le `.zip` : `cours-anglais-images.zip`.
- Aucune image trouvée en extraction : pas de page de résultat. Le moine, en humeur `oops`, dit « Ce PDF ne contient pas de photo. Essayez « Pages en JPG ». ».

## Le moteur

- **Requêtes nouvelles** dans `protocol.ts` : `compress` (fichiers, niveau, noms) et `images` (fichiers, mode, qualité, noms).
- **Livraison** : les requêtes `export`, `compress` et `images` rendent toujours les fichiers. La planche demande un `.zip` séparément, au téléchargement de plusieurs fichiers ou si le partage échoue. Un seul fichier produit est rendu seul.
- **Réponses** : une sortie commune `{ type: "files", files: { name, bytes }[] }` ; la requête `zip` rend `{ type: "zip", bytes }`. Le poids « après » de Compresser est la somme des poids des PDF livrés, avant la mise en `.zip`.
- **Progression** : le Worker envoie `{ id, progress: { done, total } }` avant la réponse finale. `client.ts` la passe à un rappel `onProgress`. Les messages de progression ne comptent pas comme une réponse.
- **Encodage JPEG** : les fonctions du moteur reçoivent `encodeJpeg(pixels, largeur, hauteur, qualité)`. Le Worker lui passe `OffscreenCanvas` ; Vitest, `jpeg-js`.
- **Mémoire** : une page ou une image à la fois. Chaque bitmap PDFium est détruit dès que son JPEG est fait. Les JPEG produits partent au fil de l'eau dans la liste de sortie.

## Structure

```
apps/web/src/
  board/
    Board.tsx          le temps courant (régler, lancer, récupérer), la livraison
    flow.ts            réducteur pur des trois temps, testé seul
    Panel.tsx          remplace ActionBar : moine, options de l'outil, bouton verbe et sa progression
    Result.tsx         page de résultat : titre, preuve, Télécharger ou Enregistrer, Voir
    FileCards.tsx      cartes de fichiers (ordinateur) et lignes (téléphone), outils sans grille
    deliver.ts         partage ou téléchargement, choix de la livraison
    Options.tsx        cartes de choix, tuiles, bascule, aide « ? », et les options de chaque outil
  engine/
    compress.ts        réencodage des images, enregistrement du document source
    images.ts          pages en JPEG, extraction des images
    output.ts          sortie commune, fichiers ou zip (`zipParts` quitte `build.ts`)
  illustrations/Scene.tsx   scènes « compress » (pile épaisse vers feuille mince) et « pdf-to-jpg » (feuille vers photos)
  content/tools/{fr,en}/compress.md, pdf-to-jpg.md
```

`tools.ts` gagne un champ `workspace: "pages" | "files"` : la grille de pages, ou les cartes de fichiers. `output` gagne `compressed` et `images`. `cast.ts` passe `compress` et `pdf-to-jpg` des outils à venir aux outils prêts : l'accueil montre 9 cartes et « Et 10 moines en méditation ».

## Pages et SEO

| Outil | Adresse FR | Adresse EN | Titre 1 FR | Titre 1 EN |
|---|---|---|---|---|
| Compresser | `/fr/compresser-pdf` | `/en/compress-pdf` | Compresser un PDF | Compress a PDF |
| PDF en JPG | `/fr/pdf-en-jpg` | `/en/pdf-to-jpg` | PDF en JPG | PDF to JPG |

Les `title`, `description`, étapes et FAQ ont été écrits après une vérification des volumes de recherche avec un outil de recherche de mots-clés. Ils restent « à relire » dans [Identité de marque](../product/brand.md). Les étapes des 7 outils actuels changent aussi : « Cliquez sur « Fusionner les PDF » », puis « Téléchargez le PDF ».

## Textes

| Outil | Moine FR / EN | Bouton verbe | Titre du résultat | Recommencer |
|---|---|---|---|---|
| Fusionner | Frère Agrafe | Fusionner les PDF | Vos PDF sont réunis | Fusionner d'autres PDF |
| Diviser | Frère Ciseaux | Diviser le PDF | Votre PDF est coupé en 3 | Diviser un autre PDF |
| Organiser | Frère Classeur | Ranger les pages | Vos pages sont rangées | Organiser un autre PDF |
| Supprimer des pages | Frère Gomme | Supprimer les pages | 2 pages en moins | Modifier un autre PDF |
| Extraire des pages | Frère Loupe | Extraire les pages | 3 pages extraites | Extraire d'un autre PDF |
| Pivoter | Frère Toupie | Pivoter le PDF | Vos pages sont d'aplomb | Pivoter un autre PDF |
| JPG en PDF | Frère Cadre | Créer le PDF | Votre PDF est prêt | Convertir d'autres images |
| Compresser | Frère Pressoir / Brother Press | Compresser le PDF | Votre PDF est 75 % plus léger | Compresser un autre PDF |
| PDF en JPG | Frère Enlumineur / Brother Illuminator | Convertir en JPG | Vos 3 images sont prêtes | Convertir un autre PDF |

Frère Pressoir : « Frère Pressoir presse vos PDF sans toucher au texte : les photos maigrissent, les mots restent. » Bulle : « Choisissez la pression. Je m'occupe du reste. » En cours : « Je presse… »

Frère Enlumineur : « Frère Enlumineur change vos pages en images JPG. » Bulle : « Toutes les pages, ou seulement les images ? » En cours : « J'enlumine… »

Dans `i18n`, `MonkTexts.question` devient `hint` (la phrase du tableau des 7 outils), et gagne `verb`, `result` (une fonction du chiffre) et `again`. Le bouton de retour a deux textes communs : « Changer les réglages » (Compresser, PDF en JPG) et « Revenir aux pages » (outils page par page). Les deux dictionnaires gardent le même type. Tous ces textes sont « à relire ».

## Gestion des erreurs

| Cas | Ce que voit le visiteur |
|---|---|
| PDF protégé par un mot de passe | Comme aujourd'hui : le champ du mot de passe sur l'onglet ou la carte du fichier |
| Fichier illisible | La carte en erreur, le message en rouge tampon, le × pour le retirer. Les autres fichiers restent utilisables |
| Plus de mémoire pendant le travail | Retour au temps 1, le moine en `oops` : « Ce fichier est trop gros pour cet appareil. » |
| Compresser sans gain | La page de résultat, « Ce PDF était déjà bien pressé », et l'original en téléchargement |
| Extraction sans photo | Temps 1, le moine en `oops` (voir PDF en JPG) |
| Partage refusé ou fermé | Rien. Le bouton reste là |
| Partage impossible alors qu'il était prévu | Le `.zip` se télécharge |

## Accessibilité

- Les choix sont de vrais boutons radio dans un `fieldset` : les flèches du clavier passent de l'un à l'autre.
- L'aide « ? » a un libellé (« Extraire les images : aide »), expose son état avec `aria-expanded` et sa bulle se ferme avec Échap.
- La barre de progression a `role="progressbar"`. Le début et la fin sont annoncés.
- La page de résultat prend le focus sur son titre. « Changer les réglages » le rend au bouton verbe.
- Sur téléphone, tout ce qui se touche fait au moins 44 px, et le bouton verbe au moins 56 px.
- `prefers-reduced-motion` : la barre saute de pas en pas, sans animation.

## Performance

Les budgets de la spec du design system ne changent pas : JavaScript d'une page outil ≤ 50 Ko (gzip), LCP ≤ 1,6 s. Les composants du parcours se chargent avec la planche. Le code de compression et d'images vit dans le Worker, chargé après la page.

Repères, mesurés dans la vérification préalable 1, sur un ordinateur portable récent :

| Opération | Repère |
|---|---|
| Compresser un PDF de 20 pages avec photos (15 Mo), niveau Recommandée | < 10 s |
| PDF en JPG, 20 pages A4, qualité Normale | < 8 s |
| Pic de mémoire du Worker | < 400 Mo |

## Tests

**Unitaires (Vitest) :**

- `flow` : régler, lancer, progression, résultat, retour avec l'état intact, retouche qui oublie le résultat, échec qui revient au temps 1.
- `deliver` : un fichier, un téléchargement ; plusieurs fichiers, le partage si l'écran est tactile et que `canShare` accepte, sinon le `.zip`.
- Noms des fichiers produits pour Compresser et PDF en JPG.
- Textes : chaque outil a `hint`, `verb`, `result` et `again` dans les deux langues.

**Moteur (Vitest, PDFium en WebAssembly, `jpeg-js`) :**

- Compresser : un PDF avec une grande photo devient plus petit ; texte, signets, liens, titre/XMP, formulaire, balises et pièce jointe restent lisibles (pdf.js) ; les masques des images transparentes sont conservés ; images de 1 bit et petites images restent intactes ; images partagées et images de formulaires restent partagées après compression ; un PDF sans gain rend l'original.
- PDF en JPG : autant de JPEG que de pages, aux bonnes dimensions pour 150 et 300 ppp ; l'extraction rend une image par photo, sans doublon ni petite image ; un PDF sans photo rend une liste vide.
- Progression : `done` va de 1 à `total`, dans l'ordre.

**Bout en bout (Playwright, Chromium, Firefox, WebKit) :**

- Compresser : déposer un PDF avec photos, garder Recommandée, lancer, voir la progression puis « % plus léger », télécharger un PDF plus petit ; « Changer les réglages » revient avec le fichier.
- PDF en JPG : 3 pages donnent 3 images dans un `.zip` ; l'aide « ? » s'ouvre et se ferme au clavier ; l'extraction d'un PDF sans photo laisse le moine le dire.
- Téléphone (390 px, écran tactile émulé, `navigator.share` simulé) : le bouton dit « Enregistrer les 3 images » et partage 3 fichiers ; aucun défilement horizontal ; le bouton verbe reste visible en bas.
- Les 7 outils actuels : le bouton verbe, puis la page de résultat, puis Télécharger et Voir. Les tests existants de la planche sont adaptés au nouveau parcours.
- Le haut de page se replie dès qu'un fichier est choisi, et le titre 1 reste.

## Vérifications préalables

À faire au début du plan, avant les composants :

1. **Gain de la compression.** Sur 10 PDF réels (rapports avec photos, scans, présentations, un PDF texte seul), mesurer le gain de chaque niveau et le temps. Le lot privé reste hors du dépôt. Si le niveau Recommandée gagne moins de 30 % sur les PDF avec photos, s'arrêter et en parler avec l'auteur. Résultat : voir [Version Web](../development/web-version.md#mesures-de-la-compression).
2. **Images et structure.** Vérifier que la réécriture du flux remplace les anciennes données, qu'une image partagée reste écrite une fois, et que signets, liens, titre, formulaires, balises et pièces jointes sont conservés. Mesurer séparément le poids de l'enregistrement seul : PDFium peut décompacter les flux d'objets.
3. **Partage.** Vérifier `navigator.canShare({ files })` avec 3 JPEG sur Safari iOS et Chrome Android, et le choix « Enregistrer dans Photos ».
4. **Poids de l'accueil.** Mesurer le HTML compressé de l'accueil avec 9 cartes contre le budget de 25 Ko.

## Ordre de réalisation

1. Les vérifications préalables 1 et 2 : elles peuvent arrêter Compresser.
2. Le parcours en trois temps, la progression et la livraison, appliqués aux 7 outils actuels.
3. PDF en JPG.
4. Compresser.

Chaque étape laisse le site utilisable et ses tests verts.

## Écarts pendant la réalisation

Le plan et l'exécution ont changé la spec sur neuf points :

1. Le moteur rend toujours les fichiers ; un `.zip` se fait à la demande, quand on télécharge plusieurs fichiers. La spec faisait choisir `zip` ou `files` à chaque requête.
2. Le résultat de PDF en JPG montre les images produites (les 6 premières), dans les deux modes, et non les vignettes de la planche.
3. La première implémentation laissait les images partagées et celles des formulaires XObject telles quelles. La correction de relecture du 1er octobre remplace directement leurs flux dans le document source : aucune réécriture du contenu des formulaires n'est nécessaire.
4. L'aide « ? » est un bouton à `aria-expanded` dont la bulle s'ouvre dessous, et non un `popover` : un popover ne se place pas sous son bouton sans l'ancrage CSS, absent des trois navigateurs. Échap ou la sortie du bouton la ferme.
5. Pendant le travail, le moine dit son verbe (« Je presse… ») et le bouton montre le pourcentage. « Page 2 sur 4 » serait faux pour les outils page par page, dont les étapes sont des fichiers.
6. Ordre : le moteur de compression et sa mesure viennent d'abord, parce que mesurer le gain demande le moteur.
7. La progression ne se montre que dans le bouton verbe, pas sur chaque ligne de fichier d'un téléphone : le moteur compte les pages de tous les fichiers ensemble.
8. Compresser garde l'original sauf si le nouveau fichier gagne 1 % au moins, et ne rend jamais l'original d'un PDF protégé : il demanderait encore son mot de passe, alors que le site promet des fichiers sans.
9. Une image avec transparence est ré-encodée en JPEG et garde son masque doux : PDFium perd le masque quand il écrit un JPEG, donc le flux est réécrit dans le fichier enregistré. La réécriture vérifie la mise en page du fichier et rend les octets tels quels si elle ne la reconnaît pas. Les niveaux deviennent 96, 150 et 200 ppp (qualité 0,5, 0,6 et 0,8), au lieu de 100, 150 et 220. La phrase « laisser telle quelle si elle a de la transparence » de la section Compresser ne vaut plus.

Décisions prises pendant le travail :

- Vérification préalable 1 : les anciennes médianes de 29 % puis 31 % incluaient une suppression de structure par copie de pages ; elles ne valident pas le seuil de 30 %. Refaire la mesure sur les 11 PDF en conservant le document source, avec une médiane sur les PDF 1 à 5 (rapports avec photos, scan JPEG). Distinguer le candidat brut du fichier effectivement livré quand l'outil garde l'original. Table et détail : [Version Web](../development/web-version.md#mesures-de-la-compression).
- JPG en PDF n'a ni onglets de fichiers ni marques de couleur, puisqu'une image est une page. La légende sous chaque image donne le nom du fichier ; au survol, une infobulle donne le nom et le poids.
- La bulle du résultat dit « Alléluia, c'est fait ». Les onglets de fichiers tiennent sur une seule rangée qui défile de côté (barre fine, fondu à droite tant que des onglets se cachent), avec le bouton Annuler toujours visible.
- L'en-tête suit le défilement ; ses menus montrent une icône au trait par outil, et non les petits moines. Le pied de page suit la structure du design system : trois promesses, la marque, cinq colonnes de liens ; ses pages non encore écrites pointaient vers `#`. Les icônes des réseaux viennent de Simple Icons (CC0), écrites dans la page. Détail dans la [spec du design system](2026-09-30-web-design-system-design.md#mise-en-page-commune).
- La page d'un outil vide centre une seule action : le moine au-dessus du bouton « Choisir… ». Elle remplace les titres de dépôt (`t.drop.*`). Le fil d'Ariane visible disparaît ; il reste dans le JSON-LD.

## Suite prévue

- relecture des textes et des pages SEO des 2 outils ;
- lot 2 : écrire sur les pages (Signer, Filigrane, Numéros de page, Noircir) ;
- lot 3 : Protéger et Déverrouiller. PDFium expose `EPDF_SetEncryption` : pas de bibliothèque de plus ;
- lot 4 : OCR et Scanner.
