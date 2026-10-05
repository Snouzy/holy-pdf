# Version Web : design system Holy PDF — design

_Rédigé le 30 septembre 2026. Statut : livré dans `apps/web/`. Ajoutés en cours de réalisation et décrits ici : la bascule clair et sombre, le ton « abbaye » et la robe de bure, le haut de page centré, la vue compacte et le dépôt sur toute la page._

## Contexte

Le site `apps/web/` marche : 7 outils, la planche commune, le moteur PDFium, Lighthouse au vert (voir la [spec du socle](2026-09-29-web-organiser-design.md)). Son interface est volontairement nue : police système, une liste de liens en accueil, le nom provisoire `pdf-toolbox`.

Le 30 septembre, le nom et la direction visuelle ont été choisis : voir [Identité de marque](../product/brand.md). Les maquettes de référence du 30 septembre 2026 ne sont pas publiées : page « Design system » (fondations, composants, moines), page « Un moine par outil — itérations » (accueil D2, page outil Fusionner, mobile) et page « Titres : polices et émojis ».

Cette spec applique ce design system au site.

## Objectif et critères de réussite

Un visiteur qui arrive sur Holy PDF voit tout de suite un site d'outils PDF, avec une personnalité : un moine par outil. Il garde tout ce que le socle lui donne : la vitesse, aucun envoi de fichier, les deux langues.

La spec est réussie quand :

- l'accueil suit la mise en page D2 et sa zone de dépôt oriente vers les bons outils ;
- les 7 pages outils ont le portrait du moine, la planche habillée et la barre d'action qui parle ;
- le mode sombre suit l'appareil, avec les couleurs de cette spec, et un bouton de l'en-tête bascule entre clair et sombre ;
- chaque page tient les budgets de la section Performance, et la CI bloque sinon ;
- les tests unitaires, SEO et bout en bout de la section Tests passent sur Chromium, Firefox et WebKit.

## Portée

**Dans la spec :**

- le nom Holy PDF dans le site ;
- les fondations : couleurs claires et sombres, polices, formes ;
- les illustrations : moines, scènes, avatars, icônes d'interface, favicon ;
- l'en-tête, le menu des outils, le pied de page ;
- l'accueil D2, avec la zone de dépôt qui oriente ;
- l'habillage des 7 pages outils et de la planche ;
- la page 404 ;
- les textes nouveaux, en français et en anglais.

**Hors spec :** l'app Mac, les illustrations finales par un illustrateur, les pages des outils à venir, la recherche d'outils, les images de partage (Open Graph), un écran « terminé » à part, le renommage du Worker Cloudflare.

## Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Illustrations | Composants Preact qui produisent du SVG. Astro les rend en HTML au build ; la planche les réutilise dans son îlot | Une seule source par dessin, zéro JavaScript sur les pages statiques. Les couleurs passent par des variables CSS, donc le mode sombre ne duplique rien |
| Écarté | Fichiers SVG en `<img>` | Un SVG en `<img>` ne lit pas les variables CSS de la page : le mode sombre devrait être copié dans chaque fichier |
| Écarté | Sprite SVG (`<symbol>`, `<use>`) | Le plus complexe, pour un gain de poids faible sur 19 moines |
| Polices | Hébergées sur le site : Bricolage Grotesque (graisse 800 seule) et Figtree variable, prises dans `@fontsource/bricolage-grotesque` et `@fontsource-variable/figtree`, puis réduites aux lettres du français et de l'anglais par `scripts/subset-fonts.py` (fontTools) dans `src/fonts/` | Pas de requête vers Google Fonts. Le sous-ensemble fait passer les polices de 42 à 25 Ko, ce qui tient le LCP de l'accueil sous 1,5 s |
| Accueil | Mise en page D2 : les 7 outils prêts en grandes cartes, les 12 à venir en petits avatars | Mettre en avant ce qui marche. Choix de l'auteur |
| Zone de dépôt de l'accueil | Elle oriente vers les outils qui acceptent les fichiers, puis ouvre la page outil avec les fichiers | Choix de l'auteur. Coût : un îlot et la navigation `ClientRouter` sur l'accueil |
| Passage des fichiers | En mémoire, dans un module partagé, pendant une navigation `ClientRouter` | Le plus simple. Si la page est rechargée, les fichiers sont perdus et la zone de dépôt habituelle s'affiche |
| Mode sombre | Automatique, selon l'appareil, et un bouton lune ou soleil dans l'en-tête pour choisir | Choix de l'auteur. Le choix reste dans le navigateur. Sans JavaScript, le site reste clair |
| Menu des outils | `<details>` natif | Zéro JavaScript, marche au clavier |
| Recherche | Aucune | 19 outils tiennent sur une page |
| Police d'accent dans les titres | Aucune | Essayée, refusée par l'auteur. Le surligneur jaune reste le seul accent |
| Émojis | Un par titre, à la fin, collé au dernier mot, émoji du système | Donne le ton sans fichier à charger |
| Domaine | `SITE_URL=https://holy-pdf.com` au branchement du domaine. D'ici là, `noindex` | La variable existe déjà. Ne pas faire indexer une adresse provisoire |

## Structure

```
apps/web/src/
  styles/
    tokens.css          couleurs claires et sombres, formes, ombres, espacements
    fonts.ts            @font-face des deux polices et la liste des lettres gardées
  fonts/                les deux polices réduites et leur licence OFL (générées par scripts/subset-fonts.py)
  illustrations/
    Monk.tsx            le moine : accessoire, humeur, taille, calque, auréole
    Scene.tsx           la feuille PDF de chaque outil
    Avatar.tsx          le moine qui sort du cercle
    Icon.tsx            icônes d'interface
  cast.ts               la distribution : un moine par outil prêt, les 12 outils à venir
  home/
    HomeDrop.tsx        îlot de la zone de dépôt de l'accueil
    orient.ts           quels outils pour quels fichiers (fonction pure)
  board/
    handoff.ts          passage des fichiers de l'accueil à la planche
    MonkBubble.tsx      le moine et sa bulle, dans la barre d'action
  layouts/Base.astro    head et script (tokens, polices, thème), la barre du site et la largeur des pages
  styles/base.css       les règles que chaque page et l'appli de bureau partagent (corps, liens, titres, voile de dépôt, surligneur)
  layouts/SiteNav.astro, SiteFooter.astro    la barre du haut et ses menus, le pied de page
  illustrations/ToolIcon.tsx    les icônes au trait des outils
  pages/[lang]/index.astro, [tool].astro, 404.astro
  i18n/fr.ts, en.ts     nouveaux textes
public/favicon.svg      tête du moine auréolé
```

