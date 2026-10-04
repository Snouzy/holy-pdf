# Web — Ajouter des signets

_Rédigé et livré le 3 octobre 2026. Suit [les signets sur Mac](2026-10-02-mac-bookmarks-design.md) : même liste à plat, mêmes règles de rang et de niveau._

Frère Signet (`/fr/signets-pdf`, `/en/pdf-bookmarks`) lit les signets d'un PDF, en pose sur la page affichée, les renomme, les range et les retire, puis enregistre la copie.

## Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Moteur | `engine/bookmarks.ts` : `listBookmarks` lit le plan en liste à plat (titre, page, niveau, vue) ; `writeBookmarks` le vide (`EPDFBookmark_Clear`) et écrit la liste (`EPDFBookmark_AppendChild`, `EPDFBookmark_SetDest`) | Sonde du 3 octobre : pdf.js relit l'arbre écrit, titres accentués et niveaux compris |
| Point d'arrivée | Un signet lu garde sa vue telle quelle : `XYZ` avec ses valeurs laissées vides, `Fit`, `FitH`… avec leurs paramètres. Un signet lu par une action GoTo ou une destination nommée est réécrit en destination directe. Un `FitH` ou `FitBH` sans hauteur mène au haut de la page ; une vue que PDFium ne sait pas refaire aussi | PDFium donne la vue entière, là où PDFKit ne donne qu'un point. Il ne distingue un paramètre vide d'un zéro que dans un `XYZ` complet : ailleurs le vide se lit 0, et une hauteur 0 mènerait au pied de la page |
| Nouveau signet | `XYZ` au coin haut gauche de la page telle que le lecteur la voit, zoom laissé vide ; rangé après les signets de sa page et des pages d'avant, au niveau le plus profond de ses deux voisins | Comme sur Mac |
| Signet sans page | Laissé de côté et compté s'il mène à une adresse, à un autre fichier ou à rien, ou si son titre est vide ; ses enfants prennent sa place | Comme sur Mac. Une boucle dans le plan s'arrête au signet déjà vu |
| Lecture | Requête `bookmarks` du worker, chargée avec l'éditeur ; l'écran attend les deux | Le sommaire affiché est toujours celui du document ouvert |
| Écran | L'aperçu et ses flèches à gauche ; le titre, « Ajouter un signet à la page N » et la liste dans le panneau. Chaque ligne : titre modifiable, « p. N » qui affiche la page, deux flèches de niveau, corbeille | Sur Mac, les niveaux passent par un menu contextuel ; un site les montre |
| Retrait | Les enfants du signet retiré remontent d'un niveau, à sa place | Sur Mac, ils passent sous le signet d'avant : retirer « Partie I » rangeait « Chapitre 2 » sous « Chapitre 1 » |
| Enregistrement | Offert dès le premier changement, refusé tant qu'un titre est vide (bordure rouge) | Comme sur Mac |
| PDF signé | Refusé (`alreadySigned`) | Toute réécriture invalide la signature |
| PDF protégé | Ouvert avec son mot de passe ; la copie garde ce mot de passe | PDFium réécrit le chiffrement d'origine |
| Moine | « Frère Signet » (« Brother Ribbon »), le livre, en joie, catégorie Organiser | Le nom et la pose du Mac |
| Recherche | `signets`, `sommaire`, `chapitres`, `plan du document`, `marque-page`… Sans « table des matières » | La recherche y répondrait à « tableur » |
| Aperçu partagé | `signature/pagePreview.ts` : le chargement de l'aperçu de page, commun à Noircir et aux Signets | Un seul code pour l'attente, l'échec et le nouvel essai |

## Limites connues

- Pas de glisser-déposer pour réordonner, et pas de choix du point d'arrivée dans la page.
- Un signet existant perd son état ouvert ou fermé, sa couleur et son style gras ou italique : les lecteurs montrent fermés les signets qui ont des enfants.
- Dans un sommaire qui ne suit pas l'ordre des pages, un nouveau signet se range après le dernier signet d'une page antérieure.
- Un seul PDF à la fois.

## Tests

- Moteur (`tests/engine/bookmarks.test.ts`) : lecture dans l'ordre avec niveaux, signets laissés de côté et comptés, enfants à leur place, action GoTo et destination nommée ; `XYZ` incomplet et `FitH` sans hauteur ; boucle arrêtée ; vues gardées à la réécriture, titre avec ses espaces ; trois niveaux en alphabets variés ; remplacement et retrait de tous les signets ; haut de page pour les quatre rotations sur un cadre qui ne part pas de zéro ; niveau ramené ; page ou titre impossibles refusés ; PDF signé refusé, PDF protégé qui le reste. Relecture par pdf.js.
- Liste (`tests/unit/bookmarksOutline.test.ts`) : rang et niveau d'un nouveau signet, niveaux ramenés, enfants d'un signet retiré remontés, enregistrement offert.
- Navigateur (`tests/e2e/bookmarks.spec.ts`) : deux signets ajoutés, titre par défaut, l'un rangé sous l'autre ; signets du PDF listés, « p. 2 », titre vide refusé, signet retiré.
