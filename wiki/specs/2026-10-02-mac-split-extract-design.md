# Mac — Diviser un PDF et Extraire des pages

_Rédigé le 2 octobre 2026. Statut : livré dans `apps/mac`._

## Objectif

Deux outils de plus dans Holy PDF pour Mac, sur le moteur d'Organiser, sans nouveau moteur ni dépendance :

- **Diviser** (Frère Ciseaux) : couper un PDF en plusieurs fichiers, là où on veut ;
- **Extraire** (Frère Loupe) : garder seulement les pages choisies, dans un nouveau PDF.

La spec est réussie quand :

- chaque morceau d'un PDF divisé contient ses pages, dans l'ordre, avec leur texte sélectionnable ;
- le PDF extrait contient les pages choisies, dans l'ordre du document ;
- aucun fichier existant n'est écrasé, et le fichier d'origine n'est jamais modifié ;
- les tests du paquet, de l'appli et des textes passent, sans avertissement du compilateur.

## Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Deux outils, un écran | Deux cartes sur l'accueil. Un seul écran et une seule session, avec un mode « diviser » ou « extraire » | Choix de l'auteur : un moine par outil, comme le site. Les deux outils ne diffèrent que par ce qu'on marque (une coupe ou une page) et par l'enregistrement |
| Coupes | Des ciseaux entre deux pages posent ou retirent une coupe. « Pages par fichier » pose les coupes d'un coup | Choix de l'auteur. Couvre les morceaux réguliers et irréguliers |
| Fichiers de Diviser | Dans un dossier choisi : `nom-1.pdf`, `nom-2.pdf`… Un fichier déjà présent garde sa place : le nouveau s'appelle `nom-1-2.pdf` | Choix de l'auteur. Rien n'est écrasé, donc l'original non plus |
| Extraire | Un seul PDF, `nom-extrait.pdf`, par le panneau d'enregistrement | Choix de l'auteur. Un fichier par page : Diviser le fait |
| Moteur | `PDFOrganizingDocument.organizedData`, appelé une fois par morceau | Il écrit déjà un sous-ensemble de pages, retire les liens vers les pages absentes et garde les signets valides |
| Chargement | La session contient une `OrganizingSession`, qui ouvre le PDF, demande le mot de passe et rend les vignettes | Pas de second chargeur. `OrganizingSession` reçoit seulement la fonction qui formule ses messages, et une méthode qui copie des pages |
| Refus | Comme Organiser : PDF signé numériquement, pièces jointes, calques, formulaires dynamiques | Même moteur, mêmes limites |

## Parcours

1. **Ouvrir** ou déposer un PDF. Un fichier protégé demande son mot de passe.
2. **Marquer**, sur la grille des pages :
   - *Diviser* : un bouton ciseaux entre deux pages pose une coupe ; un second clic la retire. Chaque page dit dans quel fichier elle ira (« Fichier 2 »), et les fichiers alternent deux teintes. « Pages par fichier » et « Appliquer » posent les coupes régulières ; « Retirer les coupes » les enlève. Un clic sur une page l'agrandit.
   - *Extraire* : un clic sur une page la coche ou la décoche. Un bouton œil l'agrandit. « Tout sélectionner » et « Tout désélectionner ».
3. **Enregistrer** :
   - *Diviser* : « Diviser en N PDF… » ouvre le choix d'un dossier, puis écrit un fichier par morceau. L'écran dit combien de fichiers sont écrits et propose « Afficher dans le Finder ».
   - *Extraire* : « Enregistrer la sélection… » ouvre le panneau d'enregistrement.

⌘O ouvre, ⌘E enregistre, ⌘Z annule la dernière coupe ou sélection. Ouvrir un autre PDF ou quitter avec des marques non enregistrées demande confirmation.

## Limites connues

- Celles de PDFKit, décrites dans la spec du Filigrane : écriture lente et fichiers plus lourds sur certains PDF.
- Chaque morceau relit le PDF d'origine : diviser en 100 fichiers fait 100 lectures. Mesuré sur 100 pages de synthèse : 100 fichiers en 0,18 s.
- Si l'écriture échoue au milieu d'une division, les fichiers déjà écrits restent, et l'écran dit après quel fichier elle s'est arrêtée. Un fichier est écrit en entier ou pas du tout : chaque morceau passe par un fichier temporaire, puis est déplacé à sa place.
- Pendant que le panneau d'enregistrement ou de dossier est ouvert, les marques ne changent pas : ce qui est enregistré est ce qui était à l'écran.

## Tests

| Niveau | Quoi | Où |
|---|---|---|
| Session | Extraire : les pages choisies dans l'ordre du document, l'original intact, rien sans sélection, annulation. Diviser : les morceaux d'après les coupes, « pages par fichier », un fichier par morceau, aucun fichier écrasé, annulation. Un nouveau PDF efface les marques | `PagePickingSessionTests` |
| Marque | Frère Ciseaux et Frère Loupe dans le catalogue, en clair et en sombre, à jour avec le site | `MonkAssetTests`, `export-monk-assets.mjs` |
| Accueil | Diviser et Extraire ne sont plus dans « Bientôt » | `BrandTests` |
| Écrans | Captures des deux outils, en clair et en sombre | `PagePickingSnapshots` |
| Textes | Tous traduits, sans tutoiement | `check-strings.py` |
| À la main | Les étapes de `wiki/development/tests.md` | |