`tools.ts` reste la source des outils qui fonctionnent. `cast.ts` ajoute ce qui est propre au moine. Le moteur, l'état de la planche et les contenus Markdown ne changent pas.

## Fondations

### Couleurs

Toutes dans `tokens.css`, en variables. Aucun composant n'écrit une couleur en dur.

| Rôle | Clair | Sombre |
|---|---|---|
| fond | `#EEF1F6` | `#111527` |
| surface (feuilles, cartes, champs) | `#FFFFFF` | `#1B2138` |
| encre (texte) | `#141A2E` | `#F1F3FA` |
| encre douce | `#3A4260` | `#A9B1CC` |
| gris (légendes, inactif) | `#5B6272` | `#8C94AE` |
| principal (boutons, liens) | `#2346D8` | `#8FA2FF` |
| principal au survol | `#1A36AD` | `#B4C1FF` |
| texte sur principal | `#FFFFFF` | `#111527` |
| surligneur | `#FFE45C` | `#FFD84A` |
| surligneur clair (feuille mise en avant) | `#FFF3B0` | `#FFF3B0` |
| pli (coin corné, traits des scènes) | `#D3DAE8` | `#2C3452` |
| bordure | `#C9D1E0` | `#3A4466` |
| tampon (« Bientôt », erreurs) | `#C8321B` | `#FF6B57` |
| outil à venir (fond) | `#ECEEF3` | `#333C60` |

Catégories, une couleur pour le texte et une teinte pour le fond des illustrations :

| Catégorie | Clair | Sombre |
|---|---|---|
| Organiser | `#2346D8` / `#E3E9FB` | `#8FA2FF` / `#2A3562` |
| Convertir | `#0B7A5E` / `#DDF3EA` | `#4FD1A5` / `#1C3F36` |
| Modifier | `#B4418E` / `#F8E1EC` | `#F28AC0` / `#4D2D4C` |
| Optimiser | `#A35900` / `#FBEBD3` | `#FFB547` / `#45361B` |
| Sécurité | `#5B6272` / `#E6E8EE` | `#A9B1CC` / `#303750` |

Moine : robe `#6B4226` (sombre `#8A5A34`), ombre de robe `#4E2E18` (sombre `#6B4226`), peau `#F5CBA7`, cheveux `#141A2E`, joues `#F59A8C`, corde et accessoires `#FFE45C`, contour `#141A2E` (sombre `#0B0E1C`), papier `#FFFFFF`.

Fichiers de la planche : six couleurs qui tournent, avec leur teinte : rouge `#E0452B` / `#FCE6E1`, bleu `#2346D8` / `#E1E7FB`, jaune `#E3B400` / `#FFF6C7`, vert `#0B7A5E` / `#DDF3EA`, rose `#B4418E` / `#F8E1EC`, orange `#A35900` / `#FBEBD3`. En sombre, le rouge devient `#FF6B57` / `#512F2D`, le jaune `#FFD84A` / `#3F3919`, les quatre autres prennent les valeurs sombres des catégories de même couleur.

Les feuilles PDF (vignettes, scènes) restent blanches en mode sombre.

### Surligneur

En clair, une bande jaune sur le bas des lettres (de 55 à 92 % de la hauteur), texte en encre. En sombre, la bande couvre le mot entier (de 8 à 92 %) et le texte passe en `#111527`. Au plus un groupe de mots surligné par écran.

### Polices

| Style | Police | Taille |
|---|---|---|
| Titre 1 | Bricolage Grotesque 800, interligne 0,98, lettres −2,5 px | 68 px, 40 px sur mobile |
| Titre 2 | Bricolage Grotesque 800, lettres −1,5 px | 40 px, 26 px sur mobile |
| Titre 3 | Bricolage Grotesque 800 | 24 px |
| Texte large | Figtree 400, interligne 1,5 | 19 px |
| Texte | Figtree 400 et 600 | 16 px |
| Légende | Figtree 700, capitales, lettres +1,5 px | 12 px |

Les tailles de titre passent de mobile à ordinateur avec `clamp()`. Les deux polices sont préchargées et déclarées en `font-display: optional` : une police arrivée trop tard n'est jamais substituée après le premier affichage, donc le texte ne bouge pas. Le préchargement les fait arriver à temps dès la première visite (25 Ko à elles deux). Elles ne gardent que les lettres du français et de l'anglais et les signes des textes (`latin` dans `fonts.ts`) ; une lettre absente, dans un nom de fichier par exemple, prend la police système. Après un changement de cette liste : `python3 scripts/subset-fonts.py` (il faut `fonttools` et `brotli`).

### Formes et ombres

- Espacements : multiples de 4 px.
- Rayons : 10 px pour les boutons, champs et onglets ; 14 px pour les panneaux ; 999 px pour les pastilles et avatars.
- Diviser : les ciseaux entre les pages occupent un bouton rond de 44 px, avec une icône de 22 px et un contour bleu. Le bouton actif est rempli de bleu. Les cellules portant une découpe laissent déborder ce bouton dans l'espacement entre pages, sans rognage par `content-visibility` ni réduction de l'icône par le padding générique.
- Feuilles : angles droits, coin corné de 20 à 34 px selon la taille (un `clip-path` et un triangle de la couleur « pli »).
- Ombres : feuille `0 4px 8px rgb(20 26 46 / 0.10)`, panneau `0 10px 30px rgb(20 26 46 / 0.07)`, page levée `0 16px 20px rgb(20 26 46 / 0.28)`.

### Survol

Chaque contrôle répond au pointeur. Une seule règle par sorte de contrôle :

