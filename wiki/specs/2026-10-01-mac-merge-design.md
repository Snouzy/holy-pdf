# Mac — Fusionner des PDF

## Objectif

Troisième outil natif : réunir plusieurs PDF en un seul fichier, dans un ordre choisi, sans modifier les originaux. Frère Agrafe rejoint la grille de l’accueil. La session Web reste indépendante. Aucun serveur, moteur supplémentaire ou dépendance.

## Parcours

1. Choisir plusieurs PDF ou les déposer. Les fichiers sont lus séquentiellement hors du thread principal. Chaque ligne affiche son nom, son nombre de pages et son poids, avec un aperçu de première page chargé à l’apparition de la ligne.
2. Un fichier protégé demande son mot de passe dans une feuille dédiée. Un fichier illisible ou incompatible reste visible avec un message et peut être retiré. Un PDF signé numériquement est refusé pour ne pas présenter une fusion comme conservant son certificat.
3. Changer l’ordre des documents par glissement ou avec les boutons Monter/Descendre ; retirer un fichier et annuler l’action. Ajouter d’autres fichiers reste possible. Le déplacement des pages au sein d’un document relève du futur outil Organiser.
4. Fusionner exige au moins deux fichiers valides, sans fichier encore verrouillé ou en erreur. Le panneau macOS enregistre une copie. Aucun fichier source, lien symbolique ou lien physique vers une source ne peut devenir la destination.
5. Le résultat indique le nom du fichier enregistré et propose Afficher dans le Finder. Un nouveau lot demande confirmation si le travail courant n’a pas été exporté ; quitter également. Fermer la fenêtre conserve la session.

## Conservation

`PDFMergeCollection`, acteur de `PDFCore`, conserve les données sources immuables et leurs informations validées. L’export reconstruit l’assemblage depuis des copies fraîches des données sources, en insérant leurs pages PDF ; il ne dessine pas les pages dans un nouveau contexte bitmap. L’ordre de l’interface détermine l’ordre exact d’export. Les exports successifs sont indépendants.

Les tests couvrent texte sélectionnable, images, MediaBox/CropBox, rotations, liens URI, destinations internes, annotations avec apparence, signets et champs remplis. Les champs de documents distincts doivent rester indépendants même si leurs noms se ressemblent. PDFKit peut demander de renommer des champs internes et de résoudre explicitement des destinations avant insertion. Les structures interactives que le moteur ne peut conserver (formulaires XFA ou calculés, scripts, pièces jointes, calques) sont refusées explicitement. Les documents contenant des balises d’accessibilité ou des profils d’archivage/impression sont acceptés avec une indication visible avant export : ces structures ne seront pas reprises, la conformité PDF/A et les couleurs à l’impression ne sont pas garanties. Les préférences de vue initiale ne sont pas reprises dans le nouveau document. Aucune promesse de conservation de tous les profils PDF ou des certificats numériques.

Les copies issues de sources protégées s’ouvrent sans mot de passe, ce que l’interface annonce. Mots de passe et documents ne sont conservés que dans la session locale. L’auteur d’un document source n’est pas repris comme auteur du document fusionné.

## Performance et limites

- Aucun PDF rendu au déplacement d’une ligne ; seul l’ordre d’identifiants change.
- Première page uniquement, aperçu borné à 240 pixels de côté ; cache de 32 aperçus maximum (moins de 7,4 Mo RGBA hors frais du framework). Les demandes hors écran sont annulables.
- 100 fichiers chargés au maximum, 256 Mio par fichier, 512 Mio cumulés de données sources, y compris les documents retenus pour annuler une suppression. Ce plafond ne représente pas la mémoire totale PDFKit ni le pic d’export.
- 100 opérations annulables ; libérer les sources supprimées quand aucune opération ne peut les restaurer. Un nouveau lot libère également l’historique.
- Import séquentiel, traitement PDFKit dans l’acteur ; lectures et écriture de fichiers hors de l’acteur principal.
- Mesurer une fusion de 20 documents / 100 pages synthétiques et le premier aperçu. Repères indicatifs : aperçu < 1 s, export < 3 s sur cette machine.

## Interface

Cartes d’accueil en grille adaptative (deux côte à côte dès 960 points). Frère Agrafe vient du dessin officiel Web, exporté dans un sous-catalogue propre à Fusionner sans modifier Web ni Generated. Fonds système, accent bleu, Bricolage pour les titres, textes français/anglais et vouvoiement. Les commandes ⌘O, ⌘E et ⌘Z suivent l’outil affiché.

## Validation

Tests PDFCore avec fixtures synthétiques, vérification indépendante du PDF exporté, tests de session (ordre, undo, erreurs, export et protection des sources), captures natives clair/sombre, catalogue de textes et export de marque. Pas de photo ou document personnel ajouté au dépôt.


## Retours d’usage du 2 octobre

Le clic sur une vignette ouvre une feuille d’aperçu du document entier, avec navigation page précédente/suivante. Une seule page est rendue à la demande, jusqu’à 1 600 pixels de côté, et libérée à la fermeture ; les vignettes restent à 240 pixels. Les fichiers protégés utilisent les données déjà ouvertes dans la session.

« Aperçu », à côté de l'enregistrement (4 octobre 2026), ouvre la même feuille sur le PDF fusionné : toutes les pages dans l'ordre de la liste, chacune rendue depuis son fichier, sans rien fusionner. Le bouton suit l'état de l'enregistrement.

Le dépôt de fichiers du Finder doit fonctionner sur une ligne et sur les zones vides. Le réordonnancement utilise des destinations explicites avant/après pour atteindre les deux extrémités. Le survol distingue les boutons actifs, sans changer leurs dimensions ni les rendre actifs lorsqu’ils sont désactivés.
