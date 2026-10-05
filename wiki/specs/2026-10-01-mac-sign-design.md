# Mac — Signer un PDF

_Appli Swift retirée le 5 octobre 2026 : cette spec est une archive, le code est au tag `mac-final`._

## Objectif

Ajouter une signature visuelle dessinée ou importée à un PDF dans Holy PDF pour Mac, puis enregistrer une nouvelle copie. Le Scanner reste disponible. Aucun serveur, compte ou nouveau moteur : PDFKit, Core Graphics et ImageIO suffisent.

## Identité et parcours

Frère Plume rejoint le monastère comme deuxième outil. Le moine est exporté depuis le dessin officiel ; Bricolage reste réservé aux grands titres, les autres textes et contrôles restent natifs. Fonds système, accent bleu, modes clair et sombre, vouvoiement et catalogue français/anglais.

1. Ouvrir ou déposer un PDF. Un fichier verrouillé demande son mot de passe. Un PDF signé numériquement est refusé explicitement pour préserver son certificat. Un formulaire qui ne porte que des droits d'usage Adobe (`/UR`, `/UR3`, comme les formulaires du fisc américain) est accepté : personne ne l'a signé. La copie perd ces droits d'usage. Le contrôle est commun à Signer, Fusionner, Organiser et Filigrane.
2. Créer une signature dans une feuille native : dessin à la souris/au trackpad, ou import PNG/JPEG. Le fond transparent d'un PNG est conservé ; un JPEG garde son fond.
3. Afficher une page à la fois, choisir la page précédente/suivante, ajouter la signature, la déplacer et modifier sa taille proportionnellement. Plusieurs placements de la même signature sont possibles, et plusieurs marques différentes depuis le 3 octobre. Supprimer un placement et annuler une retouche sont disponibles.
4. Enregistrer une copie avec le dialogue macOS. Le PDF source reste inchangé. Le résultat indique le fichier enregistré et permet de le montrer dans le Finder.

Disposition de travail : page centrée sur un fond système à gauche ; panneau de signature et bouton d'enregistrement à droite. La signature se déplace au-dessus de l'aperçu, sans calculer un nouveau rendu PDF. La fenêtre garde ses dimensions minimales actuelles, 960 × 640. Les commandes désactivées expliquent le prochain geste. Les moines restent au démarrage et sur la carte, conformément au design natif.

## Plusieurs marques (3 octobre 2026)

À la demande de l'auteur, l'écran reprend ce que Signer fait sur le web ([spec du site](2026-10-01-web-sign-design.md)) : plusieurs marques différentes coexistent et chacune se pose autant de fois que voulu.

| Sujet | Décision | Raison |
|---|---|---|
| Marques | Une liste « Vos marques » dans le panneau : signatures dessinées, images importées, lignes tapées. Vingt au plus, et l'écran le dit à la vingt et unième. Créer une marque n'efface pas les autres, ni une marque encore en train de se décoder ; la nouvelle devient la marque courante et se pose aussitôt | Un contrat demande une signature, des initiales et une date. Relecture du 3 octobre : un second ajout annulait le premier sans un mot |
| Texte | Une ligne de 120 caractères au plus (le champ s'arrête là, et garde sa ligne après l'ajout), en Manuscrit (Bradley Hand, livrée avec macOS) ou en Simple (Helvetica), rendue en image transparente par Core Text, large comme ses glyphes, puis traitée comme une signature. Posée haute de 24 points, quelle que soit sa longueur | La règle du site, avec une police du Mac au lieu de Caveat : pas de fichier à embarquer. Relecture du 3 octobre : posée large de 28 % de la page, « AL » faisait un tiers de la hauteur |
| Pose | « Placer sur cette page » pose la marque courante au centre ; un clic sur la page la pose à cet endroit, dans les limites de la page. Le premier clic ne fait que désélectionner la marque sélectionnée | Comme sur le site (« Ajouter ici ») |
| Retrait | La corbeille d'une marque la retire avec toutes ses places ; « Retirer de la page » retire la place sélectionnée. Les deux s'annulent | |
| Moteur | `PDFSigningDocument.signedData(marks:placements:)` : chaque place nomme sa marque ; chaque image est décodée une fois | Les tampons de PDFKit portent chacun leur apparence : une marque posée trois fois est écrite trois fois (le site partage un seul objet) |

Hors de ce lot, que le site offre : la rotation d'une marque, le zoom de la page et la rotation de la page.

## Conservation

Un acteur `PDFSigningDocument` dans `PDFCore` possède le document PDFKit et ses données. Il n'importe ni AppKit ni UIKit. L'export ouvre une copie des données originales et ajoute des annotations stamp avec une apparence persistante ; aucune reconstruction des pages, aucune pixellisation du document ni aplatissement global des annotations.

Les placements sont stockés en rectangles normalisés, origine en haut à gauche de la page visible. Une conversion centralisée tient compte de CropBox et de la rotation. Les exports successifs repartent toujours de l'original : pas d'accumulation cachée. Supprimer l'auteur d'annotation que PDFKit fournit par défaut pour ne pas incorporer l'identité du compte Mac.

Le fichier importé ne change jamais. Les signatures et le mot de passe restent uniquement dans la session mémoire. La copie exportée d’un PDF protégé s’ouvre sans mot de passe, avec une indication dans l’interface. PDFKit peut conserver un dictionnaire de chiffrement à mot de passe vide : ne pas présenter cette copie comme déchiffrée. Fermer la fenêtre conserve la session ; quitter avertit si des placements n'ont pas été enregistrés.

## Performance

- Aucun OCR ni moteur WebAssembly pour Signer ; ouverture et export hors de l'acteur principal.
- Aperçu limité à une seule page, grand côté de 1 600 pixels maximum et surface bornée. Libérer l'ancien aperçu au changement de document et limiter les rendus obsolètes lors d'une navigation rapide.
- Déplacement par superposition, sans rendre la page ni exporter le PDF pendant le geste. Viser moins de 16 ms de travail de mise à jour ; ne pas assimiler une mesure de géométrie à une mesure de fluidité de l'écran entier.
- PDF ouvert dans l’application : 256 Mio maximum avant lecture. Au plus 100 placements et 100 opérations annulables par session.
- Signature importée : 10 Mio et 16 Mpx maximum avant décodage, normalisée à 1 600 pixels de côté et 1 Mpx. Métadonnées de l'image non recopiées.
- Mesurer un aperçu et un export sur un PDF synthétique de 20 pages : repères de 1 s pour l'aperçu et 3 s pour l'export sur cette machine, sans en faire une garantie universelle.

## Validation

Le moteur doit prouver la persistance après réouverture, la transparence, les placements sous les quatre rotations avec recadrage, le texte sélectionnable, les liens, les champs, le titre, l'original intact et l'absence de cumul. Vérifier aussi les mots de passe, les fichiers invalides, les signatures numériques existantes et les limites d'image.

L'application doit couvrir création, placement, suppression, annulation et export ; vérifier les localisations et des captures clair/sombre. `swift test`, tests Xcode et `check-strings.py` restent les commandes de référence. Les contrôles de structure et de rendu sont explicitement délimités : pas de certification de tous les profils PDF ni des formulaires dynamiques.
