# Mac — Superposer deux PDF

_Rédigé le 2 octobre 2026. Statut : appli Swift retirée le 5 octobre 2026 (tag `mac-final`) ; à l'époque, livré dans `apps/mac`. Dernier outil de la liste approuvée par l'auteur le 2 octobre, après les [signets](2026-10-02-mac-bookmarks-design.md). Le site n'a pas cet outil._

## Objectif

Poser les pages d'un PDF sur celles d'un autre dans Holy PDF pour Mac, puis enregistrer la copie : un papier à en-tête sous une lettre, un fond de formulaire, un tampon d'une page sur tout un dossier. PDFKit seulement.

La spec est réussie quand :

- la page 1 du PDF posé va sur la page 1, la page 2 sur la page 2, et sa dernière page sur toutes celles qui restent ;
- il se pose par-dessus les pages ou dessous, au choix ;
- le texte des deux PDF reste du texte, et les signets et les liens du PDF qui reçoit restent ;
- l'aperçu montre le résultat avant d'enregistrer, pour les deux positions ;
- le fichier d'origine n'est jamais modifié ;
- les tests du paquet, de l'appli et des textes passent, sans avertissement du compilateur.

## Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Moteur | `PDFOverlay.overlaid` passe par `PageOverlay.write`, la brique du Filigrane : PDFKit dessine chaque page, et la page de l'autre PDF avant ou après | Sonde du 2 octobre : 15 pages en 0,4 s, les deux textes gardés, signets et champs du PDF qui reçoit gardés |
| Dessous | `PageOverlay.write(under:)` dessine d'abord, puis la page. Le PDF posé se voit là où la page n'a rien peint | Une page PDF ne peint pas son papier : c'est ce qui rend un papier à en-tête possible |
| Taille | La page posée est ajustée à la page qui la reçoit et centrée, sans déformation, telles que le lecteur voit les deux (rotation et cadre compris) | Un A4 sur un Letter ne doit ni déborder ni s'étirer |
| Dessin du PDF posé | Par Core Graphics (`drawPDFPage`), avec la rotation et le cadre de sa page, pour la copie comme pour l'aperçu | Relecture du 2 octobre : pendant une écriture, `PDFPage.draw` oublie la rotation ; une page posée pivotée d'un quart de tour disparaissait de la copie. Il dessinait aussi les annotations du PDF posé à l'écran seulement |
| Pages en moins | La dernière page du PDF posé se répète sur les pages restantes | Un en-tête d'une page sert tout un document ; un en-tête de deux pages (première, suivantes) aussi |
| PDF posé | Lu seulement : signé, il est accepté. Protégé, il est refusé avec la marche à suivre (le déverrouiller d'abord). Il reste choisi d'un document au suivant | Le même en-tête sert plusieurs lettres. Demander un second mot de passe compliquerait l'écran pour un cas rare |
| PDF qui reçoit | Signé, il est refusé : sa copie garderait une signature qui ne serait plus valide | Comme les autres outils qui réécrivent le document |
| Choix du PDF posé | Un panneau d'ouverture macOS (`chooseFile`), pas un second `fileImporter`. La session est occupée du panneau à la fin de la lecture | Relecture du 2 octobre : de deux `fileImporter` emboîtés, SwiftUI ne présente que celui du dehors, et « Choisir un PDF… » restait sans effet. Le Filigrane avait le même défaut pour son image : corrigé de la même façon |
| Aperçu | `PDFCopySession.underlay` et `preview(underlay:)` dessinent sous la page, sur le papier blanc ; `overlay` par-dessus | Un mélange de couleurs par-dessus aurait montré le PDF posé sur les aplats de couleur, où la copie le cache |
| Moine | « Frère Calque » (Brother Layer), le tampon, en joie | Le site n'a pas l'outil : nom et pose sont à confirmer par l'auteur |
| Recherche | Ses propres mots (`Tool.ownWords`) : superposer, calque, papier à en-tête, arrière-plan | Le site n'en a pas pour lui |

## Parcours

1. Ouvrir ou déposer le PDF qui reçoit. Un fichier protégé demande son mot de passe.
2. « Choisir le PDF à poser dessus… » : son nom et son nombre de pages s'affichent, l'aperçu le montre.
3. Choisir « Par-dessus les pages » ou « Sous les pages ».
4. « Enregistrer la copie superposée… » propose `nom-superpose.pdf`.

## Limites connues

- Pas de réglage de taille, de place ni d'opacité, et pas de choix des pages.
- Les annotations, les champs et les liens du PDF posé ne suivent pas : seul son dessin est posé.
- Par-dessus, les annotations et les champs du PDF qui reçoit restent au-dessus du PDF posé dans la copie, alors que l'aperçu les couvre.
- Dessous, il reste caché partout où la page peint un fond, même blanc (un scan, une page exportée avec un fond).
- Un PDF posé qui est protégé doit d'abord passer par Déverrouiller.
- Les limites de PDFKit à l'écriture s'appliquent (spec du Filigrane).
- La copie d'un PDF protégé s'ouvre sans mot de passe, et l'écran le dit.

## Tests

| Niveau | Quoi | Où |
|---|---|---|
| Moteur | Page pour page et dernière page répétée, les deux textes gardés ; dessus couvre, dessous laisse voir la page ; ajusté et centré, page qui reçoit pivotée ; page posée pivotée, à des places écrites à la main ; aperçu des deux positions ; signets et liens gardés ; PDF qui reçoit signé refusé, PDF posé signé accepté ; mots de passe | `PDFOverlayTests` |
| Outil | Rien à enregistrer sans PDF posé ; aperçu changé ; copie enregistrée, original intact ; position changée qui efface « enregistré » ; PDF posé gardé pour le document suivant ; PDF posé protégé ou illisible refusé avec son message | `OverlaySessionTests` |
| Écrans | Départ, prêt, PDF choisi en clair, en sombre et en anglais, dessous, copie enregistrée | `OverlaySnapshots` |
| Fichiers réels | Un article de 15 pages et un formulaire de 6 pages, l'un sur l'autre, dessus et dessous | Sonde du 2 octobre, non gardée |
| Textes | Tous traduits, sans tutoiement | `check-strings.py` |
