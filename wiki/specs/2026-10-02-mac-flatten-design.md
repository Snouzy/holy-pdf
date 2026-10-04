# Mac — Aplatir

_Rédigé le 2 octobre 2026. Statut : livré dans `apps/mac`. Demandé par l'auteur le 2 octobre, après l'[accueil par catégories](2026-10-02-mac-home-design.md) : le site a l'outil depuis le même jour ([spec du site](2026-10-02-web-flatten-design.md))._

## Objectif

Figer un PDF rempli ou annoté dans Holy PDF pour Mac : les champs de formulaire remplis et les annotations passent dans le contenu des pages, puis on enregistre la copie. Ils gardent leur aspect et ne se modifient plus. PDFKit seulement.

La spec est réussie quand :

- la valeur d'un champ rempli devient du texte de la page, et le champ disparaît ;
- la page a le même aspect avant et après ;
- le texte reste du texte, les signets restent, et les liens restent des liens ;
- un PDF sans champ ni annotation est refusé dès l'ouverture, avec la raison ;
- le fichier d'origine n'est jamais modifié ;
- les tests du paquet, de l'appli et des textes passent, sans avertissement du compilateur.

## Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Moteur | `PDFFlattening.flattened` : l'option d'écriture `burnInAnnotationsOption` de PDFKit | Sonde du 2 octobre : la valeur d'un champ du formulaire W-9 se retrouve dans le texte de la page, et moins de 0,02 % des pixels changent |
| Liens | PDFKit grave toutes les annotations, liens compris ; un lien n'a rien à dessiner et cesserait de marcher. Les liens sont relevés avant, puis reposés sur la copie aplatie : adresse, ou page et point de destination | Le site perd les liens (PDFium retire toutes les annotations). Un sommaire qui ne mène plus nulle part serait une perte muette. Sonde : 113 liens sur 113 retrouvés |
| Ce que le lecteur ne voit pas | Avant la gravure, le moteur retire les annotations cachées (drapeau Hidden) et les bulles des notes. PDFKit, lui, les graverait : la valeur d'un champ caché apparaîtrait dans la page, et une bulle laissée ouverte poserait une boîte opaque sur le texte | Deux défauts prouvés par la relecture du 2 octobre. Le moteur du site (PDFium) saute aussi les deux |
| Rien à aplatir | `PDFFlattening.survey` compte les champs et les annotations visibles, sans les liens ni les bulles. À zéro, le PDF est refusé à l'ouverture : « Ce PDF n'a ni champ ni annotation à aplatir » | Une copie identique n'a pas de sens, et le dire avant le panneau d'enregistrement évite un détour |
| Écran | La session et l'écran communs, sans réglage ; l'écran dit combien de champs et d'annotations seront aplatis | Comme sur le site : pas de réglage |
| Moine | « Frère Rouleau », le livre, souriant : la pose du site | Même personnage que sur le site |

## Parcours

1. Ouvrir ou déposer un PDF rempli ou annoté. Un fichier protégé demande son mot de passe.
2. L'écran dit combien de champs et d'annotations il a trouvés.
3. « Enregistrer la copie aplatie… » propose `nom-aplati.pdf`.

## Limites connues

- Un champ vide ou sans apparence n'a rien à dessiner : il disparaît sans laisser de trace.
- Le texte d'une note (sa bulle) n'est pas écrit dans la page : seule son icône est gravée.
- Un fichier joint à une page par une annotation n'est pas gardé dans la copie : l'écran le dit à l'ouverture.
- Un formulaire vide s'aplatit en cases vides qui ne se remplissent plus : l'écran ne prévient pas.
- Une annotation qui ne s'imprime pas (un bouton « Imprimer ») est gravée et s'imprimera.
- Deux écritures PDFKit se suivent quand le PDF a des liens : trois minutes sans « Annuler » sur la publication IRS de 142 pages et 2 955 liens.
- Un lien qui lance autre chose qu'une adresse ou un saut dans le document (un script, un fichier) n'est pas reposé.
- Les limites de PDFKit à l'écriture s'appliquent (spec du Filigrane, spec de Protéger pour les étiquettes de pages).
- La copie d'un PDF protégé s'ouvre sans mot de passe, et l'écran le dit.

## Tests

| Niveau | Quoi | Où |
|---|---|---|
| Moteur | Valeur du champ dans le texte de la page, champ et carré disparus, signet gardé ; même aspect ; les deux liens (adresse et saut) marchent encore ; champ caché, bulle ouverte et lien caché ni dessinés ni comptés ; fichier joint compté ; compte des champs et annotations ; PDF signé refusé, PDF protégé ouvert | `PDFFlatteningTests` |
| Outil | Compte affiché, copie aplatie enregistrée, original intact ; PDF sans rien à aplatir refusé à l'ouverture | `FlattenSessionTests` |
| Écrans | Départ, prêt en clair, en sombre et en anglais, copie enregistrée, rien à aplatir | `FlattenSnapshots` |
| Fichiers réels | Sept PDF de `fixtures-private/pdfs` : les 23 champs du W-9 aplatis, surlignage et tampon gravés, 113 liens gardés | Sonde du 2 octobre, non gardée |
| Textes | Tous traduits, sans tutoiement | `check-strings.py` |
