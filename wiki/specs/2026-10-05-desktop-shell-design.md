# Bureau : la coque applicative — design

_Rédigé le 5 octobre 2026. Statut : lot 1 livré le 5 octobre (côté site, puis l'entrée bureau) ; lots 2 et 3 à venir. Suite de [Bureau : coque Tauri sur le code du site](2026-10-05-desktop-tauri-design.md), dont l'étape 1 chargeait le site entier dans la fenêtre._

## Contexte

L'étape 1 de la coque Tauri ouvre le site construit dans la webview du système : 86 pages, l'en-tête et le pied du site, les textes de référencement sous chaque outil, le sélecteur de langue, 63 Mo embarqués. Ça marche, et ça ressemble à un site dans une fenêtre (remarque de l'auteur, 5 octobre 2026).

L'appli Mac en Swift, gelée le 4 octobre, avait la forme juste : une seule fenêtre, l'accueil « Le monastère » en grille par catégories, le champ « Chercher un outil » dans la barre de titre, un écran par outil avec la page à gauche et un panneau fixe à droite, le chevron de retour, ⌘O, une copie enregistrée par le dialogue natif, « Afficher dans le Finder » ([accueil](2026-10-02-mac-home-design.md), [design system Mac](2026-10-01-mac-design-system-design.md)). Elle n'avait ni association de fichiers, ni fichiers récents, ni mise à jour.

Le site a déjà presque tout ce qu'il faut, et les parts sont nettes :

- **Réutilisable tel quel** : la planche (`Board`, `apps/web/src/board/Board.tsx`), seul îlot Preact du site, trois props (`toolId`, `lang`, `monks`), qui ne lit ni l'URL, ni l'historique, ni le titre de la page ; les éditeurs qu'elle charge, dont le Scanner, qui a son propre enregistrement et ses propres questions ; le moteur (`board/engine.ts`) ; les illustrations (`Monk`, `Scene`, `Avatar`, `ToolIcon`) ; `tokens.css` et `fonts.ts` ; les dictionnaires (`dictionaries[lang]`, `boardTexts`, `searchTexts`) ; la recherche (`home/search.ts`, sans DOM).
- **Lié à la page, pas à la planche** : dès 64 rem, et seulement quand des documents sont ouverts (`main:has(.board)`), la planche se fond dans la grille de la page outil (`[tool].astro`), et son panneau se cale sous `--nav-height` ; les globaux de `Base.astro` ; le thème, posé sur `<html data-theme>` par le script inline de `Base.astro` (`tokens.css` n'a pas de règle `prefers-color-scheme`) ; le voile du dépôt, dessiné par `Base.astro`.
- **Astro seulement** : les cartes (`home/ToolCard.astro`), le choix « Je veux… » (`Pick.astro`), les filtres (`home/filters.ts`, du DOM sur le balisage de l'accueil), les pages.

Trois gestes du site n'existent pas dans WKWebView sous wry : le lien `<a download>` est annulé sans gestionnaire de téléchargement (`download.ts`, et l'enregistrement du Scanner dans `ScannerApp.tsx`), `window.open` ne fait rien (« Voir » dans `Result.tsx`), `confirm()` ne s'affiche pas et répond « non » (deux fois dans le Scanner). Le dépôt de fichiers, lui, est intercepté par Tauri tant qu'on ne le lui retire pas.

La pratique courante (VS Code, Obsidian, Linear, Stirling PDF v2 qui passe sur Tauri) : une seule base de composants, deux entrées. Le site marketing d'un côté, la coque applicative de l'autre. On ne cache pas des sections du site : on compose une autre page avec les mêmes briques.

## Principe : une appli du système, pas un site dans une fenêtre

Décision de l'auteur, 5 octobre 2026 : l'appli de bureau se juge comme une appli native de son système. Sur Mac, elle doit se comporter et se présenter comme l'appli Swift gelée le 4 octobre ; sur Windows comme une appli Windows ; sur Linux comme une appli du bureau. Le web est sa technique, pas son allure. Concrètement :

- **La fenêtre est celle du système** : barre de titre intégrée sur Mac, décorations natives ailleurs, taille et position mémorisées, mode sombre et couleur d'accent du système, police système pour les commandes (Bricolage pour les grands titres seulement, comme sur Mac).
- **Les gestes sont ceux du système** : menus dans la langue avec leurs raccourcis (⌘O, ⌘W, ⌘Q, ⌘Z), dialogues natifs pour ouvrir et enregistrer, dépôt de fichiers n'importe où, double-clic dans le Finder ou l'Explorateur, « Afficher dans le Finder », une garde avant de quitter avec un résultat non enregistré.
- **Rien du web ne transparaît** : pas d'en-tête ni de pied de site, pas de texte de référencement, pas de sélecteur de langue, pas d'URL ni de navigation par pages, pas de « télécharger » ni de « nouvel onglet », pas de lien qui remplace l'appli dans sa fenêtre, pas de bouton de thème.
- **Le document est au centre** : il reste ouvert d'un outil à l'autre, et l'appli ne recharge jamais.

Le test : quelqu'un qui connaît l'appli Swift ne doit pas voir la différence dans la première minute, et quelqu'un qui connaît le site ne doit pas y penser. Chaque décision ci-dessous découle de ce principe ; une décision qui le contredit se justifie dans sa ligne, ou ne se prend pas.

## Objectif et critères de réussite

À l'ouverture, Holy PDF pour le bureau est une appli : on reconnaît la marque et le monastère, et rien ne rappelle un site.

La spec est réussie quand :

- la fenêtre s'ouvre sur le monastère, sans en-tête ni pied de site, sans texte de référencement, sans sélecteur de langue, sans lien qui remplace l'appli dans la fenêtre ;
- un outil s'ouvre dans la même fenêtre, planche à gauche et panneau à droite, et le chevron ramène au monastère ; le document courant suit quand on change d'outil, si l'outil suivant l'accepte ;
- ⌘O ouvre le dialogue natif, un fichier lâché n'importe où dans la fenêtre, monastère compris, s'ouvre, un double-clic sur un PDF dans le Finder ouvre l'appli avec lui ;
- un résultat s'enregistre par le dialogue natif, sous le nom que la planche lui donne déjà, Scanner compris, puis « Ouvrir » et « Afficher dans le Finder » marchent ;
- le thème, la langue et la taille de la fenêtre suivent le système, et la fenêtre revient où on l'a laissée ;
- quitter un outil ferme ses documents dans le moteur (un test le compte) ;
- l'appli n'embarque ni les films ni les pages du site ;
- `pnpm desktop:smoke` passe : la page moteur, puis la coque sondée (monastère, un outil, retour) sans violation ni erreur ;
- `pnpm verify` passe, avec les tests des changements faits au site pour la coque.

## Portée

**Dans la spec :** l'entrée bureau (`apps/desktop/app/`), le monastère, l'écran d'outil, la barre de titre, les menus et raccourcis, l'ouverture (dialogue, dépôt, double-clic), l'enregistrement (copie, dialogue natif, ouvrir, afficher, Scanner compris), le thème, la langue, la fenêtre, les liens externes, le poids, la fumée, et les changements du site qu'elle demande.

**Hors spec :** la mise à jour automatique, la signature et la vente (lot 3 de la [spec Tauri](2026-10-05-desktop-tauri-design.md)), traiter un dossier entier, enregistrer sur place, les favoris et les fichiers récents, des préférences (langue ou thème choisis à la main), les vérifications sur Windows et Linux (la coque est écrite pour les trois ; elles viennent avec le lot 3), Turborepo et le paquet partagé.

## Décisions

### La coque

| Sujet | Décision | Raison |
|---|---|---|
| Entrée | `apps/desktop/app/index.html` et `App.tsx` (Preact), construits par Vite dans `dist-app` ; `frontendDist` y pointe | Une appli compose les briques du site ; elle n'en cache pas des morceaux |
| Serveur de développement | `pnpm desktop:dev` lance le serveur Vite de cette entrée par `beforeDevCommand` (`devUrl`, port 1420, `cacheDir` sous `apps/desktop`), après avoir copié les dossiers `ocr/` et `scan/` dans le dossier public du site, que Vite sert en développement | Un serveur à part laisse le `pnpm dev` du site tranquille, et la coque se lance d'une commande |
| Ce qui vient du site | Importé par chemin relatif depuis `apps/web/src`, comme la page de fumée : planche, éditeurs, moteur, illustrations, `tokens.css`, `fonts.ts`, dictionnaires, `home/search.ts` | Sans copie. Le paquet partagé viendra avec Turborepo, après la question `Packages/` vs `packages/` ([feuille de route](../product/roadmap.md)) |
| Preact | `@preact/preset-vite` et `preact` dans `apps/desktop`, à la version exacte du site, `resolve.dedupe: ["preact"]` ; `compat` comme le site (`dnd-kit` importe `react`) ; `app/` entre dans `tsconfig.json` avec `jsxImportSource` | La page de fumée n'a pas de JSX ; deux copies de Preact casseraient les hooks |
| Ce qui est propre à l'appli | Le monastère en Preact (`Monastery.tsx` : cartes depuis `cast`, `toolNames`, `toolShort`, `monks`, `upcoming`), la barre de titre, l'écran d'outil et sa grille, la recherche en mémoire, l'enregistreur natif, les textes de l'appli, `app.css` | `ToolCard.astro`, `Pick.astro` et `filters.ts` sont de l'Astro et du DOM écrits pour une page : les réécrire en Preact coûte moins que les rendre partageables, et la carte tient en trente lignes |
| Textes | Chaque texte vit avec le code qui l'affiche, français et anglais, aux règles du site (« vous », espace insécable à l'intérieur des « ») : les écrans propres à l'appli dans `app/texts.ts` ; les mots de la page de résultat et l'erreur d'écriture dans `i18n/fr.ts` et `en.ts` ; la question du Scanner dans `scanner/texts.ts` ; les menus dans `lib.rs`. Voir « Textes » plus bas | `Result` et le Scanner sont du code du site, qui n'importe rien de l'appli ; les menus sont construits en Rust avant la page |
| Navigation | Un état dans `App.tsx` : le monastère, ou un outil. Pas de routeur, pas d'URL. Le chevron ← de la barre et ⌘[ ramènent au monastère ; le titre de la fenêtre dit « Holy PDF » ou le nom de l'outil (`setTitle`). La planche est montée avec `key={toolId}` | La pile de navigation du Mac. La planche ne lit pas l'URL ; une clé par outil garantit un démontage propre |
| Langue et système | Rust lit la langue (`sys-locale`) et le système (`std::env::consts::OS`) et les donne à la page par un script d'initialisation (`window.__HOLY__ = { lang, os }`) ; `fr` si la langue commence par `fr`, `en` sinon | Les menus sont construits en Rust et doivent être dans la langue ; `navigator.language` dans WKWebView n'est pas garanti suivre le système |
| Thème | `data-theme` suit `prefers-color-scheme`, en direct ; pas de bouton | Le script de `Base.astro` n'est pas là ; une appli suit le système. Le choix à la main vient avec les préférences |
| Fenêtre | Minimale 64 rem × 680 px (1 024 × 680), par défaut 1 280 × 840 ; greffon `window-state` pour la taille et la position | Sous 64 rem la planche reprend son panneau flottant de page web ; une appli revient où on l'a laissée |
| Barre de titre | Mac : `title_bar_style: Overlay`, `hidden_title`, feux de signalisation décalés ; la barre de l'appli (52 px, `data-tauri-drag-region="deep"`) porte le chevron, le titre et, à droite, le champ « Chercher un outil ». Windows et Linux : décorations du système, la même barre sans décalage. `--nav-height` vaut 52 px, fixe | La barre de titre intégrée est le signe le plus visible d'une appli Mac ; `deep` fait glisser toute la barre, pas seulement son fond. La planche cale son panneau sur `--nav-height` |
| Menus | Rust, libellés dans la langue : le menu de l'appli (À propos ; sur Mac, Services, Masquer, Masquer les autres, Tout afficher ; Quitter), Fichier (Ouvrir… ⌘O, Fermer ⌘W), Édition (Annuler ⌘Z, Rétablir ⇧⌘Z, puis couper, copier, coller, tout sélectionner, prédéfinis), Fenêtre, Aide (Site, Code source, FAQ dans le navigateur ; Licences au lot 3). Ouvrir, Annuler et Rétablir émettent un événement à la page ; Fermer et Quitter sont traités en Rust jusqu'au lot 2, où la garde les fera passer par la page | Les entrées prédéfinies ont des libellés anglais. Annuler prédéfini envoie `undo:` à WebKit, que la planche n'entend pas : l'entrée de l'appli l'envoie au champ actif (`execCommand`) ou à la planche, jamais aux deux. Le Scanner répond déjà à ⇧⌘Z. Quitter prédéfini ne pose aucune question |
| Liens externes | `on_navigation` n'accepte que l'origine de l'appli et `devUrl` ; `http(s)` et `mailto` partent dans le navigateur par `opener.open_url`, tout autre schéma est bloqué. `on_new_window` fait de même pour `window.open` | Un lien ne doit jamais remplacer l'appli dans sa fenêtre ; un `file://` lâché ne doit pas non plus sortir |
| Capacités | `core:default` plus `core:window:allow-set-title` et `allow-start-dragging` ; `dialog:default` ; `fs:allow-read-file` et `fs:allow-write-file` (les chemins choisis dans un dialogue entrent dans le périmètre `fs`) ; `opener:default` (qui couvre « Afficher dans le Finder ») plus `opener:allow-open-path` sur `$HOME/**` et `/Volumes/**` ; `window-state:default`. La fermeture gardée du lot 2 ajoutera `allow-close` et `allow-destroy` | `core:window:default` n'a aucun réglage : le titre et le glisser de la barre en ont besoin. Le périmètre d'`opener` est une liste fixe dans la capacité, sans ajout à l'exécution comme `fs` : le dossier personnel et les volumes externes couvrent ce que le dialogue d'enregistrement propose |
| CSP | Politique fixe dans `tauri.conf.json`, avec `dangerousDisableAssetCspModification` : `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' ipc: http://ipc.localhost; worker-src 'self' blob:; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'`. `build.rs` perd le balayage des scripts inline du site | L'entrée de l'appli n'a aucun script inline : Vite les met dans des fichiers, et les hachages de l'étape 1 n'ont plus d'objet. Le seul style inline est celui des polices, que `main.tsx` injecte et que `'unsafe-inline'` autorise |
| Poids | `dist-app` = ce que Vite empaquette (planche, éditeurs, moteur : PDFium 4,6 Mo, qpdf 2,2 Mo, polices) plus `ocr/`, `scan/` et `licenses/` copiés depuis `apps/web/public` à la fin de la construction (`writeBundle`, `copyPublicDir: false`), parce que `tesseract.ts` et `scanWorker.ts` les lisent par chemin absolu sur l'origine. En développement, `publicDir` pointe sur `apps/web/public`. Les scripts `copy-ocr.mjs` et `copy-scan.mjs` du site, qui remplissent ces dossiers, tournent avant `desktop:dev` et `desktop:build` | Pas de films, pas de pages. Mesuré le 5 octobre : 41 Mo, dont 18 pour les trois cœurs Tesseract et leurs langues, 15 pour OpenCV et libheif, 7,5 pour l'appli ; contre 63 pour le site entier. Un seul cœur Tesseract viendra plus tard |
| Polices | `main.tsx` pose les deux liens de préchargement (`preloadedFonts`, les mêmes fichiers hachés que `fonts.ts` importe) puis injecte `fontFaces` | `fonts.ts` n'exporte que des chaînes, c'est `Base.astro` qui les écrit, et un `index.html` statique ne lit pas un export ; avec `font-display: optional`, une police ratée au premier rendu manque toute la session, le préchargement l'évite |
| Globaux | Passent dans `apps/web/src/styles/base.css`, importé par `Base.astro` et par l'appli : `box-sizing`, `body` (fond, encre, police), `button { font: inherit }`, `a` et `a:hover`, la transition de `:where(a, button, summary, label)`, `.scroll`, `.drop-overlay`, `.visually-hidden`, `:focus-visible`, les titres, `.highlight`, `.lift`, la règle « réduire les animations ». Restent dans `Base.astro` : `--nav-top`, `--nav-height` et ses valeurs au défilement, le `padding-top` du `body`, la largeur de `main`, `.tool-glyph`, la requête à 75 rem | Deux copies divergeraient en silence ; les boutons de la planche comptent sur la transition commune ; les règles de la barre du site ne concernent que lui |
| Fumée | `--smoke` seul garde la page moteur ; `--smoke app` charge l'appli sous une sonde (`smoke/app-probe.js`) qui rapporte le monastère, ouvre Compresser par sa carte, rapporte l'écran d'outil, revient par le chevron et rapporte encore : trois rapports, chacun sans violation ni erreur ; `smoke:site` devient `smoke:app`. Codes 0, 1, 2 et 3 inchangés | Sans URL, la liste de pages de l'étape 1 n'a plus de sens ; les gestes de la sonde remplacent les liens |

### La planche dans la coque

| Sujet | Décision | Raison |
|---|---|---|
| Écran d'outil | Le haut de page du site (nom de l'outil et son émoji, la phrase du moine), puis la planche. Dès que des documents sont ouverts (`main:has(.board)`, la condition du site), la grille `"head panel" auto "work panel" 1fr / minmax(0, 1fr) 27.5rem` de `[tool].astro` sans les sections du dessous. Sinon (planche vide, résultat, Scanner), une colonne. Le haut de page se compacte et la phrase se cache sous `.board` comme sous `.result`, la règle du site | Sans la condition, la carte vide, la page de résultat et le Scanner tomberaient à côté d'une colonne de panneau vide |
| Recherche | ⌘F et ⌘K activent le champ. Sur le monastère, il filtre les cartes en direct ; Entrée ouvre le meilleur résultat. Sur un écran d'outil, il ouvre une palette flottante avec les mêmes résultats, Échap la ferme. Règles et mots de `home/search.ts` et `searchTexts` ; une demande faite de mots vides (« pdf », « le ») laisse le monastère en place, comme sur le site ; la construction de l'index, écrite aujourd'hui dans la route `search.json.ts`, passe dans `home/index.ts` que la route et l'appli appellent | Une seule source pour les mots, règle déjà posée pour le Mac. ⌘F est celui du Mac, ⌘K celui des applis de bureau d'aujourd'hui |
| Props nouvelles de la planche | `files`, `saver`, `confirm` et `onDocumentChange`, toutes facultatives, avec leur valeur par défaut dans la planche | Astro ne passe pas de fonction à un îlot : le site monte la planche comme aujourd'hui |
| Fichiers reçus par la planche | `files`, réactive : chaque nouveau tableau passe par `addFiles` ; un outil à un fichier remplace le sien, comme quand on en choisit un autre | Une prop lue au montage seul n'atteindrait pas une planche déjà à l'écran (⌘O sur un outil ouvert) |
| Ce que la planche tient | `onDocumentChange({ files, unsaved })` : les fichiers du document courant (le résultat s'il existe, sinon les sources) et s'il reste un résultat non enregistré. Le Scanner y contribue avec son propre état. Un résultat passé à l'outil suivant sans avoir été enregistré reste `unsaved` | La coque fait suivre le document d'un outil à l'autre et garde la fermeture ; les sources seules seraient fausses après Compresser ; une copie jamais enregistrée ne doit pas se perdre en silence |
| Le document suit | En changeant d'outil (palette, ou chevron puis carte), la coque donne à l'outil suivant les fichiers du document courant qu'il accepte (`accepts`, `multipleFiles`) ; un outil qui n'en accepte aucun part vide. « Retour » et « Recommencer » dans la planche abandonnent le résultat sans question, comme sur le site | Sur le bureau on travaille un document : compresser, puis signer la copie |
| Nettoyage au démontage | La planche ferme ses documents du moteur et la couche de superposition, et oublie ses vignettes, quand elle se démonte | Le site repart de zéro à chaque page ; l'appli ne recharge jamais. Aujourd'hui les documents ne se ferment que dans `addFiles`, `remove` et `startOver` |
| Enregistreur | `board/deliver.ts` définit un enregistreur : `kind` (`download` ou `save`) et `save(bytes, name, type)`, qui rend l'une de trois issues, enregistré à un chemin, téléchargé, ou annulé ; par défaut, le téléchargement actuel. La planche le reçoit en prop (`saver`) et le passe à `Result` et au Scanner, qui enregistre par lui aussi ; le mot des boutons suit `kind` (« Télécharger » ou « Enregistrer… ») | Sans gestionnaire, wry annule le lien `<a download>`, celui de `download.ts` comme celui du Scanner. Un dialogue annulé n'est pas un téléchargement : `unsaved`, « Enregistré » et l'état enregistré du Scanner en dépendent. Le Scanner ne doit pas importer le lot de la planche (`ScannerApp.tsx`) : une prop, comme le moteur et le squelette qu'il reçoit déjà |
| Enregistrer dans la coque | L'enregistreur de la coque : dialogue `save` du greffon `dialog`, nom proposé par la planche (`fileName.ts`), dernier dossier mémorisé (Documents au début), écriture par `fs.writeFile`, chemin rendu. Plusieurs fichiers restent un zip, un seul dialogue | Un dialogue depuis Rust dans `on_download` bloquerait la boucle principale |
| Après l'enregistrement | La page de résultat montre « Enregistré », le nom du fichier, « Ouvrir » (`opener.openPath`) et « Afficher dans le Finder » (`revealItemInDir`). « Voir » est masqué. Une erreur d'écriture s'affiche sur la ligne d'indication de la page de résultat (celle des erreurs d'aujourd'hui), avec un texte nouveau | Le geste du Mac après chaque copie. `window.open` ne fait rien dans WKWebView ; le moine de la page de résultat a une humeur fixe |
| Questions du Scanner | Un dialogue de la planche à message et deux libellés (`ConfirmDialog`), donné au Scanner en prop (`confirm`) comme l'enregistreur ; ses deux `confirm()` l'utilisent, avec les libellés de chaque question dans `scanner/texts.ts` (la question avant d'enregistrer suit `kind` : « Télécharger quand même ? » ou « Enregistrer quand même ? », Annuler / Télécharger ou Enregistrer) | wry n'affiche pas `confirm()` sur Mac : la question ne s'affiche pas et la réponse est « non ». `RemoveDialog` de la planche est lié à un document et à ses deux libellés |
| Ouvrir par le bouton | Le bouton de la planche garde son `<input type=file>` : dans WKWebView, wry ouvre le panneau natif (sans tenir compte de `accept`) | Rien à changer |
| Ouvrir par ⌘O | ⌘O et Fichier › Ouvrir… passent par le greffon `dialog` (filtres PDF, JPEG, PNG, HEIC), puis `fs.readFile`, et donnent les fichiers à la planche par `files` ou, sur le monastère, à l'état « fichiers arrivés » | Un `click()` sur l'entrée de fichier depuis un menu n'a pas de geste utilisateur |
| Dépôt | La coque appelle `disable_drag_drop_handler()`. Sur un écran d'outil, le dépôt arrive à `useFileDrop` comme sur le site ; sur le monastère, `App.tsx` appelle `useFileDrop` lui-même et dessine le voile | Tauri intercepte le dépôt et ne donne que des chemins, Mac compris ; la planche attend des `File`. Seule la planche empêche aujourd'hui la navigation du navigateur vers le fichier lâché, et le voile vient de `Base.astro` |
| Fichiers arrivés sur le monastère | Quand des fichiers arrivent (dépôt, ⌘O, double-clic) ou quand le chevron revient avec un document ouvert : sous le titre, « 3 fichiers prêts. Choisissez un outil. » et « Changer de fichiers » ; les cartes qui n'acceptent pas ces fichiers sont grisées (`aria-disabled`, dans l'ordre du clavier mais sans effet). Une carte ouvre son outil avec les fichiers qu'il accepte ; ⌘O depuis un outil donne tout à la planche, qui dit elle-même ce qu'elle refuse | Le monastère oriente, comme l'ancienne zone de dépôt de l'accueil du site |
| Double-clic | `bundle.fileAssociations` (PDF, JPEG, PNG, HEIC) avec `rank: "Alternate"`. Mac : `RunEvent::Opened { urls }` ; Windows et Linux : les arguments, et le greffon `single-instance` relaie ceux d'un second lancement. Rust ajoute chaque chemin au périmètre `fs` et le garde jusqu'à ce que la page le demande (`invoke("take_opened")` au démarrage, puis un événement). Un outil ouvert qui accepte ces fichiers les reçoit par `files` ; sinon ils vont au monastère | L'appli ne doit pas devenir le lecteur de PDF par défaut ; les chemins hors dialogue ne sont pas dans le périmètre `fs` ; un lancement à froid livre le fichier avant que la page écoute |
| Garde à la fermeture | Fermer (⌘W, bouton rouge : `onCloseRequested`) et Quitter (⌘Q, entrée de l'appli) demandent « Le résultat de Compresser n'est pas enregistré. » (Garder / Quitter) quand `unsaved` est vrai ; sinon la fenêtre se ferme et l'appli quitte | Le Mac avait cette garde ; `beforeunload` du Scanner ne s'affiche pas dans WKWebView |
| Garde au changement d'outil | Le chevron puis une carte, ou la palette, ne demandent rien quand l'outil suivant prend le résultat : il suit. Quand il ne le prend pas, « Le résultat de Compresser n'est pas enregistré. » (Rester / Changer d'outil) | Compresser puis Signer est le parcours normal, pas une perte ; la question ne vient que si le résultat serait abandonné |

### Écarté

| Option | Raison |
|---|---|
| Cacher les sections du site par CSS (`data-desktop`) | Les textes restent dans le DOM, le modèle page par outil et les 63 Mo aussi ; l'effet « site embarqué » resterait |
| Une barre latérale permanente des outils | Trois colonnes (barre, table, panneau) ne tiennent pas dans 1 024 px ; le monastère et la palette ⌘K font le même travail. À revoir si l'usage le demande |
| Rendre `ToolCard.astro` partageable | Une carte Preact de trente lignes contre une migration des pages du site |
| Un enregistreur en module partagé (`setSaver`) | Le Scanner devrait importer le lot de la planche, que `ScannerApp.tsx` interdit |

## Écrans

### Le monastère

- **Barre** : à gauche, rien (les feux sur Mac) ; au centre, « Holy PDF » ; à droite, le champ « Chercher un outil ». Toute la barre déplace la fenêtre.
- **Haut** : le titre en Bricolage, surligné comme le Mac, et la phrase de confiance. Pas de tampon, pas de zone de dépôt dessinée : la fenêtre entière reçoit les fichiers, avec le voile « Lâchez, je m'en occupe. ».
- **Les catégories** : Organiser, Convertir, Modifier, Optimiser, Sécurité, dans l'ordre et avec les noms du site (`cast.ts`, `categories`). Chaque carte reprend la carte du site : bandeau de 150 px sur la teinte de la catégorie avec le moine (112 px) et sa scène, le nom du moine en légende, le nom de l'outil, une phrase. Toute la carte est un bouton ; au survol, elle se soulève comme sur le site (`.lift`). Grille adaptative, trois cartes par rangée à 1 024 px, quatre dès 80 rem.
- **Bientôt** : l'outil à venir (`upcomingIds`) sous sa catégorie, l'icône au trait de l'outil et l'étiquette « Bientôt · en méditation », comme la carte du site, non cliquable.
- **Recherche** : dès un mot utile, les catégories laissent la place aux moines trouvés, du meilleur au moins bon, avec la ligne « 3 moines · « réduire » → Compresser » du site. Rien trouvé : « Aucun moine ne fait ça… pour l'instant », la phrase du site et « Voir tous les moines ».
- **Fichiers arrivés** (dépôt, ⌘O, double-clic) : l'état décrit plus haut.

### L'écran d'outil

- **Barre** : le chevron ← « Monastère », le nom de l'outil, le champ de recherche (palette).
- **Haut de page** : le nom de l'outil et son émoji en titre, la phrase du moine (`monks[id].intro`), alignés à gauche, compacts : le haut de page du site en mode atelier, où la phrase se cache dès que des documents sont ouverts.
- **La planche** : vide, c'est la carte en pointillés du site avec son moine et son bouton « Choisir des PDF » ; avec des documents, la table à gauche et le panneau à droite, collé au bord droit sous la barre, comme l'atelier du site. Rien sous la planche : ni « Comment faire », ni FAQ, ni autres moines.
- **Résultat** : la page de résultat du site, avec « Enregistrer… » en bouton principal. Une fois enregistré : « Enregistré », le nom du fichier, « Ouvrir », « Afficher dans le Finder ». « Retour » revient à la table avec les fichiers.
- **Changer d'outil** avec un document ouvert : par la palette ou par le chevron puis une carte. Les fichiers acceptés par l'outil suivant l'y attendent ; si l'outil suivant ne prend pas un résultat non enregistré, la question « Rester / Changer d'outil » se pose.

### Enregistrer

1. « Enregistrer… » ouvre le dialogue natif, dans le dernier dossier utilisé (ou Documents), avec le nom que la planche donne au téléchargement sur le site.
2. L'écriture passe par `fs.writeFile`. Une erreur (dossier en lecture seule, disque plein) s'affiche sur la ligne d'indication de la page de résultat : « L'enregistrement a échoué : » et la raison donnée par le système.
3. Le chemin enregistré sert à « Ouvrir » et « Afficher dans le Finder ».
4. Plusieurs fichiers (Diviser, PDF en JPG) : un zip, un dialogue. Un dossier de sortie avec des fichiers numérotés, comme le Mac, vient au lot 2.
5. Le Scanner enregistre par le même enregistreur, avec son nom actuel.

## Textes

Français puis anglais, chacun dans le fichier du code qui l'affiche :

| Où | Clé | Français | Anglais |
|---|---|---|---|
| `app/texts.ts` | Titre du monastère, Mac | « Vos PDF, sur votre Mac 🙏 » (« sur votre Mac » surligné) | "Your PDFs, on your Mac 🙏" |
| `app/texts.ts` | Titre, Windows | « Vos PDF, sur votre PC 🙏 » | "Your PDFs, on your PC 🙏" |
| `app/texts.ts` | Titre, Linux | « Vos PDF, sur votre ordinateur 🙏 » | "Your PDFs, on your computer 🙏" |
| `app/texts.ts` | Phrase de confiance | « Tout est traité ici : rien n'est envoyé. » | "Everything happens here: nothing is sent." |
| `app/texts.ts` | Chevron | « Monastère » | "Monastery" |
| `app/texts.ts` | Fichiers arrivés | « 3 fichiers prêts. Choisissez un outil. », « Changer de fichiers » | "3 files ready. Pick a tool.", "Change files" |
| `app/texts.ts` | Garde | « Le résultat de Compresser n'est pas enregistré. », « Garder », « Quitter », « Rester », « Changer d'outil » | "The result of Compress is not saved.", "Keep", "Quit", "Stay", "Switch tool" |
| `i18n/fr.ts`, `en.ts` | Page de résultat | « Enregistrer… », « Enregistré », « Ouvrir », « Afficher dans le Finder » (« dans l'Explorateur », « dans le dossier » sur Linux) | "Save…", "Saved", "Open", "Show in Finder" ("in Explorer", "in folder") |
| `i18n/fr.ts`, `en.ts` | Erreur d'écriture | « L'enregistrement a échoué : » | "Saving failed:" |
| `scanner/texts.ts` | Question avant d'enregistrer | « Enregistrer quand même ? », « Annuler », « Enregistrer » | "Save anyway?", "Cancel", "Save" |
| `lib.rs` | Menus | « Fichier », « Ouvrir… », « Fermer », « Édition », « Annuler », « Rétablir », « Couper », « Copier », « Coller », « Tout sélectionner », « Fenêtre », « Réduire », « Aide », « Site », « Code source », « Questions fréquentes », « À propos de Holy PDF », « Services », « Masquer Holy PDF », « Masquer les autres », « Tout afficher », « Quitter Holy PDF » | "File", "Open…", "Close", "Edit", "Undo", "Redo", "Cut", "Copy", "Paste", "Select All", "Window", "Minimize", "Help", "Website", "Source code", "FAQ", "About Holy PDF", "Services", "Hide Holy PDF", "Hide Others", "Show All", "Quit Holy PDF" |

Le reste vient du site quand le site l'a déjà (« Chercher un outil », « Aucun moine ne fait ça… pour l'instant », « Voir tous les moines », « Lâchez, je m'en occupe. », les noms et les phrases des outils).

## Structure

```
apps/desktop/
  app/
    index.html        #app et le script main.tsx
    main.tsx          lit window.__HOLY__, pose lang et data-theme, précharge et injecte les polices, monte App
    App.tsx           l'état d'écran, le document qui suit, les événements des menus, la garde, le dépôt du monastère
    Titlebar.tsx      chevron, titre, champ de recherche et palette
    Monastery.tsx     catégories, cartes, moine endormi, résultats, fichiers arrivés
    ToolScreen.tsx    haut de page, grille de l'atelier sous condition, Board avec key, files, saver, onDocumentChange
    saver.ts          dialog, fs, opener : l'enregistreur de la coque
    files.ts          les fichiers qu'un outil accepte (par le nom : un fichier lu depuis un chemin n'a pas de type)
    shell.ts          ce que Rust a donné : langue, système
    texts.ts          les textes de l'appli, fr et en
    app.css           barre, grille, monastère, sur les tokens du site
  smoke/app-probe.js  la sonde de `--smoke app`
  vite.config.ts      deux modes (app, smoke), preset Preact, publicDir du site en dev, copie de ocr/, scan/, licenses/ à la construction
  tsconfig.json       + app/, jsxImportSource preact
  src-tauri/
    build.rs          tauri_build::build() seul
    src/lib.rs        langue et système, barre de titre, menus, on_navigation, on_new_window, dépôt natif coupé, fumée ; Opened et take_opened au lot 2
    capabilities/default.json
    tauri.conf.json   frontendDist ../dist-app, devUrl 1420, csp fixe, plugins ; fileAssociations au lot 2
apps/web/src/
  styles/base.css     les globaux sortis de Base.astro
  layouts/Base.astro  importe base.css, garde les règles de la barre
  board/Board.tsx     props facultatives files, saver, confirm, onDocumentChange ; nettoyage au démontage
  board/deliver.ts    le type de l'enregistreur, ses trois issues, le téléchargement par défaut
  board/Result.tsx    Télécharger ou Enregistrer… selon kind, Enregistré, Ouvrir, Afficher, ligne d'erreur
  board/ConfirmDialog.tsx   message et deux libellés
  scanner/            saver et confirm en props, plus de confirm() ni de lien de téléchargement ; scanner/texts.ts
  home/index.ts       la construction de l'index, appelée par search.json.ts et par l'appli
  i18n/fr.ts, en.ts   les mots de la page de résultat et l'erreur d'écriture
```

## Lots

1. **La coque** : l'entrée, Preact, le monastère et son dépôt, l'écran d'outil, la barre, les menus et ⌘O, la recherche, la langue et le système, le thème, la fenêtre mémorisée, les liens externes, l'enregistreur (page de résultat et Scanner), le dialogue du Scanner, le nettoyage au démontage, `base.css`, les polices, la CSP fixe, la fumée `app`, la copie des dossiers, la mesure du poids. À la fin du lot, on ouvre un PDF par le bouton, par ⌘O ou par dépôt, on le travaille, on enregistre la copie et on l'ouvre : l'appli est utilisable.
2. **Les fichiers** : le double-clic, « Ouvrir avec » et le second lancement, le document qui suit d'un outil à l'autre (le Scanner annonce alors ses pages, pas toutes les photos reçues), la garde à la fermeture, le dossier de sortie pour Diviser et PDF en JPG, et le worker du Scanner terminé au démontage (il fuit à chaque visite, sur le site comme dans la coque).
3. **La distribution** : le lot 3 de la [spec Tauri](2026-10-05-desktop-tauri-design.md) (mise à jour, signature, vente), Aide › Licences (les textes de `licenses/` dans un panneau de l'appli), puis les vérifications sur Windows et Linux.

## Limites connues

- Plusieurs fichiers sortent en zip au lot 1.
- Pas de fichiers récents, pas d'enregistrement sur place, pas de préférences.
- La langue et le thème suivent le système seulement.
- La fenêtre fermée quitte l'appli (le Mac la gardait ouverte en arrière-plan).
- Quitter depuis le Dock ne pose pas la question de la garde : macOS termine l'appli sans passer par la page.
- Au lot 1, « Fermer » et « Quitter » ne posent pas encore la question de la garde, et le document ne suit pas encore d'un outil à l'autre : la planche les annonce (`onDocumentChange`), la coque ne les écoute qu'au lot 2. Changer d'outil par la palette ou le chevron abandonne donc un résultat non enregistré sans question.
- « Ouvrir » et « Afficher dans le Finder » ne marchent que sous le dossier personnel et `/Volumes` : ailleurs, l'erreur s'affiche sur la ligne de la page de résultat alors que le fichier est bien enregistré.

## Tests

| Niveau | Quoi | Où |
|---|---|---|
| Site, unitaires | Les tests du site tournent sans DOM : la logique nouvelle est dans des fonctions pures. `documentOf` donne les sources tant que rien n'est fait, puis le résultat en fichiers, `unsaved` tant qu'il n'est pas enregistré ; `release` ferme chaque document et la couche dans un moteur factice et révoque les aperçus ; l'enregistreur par défaut télécharge et rend « téléchargé » ; `searchIndex` liste chaque outil, prêts d'abord, avec noms, mots et libellé. Le reste (props de la planche, `Result`, le Scanner et son dialogue) est couvert par les parcours e2e | `apps/web/tests/unit/document.test.ts`, `deliver.test.ts`, `searchIndex.test.ts` |
| Site, e2e | Les parcours existants passent avec `base.css`, l'enregistreur par défaut et le dialogue du Scanner | `pnpm verify` |
| Appli, types | `tsc --noEmit` sur `app/` et `smoke/` | `pnpm --filter @holy-pdf/desktop check` |
| Appli, fumée | Page moteur ; puis le monastère, Compresser par sa carte, retour, sans violation ni erreur | `pnpm desktop:smoke` |
| À la main | Ouvrir par ⌘O, par dépôt sur le monastère et sur un outil, par double-clic ; enregistrer, Ouvrir, Afficher dans le Finder ; le Scanner enregistre et pose sa question ; mode sombre ; fenêtre retrouvée ; un lien externe part dans le navigateur ; ⌘Q avec un résultat non enregistré ; Compresser puis Signer sans question, puis Compresser puis JPG en PDF avec la question ; ⌘Z dans un champ de texte annule la frappe, ⌘Z sur la planche annule la retouche, jamais les deux | `wiki/development/tests.md`, section Bureau |
