# Appli Mac : design system Holy PDF — design

_Rédigé le 1er octobre 2026. Statut : livré dans `apps/mac`._

## Contexte

L'appli Mac (`apps/mac`) livre le Scanner v1 ([spec](2026-09-29-scanner-mac-v1-design.md)). Son interface est celle du système : le nom provisoire « PDF Toolbox », une icône SF par outil, pas d'icône d'appli, et des textes au tutoiement.

Le site porte déjà la marque Holy PDF : voir [Identité de marque](../product/brand.md) et la [spec du design system Web](2026-09-30-web-design-system-design.md). Ses moines sont des composants Preact qui produisent du SVG (`apps/web/src/illustrations/`), et ses couleurs sont dans `apps/web/src/styles/tokens.css`.

Cette spec applique la marque à l'appli Mac, en reprenant les dessins et les couleurs du site, sans les copier à la main.

## Objectif et critères de réussite

À l'ouverture, on reconnaît Holy PDF comme sur le site : le nom, l'icône, les moines, le bleu, la police des titres et la voix. L'appli reste une appli Mac : menus, raccourcis, mode sombre, VoiceOver et réglages d'accessibilité marchent comme avant.

La spec est réussie quand :

- le Dock, le menu de l'appli, la fenêtre et « À propos » disent « Holy PDF », avec l'icône de la marque ;
- l'accueil montre les outils disponibles en grille avec leurs moines, et les outils à venir en moines endormis ;
- l'écran de démarrage, le bandeau de conseils et les toasts ont leur moine ;
- tous les textes français vouvoient ;
- les images de l'appli sont produites à partir des composants du site, et un test échoue si elles ne sont plus à jour ;
- les tests du paquet, de l'appli et du site passent, et la liste de vérification à la main passe en clair, en sombre, en français et en anglais.

## Portée

**Dans la spec :**

- le nom Holy PDF dans l'appli ;
- l'icône de l'appli ;
- la couleur d'accent ;
- la police des grands titres, le surligneur et les émojis de titre ;
- le moine du Scanner, « Frère Déclic », et sa scène, dessinés dans les composants du site ;
- l'accueil « Le monastère », l'écran de démarrage, le bandeau de conseils, les toasts ;
- le passage au vouvoiement de tous les textes français de l'appli ;
- l'export des images du site vers l'appli, et son test.

