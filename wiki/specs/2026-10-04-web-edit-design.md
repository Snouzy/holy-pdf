# Web — Modifier un PDF

_Rédigé le 4 octobre 2026. Périmètre choisi le 4 octobre : ajouter seulement, ajouts écrits dans la page. Le Mac n'a pas cet outil._

Frère Scribe (`/fr/modifier-pdf`, `/en/edit-pdf`) ajoute du texte, des images, des formes, des traits à main levée et du surlignage sur les pages d'un PDF, puis enregistre la copie.

## Objectif

La spec est réussie quand :

- on ajoute sur la page affichée : texte, image, rectangle, ellipse, ligne, flèche, crayon, surligneur ;
- un ajout se sélectionne, se déplace, se redimensionne, change de couleur ou de taille, passe devant ou derrière, se supprime ;
- annuler et rétablir couvrent chaque changement ;
- la copie montre les ajouts à la même place que l'aperçu, page pivotée comprise, et le texte ajouté reste du texte ;
- rien d'autre ne change dans le fichier.

## Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Périmètre | Ajouter seulement. Le texte d'origine ne change pas | Choix de l'auteur. Modifier le texte d'origine bute sur les polices embarquées réduites aux lettres déjà utilisées |
| Écriture | Les ajouts deviennent du contenu de la page (`engine/edit.ts`) : objets texte, image et chemin de PDFium | Choix de l'auteur. Rendu identique dans tous les lecteurs, comme Signer et Filigrane |
| Coordonnées | Points de la page telle que le lecteur la voit, depuis son coin haut gauche. Le moteur passe par les axes de `displayed()` | La page pivotée se traite comme les autres outils ; l'aperçu SVG utilise les mêmes nombres |
| Texte | Polices standard du PDF : Helvetica, Times, Courier, en normal ou gras ; taille 8 à 96 pt ; plusieurs lignes. Tout WinAnsi passe (Latin-1, plus « œ », « € », apostrophe et guillemets typographiques, tirets, points de suspension) ; une autre lettre est signalée et bloque l'enregistrement | Pas de police à embarquer. macOS et iOS tapent d'eux-mêmes l'apostrophe typographique : la refuser bloquait « l'été » |
| Saisie | Le texte se tape dans un champ posé sur la page, placé pour que sa ligne de base tombe sur celle du PDF. Le champ est activé pendant le geste même | Sans calcul, le texte sautait d'environ 0,2 em en quittant le champ. iOS n'ouvre son clavier que pour un champ activé pendant le geste |
| Image | JPEG, PNG ou WebP. Le navigateur la décode (orientation EXIF comprise) et la ramène à 2 400 px au plus ; JPEG sans transparence, pixels RGBA sinon | Une photo de téléphone ne gonfle pas le fichier et arrive à l'endroit |
| Formes | Rectangle et ellipse (contour, remplissage ou les deux), ligne, flèche, crayon : épaisseur fine, moyenne ou épaisse. Maj pendant le tracé donne un carré ou un cercle, et garde les proportions pendant un redimensionnement par les coins | L'ellipse est faite de quatre courbes de Bézier. Maj : demandé par l'auteur le 4 octobre |
| Surligneur | Rectangle tiré à la souris, couleur en mode de fusion « Multiply » | Le texte reste lisible sous la couleur |
| Couleurs | Noir, bleu, rouge, vert, jaune, blanc | Six couleurs suffisent ; le blanc sert de cache visuel (il ne retire rien, Noircir le fait) |
| Outils | Après un texte, une image ou une forme, l'outil Sélection revient. Crayon et surligneur restent actifs | On règle aussitôt ce qu'on vient de poser ; on trace plusieurs traits d'affilée |
| Annuler | Historique de l'éditeur, `Ctrl/⌘+Z` et `Maj+Ctrl/⌘+Z`, inactif pendant l'enregistrement. Une saisie compte pour un seul pas, aucun si rien n'a changé | Un éditeur sans annulation se subit ; un clic perdu avec l'outil Texte ne doit pas effacer « Rétablir » |
| Enregistrement | Offert dès le premier ajout ; un texte vide disparaît quand on le quitte ; un toucher du crayon sans trait ne laisse rien. Seules les images encore posées partent au moteur, et leurs aperçus sont libérés avec le document | |
| PDF signé | Refusé (`alreadySigned`) | Toute réécriture invalide la signature |
| PDF protégé | Ouvert avec son mot de passe ; la copie le garde | Comme Signets |
| Moine | « Frère Scribe » (« Brother Scribe »), la plume, en joie, catégorie Modifier | Le scribe écrit et orne la page. Premier nom, « Frère Enlumineur », livré le 4 octobre puis changé : c'était déjà celui de PDF en JPG |