| Sorte | Exemples | Au survol |
|---|---|---|
| Principal, plein | le bouton verbe, « Choisir des PDF », « Télécharger », « Choisir des fichiers » de l'accueil, « Retirer » de la confirmation | fond `--accent-hover` et une ombre plus grande : `0 12px 28px`, `--accent` à 38 % |
| Secondaire, à bordure ou sur la surface | « + Ajouter un PDF » (case, cartes de fichiers et panneau), « Changer les réglages », Annuler, les boutons secondaires du résultat, le thème, la langue, « Menu » et les entrées des menus de la barre, « Vue compacte », les petits boutons icônes (pivoter, couper, « ? »), les catégories de l'accueil (sauf celle choisie), « Voir tous les moines » | fond `--accent-tint`, bordure et texte ou icône `--accent` ; le champ de recherche de l'accueil prend la bordure seule |
| Interrupteur | « Montrer les moines en méditation » | libellé `--accent` |
| Bascule enfoncée | les ciseaux posés de Diviser, « Vue compacte » active | fond et bordure `--accent-hover`, sans ombre |
| Destructif, icône | le × d'une carte et d'un onglet de fichier, « Supprimer la page » | fond `--stamp-tint`, bordure et icône `--stamp` |
| Carte de choix, tuile, bascule | les niveaux de Compresser, les modes et les qualités de PDF en JPG | bordure `color-mix(in srgb, var(--accent) 55%, var(--line))`, fond `color-mix(in srgb, var(--accent) 4%, var(--surface))` ; le choix coché garde son aspect |
| Carte lien | les cartes des outils prêts et celle des moines en méditation, sur l'accueil (une carte d'outil à venir n'est pas un lien et ne change pas), « Les autres moines », les moines proposés par la zone de dépôt, les outils de la page 404 | `translateY(-2px)` et `--shadow-panel` ; la carte d'outil, coupée par son coin corné, prend l'ombre en `filter: drop-shadow()`. La classe commune `.lift` lève la carte, et son `::after` couvre les 2 px qu'elle quitte : un pointeur au bord bas ne fait pas clignoter le survol |
| Lien texte | les liens de la barre, du pied de page et de la vue compacte, « Fusionner d'autres PDF » sous le résultat, « Comment faire, questions fréquentes » sous l'atelier | couleur `--accent` et soulignement ; un lien déjà souligné en `--accent` (dans le texte, « Changer de fichiers ») passe en `--accent-hover` |
| Vignette de page | les pages de la planche | contour de 2 px `--accent` autour de la feuille ; le curseur `grab` reste. L'aperçu d'une carte de fichier ne réagit à rien, donc il ne change pas |
| Question de la FAQ | `summary` de la FAQ d'une page outil | couleur `--accent` ; le signe « + » d'une question fermée passe sur `--accent-tint` |

- **Jetons** : `--accent-tint` vaut `color-mix(in srgb, var(--accent) 10%, var(--surface))`, `--stamp-tint` vaut `color-mix(in srgb, var(--stamp) 10%, var(--surface))`. Déclarés une fois sur `:root`, ils suivent le thème. Contrastes mesurés dans le navigateur : `--accent` sur `--accent-tint` 6,1 : 1 en clair, 5,6 : 1 en sombre ; `--stamp` sur `--stamp-tint` 4,6 : 1 en clair, 5,0 : 1 en sombre. À 12 %, le tampon descendait à 4,45 : 1 en clair.
- **Pied de page** : il est sombre dans les deux thèmes, et `--accent` n'y atteint que 2,4 : 1 en clair. Il garde la même règle avec sa propre encre : fond `--on-footer` à 12 %, bordure et texte `--on-footer` ; ses liens passent en `--on-footer`, soulignés.
- Tous les styles de survol sont dans `@media (hover: hover)` : un écran tactile ne garde pas un survol collé.
- Transitions de 150 ms sur `background-color, border-color, color, box-shadow, transform`, en une règle commune de `styles/base.css` sur `a, button, summary, label`. La règle globale de `prefers-reduced-motion` les coupe.
- Un contrôle désactivé ne change pas (`:not(:disabled)`). L'anneau de focus ne change pas. Le logo de la barre et du pied de page ne change pas.

## Illustrations

Le dessin de référence est la maquette du 30 septembre 2026, non publiée ; les SVG du site (`apps/web/src/illustrations/`) en sont la version de référence. Les attributs de couleur deviennent des variables CSS.

### `Monk`

| Prop | Valeurs |
|---|---|
| `accessory` | `stapler`, `scissors`, `sheet`, `eraser`, `loupe`, `arrows`, `frame`, `quill`, `stamp`, `lock`, `book`, `none` |
| `mood` | `happy` (content), `focus` (concentré), `joy` (ravi), `oops`, `sleep` (en attente) |
| `size` | largeur en px. La hauteur vaut 1,1 × la largeur |
| `layer` | `all` (défaut) ou `prop` : seulement l'accessoire et la main droite |
| `halo` | auréole jaune derrière la tête, pour le logo et le favicon seulement |

Le SVG a `aria-hidden="true"` : le texte autour porte le sens.

### `Scene`

`kind` : `merge`, `split`, `organize`, `delete`, `extract`, `rotate`, `images`, les scènes des 7 outils prêts. Les outils à venir n'ont pas de scène sur le site. Les accents prennent la couleur de la catégorie de la carte ; la feuille mise en avant prend le surligneur clair.

### `Avatar`

Le moine dans un cercle teinté, la tête et l'accessoire sortent du cercle. Deux calques : le moine entier, coupé par un `clip-path: path()` (la moitié haute ouverte, la moitié basse suit le cercle), puis l'accessoire seul (`layer="prop"`), sans coupe. Le tracé du `clip-path` se calcule à partir du diamètre. Tailles : 80 px (cartes des moines liés), 46 px (outils à venir), 42 px (menu).

### `Icon`

Icônes d'interface en trait : dépôt de fichier, pivoter (une flèche en cercle), supprimer (une poubelle), cadenas, fermer, coche, voir (un œil), télécharger, plus et moins (le signe des questions de la FAQ).

### Favicon

La tête du moine auréolé, sur un rond jaune, en `favicon.svg`.

## La distribution des moines

`cast.ts` associe à chaque outil prêt son moine et sa scène :

| Outil | Accessoire | Humeur de carte | Scène | Catégorie | Émoji |
|---|---|---|---|---|---|
| Fusionner | `stapler` | `joy` | `merge` | Organiser | 📎 |
| Diviser | `scissors` | `focus` | `split` | Organiser | ✂️ |
| Organiser | `sheet` | `happy` | `organize` | Organiser | 🗂️ |
| Supprimer des pages | `eraser` | `focus` | `delete` | Organiser | 🗑️ |
| Extraire des pages | `loupe` | `happy` | `extract` | Organiser | 🔍 |
| Pivoter | `arrows` | `joy` | `rotate` | Organiser | 🔄 |
| JPG en PDF | `frame` | `happy` | `images` | Convertir | 📸 |

Les 12 outils à venir, en humeur `sleep` :

| Catégorie | Outils (accessoire) |
|---|---|
| Convertir | PDF en images (`frame`), PDF en Word (`quill`), Page web en PDF (`book`) |
| Modifier | Signer (`quill`), Filigrane (`stamp`), Numéros de page (`sheet`), Noircir (`eraser`) |
| Optimiser | Compresser (`book`), OCR (`loupe`), Scanner (`sheet`) |
| Sécurité | Protéger (`lock`), Déverrouiller (`lock`) |

Les noms des moines et des outils à venir sont dans `i18n` (voir Contenus).

## Mise en page commune

