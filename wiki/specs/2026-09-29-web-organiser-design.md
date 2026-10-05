# Version Web : socle et outils Organiser — design

_Rédigé le 29 septembre 2026, mis à jour le 30 avec les résultats d'un prototype complet. Statut : livré dans `apps/web/`._

## Contexte

`pdf-toolbox` vise Mac, iPhone et Web (voir la [feuille de route](../product/roadmap.md)). Les choix de pile de la version Web sont dans [Version Web](../development/web-version.md).

La version Web se découpe en trois sous-projets, chacun avec sa spec :

1. **le socle et les outils Organiser** : cette spec ;
2. le portage du scanner, quand `algorithm.md` ne bouge plus ;
3. les outils des phases suivantes.

La priorité est la performance : au chargement, parce qu'elle compte pour le classement Google, et au traitement. Le trafic vient de la recherche.

## Objectif et critères de réussite

Un visiteur arrive depuis Google sur la page d'un outil, dépose ses fichiers, les arrange sur la planche et télécharge le résultat. Il n'a pas de compte à créer et aucun fichier n'est envoyé.

La v1 est réussie quand :

- les 7 outils marchent sur Chromium, WebKit et Firefox, sur ordinateur et sur téléphone ;
- aucune requête réseau ne transporte le contenu d'un fichier ;
- chaque page tient les budgets de chargement de la section Performance, et la CI bloque sinon ;
- les opérations tiennent les cibles de traitement fixées par le benchmark ;
- chaque page passe les contrôles SEO de la section Tests.

## Portée

**Dans la v1 :**

- site Astro statique, en français et en anglais ;
- une page d'accueil par langue, avec la grille des outils ;
- 7 outils : fusionner, diviser, réorganiser, supprimer des pages, extraire des pages, pivoter, images en PDF ;
- la planche commune, le moteur PDFium dans un Worker ;
- l'hébergement Cloudflare, la CI (tests, Lighthouse).

**Hors v1 :** le scanner, les outils des phases 2 à 6, les comptes et le paiement, les analytics, le mode hors ligne, les autres langues, les illustrations de marque, le choix du domaine.

## Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Emplacement | Dossier `apps/web/` dans ce dépôt | Partage du wiki, de `algorithm.md` et des futures photos de test. Aucun code commun avec Swift |
| Site | Astro 7 (Vite 8), une page statique par outil et par langue | HTML statique, aucun JavaScript par défaut |
| Interface | Preact 10 avec `compat`, en îlot, seulement pour la planche | Mesuré le 30/09 : avec React, la page d'outil rate le LCP (1,51 à 1,58 s) et dépasse 80 Ko dès qu'on ajoute le glisser-déposer. Avec Preact : LCP 1,37 s et 32 Ko de JS |
| Glisser-déposer | dnd-kit (`@dnd-kit/core` 6.3, `@dnd-kit/sortable` 10) | Souris, doigt et clavier, avec annonces pour lecteurs d'écran. Marche avec `preact/compat`. Versions figées depuis 2024, mais stables |
| Moteur PDF | PDFium en WebAssembly (`@embedpdf/pdfium` 2.15.1), dans un Worker | Un seul moteur pour presque tout le catalogue, licence MIT / BSD / Apache. Mesuré : fusion 2,7× plus rapide que pdf-lib, miniatures aussi rapides que pdf.js |
| Écarté | MuPDF | Licence AGPL, compatible avec celle du projet (AGPL-3.0). Écarté parce que PDFium couvre déjà presque tout le catalogue avec un seul moteur |
| Écarté | Next.js | Son côté serveur ne sert à rien quand tout tourne dans le navigateur |
| Hébergement | Cloudflare Workers, fichiers statiques | Bande passante statique gratuite et illimitée, 25 Mio par fichier. L'offre gratuite de Vercel interdit l'usage commercial, celle de Netlify plafonne vers 15 Go par mois |
| Langues | Français et anglais | Comme l'appli Mac. D'autres langues s'ajoutent sans changer la structure |
| Écrans des outils | Une planche commune, réglée par outil | Un seul composant à optimiser, déjà en cache d'un outil à l'autre |
| Analytics | Aucun script. Google Search Console seulement | Aucun script tiers sur le chemin critique |
| COOP / COEP | Pas en v1 | Aucun moteur n'utilise de threads WebAssembly. Ces en-têtes reviendront avec le scanner (OpenCV en threads) |
| Domaine | Celui de la marque, choisi plus tard. D'ici là, l'adresse `*.workers.dev`, en `noindex` | Ne pas faire indexer une adresse provisoire |

