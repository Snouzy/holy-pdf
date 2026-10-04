# pdf-toolbox — wiki

Ouvrable dans Obsidian : **Ouvrir un dossier comme coffre**, puis choisir le dossier `wiki/`.

## Produit

- [Feuille de route](product/roadmap.md) — tous les outils visés, leur faisabilité et les phases.
- [Identité de marque](product/brand.md) — Holy PDF : le nom, un moine par outil, la palette Encre bleue.
- [Histoire de Holy PDF](product/story.md) — le manque de place, les PDF de la famille et la naissance du projet.
- [Posts de présentation](product/social-posts.md) — les déclinaisons LinkedIn, Instagram et X.

## Développement

- [Guide technique](development/technical-guide.md) — règles de code, coordonnées, performance, confidentialité.
- [Algorithme du scanner](development/algorithm.md) — le pipeline, indépendant du langage, et ses mesures.
- [Tests](development/tests.md) — commandes, niveaux, lot privé.
- [Version Web](development/web-version.md) — site Astro, moteur dans le navigateur, pièges connus.
- [Benchmark de compression](development/compression-benchmark-2026-10-01.md) — comparaison PDFium, qpdf, Cantoo et MuPDF, mesures navigateur et limites.
- [Mots-clés du site](development/web-keywords.md) — l'adresse de chaque outil en français et en anglais, les candidats de recherche, volumes à vérifier.

## Specs

