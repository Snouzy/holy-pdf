# Mac — Compresser

_Rédigé le 2 octobre 2026. Statut : livré dans `apps/mac`. Troisième des six outils commandés le 2 octobre (avant : [Numéros de page](2026-10-02-mac-page-numbers-design.md), [Protéger et Déverrouiller](2026-10-02-mac-protect-unlock-design.md) ; ensuite : OCR, Noircir)._

## Objectif

Alléger un PDF dans Holy PDF pour Mac, puis enregistrer la copie. Comme sur le site : trois niveaux, les photos maigrissent, le texte reste sélectionnable. PDFKit et Quartz seulement, sans nouveau moteur.

La spec est réussie quand :

- un PDF qui contient des photos sort plus léger, de plus en plus du niveau Basse au niveau Extrême ;
- le texte, les liens, les champs de formulaire et les signets restent ;
- un PDF que l'outil ne sait pas alléger n'est pas enregistré, et l'écran le dit avant de demander où enregistrer ;
- le fichier d'origine n'est jamais modifié ;
- les tests du paquet, de l'appli et des textes passent, sans avertissement du compilateur.

## Ce que PDFKit sait faire (sondes du 2 octobre)

Poids de la copie en pourcentage de l'original :

| Fichier | Réécriture simple | Images en JPEG | Optimisées écran | Les deux | Filtre Quartz (200 / 144 / 96 ppp) |
|---|---|---|---|---|---|
| Fiche NASA, 1,2 Mo | 97 | 97 | 39 | 39 | 63 / 32 / 19 |
| Photos Gemini scannées, 2,5 Mo | 99 | 99 | 196 | 196 | 57 / 28 / 12 |
| `images.pdf`, 1,5 Mo | 149 | 51 | 21 | 9 | 149 (aucun effet) |
| Article arXiv, 2,2 Mo | 104 | 120 | 91 | 92 | 94 / 91 / 89 |
| Formulaire W-9, 137 Ko | 125 | 125 | 125 | 125 | 125 |

- Les deux options documentées (`saveImagesAsJPEGOption`, `optimizeImagesForScreenOption`) n'ont aucun réglage, et alourdissent certains fichiers.
- Le filtre Quartz est celui du « Réduire la taille du fichier » d'Aperçu. Construit en mémoire avec `QuartzFilter(properties:)`, il prend une résolution, une qualité JPEG et un plafond du plus grand côté. Sans ce plafond, le scan Gemini sort seize fois plus lourd.
- Aucune voie ne gagne partout. Le texte, les liens, les champs et les signets sont gardés par toutes.
- Les deux gros fichiers connus sortent plus lourds par toutes les voies (livre scanné en JBIG2 : 555 % au mieux ; publication IRS : 448 %), en 70 à 100 s par écriture.

## Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Moteur | `PDFCompression.compressed` écrit deux copies par niveau et garde la plus légère : les options documentées, et le filtre Quartz du niveau | Aucune voie ne gagne partout ; deux écritures restent rapides (0,1 à 0,6 s sur les fichiers d'essai) |
| Niveaux | Extrême : JPEG et écran, filtre à 96 ppp, qualité 0,5, 1 600 px au plus. Recommandée : JPEG et écran, filtre à 150 ppp, 0,6, 2 400 px. Basse : JPEG seul, filtre à 200 ppp, 0,8, 3 200 px | Les trois niveaux, leur ordre, leurs textes, leurs résolutions et leurs qualités sont ceux du site |
| Rien à gagner | Si aucune copie n'est plus légère d'au moins 1 %, le moteur rend `nil` : l'écran dit que le PDF était déjà bien pressé, rien n'est enregistré | Une copie plus lourde que l'original n'a pas de sens |
| Vérification | Une copie dont le nombre de pages diffère, ou qui demande un mot de passe, est écartée. Si aucune écriture ne donne de copie valable, c'est une erreur, pas un PDF « déjà bien pressé » | Garde-fou sur une clé d'écriture non documentée |
| Scans en noir et blanc | À l'ouverture, `PDFCompression.hasBilevelScan` cherche une grande image à un bit (500 × 500 pixels ou plus, dans la page ou dans un formulaire). L'écran prévient alors que la compression peut la rendre floue | Toutes les écritures de PDFKit passent chaque image en JPEG ; aucun réglage n'en épargne une. Le site, lui, laisse ces images intactes |
| Deux temps | « Compresser le PDF » calcule et affiche le gain ; « Enregistrer la copie compressée… » vient ensuite | L'utilisateur sait ce qu'il gagne avant de choisir où enregistrer |
| Résultat gardé | Le gain reste affiché après l'enregistrement. Un autre niveau ou un autre PDF l'efface ; le niveau reste d'un PDF au suivant | On compresse souvent plusieurs fichiers au même niveau |
| Annuler | Le travail se fait hors de l'écran, avec « Annuler ». PDFKit ne s'arrête pas au milieu d'une écriture : la session se libère tout de suite, et le résultat est jeté quand l'écriture finit | Les deux gros fichiers demandent trois minutes |
| iPhone | Sans le filtre Quartz, qui n'existe que sur Mac : les options documentées seules | Le paquet `PDFCore` compile aussi pour iOS |
| Moine | « Frère Pressoir », livre, l'air appliqué : la pose du site | Même personnage que sur le site |