## Structure

```
apps/web/
├── astro.config.mjs
├── wrangler.jsonc            hébergement Cloudflare (fichiers statiques)
├── public/
│   ├── _headers              cache et en-têtes de sécurité
│   └── _redirects            / → /en
├── src/
│   ├── pages/[lang]/         accueil et une page par outil, par langue
│   ├── content/tools/fr|en/  texte SEO de chaque outil (Markdown)
│   ├── i18n/                 chaînes d'interface, FR et EN
│   ├── layouts/              gabarit de page : en-tête, balises SEO, pied de page
│   ├── board/                la planche (îlot Preact)
│   └── engine/               le Worker : PDFium, fflate
└── tests/
```

## Pages et SEO

**Adresses.** Tout le contenu vit sous `/fr/` et `/en/`, avec des adresses traduites. On les fixe après une recherche de mots-clés par outil et par langue, sur les volumes de recherche. Exemples : `/fr/fusionner-pdf` et `/en/merge-pdf`, `/fr/jpg-en-pdf` et `/en/jpg-to-pdf`. Les adresses n'ont pas de barre finale. La racine `/` redirige vers `/en`.

**Page d'outil**, dans cet ordre :

1. un titre `H1`, puis la zone de dépôt, visible sans défiler ;
2. la phrase « Vos fichiers ne quittent pas votre appareil » ;
3. le mode d'emploi en 3 étapes, une explication, une FAQ de 5 à 8 questions ;
4. des liens vers les outils voisins.

**Balises**

- `title` et `meta description` par langue ;
- `canonical` vers la page elle-même, `hreflang` fr/en et `x-default` ;
- un `sitemap.xml` généré au build.
- Le JSON-LD se limite à `WebApplication` et `BreadcrumbList`. Pas de balisage FAQ : depuis 2023, Google ne montre ces extraits enrichis qu'aux sites de santé et aux sites officiels.

**Rédaction.** Les textes sont rédigés en français et en anglais, puis relus par l'auteur. Le mot-clé principal de chaque page vient de la recherche de volumes.

## La planche

La planche est un îlot Preact. Pivoter, supprimer et réordonner ne modifient que son état, sans appel au moteur.

```ts
type DocStatus =
  | { kind: "opening" }
  | { kind: "ready"; pageCount: number; sizes: PageSize[] }
  | { kind: "failed"; error: EngineError }

type PageRef = { id: string; docId: string; index: number; rotation: 0 | 90 | 180 | 270 }
```

`rotation` s'ajoute à la rotation que la page a déjà dans son fichier.

Sur toutes les pages d'outils, la planche permet d'ajouter des fichiers, de réordonner (au doigt, à la souris et au clavier), de pivoter, de supprimer et de sélectionner. Un outil n'en est qu'un réglage :

| Outil | Fichiers acceptés | Mise en avant | Bouton principal → résultat |
|---|---|---|---|
| Fusionner | plusieurs PDF | pages groupées par fichier | 1 PDF |
| Diviser | 1 PDF | ciseaux entre les pages, ou « toutes les N pages » | un ZIP de PDF |
| Réorganiser | 1 PDF | glisser les pages | 1 PDF |
| Supprimer des pages | 1 PDF | ✕ sur chaque page | 1 PDF |
| Extraire des pages | 1 PDF | sélection des pages | 1 PDF avec la sélection |
| Pivoter | 1 ou plusieurs PDF | ↻ par page et « tout pivoter » | 1 PDF |
| Images en PDF | JPEG, PNG | une image devient une page | 1 PDF |

