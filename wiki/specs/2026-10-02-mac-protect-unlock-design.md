# Mac — Protéger et Déverrouiller

_Rédigé le 2 octobre 2026. Statut : appli Swift retirée le 5 octobre 2026 (tag `mac-final`) ; à l'époque, livré dans `apps/mac`. Deuxième des six outils commandés le 2 octobre (avant : [Numéros de page](2026-10-02-mac-page-numbers-design.md) ; ensuite : Compresser, OCR, Noircir)._

## Objectif

Deux outils dans Holy PDF pour Mac. **Protéger** enregistre une copie qui ne s'ouvre qu'avec un mot de passe. **Déverrouiller** enregistre une copie sans mot de passe d'un PDF dont on connaît le mot de passe. PDFKit seulement, sans nouveau moteur.

La spec est réussie quand :

- la copie protégée demande le mot de passe choisi, et aucun autre ne l'ouvre ;
- la copie déverrouillée n'est plus chiffrée du tout (plus de dictionnaire `/Encrypt`) ;
- le texte, les liens, les champs de formulaire et les signets restent ;
- le fichier d'origine n'est jamais modifié ;
- les tests du paquet, de l'appli et des textes passent, sans avertissement du compilateur.

## Ce que PDFKit sait faire (sondes du 2 octobre)

| Question | Réponse mesurée |
|---|---|
| Quel chiffrement ? | AES-128 (`/V 4 /R 4 /AESV2`), PDF 1.6. La longueur de clé 256 est refusée : l'écriture échoue |
| Un mot de passe utilisateur seul suffit-il ? | Non : sans mot de passe propriétaire, la copie n'est pas chiffrée. Les deux options sont passées, avec la même valeur |
| Quels caractères ? | ASCII imprimable seulement. Avec « é », « € » ou un idéogramme, l'écriture échoue. Quartz n'utilise que les 32 premiers octets : 40 « a » s'ouvrent avec 32 « a » |
| Protéger un PDF déjà protégé ? | Oui : le nouveau mot de passe remplace l'ancien |
| Réécrire un PDF ouvert avec son mot de passe le déchiffre-t-il ? | Non. Sans option, la copie garde son mot de passe ; avec deux mots de passe vides, elle s'ouvre sans rien demander mais reste chiffrée |
| Comment obtenir une copie sans chiffrement ? | Déplacer les pages dans un document neuf, comme Organiser : plus de `/Encrypt`, formulaires, liens, signets et titre gardés |
| Durée | 0,1 à 0,2 s pour 1 à 2 Mo. Les deux gros fichiers connus restent lents (voir Limites) |

## Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Protéger | `PDFProtection.protected` : PDFKit réécrit le document entier avec le mot de passe en utilisateur et en propriétaire | Tout le document est gardé. Un seul mot de passe : celui qui ouvre a tous les droits, pas de fausse promesse sur l'impression ou la copie |
| Mot de passe accepté | 1 à 32 caractères ASCII imprimables, vérifié avant d'écrire ; tapé deux fois | Ce que Quartz sait écrire. L'écran le dit dès la saisie plutôt qu'à l'enregistrement |
| Vérification | Après l'écriture, le moteur rouvre la copie avec le mot de passe ; sinon il échoue | Une copie que son mot de passe n'ouvre pas est pire qu'aucune copie |
| Champs vidés | Les deux champs se vident après un enregistrement réussi et à l'ouverture d'un autre PDF. Un enregistrement refusé ou annulé les garde | Un mot de passe resté dans les champs verrouillerait le PDF suivant sans que l'utilisateur l'ait tapé |
| Déverrouiller | `PDFProtection.unlocked` : le moteur d'Organiser, toutes les pages gardées dans l'ordre | La seule voie PDFKit vers une copie vraiment sans chiffrement |
| Mot de passe connu seulement | Un PDF qui demande un mot de passe ne s'ouvre qu'avec lui : l'outil ne devine rien. Un PDF qui s'ouvre sans mot de passe mais limite l'impression ou la copie est déverrouillé aussi | La règle de la feuille de route. Pour les limites sans mot de passe : Organiser, Extraire et les autres outils en écrivent déjà une copie libre ; refuser ici serait incohérent. À resserrer sur décision de l'auteur |
| Un PDF sans mot de passe | L'écran dit qu'il n'y a rien à déverrouiller ; le bouton est inactif | Pas de copie inutile |
| Écran | La session et l'écran communs (`PDFCopySession`, `CopyToolView`), une `ProtectionSession` à deux modes et une `ProtectionView` | Les deux outils ne diffèrent que par leur panneau |
| Moines | « Frère Cadenas » et « Frère Passe-partout », dans leurs poses du site, exportés du dessin du site | Le site donne le même accessoire aux deux outils : l'humeur les distingue |

