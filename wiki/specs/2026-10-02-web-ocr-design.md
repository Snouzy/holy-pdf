# Web — OCR

_Rédigé et livré le 2 octobre 2026. Suit [OCR sur Mac](2026-10-02-mac-ocr-design.md) : mêmes pages lues, même texte invisible. Choix de l'auteur (2 octobre) : Tesseract.js, hébergé par le site._

Frère Lecteur (`/fr/ocr-pdf`, `/en/ocr-pdf`) lit le texte des pages scannées d'un PDF et le pose dessus, invisible : la recherche le trouve, la sélection le copie, la page garde son aspect.

## Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Lecture | Tesseract.js 7.0.0, moteur LSTM seul, français et anglais (`fra+eng`), données `4.0.0_best_int` | Sonde du 2 octobre : environ 3 s par page A4 dense dans les trois navigateurs ; l'anglais ajoute 0,1 à 0,3 s |
| Hébergement | `scripts/copy-ocr.mjs` copie le worker, les trois cœurs LSTM et les deux langues dans `public/ocr/` (ignoré par git) avant `dev` et `build` | Aucun fichier ne vient d'un autre serveur. Le navigateur choisit lui-même son cœur (relaxed SIMD, SIMD ou simple) : les trois doivent être servis |
| Poids | Rien au chargement de la page. Au premier usage : la bibliothèque (19 Ko, morceau à part), un cœur (3,9 Mo, 1,5 Mo compressé) et les langues (3,7 Mo) ; Tesseract garde les langues dans IndexedDB | L'OCR ne coûte qu'à qui s'en sert |
| Pages lues | Celles qui ont moins de 50 caractères de texte (requête `textCounts` du moteur) | Comme sur Mac : un scan porte souvent un tampon ou un numéro |
| Image lue | La page rendue par le moteur, plus grand côté à 2 400 px (environ 200 ppp en A4), en JPEG | La même que sur Mac. Lire plus net ne change presque rien et prend plus longtemps |
| Écriture | `writeTextLayer` (moteur) : une ligne lue devient un objet texte Helvetica en mode invisible, étiré sur le cadre de la ligne, placé dans les axes de la page telle que le lecteur la voit | Exact sous les quatre rotations. Le contenu de la page n'est pas touché |
| Lettres | Ce que l'encodage WinAnsi des polices standard sait écrire est gardé (accents latins, `’ – € œ`) ; une autre lettre perd son accent (« ș » devient « s ») ou disparaît | Pas de police embarquée : la copie ne grossit presque pas |
| Rien à lire | « Toutes les pages ont déjà leur texte » (`textAlready`) ; « Aucun texte n'a pu être lu » (`noTextRead`) ; aucune copie | Une copie identique n'a pas de sens |
| Un seul PDF | `multipleFiles: false` | La lecture est longue ; l'outil Mac fait de même |
| Titres | « OCR d'un PDF » / « OCR a PDF » | « make a PDF searchable » rendait vide la recherche « make pdf smaller » : « make » devenait un mot connu |
| Moine | « Frère Lecteur » (« Brother Reader »), la loupe, l'air appliqué | Le nom du Mac ; l'air appliqué le distingue de Frère Loupe |

## Limites connues

- Deux langues : français et anglais, sans choix.
- Une page de 50 caractères ou plus n'est pas lue, même si elle porte aussi une image avec des mots.
- Les annotations sont dessinées dans l'image lue : leur texte peut être lu avec celui de la page.
- Une page tournée de 90° dans son image (scan posé de travers) se lit mal : le cœur LSTM ne détecte pas l'orientation.
- Pas d'annulation pendant la lecture.
- Les téléphones et les vrais scans n'ont pas été mesurés.

## Tests

- Moteur (`tests/engine/ocr.test.ts`) : ligne écrite là où le lecteur la voit et aussi large qu'elle, sous les quatre rotations ; page rendue inchangée ; accents gardés ou ramenés à leur lettre ; caractères comptés par page.
- Navigateur (`tests/e2e/ocr.spec.ts`) : lecture réelle par Tesseract.js d'une page scannée, dans les trois navigateurs ; message quand toutes les pages ont leur texte.
