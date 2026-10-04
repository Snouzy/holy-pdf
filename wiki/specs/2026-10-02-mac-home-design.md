# Mac — Accueil par catégories, avec recherche

_Rédigé le 2 octobre 2026. Statut : livré dans `apps/mac`. Demandé par l'auteur le 2 octobre, après [Images en PDF et PDF en images](2026-10-02-mac-images-design.md) : l'accueil avait quinze cartes à plat._

## Objectif

Retrouver un outil sur l'accueil de Holy PDF pour Mac comme sur le site : par sa catégorie, ou en tapant ce qu'on veut faire.

La spec est réussie quand :

- les outils sont rangés sous les cinq catégories du site, dans son ordre ;
- taper « alléger » trouve Compresser, « mot de passe » trouve Protéger et Déverrouiller, « fusioner » (avec la faute) trouve Fusionner ;
- la recherche du Mac et celle du site répondent pareil aux mêmes cas ;
- les mots de recherche ne sont écrits qu'à un endroit : le site ;
- les tests de l'appli et des textes passent, sans avertissement du compilateur.

## Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Catégories | Organiser, Convertir, Modifier, Optimiser, Sécurité : celles du site (`apps/web/src/cast.ts`), dans son ordre, avec ses noms | Une seule façon de ranger les outils pour la marque |
| Rangement | Organiser : Fusionner, Organiser, Diviser, Extraire. Convertir : Images en PDF, PDF en images. Modifier : Signer, Filigrane, Numéroter, Noircir. Optimiser : Scanner, Compresser, OCR. Sécurité : Protéger, Déverrouiller | Le rangement du site, Scanner compris |
| Outils à venir | Leurs moines endormis sont sous les cartes de leur catégorie | La section « Bientôt » séparée disparaît : deux outils seulement (un seul depuis PDF en Word, livré le 2 octobre au soir) |
| Recherche | Le champ de recherche de la fenêtre (`searchable`, ⌘F). Dès qu'un mot utile est tapé, les catégories laissent la place aux moines trouvés. Tant que la demande ne dit rien (vide, mots vides, « pd » en route vers « pdf »), les catégories restent | Le champ natif de macOS, sans rien dessiner. Le site garde aussi sa vue normale dans ce cas |
| Règles | Celles du site (`apps/web/src/home/search.ts`), portées en Swift dans `ToolSearch` : accents et majuscules ignorés, mot en cours de frappe, une faute dès 4 lettres et deux dès 7, mots vides ignorés (« pdf », « de », « fichier »), sens d'une conversion (« pdf en jpg » avant « jpg en pdf »), outils prêts avant les outils à venir | Les deux recherches doivent répondre pareil |
| Noms et mots | L'index de recherche du site (les noms de chaque outil et ses mots, comme `search.json.ts` le construit), copié dans `App/SearchTerms.json` par `apps/web/tests/unit/macSearch.test.ts` : `pnpm test` échoue si la copie n'est plus à jour, `UPDATE_MAC_ASSETS=1 pnpm test` la réécrit. Chaque outil du Mac est cherché par son titre, son moine, et les noms et les mots du site | Une seule source, et le même mécanisme que les dessins des moines. Un script à part avait laissé la copie périmer le jour même (2 octobre). Les noms du site portent des mots que les titres du Mac n'ont pas : « convertir », « add ». Sans eux, « convertir pdf en jpg » trouvait l'outil inverse (relecture du 2 octobre) |
| Langue | Celle de l'interface (`Bundle.main.preferredLocalizations`), pas celle de la région | Un Mac réglé sur la France avec l'appli en anglais doit chercher en anglais |
| Correspondance | Chaque outil du Mac nomme les outils du site dont il prend les mots. Organiser prend aussi ceux de Supprimer des pages et de Pivoter, qu'il fait sur Mac | « tourner » doit trouver Organiser |
| Rien trouvé | « Aucun moine ne fait ça… pour l'instant », un conseil, et « Voir tous les moines » | Les textes du site |
| Hors de ce lot | Favoris et outils récents | Prévus par la feuille de route, à faire quand l'usage le demandera |

## Parcours

1. L'accueil montre les cinq catégories, chacune avec ses cartes.
2. ⌘F ou un clic dans le champ de la barre d'outils ; taper un mot.
3. L'accueil montre les moines trouvés, le meilleur d'abord, et leur nombre.
4. Effacer le champ, ou « Voir tous les moines », ramène les catégories.

## Limites connues

- Le site dit par quel mot un outil a été trouvé (« alléger » → Compresser) ; le Mac ne le dit pas.
- Pas de filtre par catégorie ni de vue compacte, que le site a.
- Les mots suivent la langue de l'appli : français, sinon anglais.
- « ß » et les ligatures (« ﬁ ») sont lus comme « ss » et « fi » ; le site en fait des espaces. Seul écart mesuré sur 443 demandes.

## Tests

| Niveau | Quoi | Où |
|---|---|---|
| Recherche | Les cas de `apps/web/tests/unit/search.test.ts` : synonyme, accents, mot en cours, fautes, mot inconnu, mots vides, sens d'une conversion, moine, outils prêts d'abord | `ToolSearchTests` |
| Catalogue | Chaque outil a sa catégorie, ses noms et ses mots dans les deux langues ; « alléger », « mot de passe », « caviarder », « supprimer une page », « tourner », « shrink », « word » ; les 22 cas du site sur son index construit, plus « add page numbers » et « convertir » | `ToolCatalogTests` |
| Fenêtre | Le champ de recherche est dans la barre d'outils de la vraie fenêtre | `HomeSearchFieldTests` |
| Écrans | Accueil par catégories en clair, en sombre et étroit ; moines trouvés ; outil à venir trouvé ; rien trouvé | `ScreenSnapshots` |
| Index à jour | La copie de l'index de recherche du site, contrôlée par les tests unitaires du site : qui change un mot sur le site est prévenu par `pnpm verify` | `apps/web/tests/unit/macSearch.test.ts` |
| Textes | Tous traduits, sans tutoiement | `check-strings.py` |
