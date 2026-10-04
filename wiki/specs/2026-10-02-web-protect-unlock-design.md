# Web — Protéger et Déverrouiller un PDF

_Rédigé et livré le 2 octobre 2026._

## Ce que font les outils

- **Protéger** (Frère Cadenas, `/fr/proteger-pdf`, `/en/protect-pdf`) : un ou plusieurs PDF reçoivent le même mot de passe. Il faut le taper deux fois, à l'identique, avant que le bouton s'active. Le mot de passe sert à ouvrir le fichier ; une fois ouvert, le PDF s'imprime et se copie normalement (toutes les permissions accordées, mot de passe propriétaire égal au mot de passe d'ouverture).
- **Déverrouiller** (Frère Passe-partout, `/fr/deverrouiller-pdf`, `/en/unlock-pdf`) : la planche demande le mot de passe de chaque PDF protégé, comme pour les autres outils, puis enregistre une copie sans chiffrement. Un PDF qui s'ouvre sans mot de passe mais restreint l'impression ou la copie en sort aussi sans restriction.

Aucun mot de passe n'est deviné, envoyé ni stocké : il reste dans la mémoire de la page.

## Moteur

Une seule requête générique du Worker, `transform`, applique une opération à une copie de chaque document (`engine/transform.ts`) : `EPDF_SetEncryption` pour Protéger, `EPDF_RemoveEncryption` pour Déverrouiller, sur un second handle de l'original (`reopenPdf`), puis `savePdf`. Le document ouvert reste intact pour les aperçus et le lancement suivant. Les prochains outils « un fichier donne un fichier » (Aplatir, Pixelliser…) ajoutent leur opération à `TransformOp` et à `transformPdf`, sans nouvelle plomberie dans la planche.

Un PDF qui porte une signature numérique est refusé (« Ce PDF contient déjà une signature numérique… ») : toute réécriture invaliderait la signature.

## Tests

- Moteur (`tests/engine/transform.test.ts`) : le fichier protégé exige son mot de passe dans PDFium et dans pdf.js, un mauvais mot de passe est refusé, la copie déverrouillée s'ouvre sans mot de passe, un PDF signé est refusé pour les deux opérations.
- Navigateur (`tests/e2e/protect-unlock.spec.ts`) : le bouton reste grisé tant que les deux mots de passe diffèrent, la copie téléchargée s'appelle `<nom>-protected.pdf` et ne s'ouvre qu'avec le mot de passe ; la copie déverrouillée s'appelle `<nom>-unlocked.pdf` et s'ouvre sans.