La barre de navigation se sépare du contenu par une bordure inférieure de 1 px `--line` au défilement et quand un menu est ouvert, sans ombre portée (préférence du 1er octobre 2026). La bordure reste transparente au repos et suit les couleurs claire/sombre du thème.

- **Barre du haut** : fixée en haut de la page, transparente tout en haut et sur la surface avec une bordure inférieure fine dès 24 px de défilement (5 rem puis 4 rem de haut ; 4,5 puis 3,75 rem à 75 rem et moins). Elle porte Fusionner PDF, Diviser PDF, Compresser PDF, « Convertir PDF ▾ », « Tous les outils ▾ », le bouton de thème et la langue. Chaque menu montre une icône au trait par outil, sur la teinte de sa catégorie, et grise pour les outils à venir (« Bientôt »). À 75 rem et moins, les entrées se replient derrière un bouton « Menu », dans un tiroir ; la page derrière est `inert`. Le menu « Outils » à avatars n'existe plus.
- **Pied de page** : trois promesses, la marque et une phrase, cinq colonnes de liens (Produit, Outils populaires, Ressources, Juridique, Holy PDF ; chaque lien mène à sa page, voir [Pages du pied de page](2026-10-02-web-pages-design.md) ; seules les icônes des réseaux pointent encore vers `#`), puis la langue, le thème, les réseaux (X, Instagram, LinkedIn, TikTok ; icônes Simple Icons, CC0, écrites dans la page) et © 2026.
- Maquettes : pages v12 (NV1 à NV4) et v13 (IC1) du canevas.
- **Fond de page** : couleur « fond ». Les contenus sont sur des feuilles ou des panneaux « surface ».

## Accueil

De haut en bas (maquette D2, haut de page de la maquette « IT-C Rouge ») :

