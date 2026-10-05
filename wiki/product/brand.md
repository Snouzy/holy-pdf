# Identité de marque

_Créée le 29 septembre 2026. Mise à jour le 30 septembre 2026 : nom et direction visuelle choisis. Spec d'application au site à écrire._

## Intention

Une marque forte et chaleureuse, comme le mouton de PDF24 : un personnage qu'on décline en une illustration par outil, et qui rend une appli utilitaire mémorable.

## Nom : Holy PDF

Domaine retenu : **holy-pdf.com**. À acheter aussi : **holypdf.app**, en redirection, parce que holypdf.com est pris.

Pourquoi ce nom :

- deux mots d'anglais de base, compris et prononçables partout, comme « workout.cool » ou « Smash Baby Burger » ;
- une exclamation (« Holy cow! ») : le ton est drôle, pas religieux ;
- « PDF » dans le nom : on sait ce que fait le site, et la marque apparaît dans les recherches « … pdf » ;
- l'univers des moines tient : auréole au logo, un moine par outil.

Vérifications du 30 septembre 2026 :

| Point | Résultat |
|---|---|
| holy-pdf.com, holypdf.app, holy-pdf.fr | libres (whois et RDAP) |
| holypdf.com | pris depuis le 17 janvier 2025, site hors ligne, aucun produit trouvé |
| Produit PDF nommé « Holy PDF » | aucun trouvé (recherche web) |
| Marques INPI, EUIPO, USPTO, classes 9 et 42 | **à vérifier à la main** : les API de recherche refusent les requêtes automatiques. Seule trouvée par le web : « HOLY », classe 6 (conteneurs métalliques), sans rapport |

