# Mac — Organiser les pages

## Parcours

Quatrième outil natif, Frère Classeur. Ouvrir ou déposer un PDF, afficher ses pages dans une grille adaptative. Chaque carte propose aperçu agrandi, déplacement précédent/suivant, rotation horaire et suppression. Le glisser déplace une page avant/après une carte ou en fin de grille. Pendant le glisser, une barre d'insertion montre où la page va se poser : à gauche de la carte survolée si le pointeur est sur sa moitié gauche, à droite sinon. Les zones de dépôt couvrent aussi l'espace entre les cartes. Un changement d'ordre (glisser, flèches, annulation) est animé. Les positions affichées sont celles de la copie ; le numéro de page source reste identifiable. La dernière page ne peut pas être supprimée. Annuler (⌘Z) restaure ordre, pages supprimées et rotations. L’original reste intact ; enregistrer utilise le panneau macOS et crée une copie.

Un document à la fois, mots de passe locaux, erreurs explicites et abandon confirmé seulement quand le travail non enregistré serait perdu. La session survit à la fermeture de la fenêtre. Ouvrir un autre fichier ou quitter respecte les modifications non enregistrées. Les commandes ⌘O, ⌘E et ⌘Z suivent l’outil actif. Français/anglais, couleurs système, boutons avec survol, Frère Classeur dans la grille d’accueil.

## Moteur et performance

`PDFOrganizingDocument` dans PDFCore possède les données originales et le document de lecture, dans un acteur. L’état d’édition se limite aux index de pages et à leurs rotations ; déplacer ou tourner une carte ne redemande aucun rendu. L’export repart d’un document frais, préserve les contenus vectoriels et sélectionnables, et ne rastérise pas les pages. Les cibles de liens/signets retirées sont nettoyées, les structures incompatibles et certificats refusés explicitement. Les limites de conservation doivent être documentées et visibles avant l’export.

256 Mio maximum à l’ouverture, lecture hors acteur principal ; miniatures à la demande limitées à 240 pixels, cache de 32 images. Les cartes quittant l’écran libèrent leurs images. L’aperçu agrandi ne rend qu’une page à 1 600 pixels. Ces plafonds ne constituent pas une garantie sur la mémoire interne de PDFKit. Historique de 100 actions, sans copie des pixels. Aucune dépendance ni permission réseau nouvelle. Les destinations égales à la source, à un lien symbolique ou physique sont refusées.

## Vérification

Fixtures synthétiques : ordre/export, rotations, suppression, undo, fichiers protégés, conservation des textes/annotations/liens/signets, annulation et sources intactes. Mesure sur 100 pages ; contrôle du geste de glisser dans une vraie fenêtre et des extrémités. Captures clair/sombre à la taille minimale, types/compilation, tests Swift et catalogue de textes. Aucun document privé ajouté.