1. **Haut de page, centré.** Un tampon penché, trait couleur tampon : « Gratuit · local · sans compte ». Le titre 1, choisi pour la recherche, comme la balise `title` : « Outils PDF gratuits en ligne, <surligné>dans votre navigateur</surligné>. 🙏 » (EN : « Free online PDF tools, right in your browser. »). Volumes relevés le 30 septembre 2026 avec un outil de recherche de mots-clés : « pdf en ligne gratuit » 2 900 par mois en France, « outils pdf gratuits » 210, « free online pdf tools » 2 900 aux États-Unis ; « navigateur » ne se cherche pas mais dit notre différence. La phrase : « Une recette gardée par les moines : fusionner, diviser, pivoter, convertir. Aucun fichier ne quitte votre appareil. » La zone de dépôt est une feuille cornée posée sur deux feuilles inclinées. Au-dessus de son coin droit, le moine à la plume (150 px, 100 px sur mobile) dit dans une bulle « Posez-les là, je m'en occupe. ». La bulle est décorative (`aria-hidden`) et ne couvre jamais le bouton. Dans la feuille, un cadre en pointillés couleur principale : icône, « Déposez vos PDF ici », « PDF, JPG ou PNG. Plusieurs fichiers à la fois. », puis le bouton ; en colonne sur mobile.
2. **« Le monastère 🤲 ».** À partir de 900 px, deux colonnes (maquette FL7) : à gauche une colonne de filtres de 17 rem (`aside`), à droite les cartes, quatre par rangée au-delà de 75 rem, trois en dessous. Sous 900 px, la colonne passe au-dessus des cartes, qui vont par deux.
   - **Les cartes.** Les 10 outils prêts (Signer ajouté le 1er octobre). Chaque carte : sur la teinte de la catégorie, dans un bandeau de 150 px, le moine (112 px) et sa scène (110 px) ; dessous, le nom du moine en légende, le nom de l'outil en titre 3 (1,25 rem), une phrase, « Ouvrir l'outil → ». Toute la carte est le lien. Sur mobile, tuile réduite : moine de 86 px, scène de 74 px. Puis la case en pointillés « Et 9 moines en méditation », qui renvoie à la section suivante. Puis une carte par outil à venir (`ToolCard` avec `asleep`, maquette FL2) : bandeau gris `--upcoming`, icône au trait de l'outil (`ToolIcon`, 64 px) en gris, la catégorie en légende, le nom de l'outil, l'étiquette « Bientôt · en méditation ». Ni lien ni survol. Le moine endormi de la maquette n'y est pas : il pesait sur le budget du document (voir Performance).
   - **La colonne.** Le champ « Chercher un outil » (libellé masqué, même texte en indication) ; une ligne d'état (`aria-live="polite"`) : « 9 moines », et quand le meilleur résultat vient d'un synonyme, « 1 moine · « réduire » → Compresser » ; le titre « Catégories » et six boutons (`aria-pressed`) : « Tous les moines » et les cinq catégories, chacune avec sa pastille de couleur, son nom et son nombre d'outils, prêts et à venir ; un trait ; l'interrupteur « Montrer les moines en méditation » (`role="switch"`, `aria-checked`), éteint au départ. Au-delà de 900 px, la colonne reste sous la barre pendant le défilement (`position: sticky`) ; plus haute que la fenêtre, elle défile en elle-même. Sous 900 px (maquette FL10) : le champ, puis les catégories en une rangée de pastilles qui défile de côté, avec le fondu des onglets de fichiers, puis l'interrupteur.
   - **Filtrer.** Une carte d'outil à venir n'apparaît que si l'interrupteur est allumé, si la catégorie choisie n'a aucun outil prêt (aucune depuis l'arrivée de Protéger et Déverrouiller, le 2 octobre 2026 ; la règle reste pour la prochaine catégorie), ou si la recherche la trouve. La case « Et 9 moines en méditation » reste tant qu'aucun filtre n'est actif et que l'interrupteur est éteint. « 10 moines, prêts maintenant. », à côté du titre, se masque pendant qu'une catégorie ou une recherche est active : la ligne d'état donne alors le compte. Les résultats d'une recherche sont rangés du meilleur au moins bon. Sans résultat (maquette FL6) : un moine endormi, « Aucun moine ne fait ça… pour l'instant », une phrase et « Voir tous les moines », qui vide la recherche et revient à « Tous les moines ». La vue compacte suit la catégorie et la recherche, et masque ses rangées vides ; elle montre toujours les moines à venir.
   - **La recherche** (`home/search.ts`, sans serveur). Chaque outil a ses noms (nom de l'outil ; pour un outil prêt, aussi son nom court et le nom de son moine) et une liste de mots par langue (`frSearch.terms` et `enSearch.terms`, au moins cinq par outil). Accents, majuscules et mots vides (« pdf », « un », « the »…) ne comptent pas. Chaque mot de la recherche doit trouver un mot : le même (3 points), un mot qu'il commence (2), ou un mot à une faute près dès 4 lettres, deux dès 7 (1 point, lettres inversées comprises). Les fautes ne servent qu'en dernier recours : si un outil répond par mots entiers ou débuts de mots, ceux qu'il a fallu trouver par une faute sont écartés (« conv » ne ramène pas « concaténer »). À égalité, un outil prêt passe avant un outil à venir. Une recherche de plusieurs mots écrite comme un nom gagne 2 points : « pdf en jpg » et « jpg en pdf » ne donnent pas le même premier résultat. Un dernier mot qui ne trouve rien et commence un mot vide est ignoré : « pd », en route vers « pdf », ne montre pas l'absence de résultat.
   - **Sans îlot.** Les cartes et la colonne sont du HTML rendu au serveur. Le script `home/filters.ts`, écrit dans la page, bascule `hidden` sur les éléments `data-tool` et range les cartes. Un moine prêt est un élément qui porte un lien. Le script ne charge les mots (`/fr/search.json`, `/en/search.json`, 1,4 Ko) qu'au premier passage du pointeur ou du focus sur la colonne, ou à la première lettre tapée. Tant qu'ils manquent, ou si leur chargement échoue, la recherche porte sur les noms écrits sur les cartes, et un échec est retenté à la lettre suivante. Sans JavaScript, la colonne est masquée, comme « Vue compacte ».
   Un bouton « Vue compacte » (`aria-pressed`), à droite du titre, remplace les cartes et la section suivante par la liste de tous les moines, une rangée par catégorie (maquette D3) : à gauche, la catégorie dans sa couleur et son décompte (« 6 outils prêts », « 1 prêt, 3 bientôt », « 4 bientôt ») ; à droite, les avatars de 80 px (56 px sur mobile) et un nom court. Les moines prêts sont des liens, sur la teinte de leur catégorie ; les autres dorment, nom en gris. Le choix reste dans le navigateur (`localStorage`, clé `view`) et le script du `<head>` le pose sur `<html data-view>` avant le premier rendu, comme le thème : la page ne bouge pas au chargement. Sans JavaScript, le bouton est masqué et les cartes restent.
3. **« Au monastère, bientôt 🕯️ ».** Les 12 outils à venir, en quatre colonnes par catégorie : avatar endormi de 46 px et nom. Ni lien, ni page.
4. **« Rien ne sort d'ici 🤫 ».** Trois points : sur votre appareil, gratuit, sans compte.

### La zone de dépôt qui oriente

`HomeDrop` est un îlot Preact chargé en `client:idle`.

- Avant son chargement, le bouton « Choisir des fichiers » ouvre le sélecteur natif. En démarrant, l'îlot lit les fichiers déjà choisis (même méthode que `FilePicker`). Le glisser-déposer marche une fois l'îlot chargé, sur toute la page (voir « Dépôt sur toute la page »).
- L'îlot lit le type de chaque fichier avec `readKind` (quelques octets, sans le moteur).
- `orient(kinds)` rend la liste des outils proposés, dans l'ordre de `toolIds`, avec le nombre de fichiers que chacun reçoit. Un outil est proposé s'il accepte au moins un des fichiers, et, s'il n'accepte qu'un fichier, si un seul fichier lui convient.
- La feuille affiche alors « 3 PDF prêts » puis les moines proposés en boutons (avatar, nom de l'outil, et « 2 fichiers sur 3 » quand l'outil n'en reçoit qu'une partie). Un lien « Changer de fichiers » repart de zéro.
- Si aucun outil ne convient : « Holy PDF lit les PDF, les JPEG et les PNG. » Le moine est en humeur `oops`.
- Un clic sur un moine appelle `handoff.offer(tool, fichiers acceptés)`, puis `navigate()` vers la page de l'outil.
- Le résultat est annoncé dans une région `aria-live` : « 3 PDF prêts. Choisissez un outil. » Le focus clavier passe au premier moine proposé (ou à « Changer de fichiers » si aucun ne convient), et revient au bouton « Choisir des fichiers » après « Changer de fichiers ».

### Dépôt sur toute la page

Un fichier glissé depuis le bureau peut être lâché n'importe où dans la fenêtre, sur l'accueil comme sur une page outil. `useFileDrop` écoute `window`, pour un seul îlot par page : `HomeDrop` sur l'accueil, la planche sur une page outil. `dropTracker` compte les `dragenter` et `dragleave` (ils se répètent à chaque élément traversé) et ne réagit qu'à un glisser qui porte des fichiers : un texte ou un lien glissé reste au navigateur. Pendant le survol, l'îlot pose `data-dropping` sur `<html>` et `Base.astro` montre un voile sur toute la fenêtre : « Lâchez, je m'en occupe. » Le voile est hors des îlots : un ancêtre avec `clip-path` ou `filter` le couperait. Au lâcher, le navigateur n'ouvre pas le fichier ; l'îlot le reçoit comme un choix.

### `handoff.ts`

- `offer(tool, files)` garde les fichiers en mémoire, avec l'outil visé.
- `take(tool)` rend les fichiers s'ils visent cet outil, puis vide la mémoire. Un second appel rend une liste vide.
- La planche appelle `take` au démarrage et ouvre ce qu'elle reçoit, comme un dépôt.

L'accueil charge `ClientRouter`, comme les pages outils, pour que la mémoire survive au changement de page. Le moteur PDF ne se charge jamais sur l'accueil.

## Pages outils

### Haut de page

- Titre 1 centré : le `h1` du contenu Markdown, suivi de l'émoji de l'outil, puis une phrase (« Frère Agrafe relie vos PDF en un seul fichier. »).
- Pas de fil d'Ariane visible (il reste dans le JSON-LD), pas de pastille de confidentialité, pas de portrait.

### La planche

> Depuis le 30 septembre 2026, la barre d'action (Voir, Télécharger) est remplacée par le parcours en trois temps : panneau de réglage, bouton verbe, page de résultat. Voir la [spec du parcours](2026-09-30-web-parcours-lot1-design.md).

Même logique, même état, nouvel habillage :

- **Vide** : une carte blanche en pointillés. Le moine de l'outil (son humeur vient de `cast`) se tient dans un disque de 150 px sur la teinte de sa catégorie, posé sur le bord haut de la carte. Dessous, un grand bouton « Choisir des PDF », « Choisir un PDF » ou « Choisir des images », avec l'icône d'envoi, puis « ou déposez-les ici » (masqué sur un écran tactile). La ligne de confiance est sous la carte, et « Comment faire » en trois cartes plus bas. La page entière reçoit toujours les fichiers lâchés. Maquette : page v13 du canevas (TP1, TP3 à gauche).
- **Fichiers** : des onglets de chemise. Chaque fichier prend une des six couleurs, reprise en haut de ses pages. Un onglet affiche le nom, les pages et le poids ; en ouverture, une ligne qui scintille ; en erreur, languette rouge, cadenas et message d'erreur en rouge tampon sur le fond de la surface (sur la teinte du fichier, il descendrait sous 4,5 : 1). Chaque onglet a un × qui retire le fichier et toutes ses pages, après confirmation (« Toutes les pages de … seront retirées de l'aperçu. », Garder ou Retirer) ; un fichier encore sans pages part tout de suite. Cmd/Ctrl+Z ne les ramène pas, car le moteur a fermé le fichier. Le nom complet d'un fichier ou d'une page tronqué s'affiche au survol. À droite de la rangée d'onglets, un bouton icône « Annuler » (Ctrl ou ⌘ + Z) défait la dernière retouche. Les onglets sont une légende des couleurs, pas des dossiers : sur Fusionner, les pages de tous les fichiers se rangent ensemble. Avec un seul fichier prêt, ni onglet ni marque de couleur : la légende ne sert qu'à distinguer plusieurs fichiers. L'onglet revient pendant l'ouverture ou après une erreur, pour le message et le mot de passe.
- **Pages** : des feuilles cornées avec la couleur du fichier en haut et le numéro dessous. Sélectionnée : contour principal de 3 px et état annoncé. Glissée : levée, penchée de 4°, ombre « page levée ». En chargement : scintillement. Les boutons de page (pivoter, supprimer, sélectionner, couper) deviennent des boutons icône avec libellé accessible. La grille finit par une case en pointillés « + Ajouter un PDF » (« Ajouter des images » sur JPG en PDF, « Choisir un autre fichier » sur un outil à un seul fichier), qui ouvre le sélecteur.
- **Barre d'action** : en bas de la planche sur ordinateur, fixée en bas de l'écran sur mobile. `MonkBubble` montre le moine de l'outil (84 px, tête de 50 px sur mobile) et une bulle ; à côté, **Voir** (le PDF produit s'ouvre dans un nouvel onglet du navigateur) et **Télécharger**, le bouton principal. Diviser n'a que Télécharger, car il produit un zip. Pivoter un PDF garde « Tout pivoter », son geste principal. Ni « Annuler » (il est au-dessus de la grille). Sur les outils à plusieurs fichiers (Fusionner, JPG en PDF), « Ajouter un PDF » ou « Ajouter des images » est aussi dans le panneau, juste au-dessus du bouton verbe, sauf pendant l'export et sauf sous 900 px, où la barre sous le pouce garde le verbe seul : sur un document long, la case de la grille est hors de vue et il fallait descendre tout en bas pour ajouter un fichier (demande de l'auteur, 5 octobre 2026, dans l'appli de bureau). Les outils à un seul fichier gardent leur case « Choisir un autre fichier » dans la grille seulement : à côté du verbe, elle remplacerait tout le travail en un clic.

