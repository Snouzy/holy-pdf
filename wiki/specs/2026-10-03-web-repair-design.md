# Web — Réparer un PDF

_Rédigé et livré le 3 octobre 2026. Le Mac n'a pas cet outil._

Frère Ravaudeur (`/fr/reparer-pdf`, `/en/repair-pdf`) relit les PDF abîmés et en écrit une copie propre, qui s'ouvre partout.

## Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Moteur | qpdf reconstruit le fichier (`repairPdf` dans `engine/compact.ts`, même worker jetable que Compresser), sans flux d'objets. Si qpdf trouve le fichier abîmé ou ne se charge pas, PDFium relit et réécrit (`engine/repair.ts`) ; si PDFium échoue aussi, l'erreur de qpdf s'affiche (« Réessayer » quand il ne s'est pas chargé). Une copie sans page est refusée | Sonde du 3 octobre sur neuf fichiers cassés : PDFium n'ouvre ni un fichier tronqué ni un fichier sans table `xref` ; qpdf les relit. Sans flux d'objets, la copie s'ouvre dans les lecteurs anciens |
| Quand | À l'ouverture, sur cette page seulement : le worker garde la copie réparée, la carte montre ses pages, le bouton la rend | Sinon le fichier qu'on vient réparer serait refusé dès l'ouverture (« endommagé ») |
| Fin de fichier | Un commentaire `%%EOF` est ajouté avant la relecture | qpdf perd le dernier objet d'un fichier qui s'arrête juste après lui (« EOF after endobj ») : c'est ce que laisse un logiciel arrêté avant d'écrire sa table |
| Illisible | « Ce PDF est trop abîmé : rien ne s'y relit. » sur la carte | Le message général (« endommagé et ne peut pas être ouvert ») ne dit rien de neuf sur cette page |
| PDF protégé | Le mot de passe est demandé (qpdf dit « invalid password », traduit en mot de passe requis ou incorrect), qpdf le reçoit, la copie le garde. Un PDF protégé coupé avant son trailer est refusé : la copie qui a perdu `/Encrypt` est rejetée | qpdf garde le chiffrement d'origine. Sans trailer, il ne sait plus que le fichier est chiffré et recopie les flux chiffrés : toutes les pages sortaient blanches |
| PDF signé | Refusé (`alreadySigned`) | Toute réécriture invalide la signature |
| Moine | « Frère Ravaudeur » (« Brother Mender »), l'agrafeuse, concentré, catégorie Optimiser | Ravauder, c'est raccommoder |

## Limites connues

- Ce qui manque au fichier ne revient pas : un fichier coupé perd ses dernières pages, une page dont l'arbre est effacé est perdue.
- Un fichier sain est réécrit aussi ; l'écran ne dit pas s'il y avait quelque chose à réparer.
- 128 Mo au plus, comme Compresser : au-delà, PDFium ne prend pas le relais, deux copies n'y tiendraient pas.
- Un PDF protégé dont la fin est perdue ne se répare pas.

## Tests

- Moteur (`tests/engine/repair.test.ts`) : fichier coupé à 80 % et 60 %, table `xref` perdue, fichier sain réécrit, secours PDFium quand qpdf échoue, fichier illisible refusé, mot de passe demandé, refusé s'il est faux, puis gardé ; PDF protégé coupé refusé ; qpdf non chargé ou fichier trop gros ; copie sans page refusée ; PDF signé refusé. Relecture par pdf.js.
- qpdf (`tests/engine/qpdf.test.ts`) : la réécriture rendue même plus lourde, en mode réparation.
- Navigateur (`tests/e2e/repair.spec.ts`) : PDF coupé réparé avec ses trois pages ; fichier illisible signalé, bouton inactif.