- **Images en PDF** : chaque image devient à l'ouverture un document d'une page A4, orientée selon l'image, image ajustée sans marge. Ensuite, la planche la traite comme n'importe quelle page. PDFium embarque le JPEG sans le réencoder. Le HEIC est refusé : il relève du scanner.
- **Nom du fichier produit** : `<premier fichier>-<action>.pdf`, avec l'action traduite (`facture-fusionne.pdf`, `invoice-merged.pdf`).
- **Miniatures** : le Worker rend chaque page à 2× la taille affichée et l'encode en JPEG. La planche l'affiche dans une `<img>` : le navigateur libère lui-même les images hors écran, alors qu'un `<canvas>` garderait ses pixels (environ 500 Mo pour 1 000 pages). Un seul `IntersectionObserver` suit la grille. Les pages proches de l'écran sont demandées de la plus haute à la plus basse, deux à la fois au plus, et une page qui sort de l'écran avant son tour quitte la file.
- **Aperçu d'une page** (5 octobre 2026) : un clic sur une vignette, ou Entrée dessus, ouvre la page dans une `<dialog>` native, rendue par le moteur à la taille du cadre (1 600 px au plus sur le grand côté, comme la feuille de l'appli Mac), avec sa rotation ; le rendu part 100 ms après la dernière flèche, pour qu'une flèche maintenue ne mette pas une page par rendu dans la file du Worker. Un miroitement attend le rendu, « Aperçu indisponible » remplace une page que le moteur ne rend pas. Les flèches passent à la page voisine dans l'ordre de la planche, Échap ferme ; les images rendues sont libérées à la fermeture. Espace reste la touche du glisser au clavier, et dnd-kit retient le clic qui termine un glisser. Sur la page de résultat, « Voir » ouvre le même aperçu sur ce qui vient d'être produit : les PDF sont rouverts dans le moteur le temps de l'aperçu (fichier par fichier pour Diviser, chaque page nommée « fichier, page n »), les JPEG sont montrés tels quels ; pas d'aperçu pour le Word. Un onglet ne montre ni un ZIP ni la coque de bureau, d'où l'aperçu dans la page partout.
- **Fichier choisi avant que la page soit interactive** : il reste dans le champ, et la planche l'ouvre dès qu'elle démarre.
- **Fichier en cours d'ouverture** : une carte squelette dans la grille, avec son nom et ✕ pour le retirer. Une miniature pas encore rendue a le même effet.
- **Changement de langue** : sur les pages d'outils, la navigation se fait côté client (`ClientRouter` d'Astro) et la planche garde ses fichiers. L'accueil reste sans JavaScript.
- **Lecteurs d'écran** : les annonces du glisser-déposer sont traduites et nomment la page (« Page 3 posée à la place de Page 1 »).
- **Annuler** : un bouton et `Ctrl+Z` / `⌘Z` rétablissent la dernière action. Aucune confirmation avant une suppression : la planche ne touche jamais le fichier d'origine. Annuler ne retire jamais les pages d'un fichier ouvert entre-temps.

## Le moteur

`engine/` est le seul code qui connaît PDFium. Il tourne dans un Worker et répond à des messages typés :

| Message | Réponse |
|---|---|
| `open(fichier, motDePasse?)` | nombre de pages et tailles, ou `EngineError` |
| `thumbnail(doc, page, largeur)` | une image JPEG (`Blob`) |
| `export(plans)` | un PDF par plan. Si plusieurs plans (Diviser), un ZIP fait par fflate, sans compression puisque les PDF sont déjà compressés |

Un plan est une liste ordonnée de `{ docId, index, rotation }`.

Le Worker démarre après l'événement `load` et charge PDFium tout de suite : le moteur est compilé quand l'utilisateur dépose son fichier. Il traite une demande à la fois. Si PDFium s'arrête sur un manque de mémoire interne, le client remplace le Worker et rouvre les fichiers avant la demande suivante.

Circulation des données :