Liens de vérification : [INPI](https://data.inpi.fr), [TMview](https://www.tmdn.org/tmview/) (EUIPO et offices nationaux), [USPTO](https://tmsearch.uspto.gov).

Noms écartés :

| Nom | Raison |
|---|---|
| pdf-monk | **PDFMonk** existe dans le même marché ([pdfmonk.com](https://www.pdfmonk.com/)) |
| Monkey PDF, PDFMonkey | déjà pris ([monkeypdf.org](https://monkeypdf.org/), [pdfmonkey.io](https://docs.pdfmonkey.io/)) |
| Halo PDF | appli iPad « Halo PDF » qui fusionne et trie déjà des pages |
| Vesper PDF | appli de lecture « Vesper » (EPUB, PDF), sortie en juin 2026 |
| Abbey PDF | se prononce comme ABBYY, éditeur d'OCR et de PDF |
| Brother PDF | Brother, fabricant d'imprimantes |
| PDFrère | se lit « pé-dé-frère » en français |
| Scriptorium, Copiste, Vélin, Capucin | domaines pris |
| pdf.church | libre, mais « church PDF » désigne déjà des modèles de documents d'église |

## Direction visuelle

Référence : la maquette du 30 septembre 2026, page « Design system » (fondations, composants, moines), non publiée ; les SVG du site (`apps/web/src/illustrations/`) en sont la version de référence.

- **Style** : un moine par outil. Les outils prêts ont une grande carte avec le moine et une scène (une feuille PDF qu'il agrafe, découpe, pivote…). Les outils à venir ont un moine qui dort et un tampon « Bientôt ».
- **Papier** : feuilles au coin corné, surligneur jaune sur les titres, tampons.
- **Palette « Encre bleue »** : fond `#EEF1F6`, encre `#141A2E`, principal `#2346D8`, surligneur `#FFE45C`, tampon `#C8321B`. Couleurs de catégorie : Organiser `#2346D8`, Convertir `#0B7A5E`, Modifier `#B4418E`, Optimiser `#A35900`, Sécurité `#5B6272`. Tampon, Convertir et Optimiser sont foncés pour passer le contraste AA.
- **Typographie** : Bricolage Grotesque 800 pour les titres, Figtree pour le texte.
- **Titres** : pas de police d'accent (essayée, refusée). Un émoji par titre, à la fin, collé au dernier mot : 🙏 accueil, 🤲 outils prêts, 🕯️ à venir, 🤫 confidentialité, un émoji par outil.
- **Avatars** : la tête et l'accessoire sortent du cercle.
- **Mode sombre** : proposé sur le canevas, à valider.

## Les moines

Un moine en robe de bure marron, corde jaune, cinq humeurs : content, concentré, ravi, oups, en attente. Il parle en « je », en phrases courtes, avec des clins d'œil au monastère (« Pardonnez-lui ses pages en trop », « reliées comme un missel »), et jamais sur le ton de la blague dans une erreur. L'auréole n'apparaît que dans le logo.

| Outil | Moine | Accessoire |
|---|---|---|
| Scanner (Mac et site) | Frère Déclic | téléphone |
| Fusionner | Frère Agrafe | agrafeuse |
| Diviser | Frère Ciseaux | ciseaux |
| Organiser les pages | Frère Classeur | feuille |
| Supprimer des pages | Frère Gomme | gomme |
| Extraire des pages | Frère Loupe | loupe |
| Pivoter | Frère Toupie | flèche de rotation |
| JPG en PDF | Frère Cadre | cadre photo |
| Compresser | Frère Pressoir | livre |
| PDF en JPG | Frère Enlumineur | cadre photo |
| Signer | Frère Plume | plume |
| Filigrane | Frère Tampon | tampon |
| Numéroter | Frère Folio | feuille |
| Protéger | Frère Cadenas | cadenas |
| Déverrouiller | Frère Passe-partout | cadenas |
| Aplatir | Frère Rouleau | livre |
| Pages par feuille | Frère Mosaïque | feuille |
| Couper en deux | Frère Massicot | ciseaux |
| Pixelliser | Frère Vitrail | cadre photo |
| Noircir | Frère Encrier | gomme |
| OCR | Frère Lecteur | loupe |
| PDF en Word | Frère Copiste | plume |
| Superposer | Frère Calque | tampon |
| Signets | Frère Signet | livre |
| Réparer | Frère Ravaudeur | agrafeuse |
| Modifier | Frère Scribe | plume |
| Rogner | Frère Cadreur | cadre photo |

## Textes à relire

Écrits avec le design system, pas encore relus. Textes communs dans `apps/web/src/i18n/fr.ts` et `apps/web/src/i18n/en.ts` ; contrôles de Signer dans `apps/web/src/signature/text.ts`, chargé avec l'éditeur :

- `monks` : nom, présentation, phrase de carte (ton « abbaye »), consigne (`hint`), verbe en cours, bouton verbe, titre du résultat et « recommencer » de chaque moine ;
- `home` et `homeDrop` : l'accueil, sa bulle et sa zone de dépôt. Le titre 1 (« Outils PDF gratuits en ligne, dans votre navigateur ») vise la recherche ; ses volumes sont dans la spec du design system ;
- `home.compact`, `home.categoryCount`, `toolShort` : la vue compacte ;
- la phrase de confiance unique (« Aucun fichier ne quitte votre appareil, de l'import jusqu'au téléchargement. ») : `home.lead`, `footer.tagline`, `drop.trust`, `toolPage.privacy` et les pages `compress.md` / `pdf-to-jpg.md` ; `home.proofs` : le bandeau des quatre preuves (100 % local, 0 envoi, sans compte, RGPD), sans logo de certification que le site ne détient pas ;
- `toolPage` (titre, phrase, ligne de confiance), `drop` (« Choisir des PDF », « ou déposez-les ici », ligne de confiance, `release`), `nav` et `footer` (barre du haut, menus, pied de page), `flow` (dont « Alléluia, c'est fait »), `menu.darkMode`, `board.addPdf`, `board.addImages`, `board.undo`, `board.undoHint`, `board.removeConfirm`, `board.keep`, `board.removeConfirmed`, `bubble`, `upcoming`, `categories`.
- `frSearch` et `enSearch` (en bas de `fr.ts` et `en.ts`) : la colonne de filtres de l'accueil, son interrupteur, l'étiquette « Bientôt · en méditation », la ligne d'état, l'absence de résultat, et les mots que la recherche comprend pour chaque outil ;
- `toJpg`, `compress`, `errors.noImages` et les pages `compress.md` et `pdf-to-jpg.md` des deux langues : les outils du lot 1. Leurs volumes de recherche, vérifiés le 30 septembre 2026, ne sont pas repris dans le wiki.
- les pages du pied de page et les deux premiers articles (`apps/web/src/content/pages`, `apps/web/src/content/articles`), et leurs libellés (`apps/web/src/i18n/pages.ts`).

Les textes juridiques (Mentions légales, Confidentialité, Conditions d'utilisation, Cookies) sont une base sérieuse, pas un avis d'avocat. Ils couvrent l'éditeur et l'hébergeur, le traitement des fichiers dans le navigateur sans envoi au site, les données techniques que Cloudflare traite, l'absence de cookie et les deux clés de `localStorage`, les conditions d'un service gratuit fourni « en l'état », la nature de la signature posée par Signer (ni avancée ni qualifiée au sens d'eIDAS) et le droit français. Détail dans la [spec des pages du pied de page](../specs/2026-10-02-web-pages-design.md). Deux points restent ouverts :

- la page Confidentialité doit nommer le service qui reçoit les e-mails (Cloudflare Email Routing, puis la boîte de destination, et son transfert hors UE s'il y en a un) ;
- les notices des bibliothèques que `pdfium.wasm` embarque, au-delà de PDFium lui-même, restent à vérifier et à publier dans `public/licenses/`.

L'éditeur est Snouzylabs S.R.L. (décision du 5 octobre 2026), société qui édite aussi workout.cool : les mentions légales d'un éditeur professionnel doivent donner la dénomination, le siège, le téléphone, le capital social, le numéro d'immatriculation (CUI) et le directeur de la publication. Siège, téléphone, capital et CUI restent à ajouter dès que l'auteur les transmet.

Relecture du lot 1, le 1er octobre 2026 : les niveaux de compression et leurs FAQ FR/EN ne promettent plus une qualité intacte. Les trois niveaux réencodent les images avec perte ; la FAQ distingue le texte sélectionnable du texte contenu dans une photo ou un scan.

## Reste à faire

- vérifier les marques, puis acheter holy-pdf.com et holypdf.app ;
- appliquer le design system au site web : voir la [spec](../specs/2026-09-30-web-design-system-design.md) ;
- icône d'appli iPhone (celle de l'appli Mac retirée, gardée au tag `mac-final` : `apps/mac/PDFToolbox/HolyPDF.icon`) ;
- pour la version finale des illustrations, prévoir un illustrateur, avec les planches du canevas comme brief.
