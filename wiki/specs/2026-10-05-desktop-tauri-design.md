# Bureau : coque Tauri sur le code du site

_Rédigé le 5 octobre 2026. Statut : preuve livrée dans `apps/desktop`, puis le site construit chargé dans la coque le même jour (étape 1) ; les fonctions de bureau viennent ensuite._

## Contexte

Le 4 octobre 2026, l'appli Mac en Swift est gelée : deux moteurs (PDFKit sur Mac, PDFium et qpdf en WebAssembly sur le site) doublaient chaque fonction. Le bureau se fera en Tauri 2 sur le code du site, pour Mac et Windows d'abord, Linux ensuite. Avant d'écrire l'appli, une question devait être tranchée : le moteur du site tourne-t-il dans la webview du système, avec ses workers et ses fichiers WebAssembly, servis par le protocole de Tauri ?

## Ce que la preuve établit

`apps/desktop/smoke/` est une page construite par Vite 8 (la version que le site utilise) depuis les sources du site (`apps/web/src/engine/client.ts` et son worker, importés par chemin relatif, sans copie), types vérifiés par `tsc`. La coque Tauri la charge sous la CSP cible de l'appli (`script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:`), la page enchaîne cinq opérations et renvoie son rapport JSON à Rust par `invoke("smoke_report")`. Rust le désérialise et sort avec 0 seulement si les cinq étapes sont présentes et réussies ; 1 sinon ; 2 si rien n'arrive en 120 s. Depuis l'étape 1, cette page ne se charge que si le binaire est lancé avec `--smoke` (script `smoke:engine`, qui le compile avec `tauri.smoke.conf.json`) ; l'appli ordinaire ne la connaît pas.

| Étape | Ce qu'elle vérifie | Résultat (macOS 26.4.1, 5 octobre 2026) |
|---|---|---|
| Ouvrir un PDF de deux pages avec PDFium | les deux tailles, 200×100 et 100×200 | juste |
| Rendre une page en JPEG | un blob non vide | 909 octets |
| Réparer avec qpdf | deux pages après réécriture | juste (cette étape a un repli PDFium : elle ne prouve pas qpdf seule) |
| Compresser | passe par le worker qpdf imbriqué dans le worker moteur, sans repli | 510 octets |
| Tourner la première page par `export`, rouvrir la copie | la première page mesure 100×200 après rotation | juste, 671 octets |

Les cinq passent en 338 ms sur le binaire compilé, où la page est servie par `tauri://localhost` (le protocole des applis distribuées), et en 118 ms sous `tauri dev`, où elle est servie par un serveur HTTP local. La webview est WKWebView. Donc : module workers, workers imbriqués, chargement des deux `.wasm` et transfert de `ArrayBuffer` marchent dans les deux modes ; la CSP cible est vérifiée sur le binaire seulement, parce que sous `tauri dev` la page vient du serveur HTTP de la CLI. Le chemin d'échec est montré aussi : une page à quatre étapes sous un verdict qui en attend cinq a rendu le code 1 par `tauri dev --no-watch` comme par le binaire.

## Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Coque | Tauri 2, `apps/desktop`, identifiant `com.snouzylabs.holypdf` | Une dizaine de Mo, webview du système, un seul code pour Mac, Windows et Linux ; voir la [feuille de route](../product/roadmap.md) |
| Code partagé | Importé depuis `apps/web/src` par chemin relatif, tant qu'il n'y a pas de paquet `engine` séparé | Le workspace pnpm résout les dépendances depuis `apps/web` ; un paquet partagé viendra avec Turborepo, après avoir réglé la casse `Packages/` vs `packages/` |
| Preuve | Une page de test, pas l'appli, chargée depuis `dist-smoke` | Elle isole la question du moteur de celle de l'interface, et se relance d'une commande : `pnpm --filter @holy-pdf/desktop smoke` |
| Verdict | Une commande Rust désérialise le rapport et sort par `app.exit` avec 0 seulement si les cinq étapes attendues sont réussies | WKWebView n'a pas de WebDriver sur Mac : le code de sortie est le seul canal qu'un script peut lire ; compter les étapes évite qu'un rapport partiel passe |
| Garde-fous | La page se donne 90 s puis rend un verdict négatif ; Rust sort avec 2 après 120 s sans rapport | Un worker qui ne démarre pas ne lève rien côté page, et une page qui ne charge pas n'appelle jamais Rust |
| Icônes | Générées par `tauri icon` depuis `apps/web/public/favicon.svg` rendu en PNG | L'auréole est le logo ; les icônes par défaut de Tauri ne doivent pas apparaître dans le dépôt |
| Nom du binaire | `HolyPDF` (`[[bin]]` dans `Cargo.toml`), le paquet restant `holy-pdf` | Sans bundle, sous `tauri dev`, macOS nomme l'appli dans le Dock et la barre des menus d'après le fichier exécutable : ni le `CFBundleName` que Tauri embarque, ni `setProcessName` ne comptent (vérifié avec `lsappinfo`, 5 octobre). Cargo refuse l'espace ; l'appli construite s'appelle « Holy PDF » (`productName`) |
| Outils | Rust via rustup, Tauri CLI, Vite et TypeScript épinglés en dépendances du paquet | `tauri dev` appelle `cargo` par le PATH : `~/.cargo/bin` doit y être (rustup l'y met par défaut) ; `pnpm install` à la racine suffit côté JS |

## Étape 1 : le site dans la coque (5 octobre 2026)

> Dépassée le soir même : la coque charge désormais une entrée dédiée composée avec les briques du site, et `--smoke app` remplace la sonde par pages ([spec de la coque applicative](2026-10-05-desktop-shell-design.md)). Ce qui suit reste vrai pour la CSP, le dépôt et le harnais ; `frontendDist`, `devUrl` et la liste de pages ne le sont plus.

`frontendDist` pointe sur `apps/web/dist`, que `beforeBuildCommand` reconstruit (`pnpm --filter @holy-pdf/web build`, 2,7 s). `pnpm desktop:dev` ouvre le serveur de développement du site (`devUrl`, port 4321), qui doit déjà tourner : pas de `beforeDevCommand`, parce qu'un second `astro dev` dans le même dossier partagerait le cache Vite du premier et le casserait. `pnpm desktop:build` produit l'appli ; le binaire de débogage pèse 59 Mo, `dist` embarqué en entier.

La fenêtre est construite en Rust (`WebviewWindowBuilder`), pas dans `tauri.conf.json` : `dist` n'a pas d'`index.html` à la racine (Cloudflare envoie `/` vers `/en`), donc la coque ouvre `fr` quand la langue du système commence par `fr`, `en` sinon (crate `sys-locale`). Les menus macOS (Édition, Fenêtre, Quitter) sont ceux que Tauri pose par défaut.

**CSP.** Tauri autorise les scripts inline d'une page en hachant ceux de cette page seule dans sa politique. Or l'accueil et les pages d'outil utilisent le `ClientRouter` d'Astro : la page suivante arrive sans rechargement, et ses scripts, inconnus de la politique de la première, seraient refusés. De plus, les hachages de styles que Tauri ajoute rendent `'unsafe-inline'` caduc, ce qui bloquerait les attributs `style=` du site (436 sur l'accueil). Donc `build.rs` calcule les hachages SHA-256 de tous les scripts inline de `dist` (7 distincts pour 87 pages ; JSON-LD exclu), écrit la politique entière dans `TAURI_CONFIG` pour le codegen, et pose `dangerousDisableAssetCspModification` : la politique est la même pour toutes les pages, `script-src 'self' 'wasm-unsafe-eval'` plus ces hachages, `style-src 'self' 'unsafe-inline'`, `connect-src 'self' ipc: http://ipc.localhost` pour le protocole d'appel de Tauri (sans quoi chaque `invoke` passe par son repli `postMessage`, après une violation), `object-src 'none'` et `base-uri 'none'`. Tauri n'envoie cette politique qu'avec les documents HTML : les workers tournent sans politique, et le worker du Scanner compte dessus (`new Function` dans `scanWorker.ts`).

**Fumée.** Le binaire accepte `--smoke` : seul, il charge la page de test du moteur ; suivi de chemins (`--smoke fr fr/compresser-pdf fr/faq en`), il charge le site avec une sonde injectée avant chaque page (`smoke/probe.js`), qui relève les violations de CSP, les erreurs de script et de chargement, puis passe à la page suivante par un lien de la page quand il existe (le routeur d'Astro fait alors le changement, sous la politique de la première page) ou par `location.assign`. Elle retire `document.startViewTransition` avant les scripts de la page : derrière d'autres fenêtres le document est caché, WebKit saute alors la transition de vue et le routeur laisse une promesse rejetée (vu à la première exécution) ; sans l'API, le routeur fait le même remplacement du DOM et exécute les mêmes scripts, et le test ne dépend plus de la place de la fenêtre sur le bureau. Chaque rapport dit par quel chemin la page est arrivée (`via`, `load` ou `swap`) et porte son titre : une page absente est servie par Tauri comme un texte d'erreur, qui se charge sans erreur et sans titre. Rust vérifie l'ordre des pages et leur titre, et sort avec 0 après la dernière page propre, 1 à la première erreur, 2 si la chaîne n'a pas fini en 120 s, 3 si la fenêtre est fermée ou l'appli quittée (⌘Q) avant le verdict, parce que ces deux fins rendraient 0, le code d'une fin ordinaire. Sans `--smoke`, la coque n'enregistre ni les commandes de fumée, ni le chien de garde, ni la sonde.

| Vérification | Résultat (macOS 26.4.1, 5 octobre 2026) |
|---|---|
| Page moteur, cinq étapes, sous la CSP générée | 5/5 en 357 ms sur `tauri://localhost` |
| Accueil `fr`, puis Compresser par le lien de l'accueil, puis FAQ, puis accueil `en` | 4 pages sans violation ni erreur, Compresser arrivé par le routeur (`via: swap`), quatre exécutions de suite ; la chaîne `pnpm desktop:smoke` entière prend 38 s |
| Chemins d'échec | page absente (`--smoke fr/nope`) : 1 ; sonde muette : 2 ; fenêtre fermée ou Quitter par le menu : 3 |

## Ce qui vient ensuite

La forme de l'appli (une entrée dédiée composée avec les briques du site, à la place du site entier) est décidée dans [Bureau : la coque applicative](2026-10-05-desktop-shell-design.md), qui reprend les points 1 à 3 ci-dessous dans ses lots. Dans l'ordre, chacun avec sa ligne ici :

1. Enregistrer un résultat : le site le fait par un lien `<a download>`, que wry annule sur Mac tant que la coque n'a pas de gestionnaire `on_download` ; aujourd'hui aucun outil ne peut donc enregistrer sa copie dans la coque. Poser ce gestionnaire avec le dialogue natif. Liens externes (GitHub, stores, mentions) : ils remplacent le site dans la fenêtre, sans retour ; les ouvrir dans le navigateur (`on_navigation` et `tauri-plugin-opener`). « Voir » le résultat passe par `window.open`, que WKWebView ignore : ouvrir le fichier avec le lecteur du système.
2. Ouvrir un PDF par double-clic (association de fichiers), déposer depuis le Finder ou l'Explorateur, enregistrer sur place par le dialogue natif, traiter un dossier entier.
3. Régime : `dist` fait 63 Mo, dont les films de l'accueil (9,5 Mo), OpenCV (13 Mo), trois cœurs Tesseract et PDFium en double ; n'embarquer que ce que le bureau sert.
4. Mise à jour automatique, signature Mac et Windows, vente directe ; stores ensuite.
5. Windows : les scripts `smoke:*` nomment le binaire Unix (`src-tauri/target/debug/HolyPDF`), à adapter. Linux quand WebKitGTK aura fait tourner ces mêmes vérifications.
