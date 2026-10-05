# Mac — Ajouter des signets

_Rédigé le 2 octobre 2026. Statut : appli Swift retirée le 5 octobre 2026 (tag `mac-final`) ; à l'époque, livré dans `apps/mac`. Suite de la liste approuvée par l'auteur le 2 octobre, après [les feuilles, la coupe et Pixelliser](2026-10-02-mac-sheets-design.md). Le site a l'outil depuis le 3 octobre : [spec web](2026-10-03-web-bookmarks-design.md)._

## Objectif

Poser, renommer et retirer les signets d'un PDF dans Holy PDF pour Mac, puis enregistrer la copie. Les signets sont le sommaire qu'un lecteur PDF affiche dans sa barre latérale. PDFKit seulement.

La spec est réussie quand :

- l'écran liste les signets que le PDF a déjà, avec leurs niveaux ;
- un signet s'ajoute pour la page affichée, se renomme, se retire, monte ou descend d'un niveau ;
- la copie a exactement les signets de la liste, et rien d'autre n'y change ;
- un signet qui existait garde sa page, son titre tel quel, et le point où il menait quand PDFKit le donne ;
- le fichier d'origine n'est jamais modifié ;
- les tests du paquet, de l'appli et des textes passent, sans avertissement du compilateur.

## Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Moteur | `PDFBookmarks.list` lit le plan du document en liste à plat (titre, page, niveau, point d'arrivée) ; `PDFBookmarks.written` le remplace par la liste donnée | Sonde du 2 octobre : les 22 signets d'un article sur trois niveaux sont relus à l'identique après réécriture, en 0,2 s, et les 113 liens restent |
| Liste à plat | Un niveau par signet au lieu d'un arbre. Un niveau dépasse d'un cran au plus celui du signet d'avant ; le moteur et l'écran appliquent la même règle | Une liste se montre et se modifie simplement, et dit tout ce qu'un arbre dit |
| Nouveau signet | Il vise le haut de sa page, telle que le lecteur la voit, même pivotée. Il se range après les signets de sa page et des pages d'avant | L'ordre des signets suit alors celui des pages sans que l'utilisateur ait à les trier |
| Niveau d'un nouveau signet | Le plus profond de ses deux voisins : entre un signet et ses enfants, il devient un enfant | Sinon il prendrait pour lui les enfants qui le suivent |
| Signet sans page | Un signet qui mène à une adresse web, à un autre fichier ou à rien, ou dont le titre est vide, n'est pas listé, donc pas gardé dans la copie. Ses enfants prennent sa place, au même niveau. L'écran dit combien de signets sont laissés de côté | PDFKit n'en donne pas la destination ; la liste ne montre que ce qu'elle sait réécrire. Relecture du 2 octobre : sans cette règle, les enfants passaient sous le signet d'avant |
| Lecture à l'ouverture | `PDFCopySession.survey` : ce que l'outil lit dans le document attend dans `findings`, posé en même temps que le document | Un second chargement après l'ouverture laisserait un instant l'écran avec le mauvais sommaire |
| Enregistrement | Offert dès le premier changement, refusé tant qu'un titre est vide. Retirer tous les signets est un changement comme un autre | Une copie identique n'a pas de sens ; un titre vide ne s'affiche nulle part |
| PDF signé | Refusé : la copie garderait une signature qui ne serait plus valide | Comme les autres outils qui réécrivent le document |
| Moine | « Frère Signet » (Brother Ribbon), le livre, en joie | Le site n'a pas l'outil : nom et pose sont à confirmer par l'auteur. Le livre est déjà tenu par deux autres moines avec les deux autres visages |
| Recherche | L'outil apporte ses propres mots (`Tool.ownWords`), puisque le site n'en a pas pour lui. Sans « table des matières » : la recherche y répondrait à « tableur » | Le test du site exige que « tableur » ne trouve rien |

## Parcours

1. Ouvrir ou déposer un PDF : ses signets s'affichent, décalés selon leur niveau.
2. Afficher une page avec les flèches, taper un titre (sinon « Page 3 »), « Ajouter un signet à la page 3 ».
3. Modifier un titre dans la liste ; « p. 3 » affiche la page ; la corbeille retire le signet ; le menu contextuel le range sous le signet du dessus ou le remonte d'un niveau.
4. « Enregistrer la copie avec signets… » propose `nom-signets.pdf`.

## Limites connues

- Pas de glisser-déposer pour réordonner, et pas de choix du point d'arrivée dans la page.
- Un signet existant garde sa page et son point, mais pas son zoom, son état ouvert ou fermé, sa couleur ni son style gras ou italique.
- Un signet réglé sur « ajuster à la largeur » ou sur une zone (FitH, FitV, FitR, FitB) arrive en haut de sa page : PDFKit n'en donne pas le point.
- La copie n'ouvre plus d'elle-même le panneau des signets dans le lecteur (réglage `/PageMode` du document, que PDFKit n'écrit pas).
- Dans un sommaire qui ne suit pas l'ordre des pages, un nouveau signet se range après le dernier signet d'une page antérieure, et rien ne le déplace ensuite.
- Les niveaux se changent par le menu contextuel seulement.
- Les limites de PDFKit à l'écriture s'appliquent (spec du Filigrane).
- La copie d'un PDF protégé s'ouvre sans mot de passe, et l'écran le dit.

## Tests

| Niveau | Quoi | Où |
|---|---|---|
| Moteur | Lecture dans l'ordre avec niveaux ; signet sans page ou sans titre laissé de côté et compté, ses enfants à sa place ; titre gardé avec ses espaces ; écriture sur trois niveaux relue à l'identique ; remplacement et retrait de tous les signets ; point d'un signet lu gardé ; haut de page pour les quatre rotations, sur un cadre qui ne part pas de zéro ; niveau ramené, page ou titre impossibles refusés ; PDF signé refusé, PDF protégé ouvert | `PDFBookmarksTests` |
| Session commune | Ce que l'outil lit à l'ouverture, gardé jusqu'à la fermeture ; un document illisible pour l'outil ne s'ouvre pas | `PDFCopySessionTests` |
| Outil | Liste du document, ajout à la page affichée, titre par défaut, renommage, niveau, retrait, copie enregistrée, original intact ; famille gardée à l'ajout ; titre vide refusé ; autre document, liste neuve ; compte des signets laissés de côté | `BookmarksSessionTests` |
| Écrans | Départ, prêt en clair, en sombre et en anglais, copie enregistrée, PDF sans signet | `BookmarksSnapshots` |
| Fichiers réels | Quatre PDF de `fixtures-private/pdfs` : 22 signets relus et réécrits à l'identique, un signet ajouté en dernière page, page pivotée | Sonde du 2 octobre, non gardée |
| Textes | Tous traduits, sans tutoiement | `check-strings.py` |