## Ce qui change dans les briques communes

- `PDFCopySession.Maker` devient asynchrone : Déverrouiller passe par l'acteur d'Organiser.
- `PDFCopySession.onSaved` et `onClosed` préviennent l'outil après un enregistrement réussi et quand le document se ferme : Protéger vide alors ses champs.
- `PDFCopySession.inspect` laisse l'outil regarder le document à l'ouverture : il le refuse, ou rend des notes que l'écran affiche (`notices`).
- `CopyToolView` reçoit `canSave` (bouton et ⌘E inactifs) et `passwordNote` : la phrase « La copie enregistrée ne demandera pas de mot de passe » n'apparaît plus dans ces deux outils, qui disent eux-mêmes ce que devient le mot de passe.

## Parcours

**Protéger.** Ouvrir ou déposer un PDF ; taper le mot de passe deux fois ; « Enregistrer une copie protégée… » propose `nom-protégé.pdf`. L'écran rappelle de garder le mot de passe et nomme le chiffrement.

**Déverrouiller.** Ouvrir ou déposer un PDF protégé ; taper son mot de passe ; « Enregistrer une copie déverrouillée… » propose `nom-déverrouillé.pdf`.

## Limites connues

- AES-128, pas AES-256 : PDFKit n'écrit pas mieux. Avec un mot de passe court, la copie se force vite ; l'écran conseille un mot de passe long.
- Pas d'accent ni d'emoji dans le mot de passe, 32 caractères au plus.
- Protéger réécrit le document entier : les lenteurs et les fichiers gonflés de PDFKit décrits dans la spec du Filigrane s'appliquent (publication IRS de 142 pages : 113 s, 3 Mo → 14 Mo ; livre scanné en JBIG2 : 119 s, 17 Mo → 468 Mo).
- Déverrouiller a les limites d'Organiser : il refuse dès l'ouverture les PDF qu'Organiser refuse (pièces jointes, calques, formulaires dynamiques), et l'écran prévient quand les balises d'accessibilité ou le profil PDF/A ne seront pas gardés.
- PDFKit récrit le catalogue du document. Sonde du 2 octobre : les étiquettes de pages (« i, ii… ») sont perdues par les deux outils, la page « i » devient « 1 » ; la copie déverrouillée perd aussi la langue du document, le mode d'ouverture et les préférences d'affichage.
- Un PDF signé numériquement est refusé par les deux outils : la copie perdrait la signature.
- Pas de droits fins (interdire l'impression ou la copie) : un lecteur peut les ignorer.

## Tests

| Niveau | Quoi | Où |
|---|---|---|
| Moteur | La copie protégée s'ouvre avec son mot de passe seulement, en AES, avec texte, titre du signet et valeur du champ lisibles ; nouveau mot de passe sur un PDF protégé ; mots de passe refusés et acceptés ; PDF signé refusé ; copie déverrouillée sans `/Encrypt`, avec texte, liens, signet et champ | `PDFProtectionTests` |
| Outil | Le bouton attend un mot de passe tapé deux fois ; copie protégée, original intact, champs vidés ; nouveau mot de passe sur un PDF protégé ; copie déverrouillée ; rien à déverrouiller ; limites d'impression et de copie levées ; mot de passe oublié à l'ouverture d'un autre PDF ; refus et notes d'Organiser dès l'ouverture | `ProtectionSessionTests` |
| Écrans | Départ, atelier, mots de passe différents, mot de passe refusé, copie enregistrée ; mot de passe demandé, prêt, rien à déverrouiller ; clair, sombre, anglais | `ProtectionSnapshots` |
| Fichiers réels | Les 38 PDF de `fixtures-private/pdfs` : 35 protégés (2 illisibles et 1 au mot de passe inconnu refusés), dont 33 déverrouillés ensuite ; pages, champs, liens et signets comptés avant et après, tous gardés | Sonde du 2 octobre, non gardée |
| Textes | Tous traduits, sans tutoiement | `check-strings.py` |