## Parcours

1. Déposer un PDF : la première page s'affiche, la palette d'outils est dans le panneau.
2. Choisir un outil, puis cliquer ou tirer sur la page. Le texte se tape directement sur la page.
3. Sélectionner un ajout pour le déplacer, le redimensionner par ses poignées, changer sa couleur ou sa taille, le passer devant ou derrière, le supprimer.
4. « Enregistrer les modifications » propose `nom-modifie.pdf`.

## Limites connues

- Pas de modification ni de suppression du contenu d'origine.
- Pas de rotation libre d'un ajout, pas de zoom.
- Texte limité aux alphabets latins de WinAnsi : pas de « ș », d'émoji ni d'alphabet non latin.
- Une même image posée deux fois est stockée deux fois.

## Tests

- Moteur (`tests/engine/edit.test.ts`) : texte relu par pdf.js à sa place, sur quatre rotations de page ; toutes les lettres WinAnsi ; zone de texte coupée aux mêmes mots que `wrapped` ; image, formes, flèche, crayon et surligneur relus en pixels ; ordre devant/derrière ; lettre hors WinAnsi, page ou image inconnues refusées ; PDF signé refusé, PDF protégé qui le reste.
- Modèle (`tests/unit/editModel.test.ts`) : création par glisser, déplacement, poignées, sélection au clic, ordre, annuler et rétablir, zone de texte et poignées de largeur. Métriques (`tests/unit/editMetrics.test.ts`) : chasses, codes WinAnsi, coupure des lignes.
- Navigateur (`tests/e2e/edit.spec.ts`) : texte tapé sur la page, rectangle tiré, trait annulé, copie relue ; lettre refusée ; une saisie annulée en un pas, un clic perdu sans pas.

## Deuxième version (4 octobre 2026) : le document lui-même

_Demandée le 4 octobre : un utilisateur ne doit avoir aucune raison de préférer Acrobat. Cinq chantiers : le texte d'origine, les objets d'origine, les annotations, les liens, les images. Livrés en trois PR._

### Objectif

- Un texte du PDF se corrige sur la page, à sa place, dans sa police quand elle le permet.
- Un objet du PDF (texte, image, tracé, formulaire) se déplace, se supprime ; une image se redimensionne, se recadre, pivote, se retourne.
- Une note, un surlignage, un soulignement, un texte barré se posent sur le texte et se rouvrent dans Acrobat ou Aperçu.
- Un lien vers une adresse web ou vers une page se pose sur une zone.
- Une image ajoutée se recadre, pivote, se retourne ; la même image posée deux fois est stockée une fois.

### Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Aperçu | La page affichée est un rendu du PDF modifié : le moteur rouvre le fichier, applique les retouches des objets d'origine de la page, rend la page. Les ajouts restent dessinés en SVG par-dessus | Le rendu des polices d'origine n'est fiable que par PDFium ; les ajouts restent fluides au doigt |
| Pendant un geste | Un objet d'origine qu'on déplace est montré par un fantôme : la découpe de l'aperçu à son ancienne place, translatée. L'aperçu précédent reste affiché jusqu'au nouveau rendu | Pas de rendu à chaque mouvement du pointeur, pas d'écran vide entre deux rendus |
| Objets | Un objet = un objet de contenu PDFium (`FPDFPage_GetObject`), désigné par son rang dans la page d'origine, même après des suppressions. Un texte est une ligne ou un fragment, tel que le fichier l'a écrit ; mais un fichier qui écrit ses lignes glyphe par glyphe (Chrome, les factures imprimées depuis un navigateur : au moins six objets texte sur dix pas plus larges qu'une lettre) voit ses glyphes regroupés en lignes : même police, taille et couleur, même ligne de base à 0,5 pt près, écart de moins de trois quarts de cadratin. Un espace est mis où la plume saute de plus d'un cinquième de cadratin après l'avance du glyphe, lue dans sa police (`FPDFFont_GetGlyphWidth`) ; mesurer entre boîtes de glyphes mettait un espace après chaque « l ». Les lignes sont celles de la page d'origine, relevées par le moteur avant toute retouche : relever la copie retouchée aurait fusionné une ligne déplacée avec sa voisine. La ligne porte le rang de son glyphe le plus à gauche ; déplacer, corriger ou supprimer la ligne atteint tous ses glyphes, la correction les remplace par un objet. Une page écrite mot par mot (LibreOffice justifié) garde ses objets séparés. Les formulaires XObject se déplacent et se suppriment d'un bloc, sans mise à l'échelle. Les dégradés ne se sélectionnent pas | PDFium ne regroupe pas les paragraphes ; regrouper nous-mêmes trompe sur ce qui bougera. L'étendue d'un dégradé est son clip : le déplacer ne montre rien |
| Clip | Le clip d'un objet suit sa transformation (`FPDFPageObj_TransformClipPath`) | Une image recadrée par InDesign ou Word sortirait de sa fenêtre et disparaîtrait |
| Liste après retouche | La liste des objets d'une page est relevée sur une copie retouchée : boîtes et textes sont ceux d'après correction, les rangs ceux d'origine | Après une correction plus longue, la sélection et le fantôme suivent le nouveau texte |
| Texte invisible | Un texte en mode de rendu invisible (OCR) ne se sélectionne pas | Le corriger ne changerait rien de visible, et il gêne la sélection du scan dessous |
| Page image | Quand l'image sélectionnée couvre au moins 90 % de la page en largeur et en hauteur, le panneau dit que la page est une image, que son texte se recouvre mais ne se corrige pas, et renvoie à Noircir | Un billet dont le fond est une image rasterisée (4 octobre) : l'utilisateur cherchait à corriger un texte qui n'en est pas |
| Correction d'un texte | Les lettres toutes présentes dans le texte que le document écrit déjà avec cette police gardent la police (`FPDFText_SetText`), WinAnsi ou non. Sinon, le texte passe dans la police standard la plus proche : Times si la police a des empattements ou un nom de serif connu, Courier si elle est à chasse fixe, Helvetica sinon ; gras et italique suivis ; les lettres hors WinAnsi sont alors refusées et la correction n'est pas gardée. Une police non embarquée accepte tout WinAnsi, sauf une police symbolique. Une police sans nom, ou un nom porté à la fois par une police embarquée et une autre qui ne l'est pas, n'est jamais gardée. La position, la taille, la couleur et le mode de rendu sont gardés, la ligne de base aussi. Entrée termine la saisie : un objet texte est une ligne | Une police embarquée n'a souvent que les glyphes utilisés : une lettre neuve y sortirait blanche. Le jeu des lettres utilisées dans tout le document avec la police est le plus grand jeu sûr. Deux sous-ensembles de même nom, venus d'une fusion, n'ont pas les mêmes glyphes |
| Avertissement | Pendant la saisie, l'écran dit quand le texte changera de police, et quand des lettres ne pourront pas être écrites. Les lettres des polices (`fonts`) ne sont relevées qu'à la première saisie | L'utilisateur choisit en connaissance. Relever toutes les pages à l'ouverture retardait la première sélection sur un gros document |
| Déplacement, taille | En points de la page affichée, comme les ajouts. Un texte ou un groupe porte un décalage cumulé (`move`), appliqué après la correction du texte ; une image ou un tracé porte sa boîte finale (`box`) et se redimensionne par ses coins, par mise à l'échelle depuis le coin opposé. Le moteur convertit la transformation en matrice de page par les axes de `displayed()` | Mettre un texte à l'échelle déformerait ses glyphes. Une boîte pour un texte serait ambiguë : « ace » et « Ace » n'ont pas le même haut, un déplacement puis une correction décalaient la ligne de base |
| Relecture après correction | Après `FPDFText_SetText`, le texte est relu ; s'il diffère, l'objet passe en police standard | Deux sous-ensembles de même nom, venus d'une fusion, mettent leurs lettres en commun dans la liste : une lettre absente de celui-ci sortirait blanche |
| Suppression | `FPDFPage_RemoveObject`. Un objet supprimé disparaît du fichier : ce n'est pas un cache | Noircir reste l'outil pour retirer un passage avec sa trace |
| Historique | Les retouches d'objets d'origine entrent dans le même historique que les ajouts : une seule pile d'annulation. Une retouche par objet, écrasée par la suivante | Deux piles perdraient l'utilisateur |
| Annotations | Note (`/Text`), surlignage, soulignement et texte barré (`/Highlight`, `/Underline`, `/StrikeOut`) sont écrits en annotations, pas dans le contenu de la page, sans apparence : chaque lecteur dessine la sienne, PDFium aussi au rendu. Une note porte son texte et un auteur facultatif ; son icône est celle du lecteur, comme pour une note d'Acrobat | « Annoter » veut dire qu'Acrobat et Aperçu rouvrent la note. Le surligneur à main levée, lui, reste dans la page. `FPDFAnnot_SetAP` refuse nos flux et l'apparence générée pour une note est vide |
| Sélection de texte | Les mots de la page (`FPDFText_*`, boîtes en points affichés) sont listés avec les objets. Tirer avec un outil d'annotation sélectionne les mots que le rectangle touche, regroupés en un quadrilatère par ligne | Une sélection par rectangle suffit sur une page ; elle évite l'ordre de lecture, souvent faux |
| Liens | Annotation `/Link` sans bordure, sur une zone tirée ; cible : une adresse web (`/URI`, `http`, `https` ou `mailto` seulement, écrite en ASCII : hôte en punycode, chemin encodé) ou une page du document (`/GoTo` sur le haut de la page). Un lien sans adresse bloque l'enregistrement et le panneau dit sur quelle page il attend | Ce qu'Acrobat fait ; la bordure visible est une relique. Un `/URI` est en 7 bits ; `javascript:` n'a rien à faire dans un PDF |
| Note et rotation | La note porte `NoRotate` sur une page droite seulement | Avec `NoRotate`, Acrobat fait pivoter l'icône sur le coin du `Rect` dans l'espace non pivoté : sur une page tournée, elle atterrissait une icône plus loin |
| Champs du panneau | Le texte et l'auteur d'une note, l'adresse d'un lien, font un pas d'annulation par passage dans le champ. Un geste sur la page retire d'abord le focus du champ | Sinon le pas du champ et celui du geste se mélangeaient |
| Images ajoutées | Une image posée plusieurs fois est un seul XObject, placé par des objets formulaire, comme les signatures. Rotation par quarts de tour et retournements sont des matrices autour du centre de la boîte. Le recadrage est découpé dans le navigateur et devient une nouvelle image (JPEG à 0,9 s'il était opaque, PNG sinon) | Un fichier léger. Le `BBox` d'un formulaire aurait découpé sans toucher aux pixels, mais PDFium calcule les bornes d'un formulaire sans lui : l'image recadrée paraissait entière à la relecture |
| Images d'origine | Rotation et retournement : matrice seule, autour du centre de l'image telle qu'affichée. Recadrage : les pixels sont relus tels que la page les montre, transparence comprise, à leur taille (16 Mpx au plus), découpés et écrits dans un nouvel objet image qui prend le rang de l'ancien et couvre la part recadrée de son emplacement. Un formulaire fait d'une seule image est listé comme une image et se redimensionne ; seul un vrai objet image posé droit ou par quart de tour se recadre | Pas d'API pour poser un clip sur un objet existant, et les bornes d'un formulaire ignorent son `BBox`. Le flux de l'image d'origine peut être dessiné ailleurs (un logo sur chaque page) : écrire dedans l'aurait recadré partout. Un cadre droit sur une image en biais la déformerait |
| Tour et miroir | Le tour se dessine avant les miroirs ; avec un seul miroir actif, « Pivoter à droite » enregistre un tour à gauche, pour que l'image tourne bien à droite à l'écran | Composition des transformations |
| Cadre | Un coin tiré au-delà de l'image bute sur son bord ; le cadre se vide dès que la sélection change, par un geste, une touche, une annulation ou une nouvelle image ; « Recadrer » et « Appliquer » attendent que la liste des objets soit à jour | Sinon le cadre glissait, restait coincé sans bouton, ou travaillait sur d'anciens coins |
| Cadre de recadrage | Le cadre se tire par ses coins dans la boîte de l'image ; « Appliquer » le convertit en fractions des pixels (rotation et miroirs défaits pour une image ajoutée, projection sur les coins des pixels pour une image du document), composées avec le recadrage déjà fait | Un second recadrage porte sur des pixels déjà recadrés |
| Taille des fichiers | Une image d'origine n'est réécrite que si on la recadre ; un JPEG recadré devient alors un flux de pixels compressé, plus lourd | Limite écrite dans la spec ; PDFium ne découpe pas les octets d'un JPEG |

### Zoom (4 octobre 2026)

| Sujet | Décision | Raison |
|---|---|---|
| Zoom | De 50 à 200 % par pas de 25, boutons dans la barre de pagination comme Signer ; la feuille déborde avec un défilement horizontal ; l'échelle `unit` se recalcule par l'observateur de taille ; l'aperçu est rendu à l'échelle du zoom (4 000 px au plus). Sur un écran tactile, les boutons sont cachés : on pince le navigateur | Demandé par l'auteur ; une facture en 7,5 pt ne se corrige pas à l'échelle 1, et un aperçu étiré trois fois serait flou. Une feuille zoomée sous `touch-action: none` ne se ferait pas glisser au doigt |

### Formulaires (4 octobre 2026)

| Sujet | Décision | Raison |
|---|---|---|
| Champs existants | Dans Modifier, les widgets de formulaire de la page se remplissent en place : un clic sur un champ texte ouvre la saisie par-dessus, Entrée ou un clic ailleurs valide ; une case ou un bouton radio bascule au clic ; une liste déroulante ou une liste ouvre un menu. Les champs en lecture seule, les boutons et les signatures ne réagissent pas | Le geste d'un lecteur ; pas de panneau à part |
| Aperçu | La page est rendue avec les valeurs en cours (`FPDF_FFLDraw` sur une copie où les valeurs sont posées, comme les retouches d'origine) ; la saisie HTML ne se voit que pendant la frappe | Ce qui est vu est ce qui est enregistré, dans la police et la couleur du champ |
| Écriture | `EPDFAnnot_SetFormFieldValue` puis `EPDFAnnot_GenerateFormFieldAP` sur chaque widget modifié, dans l'environnement de formulaire du document (`engine/forms.ts`). Case : « Off » ou sa valeur d'export ; bouton radio : la valeur d'export du bouton cliqué ; liste : l'option par son rang, posée par le remplisseur de PDFium (`FORM_SetIndexSelected`), qui connaît sa valeur d'export quand elle diffère du libellé ; texte : une ligne, bornée par `MaxLen`. Les widgets cachés (`Hidden`, `NoView`) ne sont pas proposés | PDFium régénère l'apparence depuis `/DA` et `/MK` ; les lecteurs la montrent sans `NeedAppearances` |
| Annulation | Une valeur (`FieldEdit` : page, index du widget, valeur) entre dans l'historique avec les ajouts et les retouches, une étape par validation | Même geste que le reste |
| Hors champ | Formulaires XFA : aucun champ proposé. Scripts de format, de calcul et de validation : non exécutés, notre PDFium n'a pas de moteur JavaScript | Limite du moteur |
| Création | Un outil « Champ » (touche `f`) pose un champ texte (une ligne ou plusieurs), une case à cocher ou une liste déroulante : un clic pose la taille par défaut (160 × 24 pt, case 14 × 14), un glisser dessine le cadre. Le panneau nomme le champ (« Champ 1 », « Champ 2 »… d'office), coche « Plusieurs lignes » pour un texte, liste les options d'une liste, une par ligne. Deux champs du même nom ou un nom vide bloquent l'enregistrement | Après le remplissage, dans l'ordre décidé. Le nom est le `/T` du champ : il doit être unique |
| Écriture d'un champ | `EPDFPage_CreateFormField(page, form, type, nom vide)` puis le nom en `/T` du widget par `FPDFAnnot_SetStringValue` (le nom passé à la création est écrit en UTF-8 brut, que les lecteurs lisent en PDFDocEncoding : « PrÃ©nom »), `/Rect`, les drapeaux (`Multiline`, `Combo`), `/DA` Helvetica posé à 12 pt par `EPDFAnnot_SetDefaultAppearance` (qui enregistre la police dans `/DR` ; à 0 il n'écrit pas de police) puis réécrit à taille automatique, bordure noire d'un point, les options, et `EPDFAnnot_GenerateFormFieldAP` ; après les annotations de la page, pour que les index des widgets existants ne bougent pas | Ce que fait le moteur d'EmbedPDF, lu dans son paquet `@embedpdf/engines` |
| Deux passes | Les champs neufs reçoivent leur nom, leur cadre et le drapeau Imprimable à l'export, puis le document est enregistré et rouvert : PDFium ne connaît un champ que par le nom donné à sa création, et c'est sur cette réouverture que les drapeaux, l'apparence et les options passent par son API de formulaire (`finishFields`) | Un champ créé sans nom n'est pas dans l'arbre de PDFium |
| Noms | Non vide, sans point, propre à chaque champ ajouté et absent du document, parents compris (« a » refusé si « a.b » existe) : les noms du document sont lus une fois quand l'outil sort (`fieldNames`), le panneau et le bouton Enregistrer les connaissent, et l'export les revérifie (`fieldNameTaken`). Une liste sans option ne s'enregistre pas. Formulaire XFA : refusé (`xfaForm`) | Les lecteurs fusionnent les champs d'un même nom ; le point sépare une hiérarchie ; un widget ajouté à un XFA resterait invisible |
| Page tournée | L'outil Champ ne pose rien sur une page tournée, et le moteur le refuse | PDFium dessine le texte d'un champ le long de l'axe de la page : il tournerait avec elle, et aucune API n'écrit le `/MK /R` du widget |
| Boutons radio | Non proposés : PDFium donne à tout bouton neuf la valeur d'export « Yes », sans moyen d'en changer ; deux boutons d'un groupe se cocheraient ensemble. Une liste déroulante tient ce rôle | Limite du moteur |
| Champ ajouté | Il se remplit après l'enregistrement, pas dans la même session : c'est un ajout, pas encore un widget de la page | Comme « Préparer le formulaire » puis « Remplir » dans Acrobat |

### Tampons (4 octobre 2026)

| Sujet | Décision | Raison |
|---|---|---|
| Tampon | Un mot en capitales dans un cadre arrondi, en Helvetica grasse, la date du jour en dessous si on la demande ; rouge par défaut, six couleurs. Dix mots par langue (Approuvé, Refusé, Brouillon, Confidentiel, Urgent, Payé, Reçu, Copie, Annulé, Signer ici) et un texte libre en capitales, WinAnsi. Un clic pose 160 × 50 pt centrés, un glisser dessine le cadre (un cadre de moins de 20 pt de côté compte comme un clic) ; le mot et la date se taillent pour tenir dans le cadre (`stampLayout`, chasses PDF), le trait et les coins suivent le plus petit côté. Le mot choisi ou tapé devient celui du prochain tampon | Ce qu'Acrobat met dans ses tampons standard et dynamiques. La date est figée dans le fichier, comme la sienne |
| Écriture | Dans le contenu de la page : un tracé pour le cadre, un objet texte pour le mot, un pour la date | Comme les autres ajouts ; Acrobat les écrit en annotations, mais un tampon ne se rouvre pas |
| Touche | `b` | Les lettres de « tampon » et « stamp » sont prises |

### Raccourcis (4 octobre 2026)

| Sujet | Décision | Raison |
|---|---|---|
| Touches | Une lettre par outil, affichée sur son bouton comme une touche de clavier (majuscule encadrée, bord bas épais ; une pastille rouge se lisait comme une alerte) : v sélection, t texte, r rectangle, o ellipse, l ligne, a flèche, p crayon, h surligneur, n note, m surligner le texte, u souligner, s barrer, k lien, i image (ouvre le sélecteur). Sans modificateur, jamais pendant une saisie dans un champ, et seulement quand la touche vise la page ou l'éditeur. Les badges sont cachés sur écran tactile | Demandé par l'auteur ; ce que font les logiciels de dessin. Une dictée vocale ailleurs sur la page ne doit pas changer d'outil |

### Zone de texte (4 octobre 2026, après la deuxième version)

| Sujet | Décision | Raison |
|---|---|---|
| Zone | Tirer avec l'outil Texte dessine une zone ; le texte ajouté porte alors une largeur et ses lignes reviennent à la ligne. Un clic donne un texte libre, sans largeur, comme avant. Deux poignées, gauche et droite, changent la largeur d'un texte ; sur un texte libre, elles le changent en zone | L'écart le plus visible face à Acrobat |
| Mesure | Les lignes sont coupées avec les chasses des polices standard du PDF, lues une fois dans PDFium (`engine/standardWidths.ts`, `FPDFFont_GetGlyphWidth` prend des points de code Unicode : les 32 signes de 0x80 à 0x9F sont lus par leur caractère), à l'écran comme dans le moteur ; les bornes et la sélection d'un texte s'en servent aussi. Coupure gloutonne aux blancs, les blancs en début de ligne gardés, un mot trop large coupé lettre à lettre, un retour tapé gardé | La même fonction des deux côtés : la ligne se coupe au même mot dans l'aperçu SVG et dans le fichier. Lus par code WinAnsi, les tirets, points de suspension et guillemets valaient la chasse du glyphe manquant |
| Geste | Un glisser compte pour une zone à partir de 20 pt et de 8 px à l'écran ; en deçà, c'est un clic. L'outil Texte passe au-dessus des images et des tracés du document : seule une ligne de texte du document l'arrête | Sur un téléphone, 4 pt font 2 px : un toucher tremblé faisait une zone de 20 pt. On doit pouvoir écrire sur un scan |
| Saisie | Le champ de saisie prend la largeur de la zone et coupe avec la police du navigateur ; s'il lui faut une ligne de plus, il grandit plutôt que de faire défiler la première ligne ; à la sortie du champ, l'aperçu montre la coupure du PDF. Pour un texte libre, le champ prend la plus large des deux mesures, PDF et navigateur | Un éditeur qui coupe exactement comme le PDF demanderait de dessiner la saisie nous-mêmes. Une lettre hors WinAnsi compte un demi-cadratin en chasses PDF : le champ d'un texte en cyrillique serait trop étroit |

### Limites connues de la deuxième version

- Un texte corrigé perd son crénage fin (`TJ`) : l'espacement devient celui des chasses de la police.
- Un texte corrigé dans une autre police change de largeur : il peut chevaucher ce qui le suit.
- Les objets d'un formulaire XObject ne se modifient pas un à un.
- Une image d'origine recadrée est réécrite en pixels, JPEG compris : le fichier peut grossir. Elle perd son clip et son mode de fusion ; son opacité est cuite dans les pixels.
- Un texte d'origine ne se redimensionne pas, et ne devient pas une zone : seul un texte ajouté revient à la ligne.
- Pendant la saisie, la police du navigateur peut couper une ligne un mot plus tôt ou plus tard que le PDF ; l'aperçu se recale à la sortie du champ.
- Sur une page pivotée, PDFium dessine un soulignement ou un barré le long du bas du quadrilatère dans l'espace de la page, donc de travers ; Acrobat, Aperçu et pdf.js suivent l'ordre des coins. L'éditeur dessine ses propres annotations en SVG et n'est pas touché ; PDF en JPG peut l'être.
- Une note n'a pas d'apparence : un outil qui rend les pages en images ne la montre pas.

### Tests

- Moteur (`tests/engine/editOriginals.test.ts`) : liste des objets avec texte, police, taille, couleur et boîte affichée sur une page pivotée ; texte invisible exclu ; page écrite glyphe par glyphe regroupée en lignes, déplacée, corrigée et supprimée d'un bloc ; mots et lignes ; déplacement et suppression relus en pixels et par pdf.js ; correction qui garde la police embarquée pour des lettres déjà écrites et qui bascule en police standard pour une lettre neuve, ligne de base gardée ; image déplacée et redimensionnée.
- Moteur (`tests/engine/editAnnotations.test.ts`) : note relue par pdf.js avec son texte et son auteur ; surlignage, soulignement, barré avec leurs quadrilatères et une apparence ; lien web et lien vers une page relus ; rendu avec annotations.
- Moteur (`tests/engine/editImages.test.ts`) : image ajoutée telle quelle, tournée, retournée, tournée après miroir, sur page droite et pivotée ; image placée deux fois stockée une fois ; image d'origine tournée et retournée, recadrée sur place (JPEG réécrit en pixels), recadrée sans toucher son autre occurrence, recadrée puis mise à l'échelle.
- Modèle (`tests/unit/editModel.test.ts`) : retouches d'objets d'origine dans l'historique, clé de sélection, quadrilatères par ligne, recadrage en fractions.
- Navigateur (`tests/e2e/edit.spec.ts`) : un texte d'origine corrigé et relu ; un objet supprimé ; une note posée ; un lien posé ; une image pivotée.
