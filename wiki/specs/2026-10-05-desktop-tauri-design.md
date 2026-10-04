# Bureau : coque Tauri sur le code du site

_Rédigé le 5 octobre 2026. Statut : preuve livrée dans `apps/desktop` ; l'appli vient ensuite._

## Contexte

Le 4 octobre 2026, l'appli Mac en Swift est gelée : deux moteurs (PDFKit sur Mac, PDFium et qpdf en WebAssembly sur le site) doublaient chaque fonction. Le bureau se fera en Tauri 2 sur le code du site, pour Mac et Windows d'abord, Linux ensuite. Avant d'écrire l'appli, une question devait être tranchée : le moteur du site tourne-t-il dans la webview du système, avec ses workers et ses fichiers WebAssembly, servis par le protocole de Tauri ?

## Ce que la preuve établit

`apps/desktop/smoke/` est une page construite par Vite 8 (la version que le site utilise) depuis les sources du site (`apps/web/src/engine/client.ts` et son worker, importés par chemin relatif, sans copie), types vérifiés par `tsc`. La coque Tauri la charge sous la CSP cible de l'appli (`script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:`), la page enchaîne cinq opérations et renvoie son rapport JSON à Rust par `invoke("smoke_report")`. Rust le désérialise et sort avec 0 seulement si les cinq étapes sont présentes et réussies ; 1 sinon ; 2 si rien n'arrive en 120 s.

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
| Outils | Rust via rustup, Tauri CLI, Vite et TypeScript épinglés en dépendances du paquet | `tauri dev` appelle `cargo` par le PATH : `~/.cargo/bin` doit y être (rustup l'y met par défaut) ; `pnpm install` à la racine suffit côté JS |

## Ce qui vient ensuite

Dans l'ordre, chacun avec sa ligne ici :

1. `frontendDist` vers `apps/web/dist`, fenêtre ouverte sur `fr/index.html` (ou la langue du système), menus et raccourcis système. Retirer alors le chien de garde et `smoke_report` de la coque, ou les garder derrière une variable d'environnement que seul le script `smoke` pose : sinon l'appli se fermerait au bout de deux minutes.
2. Ouvrir un PDF par double-clic (association de fichiers), déposer depuis le Finder ou l'Explorateur, enregistrer sur place par le dialogue natif, traiter un dossier entier.
3. Mise à jour automatique, signature Mac et Windows, vente directe ; stores ensuite.
4. Linux quand WebKitGTK aura fait tourner cette même preuve.