| État de la planche | Humeur | Bulle |
|---|---|---|
| fichier en ouverture | `focus` | « Je lis contrat.pdf… » |
| prêt | `happy` | « 3 fichiers, 7 pages. » et la question de l'outil |
| export en cours | `focus` | le verbe de l'outil (« J'agrafe… ») |
| export fini | `joy` | la phrase de fin de l'outil (« Et voilà, c'est agrafé 🙌 ») |
| erreur | `oops` | le message d'erreur actuel et « Retirer ce fichier » |

Le téléchargement part comme aujourd'hui. Il n'y a pas d'écran « terminé » : seule la bulle change, jusqu'à la prochaine action.

### L'atelier

Dès que des fichiers sont choisis, la page de travail remplit l'écran sous la barre, à 64 rem de large et plus. Maquette : page v14 du canevas, version A « l'atelier » (WK1).

- **La table, à gauche** : le fond de la page. Le titre, compact et aligné à gauche ; puis l'espace de travail : les cartes de fichiers (Compresser, PDF en JPG) ou la chemise de pages et ses onglets. Les cartes de fichiers sont centrées sur la table, sans zone en pointillés ; « + Ajouter un PDF » est en haut à droite de la table, sous le titre, et la phrase « Vous pouvez aussi glisser d'autres PDF dans cette zone » est masquée (toute la page reçoit les fichiers). En bas de la table, le lien « Comment faire, questions fréquentes » et un chevron mènent aux sections du dessous (`#how-to`).
- **Le panneau, à droite** : une colonne de 27,5 rem collée au bord droit de la fenêtre. Fond surface, un trait de 1 px `--line` à sa gauche, sans rayon ni ombre. Il reste sous la barre (`position: sticky`, haut `--nav-height`) et prend toute la hauteur restante (`100vh - --nav-height`). Si son contenu déborde, il défile dans le panneau ; le bouton verbe et la ligne de confiance restent collés en bas.
- La table est au moins aussi haute que le panneau : le premier écran montre tout l'outil.
- **Mise en œuvre** : `main:has(.board)` devient une grille `minmax(0, 1fr) 27.5rem`, zones `"head panel" "work panel" "below panel"`, lignes `auto 1fr auto`, sans largeur maximale ni marge intérieure. `.board` passe en `display: contents` (dans `board.css`), donc `.workspace` et `.panel` prennent les zones `work` et `panel` de la grille de `[tool].astro`. Les sections du dessous occupent toute la ligne et gardent la largeur de la page (82 rem, centrée).
- De 900 px à 64 rem, la planche garde son panneau flottant (rayon, ombre, hauteur minimale) ; sous 900 px, la pile du téléphone et sa barre du verbe collée en bas ne changent pas (maquette WK3, à gauche). La page de résultat et la page vide ne changent pas.

### Sous la planche

Maquette : page v14 du canevas (FQ1).

- « Comment faire » (`id="how-to"`) : les 3 étapes du contenu, numérotées dans des pastilles.
- Le texte SEO du contenu, en une colonne centrée de 48 rem au plus.
- La FAQ : titre centré, une colonne centrée de 55 rem au plus. Chaque question est une carte blanche (`--radius-panel`) : la question en gras à gauche, un signe rond de 36 px à droite (« + » `--accent` sur `--bg` ; ouverte, « − » `--on-accent` sur `--accent`, et la carte prend `--shadow-panel`), la réponse dessous en `--ink-soft`.
- « Les autres moines » : titre centré, les outils de `related` en cartes centrées (`repeat(auto-fit, minmax(16rem, 22rem))`). Chaque carte montre l'avatar de 80 px, le nom de l'outil en police de titre, le nom du moine dans la couleur de sa catégorie et une flèche à droite.
- Ces sections ne prennent qu'une marge en haut : dans la grille de l'atelier, les marges ne fusionnent pas, et l'espacement reste le même que sur la page vide.