- [Mac : Modifier un PDF, étape A](specs/2026-10-04-mac-edit-design.md) — ajouts écrits dans la page, toutes les lettres, images recadrées, pivotées et retournées ; B (annotations, liens) et C (contenu d'origine) suivent.
- [Mac : Filigrane](specs/2026-10-02-mac-watermark-design.md) — texte ou image dans le contenu des pages, opacité, angle, plage, sans moteur ajouté.

- [Mac : Numéros de page](specs/2026-10-02-mac-page-numbers-design.md) — format, position, premier numéro, plage ; les briques communes aux outils qui enregistrent une copie.

- [Mac : Compresser](specs/2026-10-02-mac-compress-design.md) — trois niveaux, deux écritures PDFKit en concurrence dont le filtre Quartz, rien d'enregistré sans gain.

- [Mac : Aplatir](specs/2026-10-02-mac-flatten-design.md) — champs remplis et annotations dans le contenu des pages, liens gardés.

- [Mac : Pages par feuille, Couper les pages en deux, Pixelliser](specs/2026-10-02-mac-sheets-design.md) — trois outils d'un seul réglage, les règles du site, progression et annulation dans la session commune.

- [Mac : Ajouter des signets](specs/2026-10-02-mac-bookmarks-design.md) — lire, poser, renommer et retirer les signets ; ce qu'un outil lit à l'ouverture dans la session commune.

- [Mac : Superposer deux PDF](specs/2026-10-02-mac-overlay-design.md) — les pages d'un PDF sur ou sous celles d'un autre, aperçu fidèle des deux positions.

- [Mac : PDF en Word](specs/2026-10-02-mac-pdf-to-word-design.md) — texte, styles et images dans un .docx écrit à la main ; les polices lues dans le contenu des pages.

- [Mac : Accueil par catégories, avec recherche](specs/2026-10-02-mac-home-design.md) — les cinq catégories du site, sa recherche portée en Swift, ses mots copiés par un script.

- [Mac : Images en PDF et PDF en images](specs/2026-10-02-mac-images-design.md) — une page A4 par image, un JPG par page, les règles du site.

- [Mac : Noircir](specs/2026-10-02-mac-redact-design.md) — zones noires au glisser ; la page noircie devient une image à 200 ppp, rien de son contenu ne reste dans le fichier.

- [Mac : OCR](specs/2026-10-02-mac-ocr-design.md) — la lecture Vision du Scanner posée en texte invisible sur les pages sans texte, lignes lues surlignées.

- [Mac : Protéger et Déverrouiller](specs/2026-10-02-mac-protect-unlock-design.md) — mot de passe en AES-128 à l'écriture ; copie sans chiffrement, avec le mot de passe connu seulement.

- [Mac : Diviser et Extraire](specs/2026-10-02-mac-split-extract-design.md) — ciseaux entre les pages, pages cochées, sur le moteur d'Organiser.

- [Mac : Organiser les pages](specs/2026-10-02-mac-organize-design.md) — grille native, ordre, rotation et suppression sans rastérisation.

- [Mac : Fusionner des PDF](specs/2026-10-01-mac-merge-design.md) — assemblage natif, conservation, limites et aperçus à la demande.

- [Mac : Signer un PDF](specs/2026-10-01-mac-sign-design.md) — signature locale dessinée/importée, conservation du PDF et budgets de performance.

- [Bureau : coque Tauri sur le code du site](specs/2026-10-05-desktop-tauri-design.md) — la preuve que le moteur du site tourne dans la webview de Tauri (PDFium, qpdf, workers, `tauri://`), et l'ordre des étapes de l'appli.
- [Web : Superposer](specs/2026-10-03-web-overlay-design.md) — les pages d'un PDF sur ou sous celles d'un autre.
- [Web : Signets](specs/2026-10-03-web-bookmarks-design.md) — lire, poser, renommer, ranger et retirer les signets d'un PDF.
- [Web : Réparer](specs/2026-10-03-web-repair-design.md) — qpdf relit un PDF abîmé, PDFium en secours.
- [Web : Modifier](specs/2026-10-04-web-edit-design.md) — texte, images, formes, crayon et surligneur ajoutés dans la page.
- [Web : Rogner](specs/2026-10-04-web-crop-design.md) — la zone tracée devient le cadre de la page, sur une page ou sur toutes.
- [Web : Scanner](specs/2026-10-02-web-scanner-design.md) — photos de documents en PDF propres, moteur du Mac porté sur OpenCV.js.
- [Web : PDF en Word](specs/2026-10-02-web-pdf-to-word-design.md) — texte, styles et images dans un .docx écrit à la main.
- [Web : OCR](specs/2026-10-02-web-ocr-design.md) — texte lu par Tesseract.js et posé invisible sur les pages scannées.
- [Web : Noircir](specs/2026-10-02-web-redact-design.md) — zones tracées en noir, la page devient une image et son contenu quitte le fichier.
- [Web : Pixelliser](specs/2026-10-02-web-pixelize-design.md) — pages en images JPEG, texte non copiable.

- [Web : Couper en deux](specs/2026-10-02-web-split-in-half-design.md) — chaque page en deux moitiés, dans le sens de lecture.

- [Web : Pages par feuille](specs/2026-10-02-web-pages-per-sheet-design.md) — 2 à 16 pages par feuille A4, texte gardé.

- [Web : Aplatir](specs/2026-10-02-web-flatten-design.md) — champs et annotations figés dans le contenu des pages.

- [Web : Filigrane](specs/2026-10-02-web-watermark-design.md) — texte en travers des pages, couleur, opacité, angle, largeur et plage.

- [Web : Numéroter les pages](specs/2026-10-02-web-page-numbers-design.md) — format, six positions, premier numéro, taille et plage, texte dans le contenu.

- [Web : Protéger et Déverrouiller](specs/2026-10-02-web-protect-unlock-design.md) — mot de passe ajouté ou retiré dans le navigateur, requête `transform` générique.

- [Web : Signer un PDF](specs/2026-10-01-web-sign-design.md) — main levée, texte manuscrit ou PNG/JPG/JPEG, placements locaux et budgets de performance.

- [Scanner Mac v1](specs/2026-09-29-scanner-mac-v1-design.md) — moteur, appli Mac, erreurs, tests.
- [Mac : design system Holy PDF](specs/2026-10-01-mac-design-system-design.md) — nom, icône, moines, police des titres, vouvoiement, images exportées du site.
- [Web : socle et outils Organiser](specs/2026-09-29-web-organiser-design.md) — site Astro, planche, moteur PDFium, budgets de performance.
- [Web : design system Holy PDF](specs/2026-09-30-web-design-system-design.md) — couleurs, polices, moines, accueil D2, pages outils, mode sombre.
- [Web : parcours d'un outil, Compresser et PDF en JPG](specs/2026-09-30-web-parcours-lot1-design.md) — régler, lancer, récupérer ; compression des images ; pages ou photos en JPG.
- [Web : pages du pied de page](specs/2026-10-02-web-pages-design.md) — juridique, À propos, Contact, Presse, Nouveautés, FAQ, Applis, blog et guides, en FR et EN.
- [Web : refonte de l'accueil et FAQ par outil](specs/2026-10-02-web-landing-design.md) — haut compact sans zone d'import, sections du bas, FAQ en conversation, questions de chaque outil liées depuis la page FAQ.