1. Le fichier déposé est lu en `ArrayBuffer` et transféré au Worker sans copie.
2. Le Worker ouvre le document et renvoie le nombre de pages et leurs tailles.
3. La planche demande les miniatures des pages visibles.
4. À l'export, la planche envoie les plans. Le Worker construit les PDF et transfère les octets sans copie. Le navigateur lance le téléchargement.

## Performance

**Chargement** (Lighthouse mobile, réglages par défaut) :

| Mesure | Cible | Mesuré le 30/09 |
|---|---|---|
| LCP | ≤ 1,5 s | 1,37 s (outil), 0,76 s (accueil) |
| CLS | ≤ 0,02 | 0 |
| TBT | ≤ 100 ms | 0 ms |
| Score Performance / Accessibilité / Bonnes pratiques / SEO | ≥ 95 / ≥ 95 / 100 / 100 | 100 / 100 / 100 / 100 |
| JS avant interaction, page d'outil | ≤ 80 Ko brotli, Preact et planche compris | 37 Ko, dont 5 Ko pour le routeur |
| JS sur l'accueil et les pages de contenu | 0 Ko | 0 Ko |

- Polices système, aucune police web.
- Aucun script tiers. CSS intégré à la page.
- Le moteur (1,65 Mo brotli) n'existe qu'en un exemplaire : seul le Worker le référence. Une référence depuis la page en créait une deuxième copie. Son nom porte une empreinte, et il est mis en cache un an (`immutable`).

