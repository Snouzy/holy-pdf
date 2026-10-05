# Mac — PDF en Word

_Rédigé le 2 octobre 2026. Statut : appli Swift retirée le 5 octobre 2026 (tag `mac-final`) ; à l'époque, livré dans `apps/mac`. Demandé par l'auteur le 2 octobre (« continue sur l'outil suivant »), après les petites dettes : le site a l'outil depuis le même jour ([spec du site](2026-10-02-web-pdf-to-word-design.md))._

## Objectif

Recopier le texte et les images d'un PDF dans un document Word (.docx) modifiable, dans Holy PDF pour Mac, avec les règles du site. Aucune bibliothèque, aucun service : PDFKit, Core Graphics, et un fichier .docx écrit à la main. La feuille de route classait l'outil en C (« bibliothèque ou service ») ; la voie du site montre qu'on s'en passe.

La spec est réussie quand :

- le texte arrive paragraphe par paragraphe, avec sa taille, sa police, son gras et son italique ;
- une image arrive à sa place entre les paragraphes ;
- chaque page du PDF donne une page de Word ;
- Word, Pages et TextEdit ouvrent le document ;
- le fichier d'origine n'est jamais modifié, et un PDF signé est accepté ;
- les tests du paquet, de l'appli et des textes passent, sans avertissement du compilateur.

## Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Lignes | PDFKit : `selectionsByLine()` donne les lignes dans l'ordre de lecture, colonnes comprises, et `attributedString` la taille de chaque lettre | Sonde du 2 octobre : deux colonnes lues l'une après l'autre, 265 lignes en 0,1 s |
| Polices | PDFKit appelle « Helvetica » toute police que le Mac n'a pas. `PageScan` relit donc le contenu de la page avec Core Graphics (`CGPDFScanner`) : le nom de la police de chaque morceau de texte et le point où il commence | Sonde : sur l'article arXiv, PDFKit ne voit aucun gras ; le contenu nomme `NimbusRomNo9L-Medi`. Lecture d'une page : moins de 2 ms |
| Changement de police dans une ligne | La ligne prend la police du morceau le plus à gauche. À chaque morceau d'une autre police, une sélection à son point de départ, grande comme une demi-lettre de la ligne, donne le rang de sa première lettre (PDFKit choisit une lettre quand son milieu est dans la boîte : relecture du 3 octobre, une boîte de 2 points ne trouvait rien) | `characterBounds(at:)` et `characterIndex(at:)` comptent les lettres sans les sauts de ligne de `string` : leurs rangs dérivent d'un à chaque ligne (sonde). Les sélections, elles, sont justes |
| Gras, italique, famille | Lus dans le nom de la police (`-Bold`, `-Italic`, `-Medi` et `CMBX`, `CMTI` pour LaTeX), puis dans sa graisse et ses drapeaux. Le nom PostScript devient une famille que Word connaît (`TimesNewRomanPSMT` → Times New Roman) | La règle du site, plus les polices de LaTeX |
| Paragraphes | Les règles du site : un paragraphe s'arrête à un écart de plus de 1,6 fois la taille du texte, à un retour vers le haut, à un changement de taille, à une puce ou un numéro, ou après une phrase finie sur une ligne courte | Même résultat des deux côtés |
| Morceaux d'une même ligne | PDFKit coupe une ligne à un grand blanc : les morceaux qui se suivent sur une même ligne de base sont réunis, avec une espace | Sinon chaque colonne d'un tableau deviendrait un paragraphe |
| Images | `PageScan` donne le cadre de chaque image. La page est dessinée une fois à 200 ppp et chaque image y est découpée, en JPEG 0,85 | Découper le dessin de la page donne l'image telle qu'elle est vue : masque, rotation et couleurs compris, sans décoder chaque format d'image du PDF. Le site, lui, demande l'image à PDFium |
| Images dans le contenu, images rognées | Une image écrite dans le contenu même (`BI … EI`) est gardée. Une image rognée par un rectangle (`re` puis `W`) garde ce que le rectangle laisse voir | Relecture du 3 octobre : sans le rognage, l'image recopiait le texte de la colonne voisine |
| Page mal formée | Un point envoyé hors de toute page par une matrice est laissé de côté ; une forme qui se dessine elle-même est lue une fois, et une page ne lit pas plus de 2 000 formes | Relecture du 3 octobre : un PDF forgé faisait planter l'appli, un autre la bloquait |
| Petites images, scans | Moins de 16 points de côté : laissée de côté. Une image qui couvre plus de 80 % d'une page qui a du texte aussi : c'est un scan déjà lu. Une page sans texte garde son image | Les règles du site |
| Document | `Docx` écrit les parties XML du site, dans une archive ZIP écrite à la main : texte compressé (Compression), JPEG rangés tels quels, somme de contrôle de zlib | Aucune dépendance. `unzip` vérifie l'archive dans les tests, et macOS relit le texte et les styles |
| Page | Une page Word par page du PDF, toutes à la taille de la première, marges de 72 points, ou d'un quart de la page si elle est petite ; une image plus large que le texte est réduite | Comme le site, sauf la marge d'une petite page : sur le site, une page de moins de 144 points donne une largeur négative |
| Enregistrement | « Convertir en Word… » ouvre le panneau, propose `nom-word.docx`, puis la conversion dit la page en cours et s'annule | Le suffixe du site. 142 pages demandent 11 s |
| PDF signé | Accepté : aucune copie du PDF n'est écrite | Comme PDF en images |
| Moine | « Frère Copiste » (Brother Copyist), la plume, en joie : le nom et l'accessoire du site ; l'air content du site est déjà celui de Frère Plume sur l'accueil du Mac | Même personnage que sur le site |

## Parcours

1. Ouvrir ou déposer un PDF. Un fichier protégé demande son mot de passe.
2. « Convertir en Word… », choisir où enregistrer.
3. « Votre PDF est en Word » : le nom du fichier, et « Afficher dans le Finder ».

## Limites connues

- Les tableaux deviennent des lignes de texte ; les colonnes sont recopiées l'une après l'autre. L'écran le dit.
- L'alignement, l'interligne, les couleurs du texte, les dessins vectoriels et les liens ne sont pas repris.
- Ce que la page écrit par-dessus une image reste sur l'image recopiée. Un rognage qui n'est pas un rectangle est ignoré.
- Deux écarts avec le site : une image dessinée deux fois au même endroit n'est gardée qu'une fois, et le cadre d'une image est coupé au bord de la page avant les règles des 16 points et des 80 %.
- Un changement de police au milieu d'un morceau de texte que le PDF écrit d'un seul trait n'est pas vu ; une ligne qui n'est pas horizontale garde la police que PDFKit lui donne. Un mot coupé en fin de ligne garde son trait d'union (« resi-dents »), comme sur le site.
- Les familles que Word n'a pas (Helvetica World, les polices de LaTeX) sont remplacées par Word à l'ouverture.
- Un scan sans OCR ne donne que son image ; l'outil OCR peut le lire d'abord.
- Tout le document est préparé en mémoire avant d'être écrit : un scan de 300 pages demande quelques centaines de Mo. Au-delà de 65 000 images ou de 3 Go, la conversion s'arrête avec un message.
- TextEdit ne montre pas les images d'un .docx : Word, Pages et le coup d'œil du Finder les montrent.

## Tests

| Niveau | Quoi | Où |
|---|---|---|
| Document | Paragraphes, tailles, gras, italique et familles relus par macOS ; saut de page ; image à sa taille, réduite à la largeur du texte, relue par `unzip` ; page plus étroite que les marges ; caractères refusés par XML ; texte compressé | `DocxTests` |
| Moteur | Police, taille, gras et italique par passage, changement de police au milieu d'une ligne à l'écart des mots ordinaires, police changée sans déplacer la plume, police rendue par « Q », polices héritées du parent de la page ; noms de polices (Medium, Medi, LaTeX) ; page qui trompe la lecture (matrice énorme, forme qui se dessine elle-même) ; image dans le contenu, image rognée ; paragraphes (ligne courte après une phrase, écart, puce, changement de taille, texte en drapeau) ; deux colonnes ; une page par page, pages pivotées ; image à sa place, petite image laissée ; scan gardé seul, laissé derrière son texte lu ; PDF signé lu, mot de passe ; progression et annulation | `PDFWordTests` |
| Outil | Document enregistré et relu, original intact, dossier qui refuse l'écriture | `WordSessionTests` |
| Écrans | Départ, prêt en clair, en sombre et en anglais, document enregistré | `WordSnapshots` |
| Fichiers réels | Six PDF de `fixtures-private/pdfs` : article arXiv (15 pages, 0,4 s, titres en gras), formulaire W-9, publication 17 de l'IRS (142 pages, 12 s, 5 978 passages en gras), fiche NASA avec photos, page pivotée, photos scannées ; les six relus par macOS | Sonde du 2 octobre, non gardée |
| Textes | Tous traduits, sans tutoiement | `check-strings.py` |
