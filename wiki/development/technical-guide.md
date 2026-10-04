# Guide technique

_Rédigé le 29 septembre 2026. Règles de code du moteur Swift et de l'appli Mac._

## Langage et concurrence

- Swift 6, mode de langage 6, concurrence stricte. Un avertissement du compilateur se corrige, il ne s'ignore pas.
- Pas de `!`, `try!` ni `as!`, sauf avec un commentaire qui explique pourquoi l'échec est impossible.
- Types valeur (`struct`, `enum`) par défaut. Une classe seulement pour un état observable partagé (`@Observable`).
- Les types publics qui traversent des tâches sont `Sendable`.

## États et erreurs

- Un état se modélise en enum à valeurs associées, jamais en booléens combinés :

  ```swift
  enum PageStatus {
      case queued
      case processing(previous: PageResult?)
      case ready(PageResult)
      case failed(ScanError, previous: PageResult?)
  }
  ```

- Les erreurs sont typées (`throws(ScanError)`, `throws(PDFWriteError)`). L'interface les traduit en phrases.

## Architecture

- `ScanCore` (moteur du scanner), `PDFCore` (écriture PDF, signature et fusion) et `ScanSession` (état d'un lot : pages, documents, retouches, export) n'importent ni AppKit, ni UIKit, ni SwiftUI : ils doivent servir tels quels sur iPhone.
- Une brique prend des données et rend des données. Pas de singleton : le `CIContext` est créé une fois par le pipeline et passé explicitement.
- **Inversion de dépendances** : un protocole seulement s'il y a au moins deux implémentations envisagées, ou un service externe (paiement, analytique). Les frameworks Apple sont appelés directement.
- **Piège** : Vision (reconnaissance de texte) bloque son thread et attend un thread du pool coopératif de Swift. Appelée depuis ce pool, elle peut tout bloquer. `ScanPipeline.process` est donc asynchrone : il fait tourner les étapes sur `DispatchQueue.global`, et l'appelant l'attend avec `await`. Un test qui appelle directement `TextReader` ou `OrientationDetector` passe par `offPool`, fonction interne de `ScanCore` que `ScanPipeline.process` utilise aussi (`@testable import ScanCore`). Vérification : `LIBDISPATCH_COOPERATIVE_POOL_STRICT=1 swift test --skip PrivateBatchTests`.
- Pas d'abstraction prématurée. Le code doit rester compréhensible dans six mois par un développeur junior ou par une IA. Un pattern est le bienvenu s'il est compris et documenté.

## Appli Mac

- Projet : `apps/mac/PDFToolbox.xcodeproj`. Les dossiers `PDFToolbox/` et `PDFToolboxTests/` sont synchronisés : un fichier posé dedans entre dans la cible, sans modifier le projet.
- Un outil, c'est un dossier sous `PDFToolbox/Features/` et un cas de `Tool` dans `App/RootView.swift`.
- Bac à sable : l'appli ne lit que les fichiers que l'utilisateur choisit ou dépose, et elle les garde lisibles pendant toute la session. Aucun droit réseau (`PDFToolbox.entitlements`).
- Les conversions entre coordonnées de page et points d'écran vivent dans `Features/Scanner/ScreenGeometry.swift`.
- `ScannerSession` vit dans `AppDelegate`. Fermer la fenêtre garde l'appli et le lot ; quitter (⌘Q) demande confirmation s'il reste des documents non exportés. Une annulation qui touche une autre page ouvre cette page (`ScannerSession.showPage`).
- Les changements de la planche s'annulent comme les retouches, dans l'`UndoManager` de la fenêtre. Chacun enregistre son opération inverse, jamais une copie de la planche : un import arrivé entre-temps doit rester. Leur annulation ramène à la planche (`ScannerSession.showBoard`).
- Les commandes des menus Fichier et Aide vivent dans `Features/Scanner/ScannerCommands.swift`. `ScannerView` publie ce qu'elles peuvent faire avec `focusedSceneValue` : un raccourci n'a qu'une source, le menu. Signer, Fusionner et Organiser publient un même `ToolMenu`.
- Signer, Fusionner et Organiser partagent une erreur typée, `PDFToolError`. `SigningText` et `OrganizingText` formulent leurs cas propres et passent les autres à `MergeText`.
- `App/FileAccess.swift` sert les trois outils PDF : lecture plafonnée hors du thread principal (`readFile`), identité d'un fichier à travers ses liens symboliques et physiques (`FileIdentity`), panneau d'enregistrement (`choosePDFDestination`). `App/PagePreviewSheet.swift` est la feuille d'aperçu de Fusionner et d'Organiser.
- `apps/mac/scripts/export-monk-assets.mjs` exporte les moines des outils PDF depuis le dessin source du site, sans modifier `apps/web/`. Sans argument, il vérifie les trois ; `sign`, `merge` ou `organize` limite à un moine ; `--write` régénère. Chaque moine ne possède que son dossier : `Signing/`, `Merging/monk-merge.imageset/`, `Organizing/monk-organize.imageset/`.
- `apps/web/tests/unit/macSearch.test.ts` garde dans l'appli une copie de l'index de recherche du site (noms et mots de chaque outil, par langue) : `App/SearchTerms.json`. `pnpm test` échoue si la copie n'est plus à jour ; `UPDATE_MAC_ASSETS=1 pnpm test` la réécrit, comme pour les dessins. `export-monk-assets.mjs` donne à Vite un dossier de cache à lui, hors de `apps/web/node_modules/.vite` : avec celui du site, il casserait un `pnpm dev` en cours.

## Signature sur Mac

- `SigningSession` vit aussi dans `AppDelegate` et conserve le travail à la fermeture de la fenêtre. Un PDF chargé appartient à un acteur `PDFSigningDocument` ; ouverture, rendu et export quittent le thread principal.
- `PageGeometry` centralise CropBox, rotation et origine du placement. Le glisser ne modifie qu’un rectangle de surimpression ; il ne demande aucun rendu PDF.
- L’export repart des données originales et ajoute des annotations stamp avec apparence persistante. Les autres annotations ne sont pas aplaties. La destination ne peut pas désigner le fichier source, y compris par lien symbolique ou lien physique.
- L’aperçu est limité à 1 600 pixels de côté ; les images de signature à 1 Mpx après normalisation. Aucun nouveau moteur ni accès réseau. Voir la [spec](../specs/2026-10-01-mac-sign-design.md).

## Fusion sur Mac

- `MergeSession` vit dans `AppDelegate`, avec import séquentiel et une ligne par fichier. `PDFMergeCollection` reçoit les données immuables, les valide et retourne informations, aperçus de première page et résultat fusionné. Aucun `PDFDocument` ne traverse les acteurs.
- L’export repart de documents frais ; les destinations internes sont résolues avant insertion, les signets remappés et les noms de champs préfixés par document pour garder les formulaires indépendants. Les fichiers source ne sont pas écrasables, y compris via leurs alias ou lorsqu’ils sont conservés pour l’annulation.
- Les entrées supprimées restent disponibles tant qu’une annulation les référence (100 opérations), puis sont libérées. Le plafond de données sources inclut cet historique : 100 documents, 256 Mio par fichier, 512 Mio cumulés. Les aperçus se chargent à l’apparition des lignes, à 240 pixels, avec un cache de 32 images. Le clic ouvre `PagePreviewSheet` : une page à la fois à 1 600 pixels maximum, navigation paginée et annulation des résultats obsolètes.
- Les sources protégées produisent une copie accessible sans mot de passe. Les profils d’archivage/impression et les balises d’accessibilité font l’objet d’une notice ; les scripts, formulaires dynamiques, pièces jointes et calques non conservables sont refusés. Voir la [spec](../specs/2026-10-01-mac-merge-design.md).
- `MergeDropDelegate` reçoit uniquement les fichiers Finder sur le fond. Les lignes et la zone de fin utilisent `draggable(String)` et `dropDestination(String)` pour réorganiser : le texte contient seulement un préfixe et un UUID, vérifié dans la session active. Le haut et le bas d’une ligne correspondent à avant/après ; le fond permet de déplacer en fin. Les menus sont désactivés pendant la feuille d’aperçu et le panneau d’enregistrement.

## Organiser sur Mac

- `OrganizingSession` vit dans `AppDelegate`. Un PDF à la fois, pages identifiées par index source et rotation ajoutée. Le `ScrollView` change d’identité à chaque génération de document pour ne jamais reprendre les images du précédent PDF.
- `PDFOrganizingDocument` conserve son document de lecture dans un acteur. L’export reconstruit une copie fraîche avec les pages originales : texte, annotations et formulaires restent des objets PDF. Les liens et signets visant une page retirée sont supprimés ; un signet parent garde ses enfants valides sans sa destination retirée. Les structures refusées et notices sont communes au contrôle de Fusionner.
- Miniatures de 240 pixels demandées par les cartes visibles, cache LRU de 32, images locales libérées à la disparition des cartes. L’attente directe de l’acteur propage l’annulation : pas de tâche de rendu indépendante qui continue à calculer les pages quittées. Aperçu agrandi de 1 600 pixels, une page à la fois. Déplacements et rotations ne demandent aucun rendu.
- Historique limité à 100 opérations inverses, sans instantané des images ni de l’ensemble de la planche. La dernière page ne peut pas être retirée. Copies enregistrées atomiquement, fichiers source et alias protégés.
- Les payloads `String` incluent l’identité de la vue, la génération et l’index source. Les cartes reçoivent avant/après selon leur moitié horizontale ; une zone explicite reçoit la fin. Le dépôt Finder reste indépendant et refuse les retours asynchrones d’une ancienne génération.

## Filigrane sur Mac

- `PDFWatermarkDocument` ouvre une copie fraîche du PDF à chaque export. Le délégué de cette copie fait créer à PDFKit une sous-classe de `PDFPage` qui dessine le filigrane après le contenu : PDFKit l'écrit dans la page. Les champs, les liens et les signets restent ; aucune annotation n'est ajoutée. Ne pas utiliser `burnInAnnotationsOption` : il aplatit les champs de formulaire.
- Une seule fonction dessine le filigrane, pour l'export et pour l'image posée sur l'aperçu. La position suit la page affichée (CropBox après /Rotate), comme la signature.
- **Piège** : pendant que PDFKit écrit un document, `PDFPage.transform(for:)` ne contient plus la rotation de la page, alors que `rotation` la donne toujours. `PageGeometry.displayTransform` calcule donc la page affichée à partir de `rotation` et de la CropBox ; un test vérifie qu'elle reste égale à celle de PDFKit hors écriture.
- Les curseurs et la saisie changent les réglages sans étape d'annulation ; le changement final en enregistre une seule.

## Coordonnées

C'est le piège du projet : pixels de la photo, pixels du rendu, fractions de page, points PDF, et deux origines différentes.

- Le modèle ne stocke que des **coordonnées normalisées de page** : de 0 à 1, origine en haut à gauche.
- Toutes les conversions de `ScanCore` vivent dans `Geometry.swift`. Vision et Core Image utilisent une origine en bas à gauche : la bascule se fait là, et nulle part ailleurs.
- `PDFCore` ne dépend pas de `ScanCore`. Il reçoit des boîtes normalisées et les convertit dans une seule fonction, `PDFWriter.pdfRect`.

## Dépendances

- Frameworks Apple d'abord. Une bibliothèque tierce n'entre que par une spec qui explique pourquoi le framework ne suffit pas.
- Avant d'écrire un utilitaire, vérifier que Foundation, Core Graphics, Core Image, Vision, ImageIO ou PDFKit ne le font pas déjà.

## Performance

**Mesurer avant d'optimiser.** Une intuition de performance est fausse une fois sur deux : on chiffre, on corrige, on re-chiffre.

| Opération | Repère |
|---|---|
| Traitement d'une page (puce M) | < 1 s |
| Lot de 17 photos prêt | < 20 s |
| Image pendant le glisser d'un coin | < 16 ms |
| Poids d'un PDF | < 500 Ko par page en moyenne |

- Aucune photo décodée n'est gardée en mémoire après son traitement. Une photo de 24 Mpx décodée pèse près de 100 Mo.
- Rien ne change de taille pendant un glisser (coins, réordonnancement de pages) : sinon le contenu saute sous le curseur.

## Interface

- Toute chaîne visible passe par le catalogue Xcode (`Localizable.xcstrings`), en français et en anglais, dès la première vue.
- `ScanCore` et `ScanSession` ne contiennent aucune phrase destinée à l'utilisateur. Ils renvoient des données (`Evidence`, `ReviewReason`, `ScanError`…), et l'appli les formule. Le nom d'une retouche dans le menu Édition vient aussi de l'appli : `ScannerSession.describeAction`.
- Une action qui s'annule ne demande pas de confirmation (règle Apple) : supprimer une page se rattrape avec ⌘Z. Supprimer un document reste confirmé, avec son nom, et le message rappelle ⌘Z.
- Couleurs système et sémantiques. Le mode sombre doit fonctionner. Une exception : la couleur d'accent de l'appli Mac est le bleu de la marque (`AccentColor`, exportée du site, voir la [spec](../specs/2026-10-01-mac-design-system-design.md)).
- Les boutons utilisent `.buttonHover()` avant leur éventuel `.disabled(...)` : variation de luminosité, pointeur et animation courte respectant Réduire les animations, sans changer les dimensions. Les cartes/vignettes gardent leurs survols existants ; les menus et dialogues système conservent leurs comportements natifs.
- Un composant se nomme d'après sa fonction, pas son contexte d'origine (`PageThumbnail`, pas `ScannerBoardThumbnail`).

## Commentaires

En anglais, et seulement pour ce que le code ne peut pas dire : une raison, une contrainte, un piège. Jamais une paraphrase de la ligne suivante. Par défaut, un changement n'ajoute aucun commentaire.

## Tests

Voir [Tests](tests.md).

## Confidentialité

- L'appli n'a aucun droit réseau.
- Aucune photo réelle dans le dépôt : `fixtures-private/` est ignoré par git. Un dépôt privé reste un tiers, et peut devenir public.

## Git

- Une branche et une pull request par changement, jamais de push direct sur `main`.
- Les tests arrivent avec le changement, et la page du wiki concernée est mise à jour dans le même commit. Le reste est dans [CONTRIBUTING.md](../../CONTRIBUTING.md).