## Ce qui change dans les briques communes

- `PDFCopySession.prepare` fait tourner le travail d'un outil sur le document ouvert, hors de l'acteur principal ; la session est dans l'état `working`, et `cancelWork` l'en sort. Un travail lancé après une annulation attend la fin de l'écriture abandonnée : deux écritures en même temps se disputeraient la mémoire. Le travail est déclaré au système, pour ne pas ralentir quand la fenêtre est cachée. Il retire aussi la mention « copie enregistrée » : le fichier sur le disque n'est plus ce que l'outil vient de produire.
- `CopyToolView` affiche le travail en cours et son bouton « Annuler » en bas du panneau (`workingTitle`).
- `PDFCopySession.forget` devient `onSaved` et `onClosed` : Compresser garde son résultat après l'enregistrement, Protéger vide ses champs dans les deux cas.

## Parcours

1. Ouvrir ou déposer un PDF. Un fichier protégé demande son mot de passe.
2. Choisir le niveau, puis « Compresser le PDF ».
3. L'écran affiche le gain (« Votre PDF est 68 % plus léger », « 1,2 Mo → 388 ko »), ou dit que le PDF était déjà bien pressé.
4. « Enregistrer la copie compressée… » propose `nom-compressé.pdf`.

## Limites connues

- Seules les images changent. Un PDF de texte, ou dont les images sont déjà petites, ne s'allège pas.
- Dans un PDF qui mêle photos et pages scannées en noir et blanc, ces pages passent en JPEG et perdent en netteté : l'écran le dit à l'ouverture, mais ne peut pas l'éviter.
- Recommandée et Extrême partagent l'écriture aux options documentées : sur un fichier que le filtre Quartz ne touche pas, les deux niveaux donnent la même copie.
- Les scans en noir et blanc (JBIG2, CCITT) ne s'allègent pas : PDFKit les réécrit dans un format plus lourd.
- Depuis le 2 octobre au soir, l'aperçu montre la copie compressée dès qu'elle existe, et un sélecteur « Copie compressée | Original » permet de comparer avant d'enregistrer (`PDFCopySession.showCopy`). La copie est ouverte une fois, hors de l'acteur principal, à la fin de la compression. Changer de niveau revient à l'original.
- Le niveau ne garantit pas un poids : il fixe la résolution et la qualité des images.
- La clé d'écriture `QuartzFilter` n'est pas documentée par Apple. C'est celle qu'utilise Aperçu ; si elle cessait d'agir, l'outil garderait les options documentées.
- La copie d'un PDF protégé s'ouvre sans mot de passe, et l'écran le dit.
- Les limites de PDFKit décrites dans la spec de Protéger (étiquettes de pages perdues) s'appliquent.

## Tests

| Niveau | Quoi | Où |
|---|---|---|
| Moteur | Un PDF de photo deux fois plus léger au moins, de plus en plus du niveau Basse à Extrême, texte gardé ; un PDF sans photo rend `nil` ; lien, valeur de champ et signet gardés ; copie d'un PDF protégé ; PDF signé refusé ; grande image à un bit trouvée, directe ou dans un formulaire, petite ignorée | `PDFCompressionTests` |
| Session commune | Le travail d'un outil sur le document ouvert, son échec ; un travail annulé qui ne s'arrête pas, et le suivant qui attend sa fin ; la mention « enregistrée » retirée | `PDFCopySessionTests` |
| Outil | Compresser puis enregistrer, original intact, gain gardé après l'enregistrement ; PDF déjà léger ; résultat effacé par un autre niveau ou un autre PDF ; scan en noir et blanc annoncé à l'ouverture | `CompressSessionTests` |
| Écrans | Départ, prêt, gain en clair, en sombre et en anglais, copie enregistrée, déjà léger, travail en cours avec « Annuler » | `CompressSnapshots` |
| Fichiers réels | 36 PDF de `fixtures-private/pdfs`, aux trois niveaux (3 refusés : illisibles ou mot de passe inconnu) : pages, champs, liens, signets et texte comptés, tous gardés ; les niveaux vont toujours dans le bon sens | Sonde du 2 octobre, non gardée |
| Textes | Tous traduits, sans tutoiement | `check-strings.py` |
