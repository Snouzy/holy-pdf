# Algorithme du scanner

_Référence indépendante du langage. Mise au point le 29 septembre 2026 avec le prototype Python/OpenCV (`tools/prototype/scan.py`), sur un lot réel de 17 photos. A servi de modèle à l'implémentation Swift (retirée le 5 octobre 2026, tag `mac-final`) et sert à celle du Scanner du site._

## Étapes d'une page

```
photo → chargement → détection → redressement → mise à l'endroit → nettoyage → gomme → JPEG + OCR
```

Toutes les positions sont en coordonnées normalisées de page (0 à 1, origine en haut à gauche).

## 1. Chargement

- orientation EXIF appliquée ;
- réduction à 4096 px sur le grand côté ;
- date de prise de vue lue dans l'EXIF (`DateTimeOriginal`).

## 2. Détection

1. Détecteur de documents de la plateforme (Vision `VNDetectDocumentSegmentationRequest` sur Apple) : un quadrilatère approché. Une observation de confiance inférieure à 0,5 compte comme un échec. Sans résultat : le quadrilatère est la photo entière, page à vérifier.
2. Affinage de chaque bord, sur l'image en niveaux de gris réduite au quart puis floutée (noyau binomial 1-4-6-4-1) :

| Paramètre | Valeur |
|---|---|
| Échantillons par bord | 80, de 6 % à 94 % de la longueur |
| Profil | le long de la normale extérieure, ±3 % du petit côté de l'image réduite |
| Chute | `I(s) − I(s+3)` ; hors image, `I = 0` |
| Échantillon gardé si | chute maximale > 12 (sur 255) |
| Position retenue | la plus extérieure dont la chute dépasse 60 % du maximum |
| Droite | moindres carrés totaux, 4 passes, rejet au-delà de max(1,5 ; 2,5 × médiane des résidus) |
| Coins | intersections des droites voisines |

La position « la plus extérieure » et non « la chute maximale » : sur une facture, l'en-tête en gras juste sous le bord chutait plus fort que le bord du papier, et le haut du document était rogné.

3. Page à vérifier si : rapport des côtés à plus de 6 % de √2 et de la Lettre US (11/8,5), bord gardant moins de 70 % d'échantillons valides, ou coin affiné à plus de 1 % de la diagonale du coin détecté.

## 3. Redressement

- Correction de perspective vers un rectangle.
- Taille : largeur = moyenne des bords haut et bas, hauteur = moyenne des bords gauche et droit. Si le rapport est à moins de 6 % de √2, il est calé sur √2, avec un grand côté de 2339 px (A4 à 200 dpi). Sinon, le petit côté fait 1654 px. Le grand côté ne dépasse jamais 7016 px : au-delà, les deux côtés sont réduits dans le même rapport.

## 4. Mise à l'endroit

OCR rapide sur une version réduite (1200 px), dans les 4 sens. Score d'un sens : somme de confiance × nombre de caractères. Le meilleur sens l'emporte, 0 sans texte. Rotation par quarts de tour dans le sens horaire.

## 5. Nettoyage

Calculs sur les valeurs sRGB encodées (gamma), entre 0 et 1.

**Mode Document :**

