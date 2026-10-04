# Web — Noircir un PDF

_Rédigé et livré le 2 octobre 2026. Même règle que [Noircir sur Mac](2026-10-02-mac-redact-design.md), choisie par l'auteur : une page qui porte une zone noire devient une image à 200 ppp._

Frère Encrier (`/fr/noircir-pdf`, `/en/redact-pdf`) couvre de noir ce que le visiteur trace sur les pages d'un PDF, puis donne une copie où ce contenu n'existe plus.

## Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Moteur | `engine/redact.ts` rend chaque page marquée telle que le lecteur la voit, à 200 ppp, peint les zones en noir sur des pixels entiers, encode l'image en JPEG (qualité 0,8), puis vide la page sur place et y pose l'image | Ce que l'image ne montre pas quitte le fichier |
| Vider sur place | La page garde son objet : ses objets de contenu et ses annotations partent, l'image prend leur place, rotation et boîtes gardées | Sonde du 2 octobre : PDFium n'écrit pas les objets d'origine que plus rien n'atteint, et les signets et liens vers la page la visent toujours. Supprimer puis recréer la page cassait le signet |
| Annotations | Avant de quitter la page, chaque annotation est vidée : valeur et valeur par défaut, texte, adresse d'un lien, apparence | Une annotation retirée reste atteignable par l'arbre de balises (`OBJR`), par une bulle ou par son champ |
| Champs | La valeur d'un champ passe par l'API de formulaire de PDFium (`EPDFAnnot_SetFormFieldValue`), qui écrit là où le champ la garde, parfois un parent sans `/Type /Annot` | `FPDFAnnot_GetLinkedAnnot` ne remonte pas jusqu'à ce parent |
| Autres pages | Une bulle ou une réponse liée à une annotation retirée, et un autre widget d'un champ retiré, sont vidés et retirés de leur page | Trois fuites prouvées par la sonde, comme sur Mac |
| Formulaire | L'environnement de formulaire est ouvert sans `FORM_OnAfterLoadPage` | Avec lui, PDFium génère une apparence pour chaque annotation qui n'en a pas, avant qu'elle soit vidée, et PDFium écrit toujours les objets créés pendant la session |
| Refus | Un PDF signé (`alreadySigned`) ; un formulaire XFA (`xfaForm`, erreur nouvelle) | XFA garde ses valeurs dans un flux XML qu'aucune page n'atteint et que PDFium ne sait pas modifier |
| Grandes pages | Le plus grand côté de l'image est plafonné à 6 000 pixels | Une affiche à 200 ppp demanderait des gigaoctets |
| Éditeur | `redact/RedactEditor.tsx`, chargé avec le premier fichier comme celui de la signature. Glisser trace une zone, un clic n'en trace pas ; une croix retire une zone ; une poignée au coin opposé la déplace, au glisser ou aux flèches (Maj : plus vite), sans la laisser sortir de la page (depuis le 3 octobre, comme la signature). Croix et poignée font 22 px, leur cible 44 px ; « Vider cette page » retire celles de la page ; la liste des pages marque d'un ■ celles qui en ont | Aucun poids sur le premier affichage. Pas de zoom ni d'annulation (⌘Z) dans ce lot |
| Écran tactile | La feuille tient dans la hauteur de l'écran | Un doigt sur la page trace au lieu de faire défiler : il faut de la place autour pour défiler |
| Moine | « Frère Encrier » (« Brother Inkpot »), la gomme, l'air appliqué | Le nom du Mac |

## Limites connues

- Toute la page noircie devient une image : son autre texte ne se sélectionne plus, ses champs de formulaire disparaissent.
- Le titre du document, ses signets, ses métadonnées et les textes de remplacement de l'arbre de balises (`/Alt`, `/ActualText`) ne sont pas relus. L'écran le dit pour le titre, les signets et les métadonnées.
- La valeur par défaut (`/DV`) d'un champ dont les widgets sont des enfants reste dans le fichier : aucune fonction de PDFium n'atteint ce parent pour l'écrire. C'est une valeur posée par l'auteur du formulaire, pas une saisie.
- Une vignette de page (`/Thumb`) reste dans le fichier.
- Un champ de la page noircie disparaît aussi des autres pages où il apparaît.
- Une page noircie pèse environ 1 Mo au format A4.

## Tests

- Moteur (`tests/engine/redact.test.ts`) : six secrets d'une page (texte, objet de formulaire, note avec bulle et réponse sur l'autre page, lien atteint par l'arbre de balises, champ, champ partagé avec l'autre page) absents des octets et des flux décompressés ; autre page, signet et lien gardés ; image de 833 × 1 111 pixels pour 300 × 400 points, zone noire ; zone et taille affichée gardées sous les quatre rotations ; plafond de 6 000 pixels ; zones vides ou hors page ignorées ; PDF signé et formulaire XFA refusés.
- Navigateur (`tests/e2e/redact.spec.ts`) : copie sans le texte de la page noircie, l'autre page gardée ; un clic ne trace pas de zone ; retrait d'une zone et d'une page ; zone déplacée par sa poignée et aux flèches, gardée dans la page ; croix et poignée de 22 px au plus, touchées à 18 px de leur centre.