**Hors spec :** la planche et la correction (elles ne prennent que la couleur d'accent), une bulle du moine qui commente la planche, Figtree dans l'appli, l'appli iPhone, l'outil Scanner sur le site, les illustrations finales par un illustrateur.

## Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Source des dessins | Les composants Preact du site restent le seul dessin. Un test Vitest les rend en SVG pour l'appli, couleurs résolues en clair et en sombre, et compare le résultat aux fichiers du catalogue d'images. `UPDATE_MAC_ASSETS=1 pnpm test` réécrit les fichiers | Un dessin changé sur le site casse le test tant que l'appli n'est pas à jour : les deux ne divergent jamais en silence |
| Écarté | Redessiner les moines en SwiftUI | Deux dessins à garder identiques |
| Écarté | Copier les SVG une fois à la main | Les deux divergent sans que personne le voie |
| Format des images | SVG dans le catalogue d'images de l'appli (`Assets.xcassets`), « Preserve Vector Data », une variante sombre par image | Net à toutes les tailles, sans PNG à régénérer. Le catalogue choisit la variante selon l'apparence |
| SVG exporté | Seulement `path`, `circle`, `ellipse`, `rect`, `polygon`, `g` (avec `transform`), `clipPath`. Ni variable CSS, ni `text`, ni `svg` imbriqué | Le moteur SVG d'Apple ne lit pas les variables CSS, et ses autres limites ne sont pas documentées : on lui donne le sous-ensemble le plus simple |
| Voix | Vouvoiement dans tous les textes français | Une seule voix pour la marque, celle du site et des moines. Choix de l'auteur |
| Moines | Accueil, démarrage, bandeau de conseils, toasts. Rien sur la planche ni dans la correction | On y travaille : les moines restent à l'entrée et dans les messages. Choix de l'auteur |
| Polices | Bricolage Grotesque 800 pour les grands titres seulement. Le reste en police système | Les contrôles restent natifs et suivent les réglages d'accessibilité. Choix de l'auteur |
| Accueil | Les outils disponibles en grille adaptative de cartes compactes, les outils à venir en avatars endormis, non cliquables | Deux outils côte à côte dès 960 points, puis davantage de colonnes selon la largeur. Correction demandée par l’auteur le 1er octobre 2026 |
| Couleurs | La couleur d'accent de l'appli devient le principal de la marque. Les fonds et les textes restent ceux du système. L'orange des pages à vérifier ne change pas | La marque se voit sur les boutons, la sélection et le focus, sans repeindre une appli Mac |
| Nom | Le produit s'appelle « Holy PDF ». L'identifiant `com.snouzy.pdftoolbox` et le module Swift `PDFToolbox` ne changent pas | Le nom se voit partout, sans perdre le dossier du bac à sable ni renommer le code |
| Icône | La tête auréolée du favicon, sur fond jaune, plein cadre. D'abord un fichier Icon Composer (`.icon`) ; s'il ne donne pas d'icône sur macOS 15, un `AppIcon` classique plein cadre | Voir « Icône » |
| Marques déposées | Le nom entre dans l'appli avant la vérification INPI, EUIPO et USPTO | L'appli n'est pas publiée. La vérification reste à faire avant toute publication ([Identité de marque](../product/brand.md)) |

## Structure

```
apps/web/
  src/illustrations/
    Monk.tsx              + l'accessoire « phone »
    Scene.tsx             + la scène « scan »
  src/cast.ts             l'outil « scan » à venir prend l'accessoire « phone »
  scripts/subset-fonts.py + le TTF de Bricolage Grotesque 800 pour l'appli
  tests/unit/macAssets.test.ts   rend les images de l'appli, les compare, les réécrit sur demande
apps/mac/
  PDFToolbox/
    Assets.xcassets/      AccentColor, couleurs de la marque, images exportées
    HolyPDF.icon/         l'icône (ou AppIcon dans Assets.xcassets, voir « Icône »)
    Fonts/                BricolageGrotesque-ExtraBold.ttf et sa licence OFL
    App/Brand.swift       enregistrement de la police, police des titres, surligneur
    App/RootView.swift    l'accueil « Le monastère »
    Features/Scanner/     démarrage, bandeau de conseils et toasts avec leur moine
  PDFToolboxTests/BrandTests.swift
  scripts/check-strings.py  + signale le tutoiement
```

Le projet utilise des dossiers synchronisés : un fichier ajouté sous `PDFToolbox/` entre dans la cible sans toucher au projet. Seuls le nom (`PRODUCT_NAME`, `PRODUCT_MODULE_NAME`, `INFOPLIST_KEY_CFBundleDisplayName`) et, si besoin, le nom de l'icône changent dans `project.pbxproj`.

## Images exportées

Le test `macAssets.test.ts` rend chaque image avec `preact-render-to-string`, remplace chaque `var(--…)` par sa valeur de `tokens.css` (bloc clair, puis bloc sombre), et écrit un dossier `.imageset` par image, avec ses deux SVG et son `Contents.json`. Il possède le dossier `Assets.xcassets/Generated/` : il y écrit aussi les couleurs de la section « Couleurs », et tout fichier qu'il n'a pas produit y est une erreur. Il écrit enfin la tête de l'icône, `HolyPDF.icon/Assets/head.svg`, à partir de `apps/web/public/favicon.svg`.

| Image | Contenu |
|---|---|
| `monk-scanner` | Frère Déclic en entier, humeur « content », accessoire « phone » |
| `scene-scan` | la scène du Scanner, couleur de catégorie « Optimiser » |
| `avatar-scanner-happy`, `-focus`, `-joy`, `-oops` | l'avatar de Frère Déclic dans quatre humeurs, teinte « Optimiser » |
| `sleep-<accessoire>-<catégorie>` | un avatar endormi par couple accessoire et catégorie du site (`cast.ts`, outils prêts et à venir) |

L'avatar est composé en SVG pur, avec les mêmes mesures que `Avatar.tsx` : le disque teinté, le moine découpé par le chemin de `avatarClip` (un `clipPath`), puis l'accessoire et la main par-dessus. Le moine imbriqué devient un groupe avec `transform` (son `viewBox` de 200 × 220, mis à l'échelle).

Le test échoue aussi si un SVG exporté contient `var(`, `<text` ou un `<svg` imbriqué.

## Frère Déclic et sa scène

- **Accessoire « phone »** : un téléphone jaune (`--rope`) tenu dans la main droite, le dos vers le spectateur, objectif cerclé d'encre, et trois traits de « déclic ». Il est dessiné par-dessus la main, comme les autres accessoires.
- **Scène « scan »** : à gauche, une photo grise avec une feuille de travers et ses quatre coins marqués en couleur de catégorie ; une flèche ; à droite, la feuille droite et blanche, avec ses lignes de texte.
- **Textes** : « Frère Déclic » (« Brother Snap »). Phrase de carte : « Vos photos de documents deviennent des PDF propres. »
- Sur le site, l'avatar endormi de l'outil « scan » prend le téléphone à la place de la feuille.

La branche Web en cours (`feat/web-parcours`) modifie aussi la liste des scènes (`SceneKind`) et la fin de `SceneDrawing`. La branche fusionnée en second aura un conflit sur ces deux endroits, à résoudre en gardant les deux ajouts.

## Couleurs

Dans `Assets.xcassets/Generated/`, chaque couleur a sa valeur claire et sa valeur sombre, écrites par le test d'export à partir de `tokens.css` :

| Couleur | Clair | Sombre | Usage |
|---|---|---|---|
| `AccentColor` | `#2346D8` | `#8FA2FF` | boutons, sélection, focus, liens |
| `Highlight` | `#FFE45C` | `#FFD84A` | le surligneur d'un titre |
| `OnHighlight` | `#141A2E` | `#111527` | le texte surligné |
| `Stamp` | `#C8321B` | `#FF6B57` | le tampon « Bientôt » |

Comme sur le site, la bande du surligneur couvre le bas des lettres en clair (de 55 à 92 % de la hauteur) et le mot entier en sombre (de 8 à 92 %). Au plus un groupe de mots surligné par écran.

## Polices

- `subset-fonts.py` écrit aussi `apps/mac/PDFToolbox/Fonts/BricolageGrotesque-ExtraBold.ttf` : la même source et les mêmes lettres que le site, sans compression WOFF2, parce que macOS charge les polices TTF. La licence OFL est copiée à côté.
- `Brand.registerFonts()` enregistre la police au lancement (`CTFontManagerRegisterFontsForURL`). Son nom PostScript est `BricolageGrotesque96ptExtraBold-ExtraBold`.
- `Font.brandTitle(size:)` donne Bricolage Grotesque 800, relative à `.largeTitle`. Une lettre absente du sous-ensemble prend la police système.
- Titres concernés : l'accueil, le démarrage, la feuille d'export.

## Écrans

### Nom et menus

Le menu de l'appli dit « Holy PDF » (« À propos de Holy PDF », « Quitter Holy PDF »), comme le Dock et la fenêtre de l'accueil.

### Accueil, « Le monastère »

- Titre en Bricolage : « Vos PDF, sur votre Mac 🙏 », « sur votre Mac » surligné. Sous le titre : « Tout est traité ici : rien n'est envoyé. »
- Section « Le monastère » : une grille adaptative (`LazyVGrid`, colonnes de 340 points minimum, espacement de 16 points) affiche les outils disponibles. Deux cartes tiennent côte à côte dans la fenêtre minimale de 960 points. Les illustrations occupent 112 × 112 points, les titres Bricolage 22 points et les descriptions restent lisibles. Toute la carte ouvre son outil. Au survol, elle se soulève et le pointeur devient une main, comme une page de la planche.
- Section « Bientôt 🕯️ » : les outils du site qui manquent à l'appli, en avatars endormis avec leur nom et le tampon « Bientôt ». Ils ne sont pas cliquables. VoiceOver lit « Diviser, bientôt ».
- La liste est écrite en Swift, dans l'ordre du site : chaque outil de `cast.ts`, prêt ou à venir, sauf « scan ». Chaque outil a son nom dans le catalogue de textes et son image `sleep-<accessoire>-<catégorie>`. Quand le site ajoute un outil, l'appli ne le montre qu'une fois ajouté à cette liste.
- Les moines sont décoratifs : VoiceOver ne les lit pas.

### Démarrage

- Frère Déclic en haut de la zone de dépôt, à la place de l'icône.
- Titre en Bricolage : « Déposez vos photos de documents 📸 ». Les trois étapes ne changent pas.

### Bandeau de conseils et toasts

- L'avatar « content » remplace l'ampoule du bandeau de conseils.
- Le toast d'enregistrement prend l'avatar « concentré » pendant l'écriture, « ravi » quand le fichier est enregistré, « oups » sur une erreur. Les textes des toasts ne changent pas, à part le vouvoiement.

### Feuille d'export

Titre en Bricolage, sans émoji.

## Voix

Tous les textes français de l'appli passent au vouvoiement, par exemple :

- « Dépose tes photos de documents ici » → « Déposez vos photos de documents 📸 » ;
- « Tu pourras l'annuler avec ⌘Z. » → « Vous pourrez l'annuler avec ⌘Z. » ;
- « Ces coins ne forment pas une page : garde les quatre coins dans l'ordre, autour de la page. » → « … gardez les quatre coins dans l'ordre, autour de la page. »

Les textes anglais ne changent pas. La spec du Scanner et la liste de vérification à la main, qui citent ces textes, changent dans le même commit.

`check-strings.py` signale en plus un texte français qui contient « tu », « te », « toi », « ton », « ta » ou « tes ». Un impératif au tutoiement (« Glisse ») ne se repère pas par un mot : la relecture le vérifie.

## Icône

La tête auréolée de `apps/web/public/favicon.svg`, agrandie sur un fond jaune (`#FFE45C`) qui remplit tout le carré : macOS 26 découpe l'icône en squircle et ne l'enferme pas dans un cadre gris.

1. **D'abord** : un fichier Icon Composer `HolyPDF.icon`, écrit à la main (`icon.json` et un calque SVG), choisi dans les réglages de la cible. `ictool` en fait un rendu pour vérifier le dessin. Le build doit donner une icône à macOS 15 aussi : on vérifie dans l'appli construite qu'une icône classique est présente (`AppIcon.icns` ou ses rendus dans `Assets.car`).
2. **Sinon** : un `AppIcon` classique dans `Assets.xcassets`, plein cadre, de 16 à 1024 px, rendu par `ictool` à partir du même `.icon`. macOS 26 le découpe en squircle ; macOS 15 le montre carré. C'est accepté jusqu'à ce qu'Xcode sache produire les deux.

Choix retenu : l'option 1, le fichier Icon Composer `apps/mac/PDFToolbox/HolyPDF.icon`, déclaré dans les réglages de la cible (`ASSETCATALOG_COMPILER_APPICON_NAME = HolyPDF`). Vérification faite le 1er octobre 2026 sur Mac.

## Tests

| Niveau | Quoi | Où |
|---|---|---|
| Images | Les images du catalogue sont celles que rendent les composants du site ; aucun SVG n'a de variable CSS, de texte ni de `svg` imbriqué | `apps/web/tests/unit/macAssets.test.ts` |
| Dessins du site | Les tests existants des illustrations passent avec l'accessoire et la scène nouveaux | `apps/web/tests/unit/illustrations.test.ts` |
| Police | La police s'enregistre et `NSFont(name:size:)` la trouve | `apps/mac/PDFToolboxTests/BrandTests.swift` |
| Images de l'appli | Chaque image et chaque couleur nommée dans le code existe dans le catalogue | `BrandTests.swift` |
| Écrans | Les captures de l'accueil, du démarrage et du bandeau sont refaites et relues | `ScreenSnapshots.swift` |
| Textes | Aucun texte sans français, aucune espace mal placée, aucun tutoiement | `check-strings.py` |
| À la main | Trois étapes de plus dans `wiki/development/tests.md` | voir ci-dessous |

Étapes ajoutées à la liste de vérification à la main :

1. En mode sombre, les moines de l'accueil, du démarrage, du bandeau et des toasts prennent leurs couleurs sombres.
2. Sur macOS 26, l'icône dans le Dock et le Finder n'a pas de cadre gris ; le menu de l'appli dit « Holy PDF ».
3. En français, aucun texte ne tutoie.

## Règles techniques

Celles du [guide technique](../development/technical-guide.md). Une exception, à y noter : la couleur d'accent de l'appli est celle de la marque, pas celle du système. Les autres couleurs restent système et sémantiques.


### Survol des commandes — 2 octobre 2026

Les boutons de Scanner, Signer et Fusionner partagent `.buttonHover()` : un éclaircissement en sombre, un assombrissement en clair et un pointeur de lien. L’effet respecte les commandes désactivées et Réduire les animations. Il conserve les dimensions, le focus clavier et le comportement natif des boutons.
