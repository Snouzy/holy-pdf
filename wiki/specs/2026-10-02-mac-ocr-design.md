# Mac — OCR

_Rédigé le 2 octobre 2026. Statut : appli Swift retirée le 5 octobre 2026 (tag `mac-final`) ; à l'époque, livré dans `apps/mac`. Quatrième des six outils commandés le 2 octobre (avant : [Numéros de page](2026-10-02-mac-page-numbers-design.md), [Protéger et Déverrouiller](2026-10-02-mac-protect-unlock-design.md), [Compresser](2026-10-02-mac-compress-design.md) ; ensuite : Noircir)._

## Objectif

Rendre un PDF scanné cherchable dans Holy PDF pour Mac : lire le texte que montrent ses pages et le poser par-dessus, invisible, puis enregistrer la copie. Vision et PDFKit seulement, sans nouveau moteur.

La spec est réussie quand :

- une page sans texte porte, dans la copie, le texte lu dans son image : la recherche le trouve, la sélection le copie ;
- le texte ajouté est invisible, et placé là où le lecteur voit les mots, y compris sur une page pivotée ;
- une page qui a déjà son texte n'est pas touchée ;
- un PDF où il n'y a rien à ajouter n'est pas enregistré, et l'écran le dit avant de demander où enregistrer ;
- le fichier d'origine n'est jamais modifié ;
- les tests du paquet, de l'appli et des textes passent, sans avertissement du compilateur.

## Deux voies comparées (sondes du 2 octobre)

Cinq pages d'un livre de 1886, rendues en images sans texte :

| Voie | Durée | Lecture d'une ligne |
|---|---|---|
| Option d'écriture de PDFKit (`saveTextFromOCROption`) | 5,5 s | « Unt a narrow strip from the belly tol », une ligne manquante |
| Lecture du Scanner (`TextReader`, Vision en mode précis) sur la page rendue à 2 400 px | 1,8 s | « Cut a narrow strip from the belly for » |

Vision lit mieux et trois fois plus vite, donne la progression page par page et s'annule entre deux pages. Entre 1 600, 2 400 et 3 200 px, la lecture change peu ; 2 400 px tient un A4 à 200 ppp.

## Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Lecture | Celle du Scanner : `TextReader.read`, Vision en mode précis, roumain, français et anglais, sans correction linguistique | Déjà éprouvée sur les documents administratifs ; la correction réécrit les noms, les numéros et les dates |
| Écriture | `PDFTextLayer.adding` : la brique `PageOverlay` du Filigrane dessine la page, puis le texte en mode invisible, avec `PDFWriter.drawInvisibleText` du Scanner | Deux briques déjà testées. L'image de la page n'est pas réencodée par nous |
| Indépendance | `PDFCore` ne connaît pas Vision : il reçoit la fonction de lecture. L'appli lui passe celle de `ScanCore` | `PDFCore` et `ScanCore` restent deux modules sans lien |
| Pages lues | Celles qui ont moins de 50 caractères de texte : une page scannée porte souvent un tampon (un numéro de page posé par cette appli, un en-tête de fax, la marque d'un scanner). Ce que la page dit déjà n'est pas écrit une deuxième fois. Une page qui a son texte, même mauvais, reste telle quelle | Sans cela, « numéroter puis lire » dans cette appli ne lirait rien. Une deuxième couche sur une page tapée doublerait chaque mot dans la recherche |
| Annotations | Les champs de formulaire, les notes et les tampons posés sur la page ne sont pas lus | Leur texte n'est pas celui de la page, et il peut changer après coup |
| Mémoire | `render` vide ce que PDFKit garde après chaque page | Mesuré le 2 octobre : 625 Mo pour 40 pages avant, 3 Mo après |
| Lecture non enregistrée | Ouvrir un autre PDF ou quitter demande confirmation tant que la copie lue n'est pas enregistrée | La lecture d'un long scan prend des minutes |
| Rien à ajouter | Le moteur rend `nil` : l'écran dit qu'il n'y a pas de texte à ajouter, rien n'est enregistré | Une copie identique n'a pas de sens |
| Deux temps | « Lire le texte » lit et affiche le résultat ; « Enregistrer la copie avec son texte… » vient ensuite | L'utilisateur voit ce qui a été lu avant de choisir où enregistrer |
| Ce qui a été lu | Les lignes lues sont surlignées sur l'aperçu de la page | Le texte ajouté est invisible : sans cela, rien ne montre le travail |
| Progression | « Lecture de la page 4 sur 12… » pendant la lecture de la page 4, avec « Annuler » ; l'annulation prend effet à la page suivante | 300 pages demandent deux minutes |
| Moine | « Frère Lecteur », loupe, l'air appliqué pour ne pas doubler Frère Loupe | L'accessoire du site pour l'OCR |

## Parcours

1. Ouvrir ou déposer un PDF. Un fichier protégé demande son mot de passe.
2. « Lire le texte ». La barre du bas donne la page en cours.
3. L'écran dit sur combien de pages du texte a été ajouté, et surligne les lignes lues sur la page affichée ; ou dit qu'il n'y a rien à ajouter.
4. « Enregistrer la copie avec son texte… » propose `nom-ocr.pdf`.

## Limites connues

- Par défaut, trois langues lues ensemble : roumain, français, anglais. Depuis le 2 octobre au soir, « Langue du texte » propose aussi chacune des langues que Vision lit sur ce Mac, une à la fois. La langue choisie sert à la lecture suivante : la lecture déjà faite reste à l'écran, un clic dans une liste ne doit pas jeter des minutes de lecture. Les lettres latines se lisent pareil dans toutes les langues (Vision lit sans correction de langue) : le choix compte pour les autres écritures, japonais, chinois, coréen, arabe, thaï. Le choix n'est pas gardé d'un lancement de l'appli à l'autre.
- Une page qui mêle 50 caractères ou plus de texte tapé et une image avec des mots n'est pas lue.
- Les lignes de faible confiance ne sont pas écartées : une photo ou un schéma peut donner quelques mots sans sens.
- La copie lue reste en mémoire jusqu'à son enregistrement ou à la fermeture du document.
- Un texte existant de mauvaise qualité (un ancien OCR) n'est pas remplacé : PDFKit ne sait pas retirer du texte d'une page.
- L'écriture manuscrite et les très petits caractères d'un scan grossier se lisent mal : la copie porte ce que Vision a lu, erreurs comprises.
- Les limites de PDFKit à l'écriture s'appliquent (spec du Filigrane) : lenteur et fichiers gonflés sur certains scans en JBIG2.
- La copie d'un PDF protégé s'ouvre sans mot de passe, et l'écran le dit.

## Tests

| Niveau | Quoi | Où |
|---|---|---|
| Moteur | Une page scannée reçoit les lignes lues, sur une image de 2 400 px, avec la progression ; le texte est invisible ; il tombe au bon endroit sous les quatre rotations ; les pages qui ont du texte ne sont pas lues ; un scan qui porte un numéro de page est lu, sans réécrire le numéro ; une lecture annulée s'arrête à la page suivante ; rien à ajouter rend `nil` ; un lecteur en échec arrête le travail ; PDF signé refusé, PDF protégé ouvert ; le surlignage de l'aperçu | `PDFTextLayerTests` |
| Outil | Lire un scan avec Vision, surlignage sur l'aperçu, copie cherchable enregistrée, original intact ; une lecture non enregistrée compte comme une modification ; un PDF tapé n'a rien à lire ; un autre PDF efface le résultat | `OCRSessionTests` |
| Écrans | Départ, prêt, texte lu en clair, en sombre et en anglais, rien à ajouter | `OCRSnapshots` |
| Fichiers réels | Cinq pages scannées d'un livre : 2,2 s, les cinq pages cherchables (« CUTTING UP A HOG » trouvé), fichier de 7 460 à 7 496 Ko. Un formulaire tapé et une page pivotée : rien à ajouter | Sonde du 2 octobre, non gardée |
| Textes | Tous traduits, sans tutoiement | `check-strings.py` |
