# Web — PDF en Word

_Rédigé et livré le 2 octobre 2026, dans le lot qui finissait le catalogue du site. Le Mac a l'outil depuis le même jour ([spec Mac](2026-10-02-mac-pdf-to-word-design.md))._

Frère Copiste (`/fr/pdf-en-word`, `/en/pdf-to-word`) recopie le texte et les images d'un ou plusieurs PDF dans un document Word (.docx) modifiable.

## Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Moteur | `engine/word.ts` lit le texte avec PDFium, caractère par caractère ; `engine/docx.ts` écrit le .docx à la main (XML et `fflate`) | Aucune dépendance nouvelle : une bibliothèque .docx pèserait plus que le reste de l'outil |
| Ordre | Celui où PDFium lit la page, qui suit les colonnes | Trier par hauteur mêlait les lignes de deux colonnes (constaté sur la publication 17 de l'IRS) |
| Lignes | PDFium place un saut de ligne entre les lignes qu'il trouve ; une espace qu'il ajoute prend le style du mot précédent | Ces caractères générés n'appartiennent à aucun objet texte |
| Paragraphes | Un paragraphe s'arrête : à un écart de plus de 1,6 fois la taille du texte, à un retour vers le haut (colonne suivante), à un changement de taille, à une ligne qui commence par une puce ou un numéro, ou après une phrase terminée sur une ligne courte | Un texte en drapeau a des lignes courtes partout. « Courte » se mesure aux lignes qui partent de la même marge, pas à la page, sinon chaque ligne d'une colonne de gauche serait courte |
| Style | Police, taille, gras, italique par passage. La taille est celle de `Tf` multipliée par l'échelle de la matrice du caractère. Gras et italique se lisent dans le nom de la police (`Helvetica-Bold`, `Times-Italic`), puis dans sa graisse et ses drapeaux | Les polices standard ne déclarent ni graisse ni drapeaux utiles (sonde du 2 octobre). Le nom PostScript devient une famille que Word connaît (`TimesNewRomanPSMT` → Times New Roman) |
| Images | Rendues par `FPDFImageObj_GetRenderedBitmap` (masque compris, posées sur du blanc) ; une image droite sans masque garde ses propres pixels, plus fins ; JPEG 0,85, plus grand côté 2 400 px ; insérée avant le premier paragraphe qui commence plus bas qu'elle dans la même bande | Le rendu de PDFium fait un pixel par point : trop flou pour une photo |
| Scan lu par l'OCR | Une image qui couvre plus de 80 % d'une page qui a du texte est laissée de côté | Son texte est déjà dans le document. Une page sans texte garde son image, pour que le document ne soit pas vide |
| Page | Une page Word par page du PDF, toutes à la taille de la première, marges de 72 points ; une image plus large que le texte est réduite à sa largeur | Une section par page compliquerait le document pour un gain rare |
| Fichier | `nom-word.docx`, type `application/vnd.openxmlformats-officedocument.wordprocessingml.document` ; l'écran de résultat dit « document Word » | Le suffixe suit celui des autres outils |
| Moine | « Frère Copiste » (« Brother Copyist »), la plume, l'air content | Celui qui recopie ; l'air content le distingue de Frère Plume, appliqué |

## Limites connues

- Les tableaux deviennent des lignes de texte ; les colonnes sont recopiées l'une après l'autre.
- L'alignement, l'interligne, les couleurs du texte, les dessins vectoriels et les liens ne sont pas repris.
- Une page pivotée garde des images dans le sens de la page d'origine.
- Un intertitre en gras sur la même ligne que le texte, ou un résumé en retrait, peut couper un paragraphe en deux.
- Un scan sans OCR ne donne que son image.

## Vérifications

- Moteur (`tests/engine/word.test.ts`) : police, taille, gras et italique par passage ; paragraphes (ligne courte après une phrase, écart, puce, texte en drapeau) ; deux colonnes lues l'une après l'autre ; une page par page ; image à sa place et réduite à la largeur du texte ; scan gardé seul, laissé de côté derrière son texte lu ; fichier ouvert par `textutil` (macOS, sauté ailleurs).
- Navigateur (`tests/e2e/pdf-to-word.spec.ts`) : document téléchargé, texte et saut de page.
- Sonde du 2 octobre sur quatre PDF réels de `fixtures-private` (article arXiv, formulaire W-9, publication 17 de l'IRS en 142 pages, fiche NASA) : les quatre s'ouvrent ; 142 pages en 3,3 s dans Node.