## Page 404

Le moine en humeur `oops` avec sa loupe, « Cette page n'existe pas 🙈 », un lien vers l'accueil et les 7 outils en avatars.

## Contenus

### Nom et titres

- `siteName` devient `Holy PDF` : logo, pied de page, fil d'Ariane des données structurées.
- `<title>` de l'accueil : « Holy PDF : outils PDF gratuits, dans votre navigateur » (EN : « Holy PDF: free PDF tools, in your browser »). Les `<title>` des outils ne changent pas.
- Les émojis ne vont jamais dans `<title>` ni dans les descriptions. Dans les titres visibles, ils sont dans un `<span aria-hidden="true">`, collés au dernier mot par une espace insécable.

### Émojis

Accueil 🙏, outils prêts 🤲, outils à venir 🕯️, confidentialité 🤫, gratuit 😇 ; outils 📎 ✂️ 🗂️ 🗑️ 🔍 🔄 📸 ; fin d'export 🙌 ; erreur et 404 🙈.

### Textes des moines

| Outil | Moine FR | Moine EN | Question (prêt) | Fin |
|---|---|---|---|---|
| Fusionner | Frère Agrafe | Brother Staple | J'agrafe tout ça ? | Et voilà, c'est agrafé |
| Diviser | Frère Ciseaux | Brother Scissors | Je coupe ? | C'est coupé |
| Organiser | Frère Classeur | Brother Binder | Je range tout ça ? | C'est rangé |
| Supprimer des pages | Frère Gomme | Brother Eraser | J'efface ces pages ? | C'est effacé |
| Extraire des pages | Frère Loupe | Brother Lens | Je sors ces pages ? | C'est sorti |
| Pivoter | Frère Toupie | Brother Spin | Je les remets d'aplomb ? | C'est d'aplomb |
| JPG en PDF | Frère Cadre | Brother Frame | Je fais le PDF ? | Le PDF est prêt |

`i18n/fr.ts` et `i18n/en.ts` reçoivent aussi : la phrase de présentation de chaque moine, la phrase de chaque carte, le verbe en cours (« J'agrafe… »), les noms des 12 outils à venir, les noms des 5 catégories, les titres des sections de l'accueil, les textes de la zone de dépôt et de la 404. Les deux dictionnaires ont le même type : un texte manquant dans une langue ne compile pas. `cast.ts` est typé `Record<ToolId, …>` : un outil sans moine ne compile pas non plus.

Tous ces textes sont marqués « à relire » dans le wiki, comme les textes SEO, jusqu'à leur validation.

## Mode sombre

Un script court, dans le `<head>` de chaque page, pose `data-theme="light"` ou `"dark"` sur `<html>` avant le premier rendu : le choix gardé dans `localStorage`, sinon le réglage de l'appareil, qu'il suit tant que rien n'est choisi. `tokens.css` redéfinit les variables sous `:root[data-theme="dark"]`. Rien d'autre ne change : les composants ne lisent que des variables. Les valeurs sont dans les tableaux de Fondations.

Le bouton de la barre du haut (un second dans le pied de page, gardé en phase) montre une lune en clair et un soleil en sombre. Il bascule le thème, garde le choix, et annonce son état par `aria-pressed` (« Mode sombre »). Pendant une navigation `ClientRouter`, le script pose le thème sur la nouvelle page avant l'échange. Sans JavaScript, le site reste clair et le bouton est masqué.

Le disque des moines à venir se détache du fond et des panneaux : au moins 1,4 : 1 en sombre. Toutes les teintes sombres (catégories, fichiers) atteignent au moins 1,3 : 1 contre la surface, pour que le disque des avatars se voie.

Sous 480 px de large, l'en-tête ne montre que le moine de la marque ; le nom reste lu par les lecteurs d'écran. Le rendu est à valider sur le site avant la mise en ligne.

## Accessibilité

- Moines, scènes, avatars et émojis : `aria-hidden`. Les liens et boutons ont un texte.
- Focus clavier : anneau de 3 px, couleur encre (claire en mode sombre), décalé de 2 px.
- La couleur n'est jamais le seul signal : onglets nommés, page sélectionnée annoncée, tampon « Bientôt » écrit.
- Boutons icône : 40 px sur ordinateur, 44 px sur mobile.
- `prefers-reduced-motion` : pas de scintillement, la page glissée ne penche pas.
- Contrastes : chaque couple texte et fond des tableaux de Fondations atteint au moins 4,5 : 1 (AA), en clair et en sombre.

## Performance

La CI garde ses seuils actuels (performance ≥ 0,95, SEO et bonnes pratiques à 1, accessibilité ≥ 0,95, CLS ≤ 0,02). Le LCP est ≤ 1,5 s sur l'accueil et ≤ 1,6 s sur les pages outil. Elle ajoute :

| Budget | Valeur |
|---|---|
| JavaScript de l'accueil (compressé) | ≤ 22 Ko |
| JavaScript d'une page outil (compressé) | ≤ 45 Ko |
| Polices, toutes pages | ≤ 80 Ko, les deux préchargées (26 Ko après le sous-ensemble) |
| HTML de l'accueil (compressé) | ≤ 28 Ko, depuis le 2 octobre 2026 (cartes de Protéger et Déverrouiller, et de quoi accueillir les outils du même lot ; choix de l'auteur). Avant : 26 Ko le 1er octobre, 25 Ko à l'origine |
| CLS | ≤ 0,01 sur l'accueil |

Ces budgets sont en brotli, ce que sert Cloudflare. Les seuils de Lighthouse CI sont 24 Ko de JavaScript pour l'accueil et 50 Ko pour une page outil. Son serveur (`compression` 1.8) sert lui aussi du brotli, de qualité 4, et il compte les en-têtes, environ 390 o par réponse : ses chiffres sont environ 13 % sous `gzip -9`, qui ne mesure donc pas le budget. Le budget de l'accueil est passé de 15 à 20 Ko pendant l'écriture du plan (le routeur d'Astro pèse 6 Ko à lui seul, Preact et le runtime des îlots 9 Ko), puis à 22 Ko quand la zone de dépôt a pris toute la page : il ne restait que 18 octets de marge.

Le LCP des pages outil a son propre seuil, choisi par l'auteur. Dans la simulation de Lighthouse, les deux polices attendent derrière les sept scripts de la planche (six connexions) : 1,53 s avec les polices, 1,37 s sans. Leur poids n'y change rien ; sur l'accueil, le sous-ensemble les ramène à 1,37 s. Avec un vrai bridage réseau, les polices coûtent environ 80 ms et toutes les pages restent sous 0,85 s.