**Traitement.** Cibles fixées le 30/09 par le benchmark (`pnpm bench`, Chromium, pages de scan d'environ 180 Ko) :

| Opération | Cible Mac | Mesuré sur Mac M1 Pro | Cible téléphone |
|---|---|---|---|
| Ouverture d'un PDF de 100 pages (18 Mo) | — | 80 ms | — |
| 12 premières miniatures de ce PDF | ≤ 500 ms | 380 ms | ≤ 1,5 s |
| Tout pivoter (100 pages), jusqu'à l'affichage | ≤ 16 ms | 3 ms | ≤ 16 ms |
| Fusion de 10 PDF, 500 pages, 90 Mo | ≤ 1 s | 210 à 260 ms | ≤ 10 s |

Le ralentissement processeur 4× de Chromium ne ralentit que la page, pas le Worker de façon fiable : il vaut pour la rotation (12 à 15 ms), pas pour le moteur. Les cibles téléphone se contrôlent à la main sur un iPhone avant la mise en ligne.

## Gestion des erreurs

Le moteur renvoie des erreurs typées, sans phrase pour l'utilisateur. La planche les formule, en français et en anglais.

```ts
type EngineError =
  | { kind: "unsupportedFormat" }
  | { kind: "passwordRequired" }
  | { kind: "wrongPassword" }
  | { kind: "damaged" }
  | { kind: "outOfMemory" }
  | { kind: "engineUnavailable" }
```

| Cas | Comportement |
|---|---|
| Format non pris en charge | Détecté sur les premiers octets, pas sur l'extension. Message sur le fichier, les autres continuent |
| PDF protégé | La planche demande le mot de passe. Le PDF produit n'est plus protégé, et un message le dit |
| Mot de passe faux | Message, nouvel essai possible |
| PDF endommagé | Message sur le fichier, les autres continuent |
| Mémoire insuffisante | Message « trop gros pour cet appareil ». Aucune limite devinée à l'avance |
| PDFium s'arrête (manque de mémoire interne) | Le Worker est remplacé et les fichiers rouverts. L'opération en cours affiche « trop gros pour cet appareil » |
| Téléchargement du moteur en échec | Message et bouton « Réessayer » |
| Fichier que le navigateur ne peut pas lire (dossier, fichier resté dans le cloud) | Message « ne peut pas être ouvert » sur le fichier, les autres continuent |
| Fichier encore en ouverture | Carte squelette, ✕ pour le retirer sans attendre la fin |
| Fichier lâché à côté de la planche | Ignoré : la page reste, avec son agencement |

## Tests

| Niveau | Outil | Vérifie |
|---|---|---|
| Unitaire | Vitest | l'état de la planche, les réglages des outils, les plans d'export, les noms de fichiers, la détection du format |
| Moteur | Vitest sous Node | fusion, rotation, ordre, extraction, images en PDF, relus avec pdf.js, utilisé seulement dans les tests pour ne pas vérifier le moteur avec lui-même |
| Bout en bout | Playwright : Chromium, WebKit, Firefox | pour chaque outil : déposer, agir, télécharger, contrôler le PDF. Et aucune requête réseau autre que les fichiers du site pendant le traitement |
| SEO | Vitest sur le HTML construit | `title`, `description`, `canonical`, paire `hreflang` et `H1` sur chaque page, toutes les pages dans le sitemap |
| Performance | Lighthouse CI (en CI), benchmark Playwright (en local seulement) | les budgets et les cibles de la section Performance |

Les fichiers de test sont générés au moment du test : des PDF dont chaque page porte son numéro en gros (pour vérifier l'ordre), un PDF protégé, un PDF tronqué, des images. Aucun document réel.

La CI tourne dans GitHub Actions, à chaque pull request.

## Vérifications préalables

Faites les 29 et 30/09, sur un prototype complet (site, planche, moteur, tests) :

1. **PDFium contre `@cantoo/pdf-lib` et pdf.js** : PDFium retenu. Fusion de 500 pages (100 Mo) en 116 ms contre 318 ms sous Node. Les 12 premières miniatures d'un PDF de 20 Mo en 254 ms dans un Worker Chrome, autant que pdf.js.
2. **API de `@embedpdf/pdfium`** : tout y est. `EPDFImageObj_SetJpeg` embarque un JPEG sans réencodage, et `FPDF_SaveAsCopy` écrit par un rappel JavaScript.
3. **PDFium sous Node** : il tourne, les tests du moteur restent dans Vitest.
4. **Mémoire** : le tas plafonne à 2 Gio et ne rétrécit jamais. Un `malloc` impossible renvoie 0 proprement. Un manque de mémoire interne arrête le module (`RuntimeError`) : le Worker est alors remplacé.
5. **Budget de 80 Ko** : raté avec React, tenu avec Preact (32 Ko).
6. **`_redirects`** : pris en charge (`/ /en 301`).

Pièges trouvés par le prototype, tous couverts par un test :

- PDFium accepte des octets qui ne sont pas un JPEG : la taille en pixels de l'image est vérifiée avant de créer la page ;
- un fichier choisi avant l'hydratation de la page était ignoré ;
- les annonces de dnd-kit étaient en anglais et lisaient des identifiants internes ;
- les miniatures demandées dans le désordre retardaient les premières de 500 ms ;
- `astro check` refuse TypeScript 7 : le projet reste en TypeScript 6.0.3.

## Règles techniques

Le [guide technique](../development/technical-guide.md) s'applique, transposé en TypeScript :

- TypeScript strict, pas de `any` ni de `as` sans commentaire qui justifie ;
- un état est une union discriminée, jamais une combinaison de booléens. Les erreurs sont typées ;
- `engine/` ne contient aucune phrase pour l'utilisateur ;
- toute chaîne visible passe par `i18n/`, en français et en anglais, dès la première vue ;
- une dépendance n'entre que si cette spec la justifie. Liste de la v1 : `astro`, `@astrojs/preact`, `@astrojs/sitemap`, `preact`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `@embedpdf/pdfium`, `fflate`. Outils de développement : `typescript`, `@astrojs/check`, `vitest`, `@playwright/test`, `pdfjs-dist`, `@lhci/cli`, `wrangler`, `@types/node`, `@types/emscripten` ;
- mesurer avant d'optimiser ;
- commentaires en anglais, seulement pour le pourquoi.

## Suite prévue

Le portage du scanner (spec 2 de la version Web), quand `algorithm.md` ne bouge plus ; livré le 3 octobre 2026 ([spec](2026-10-02-web-scanner-design.md)). Puis les outils des phases suivantes, dans l'ordre de la feuille de route, chacun sur la planche et le moteur de cette spec.