| Étape | Paramètre |
|---|---|
| Estimation du papier, fine | dilatation, disque de rayon 7 px |
| Si filigrane gardé : fermeture | dilatation puis érosion, rayon 45 px, appliquées à l'estimation fine |
| Si filigrane gardé : masque d'ombre | `m = clamp((0,92 · L − g) / (0,1 · L))`, flou σ 10, où `g` = gris de la fermeture et `L` = papier éclairé local (dilatation de rayon 200 px, calculée au quart de résolution, flou σ 40) |
| Si filigrane gardé : mélange | `m · fine + (1 − m) · fermeture` |
| Lissage | médiane 21 px dans le prototype ; flou gaussien sur Apple (Core Image n'a pas de grande médiane) |
| Division | page ÷ estimation |
| Niveaux | noir 0,12, blanc 0,86, puis puissance 1,35 |
| Netteté | 1,5 × image − 0,5 × flou σ 1,2 |
| Marge | 24 px blancs sur le pourtour |

Pourquoi le mélange : la fermeture remplit les traits larges du filigrane, qui sinon ressortent évidés. Mais dans une ombre, elle remplit aussi la traînée étroite entre deux zones d'ombre, qui reste alors grise. Le masque rend l'estimation fine aux zones d'ombre.

**Mode Couleur** (fond de sécurité, photo) : étirement de chaque canal entre ses centiles 0,5 et 99.

**Filigrane gardé ou non :** gardé si plus de 2,4 % des pixels de l'intérieur de page (hors marges de 10 %, calcul au quart de résolution) ont une fermeture qui dépasse l'estimation fine de plus de 0,08, hors ombre (masque d'ombre < 0,5).

## 6. Gomme

Zones blanches peintes après le nettoyage : polygones, ou traits de pinceau (rayon en fraction de la largeur de page).

## 7. Sortie

- JPEG qualité 80 sur l'échelle de libjpeg (celle d'OpenCV), sans métadonnées. ImageIO a sa propre échelle : 0,8 y donne les tables de libjpeg 94, 0,53 celles de libjpeg 80 à 81 (estimation d'ImageMagick) ;
- PDF : une page par image, JPEG embarqué sans recompression, texte OCR invisible sous l'image ;
- format de page : A4 pour √2, sinon taille des pixels à 200 dpi ; A5 ou Lettre au choix.

## Suggestions de documents

- **Regroupement** : une page rejoint la précédente si leurs marqueurs se suivent (`x/n`, `Pagina x din n`, `Page x of n`, `Page x sur n` dans le haut 10 % ou le bas 12 %, ou un nombre seul centré en bas).
- **Titre** : la ligne la plus haute (hauteur de boîte) dans les 40 % du haut de la première page, parmi les lignes d'au plus 4 mots, d'au moins 3 lettres et de confiance OCR au moins 0,5, sans les lignes qui reviennent dans au moins max(2, ⌈n/3⌉) des n documents du lot. Les logos reviennent de l'OCR en mots de confiance 0,3 ; sur une page de travers, la boîte d'une longue ligne de texte est plus haute que celle du titre ; deux documents de même type partagent leur titre.
- **Date** : la plus récente qui ne dépasse pas la date de prise de vue de la première photo, en ignorant avant 1990 et les lignes de validité (texte replié sans accents ni casse contenant `valabil`, `valable`, `valid until`, `valid till`, `valid through`, `valid to` ou `expir` ; le seul `valid` attraperait aussi « validat » ou « invalid ») : une fin de validité peut précéder la photo, mais ce n'est jamais le jour d'émission.
- **Nom** : `AAAA-MM-JJ_Titre`, titre en ASCII, 6 mots au plus.

## Mesures

### Prototype Python, 29/09/2026, lot privé de 17 photos

| Mesure | Valeur |
|---|---|
| Pages aux coins auto faux | 9 (feuille qui recouvre un coin, coin plié) |
| Pages couchées | 7 |
| Pages avec filigrane | 4 |
| Pages en mode Couleur | 1 (certificat à fond de sécurité) |
| Poids moyen d'une page PDF | ≈ 390 Ko |

### Implémentation Swift, lot privé de 17 photos

_Mesuré le 30/09/2026, MacBook Pro M1 Pro (10 cœurs), macOS 26.4, build release, machine en usage (charge moyenne de 5 à 22, indiquée à côté des temps)._

| Critère de la spec | Attendu | Mesuré |
|---|---|---|
| Pages aux coins faux signalées | toutes (9 au prototype) | 10 / 10. Une page est fausse si un coin auto est à plus de 1,5 % de la diagonale du coin corrigé : les fausses sont entre 6,8 et 13,3 %, les justes à 0,2 % au plus |
| Bonnes pages signalées à tort | ≤ 2 | 1 (photo 01) |
| Pages mises à l'endroit | 17 / 17 | 17 / 17 |
| Filigrane détecté juste | 16 / 16 (hors mode Couleur) | 16 / 16 |
| Documents regroupés juste | ≥ 10 / 11 | 10 / 11 |
| Dates justes | ≥ 9 / 11 | 9 / 11 (8 / 11 avant d'ignorer les lignes de validité) |
| Temps par page | < 1 s | 0,61, 0,79 et 0,77 s sur les 3 pages du test (minimum de 3 passages, charge 5 à 8). Sur les 17 pages en série : 0,79 s en moyenne, 0,96 s au pire (meilleure de 2 passes). Une passe isolée monte à 1,47 s sous la charge. À une charge moyenne de 16 à 22 (navigateur), une passe unique mesure 1,3 à 3,0 s |
| Lot entier | < 20 s | 9,7 à 12,4 s ; 10,0 s à la dernière mesure (charge 5 à 8) ; 14,6 et 18,2 s à une charge de 16 à 22 |
| Poids moyen par page | < 500 Ko | 412 Ko (JPEG du prototype : 402 Ko) ; deux PDF dépassent 500 Ko par page : le certificat en mode Couleur (592 Ko) et les 3 premières pages du contrat (518 Ko) |
| Écart moyen au prototype (niveaux de gris) | < 10 | min 0,5 / max 8,1 (photo 06, mode Couleur) ; les 16 pages en mode Document sont à 4,8 au plus |

Seuils retenus : `weakEdgeRatio` 0,7 (inchangé), `maxCornerShift` 0,01 (au lieu de 0,02), `minCoverage` 0,024 (au lieu de 0,015), `fillThreshold` 0,08 (inchangé), lissage : flou gaussien σ 5 (inchangé), qualité JPEG ImageIO 0,53 (au lieu de 0,8).

- `maxCornerShift` : à 0,02, les photos 06 et 14 (un coin sous une autre feuille) n'étaient pas signalées. L'affinage y déplace un coin de 1,1 % et 1,5 % de la diagonale. Sur les bonnes pages, il le déplace de 0,7 % au plus, sauf la photo 01 (1,3 % : Vision se trompait, l'affinage corrige). 0,01 signale les 10 pages fausses. `weakEdgeRatio` ne suffisait pas : à 0,85, il signalait une bonne page (photo 17, 0,79) et laissait passer la photo 13.
- `minCoverage` : le seuil de 0,015 séparait déjà les pages, mais la photo 02, sans filigrane, montait à 0,0144 avec les coins automatiques. 0,024 est le milieu de l'écart mesuré avec les coins corrigés (0,0121 / 0,0360).
- Qualité JPEG : 0,8 dans ImageIO donne les tables de libjpeg 94, et 608 Ko par page. 0,53 donne celles de libjpeg 80 à 81 (le prototype : 80), et 412 Ko par page. L'écart au prototype ne bouge pas (+0,1 au plus).

| Photo | Document | Coins auto | Filigrane | Part remplie (coins corrigés / auto) | Écart au prototype |
|---|---|---|---|---|---|
| photo 01 | acte, p. 1 | justes, signalée | non | 0,0036 / 0,0035 | 2,4 |
| photo 02 | acte, p. 2 | faux, signalée | non | 0,0121 / 0,0144 | 0,8 |
| photo 03 | rapport, p. 1 | faux, signalée | oui | 0,0412 / 0,0543 | 3,0 |
| photo 04 | rapport, p. 2 | faux, signalée | oui | 0,0360 / 0,0419 | 2,7 |
| photo 05 | rapport, p. 3 | faux, signalée | oui | 0,0361 / 0,0420 | 2,7 |
| photo 06 | certificat (fond de sécurité) | faux, signalée | mode Couleur | — | 8,1 |
| photo 07 | certificat | faux, signalée | non | 0,0067 / 0,0058 | 1,8 |
| photo 08 | certificat | faux, signalée | non | 0,0059 / 0,0042 | 1,6 |
| photo 09 | attestation | justes | oui | 0,0519 / 0,0521 | 2,7 |
| photo 10 | déclaration | justes | non | 0,0012 / 0,0024 | 3,4 |
| photo 11 | contrat, p. 1 | justes | non | 0,0019 / 0,0023 | 3,2 |
| photo 12 | contrat, p. 2 | faux, signalée | non | 0,0014 / 0,0017 | 4,8 |
| photo 13 | contrat, p. 3 | faux en Swift, signalée | non | 0,0000 / 0,0000 | 4,7 |
| photo 14 | contrat, p. 4 | faux, signalée | non | 0,0107 / 0,0085 | 4,5 |
| photo 15 | déclaration | justes | non | 0,0000 / 0,0000 | 0,5 |
| photo 16 | facture | justes | non | 0,0030 / 0,0029 | 4,1 |
| photo 17 | facture | justes | non | 0,0019 / 0,0016 | 3,6 |

Temps d'une page, par étape (moyenne en série) : OCR précis 36 %, mise à l'endroit (4 OCR rapides) 20 %, chargement HEIC 18 %, filigrane 11 %, détection et affinage 10 %, nettoyage 5 %, JPEG 1 %. L'affinage des bords ne domine pas : le passer à Accelerate ne ferait presque rien gagner.

Déterminisme : deux lots en parallèle et un lot en série donnent des `report.json` identiques sur chaque champ (sens, raisons, coins, filigrane, regroupement, noms, octets). Le lot à 13 PDF vu une fois pendant le développement ne se reproduit pas.

OCR roumain : Vision lit juste, à confiance 1, les titres en capitales avec leurs diacritiques (Î, Ă, Ș, Ț) et les ș, ț des en-têtes. Dans le corps du texte, ă sort parfois en ä ou å, i en ı. Le logo de certification IQNET des en-têtes sort en « IQNET », « IONET », « LIQNET » ou « :IQNET », toujours à confiance 0,3, comme un logo de facture lu en mot au hasard. Les marqueurs « Pagina x din 3 » et « 1/2 » sont lus juste. Les numéros seuls centrés en bas sont lus à confiance 0,3 à 1, et un manque (photo 14). Les dates `jj.mm.aaaa` et `jj/mm/aaaa` sont lues juste sur les 17 pages, sauf une année (2026 lue 2125, écartée car future). La confiance de Vision ne prend que trois valeurs : 0,3, 0,5 et 1.

Mise à l'endroit : le score de l'OCR rapide dans le bon sens dépasse celui du sens opposé de 4 % (photo 17) à 87 % (photo 02), médiane 21 %. Les deux secours envisagés ne marchent pas. L'OCR précis sur le meilleur sens et son opposé préfère le sens renversé sur 5 pages. L'ordre des coins des observations de Vision ne dit rien non plus : Vision rend des boîtes droites pour un texte à l'envers.

Écarts connus :

- **Dates, 2 fausses.** Rapport (photos 03 à 05) : la règle prend une date postérieure citée dans le corps du texte, pas la date d'émission du rapport. Contrat : scindé (point suivant), ses 3 premières pages ne portent plus qu'une date citée dans le texte. L'attestation (photo 09), qui prenait sa fin de validité (« valabilă până la data »), est juste depuis que la règle ignore les lignes de validité.
- **Regroupement, 1 faux.** Contrat scindé en 3 + 1 : Vision ne lit pas le « 4 » seul en bas de la photo 14, dont le recadrage auto est faux (7,5 % de la diagonale à un coin). Les numéros seuls sont fragiles : avec les coins auto, Vision lit 1, 2 et 3 ; avec les coins corrigés, il lit 2 et 4, et plus 1 ni 3.
- **Coins.** 10 pages ont des coins auto faux en Swift, contre 9 au prototype : sur la photo 13, le coin sous une autre feuille est faux de 6,8 % de la diagonale, là où l'affinage du prototype le retrouvait. Sur les photos 02, 12, 13 et 14, l'affinage éloigne le coin caché de sa vraie place plus que Vision. Toutes ces pages sont signalées. La photo 01 est signalée alors que ses coins finaux sont justes.
- **Titres**, hors critères : 7 justes sur 12 (2 avec l'ancienne règle, qui mettait aussi une adresse dans deux noms). Faux : les titres de l'acte et du contrat sont imprimés plus petits que les en-têtes au-dessus, le rapport prend le nom de la ville, la facture son numéro.
- **Temps** : la marge est mince sur M1 Pro, et une passe isolée dépasse 1 s sous la charge.
- **Filigrane** : la page de synthèse des tests a maintenant 4 traits, à 0,0338 (0,0253 avec 3 traits, trop près du seuil de 0,024). Le détecteur se déclenche aussi sur des barres noires pleines et épaisses. Sur les vraies pages sans filigrane, il reste sous 0,0144.