Lighthouse CI mesure aussi l'accueil en français.

Sur l'accueil, une requête de script de plus au chargement, même de 200 octets, ajoute un aller-retour simulé au LCP : +150 ms, au-delà du budget (la simulation met les polices en file derrière les scripts). Des octets de plus dans le document ne le bougent pas. Le script des filtres est donc écrit dans la page, et `astro.config.mjs` l'y garde quelle que soit sa taille. Avec la colonne de filtres (1er octobre 2026), Lighthouse CI mesure le document de `/fr/` à 25 560 o sur 25 600 (25 307 pour `/en/`) : il reste 40 octets. Le brotli de qualité 4 varie d'environ 100 octets d'un build à l'autre pour un même contenu déplacé : la mesure se refait sur le build de la CI (`INDEXABLE=true`). `gzip -9` donne environ 28 600 o.

## Tests

**Unitaires (Vitest) :**

- `orient` : PDF seul, plusieurs PDF, image seule, plusieurs images, mélange, fichier illisible, aucun fichier.
- `handoff` : `take` rend les fichiers une fois, rien pour un autre outil, rien au second appel.
- Contrastes : calcul du ratio pour chaque couple texte et fond, en clair et en sombre.
- `searchTools` : un synonyme, et lequel ; accents et majuscules ; un mot en cours de frappe ; une faute dès 4 lettres, deux dès 7, deux lettres inversées ; les fautes en dernier recours ; tous les mots exigés ; une recherche vide ou de mots vides rend tout, comme un dernier mot qui commence un mot vide et ne trouve rien (« pd ») ; rien pour un outil qui n'existe pas ; le sens d'une conversion ; le nom du moine ; un outil prêt avant un outil à venir. Les listes de mots : au moins cinq par outil, prêt ou à venir, dans chaque langue.

**SEO (Vitest, sur le build) :** « Holy PDF » dans le `<title>` de l'accueil et le fil d'Ariane ; aucun émoji dans `<title>` ni dans `meta description` ; un seul `h1` par page ; canonical et hreflang intacts.

**Bout en bout (Playwright, Chromium, Firefox, WebKit) :**

- accueil : déposer deux PDF, choisir Fusionner, trouver les deux fichiers sur la planche ;
- accueil : choisir un fichier avant le chargement de l'îlot ;
- accueil : déposer une image, ne voir que JPG en PDF ;
- accueil : le moine parle au-dessus de la zone de dépôt sans couvrir le bouton, à 1440 et 390 px ;
- accueil : le focus clavier suit la zone de dépôt, vers les outils proposés puis de retour au bouton ;
- accueil : la vue compacte montre les 19 moines (9 liens), cache les cartes et « bientôt », et reste choisie après un rechargement ;
- filtres de l'accueil (`filter.spec.ts`) : « Convertir » montre 2 cartes, 4 avec l'interrupteur, dont 2 « Bientôt · en méditation » ; à 1 440 × 800, la colonne reste à l'écran 900 px plus bas ; sans les listes de mots (requête bloquée), « pivoter » trouve encore Pivoter, et la lettre suivante les recharge ; « Sécurité » montre ses 2 moines à venir, interrupteur éteint ; quatre cartes par rangée à 1 440 px ; « redure » ne laisse que Compresser, et l'état dit « « réduire » → Compresser » ; le meilleur résultat vient en premier ; « excel » montre le moine endormi, et « Voir tous les moines » ramène les 9 cartes ; la vue compacte suit les filtres ; la recherche marche encore après un passage par une page outil ; à 390 px, les catégories tiennent sur une rangée de pastilles, et la page ne défile pas de côté de 320 à 1 024 px ;
- téléphone : un nom de fichier sans espace ni tiret ne fait pas déborder la page pendant son ouverture (la bulle le coupe) ;
- onglet en erreur : son message est sur le fond de la surface, en clair et en sombre ;
- planche : sans onglet ni marque de couleur pour un seul fichier prêt ; le × d'un onglet demande confirmation puis retire le fichier et ses pages ; le bouton Annuler défait la dernière retouche ; le nom complet s'affiche au survol ; la case « Ajouter un PDF » ajoute un fichier, Voir ouvre le PDF produit dans un nouvel onglet, Télécharger le télécharge, et chaque outil n'a que ses actions ;
- dépôt sur toute la page : un fichier lâché sur le pied de page d'une page outil s'ouvre, le voile apparaît puis disparaît ; un fichier lâché hors de la zone de l'accueil est orienté, et le voile y couvre toute la fenêtre ;
- menu « Outils » : ouvrir, suivre un lien, au clavier ;
- mode sombre : en émulation, le fond de page vaut la couleur « fond » sombre ;
- bascule : passer en sombre, garder le choix sur la page suivante, basculer une seule fois après une navigation `ClientRouter`, suivre l'appareil sans choix ;
- accueil à 320 et 390 px : aucun défilement horizontal, même avec les polices de repli ;
- polices : chaque lettre des dictionnaires et des textes des outils est dans le sous-ensemble (sauf ✕, ⌘, ↻, que dessine la police système) ;
- survol (`hover.spec.ts`) : sur l'accueil, une page outil vide, la planche de Fusionner, Compresser, PDF en JPG, Diviser et le résultat, un contrôle de chaque sorte change d'aspect sous le pointeur (`expectHoverFeedback`) ; Annuler, désactivé, et l'aperçu d'une carte de fichier ne changent pas (`expectNoHoverFeedback`) ;
- les tests existants de la planche passent avec le nouvel habillage.

## Vérifications préalables

À faire en tout début de plan, avant d'écrire les composants :

1. **Passage des fichiers** : vérifier dans les trois navigateurs que la mémoire d'un module survit à une navigation `ClientRouter`. Si ce n'est pas le cas, repli : garder les `File` dans IndexedDB le temps de la navigation.
2. **`clip-path: path()`** : vérifier le rendu de l'avatar dans les trois navigateurs.
3. **Poids des polices** : mesurer les fichiers woff2 retenus contre le budget de 80 Ko.
4. **Poids de l'accueil** : mesurer le HTML compressé avec les 7 cartes et les 12 avatars contre le budget de 25 Ko. Si ça dépasse, réduire les tracés avant de changer d'approche.

## Suite prévue

- relecture des textes nouveaux et validation du mode sombre sur le site ;
- l'achat de holy-pdf.com, puis `SITE_URL` et `INDEXABLE=true` au déploiement, et le renommage du Worker ;
- les illustrations finales par un illustrateur, avec les planches du canevas comme brief ;
- les images de partage (Open Graph) avec les moines.
