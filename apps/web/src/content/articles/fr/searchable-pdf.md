---
section: guides
lang: fr
topics: [administrative-documents, ocr, privacy, scan]
slug: rendre-un-pdf-scanne-recherchable
title: Comment rendre un PDF scanné recherchable
description: "Rendez un PDF scanné recherchable et copiable avec l’OCR. Étapes, vérifications et limites, sans envoyer votre document sur un serveur."
h1: Comment rendre un PDF scanné recherchable
lead: Ajoutez une couche de texte invisible au scan pour chercher un mot et copier un passage, sans changer l’apparence des pages.
author: Mathias
image: /articles/searchable-pdf/searchable-pdf-hero.webp
published: 2026-11-02
---

<figure class="article-visual article-visual--hero">
  <img src="/articles/searchable-pdf/searchable-pdf-hero.webp" alt="Une loupe retrouve un mot dans les lignes d’un document PDF numérisé" width="1600" height="900" loading="eager" decoding="async" />
  <figcaption>L’OCR ajoute au scan le texte dont la recherche et la sélection ont besoin.</figcaption>
</figure>

Pour rendre un PDF scanné recherchable, il faut lui appliquer une reconnaissance optique de caractères, ou OCR. L’image de chaque page reste visible, mais une couche de texte invisible est ajoutée par-dessus. La recherche peut alors retrouver les mots, et vous pouvez sélectionner puis copier un passage.

Avec [OCR PDF](/fr/ocr-pdf), choisissez le document, cliquez sur **Lire le texte**, puis téléchargez la copie. Le traitement se déroule dans votre navigateur : le PDF n’est pas envoyé à un serveur.

## Vérifiez d’abord si le PDF a déjà du texte

Ouvrez le PDF dans votre lecteur habituel et effectuez deux tests :

- lancez une recherche avec Ctrl+F, ou ⌘F sur Mac ;
- essayez de sélectionner une phrase à la souris.

Si rien ne se sélectionne et qu’un mot pourtant visible reste introuvable, la page est probablement une image. C’est le cas fréquent d’un document passé au scanner ou photographié puis enregistré en PDF.

Si la recherche fonctionne déjà, un OCR n’est pas nécessaire. Holy PDF laisse d’ailleurs intactes les pages qui contiennent déjà suffisamment de texte.

## Rendre le PDF recherchable avec Holy PDF

1. Si une page est de travers, corrigez d’abord son orientation avec [Pivoter un PDF](/fr/pivoter-pdf), puis téléchargez la copie pivotée.
2. Ouvrez cette copie dans [OCR PDF](/fr/ocr-pdf) et cliquez sur **Choisir un PDF**.
3. Cliquez sur **Lire le texte**. Frère Lecteur analyse en français et en anglais les pages qui contiennent moins de 50 caractères.
4. Quand la lecture est terminée, cliquez sur **Télécharger le PDF** pour récupérer la copie.

<figure class="article-visual">
  <picture>
    <source media="(max-width: 40rem)" srcset="/articles/searchable-pdf/holy-pdf-ocr-ui-fr-mobile.webp" width="390" height="900" />
    <img src="/articles/searchable-pdf/holy-pdf-ocr-ui-fr.webp" alt="Interface française de l’outil OCR PDF de Holy PDF avec un document scanné fictif prêt pour la lecture du texte" width="1400" height="900" loading="lazy" decoding="async" />
  </picture>
  <figcaption>Le document reste visuellement identique : l’outil ajoute une couche de texte invisible au-dessus des pages.</figcaption>
</figure>

Holy PDF fabrique un nouveau fichier. Gardez l’original séparément, puis ouvrez la copie téléchargée dans un lecteur PDF pour la contrôler.

## Vérifiez le résultat, pas seulement l’aperçu

L’OCR interprète le scan ; il ne garantit pas que chaque caractère soit correctement reconnu. Dans le fichier téléchargé :

1. recherchez un nom, une référence et un mot pris au milieu du document ;
2. sélectionnez une phrase, copiez-la et collez-la dans un éditeur de texte ;
3. contrôlez les nombres, les accents, les noms propres et les petits caractères ;
4. vérifiez plusieurs pages, surtout celles qui sont pâles, inclinées ou annotées.

[Adobe décrit lui aussi l’OCR comme l’étape qui rend le texte d’un document numérisé sélectionnable et consultable](https://helpx.adobe.com/fr/acrobat/desktop/create-documents/scan-documents-to-pdfs/scanned-pdf-settings.html). Une recherche réussie ne suffit toutefois pas à valider tout le texte : relisez les passages importants avant de les réutiliser.

## Ce que l’OCR change dans le PDF

Pour l’analyse, Holy PDF produit une image de la page dont le côté le plus long mesure 2 400 px, soit environ 200 ppp pour une page A4. Chaque ligne reconnue est ensuite placée au même endroit sous forme de texte invisible. L’image d’origine n’est pas remplacée : le document garde son apparence.

Cette couche sert à :

- retrouver un mot avec la recherche du lecteur PDF ;
- sélectionner et copier un passage ;
- rendre le contenu exploitable par les outils qui savent lire la couche de texte d’un PDF.

Elle ne transforme pas la page en document éditable. **L’OCR ne corrige pas et ne modifie pas le texte visible dans l’image.** Si une lettre est mal reconnue, l’image affichée reste la même et la couche invisible contient cette erreur.

## Pourquoi certaines pages ne sont pas analysées

Holy PDF compte le texte déjà présent page par page. Il applique l’OCR uniquement aux pages qui contiennent **moins de 50 caractères**. Ce seuil permet de lire un scan qui ne porte qu’un numéro, un tampon ou une courte annotation, sans refaire inutilement les pages déjà textuelles.

Dans un PDF mêlant des pages numériques et des scans, seules les pages sous ce seuil sont analysées. Une page qui contient 50 caractères ou plus est laissée telle quelle, même si elle comporte aussi une grande image avec du texte.

Si toutes les pages dépassent le seuil, l’outil affiche : **Toutes les pages ont déjà leur texte : il n'y a rien à lire.**

## Préparer un scan plus facile à reconnaître

La qualité de la couche de texte dépend d’abord de l’image. Avant l’OCR :

- remettez chaque page à l’endroit ;
- préférez une page nette, droite et bien éclairée ;
- évitez les ombres, les reflets et les doigts devant le texte ;
- recadrez les grandes bordures inutiles ;
- scannez de nouveau une page trop floue plutôt que d’essayer de corriger le résultat après coup.

Une image tournée de 90° à l’intérieur de la page est mal reconnue, car le moteur ne détecte pas automatiquement son orientation. Corrigez d’abord l’orientation avec [Pivoter un PDF](/fr/pivoter-pdf) et utilisez la copie obtenue. Si le contenu reste de travers dans l’image, corrigez le scan ou refaites la photo avant de relancer l’OCR.

Pour partir de photos, [Scanner un document](/fr/scanner) redresse les pages et peut ajouter du texte cherchable dès la création du PDF. Le présent guide concerne surtout un PDF scanné qui existe déjà.

## Limites à connaître

- **Langues :** sur la page française, l’outil reconnaît le français et l’anglais. Un document dans une autre langue peut produire une couche de texte incorrecte ou dépourvue de certains accents.
- **Pages déjà textuelles :** une page contenant 50 caractères ou plus n’est pas analysée, même si une partie de son texte se trouve dans une image.
- **Orientation :** un scan tourné à l’intérieur de l’image est mal reconnu tant qu’il n’est pas redressé.
- **Interruption :** il n’y a pas de bouton pour annuler pendant la lecture. Laissez l’onglet ouvert jusqu’au résultat.
- **Correction :** l’outil ajoute une couche invisible ; il ne permet pas de modifier le texte déjà présent ni de corriger visuellement le scan.
- **Annotations :** les annotations visibles font partie de l’image analysée et peuvent être reconnues avec le texte de la page.

Si aucun mot n’est détecté, Holy PDF affiche : **Aucun texte n'a pu être lu dans les pages.** Vérifiez alors l’orientation et la netteté du document. Si le scan est trop dégradé, repartez d’une image plus propre.

## Questions fréquentes

### Quelle différence entre un PDF scanné et un PDF recherchable ?

Un PDF scanné peut ne contenir que des images. Un PDF recherchable possède aussi une couche de texte : son apparence peut être identique, mais un lecteur sait y chercher et sélectionner des mots.

### L’OCR modifie-t-il l’image du document ?

Non. Holy PDF conserve l’apparence des pages et ajoute le texte reconnu de façon invisible. Il produit une nouvelle copie du fichier.

### Puis-je rendre un PDF recherchable gratuitement ?

Oui. [OCR PDF](/fr/ocr-pdf) est gratuit et ne demande pas de compte. Le document est traité sur votre appareil.

### Le fichier est-il envoyé à un serveur ?

Non. Le navigateur ouvre le PDF localement. Au premier lancement de l’OCR, il télécharge le moteur et les langues nécessaires, puis lit et reconstruit le fichier sur votre appareil. [Le fonctionnement du traitement local est expliqué ici](/fr/blog/vos-pdf-restent-sur-votre-appareil).

### Pourquoi la recherche trouve-t-elle un mot mal orthographié ?

L’OCR a probablement confondu des caractères proches, par exemple un « 0 » et un « O ». L’image visible n’a pas changé, mais la couche de texte contient la lecture du moteur. Contrôlez toujours les références, les dates et les noms propres.

### Puis-je traiter plusieurs PDF à la fois ?

Non. L’outil OCR accepte un seul PDF à la fois. Téléchargez la première copie avant d’ouvrir le document suivant.

## Sources officielles

- [Spécification de l’outil OCR de Holy PDF](https://github.com/Snouzy/holy-pdf/blob/main/wiki/specs/2026-10-02-web-ocr-design.md)
- [Adobe Acrobat — Reconnaître le texte dans les PDF numérisés](https://helpx.adobe.com/fr/acrobat/desktop/create-documents/scan-documents-to-pdfs/recognize-text.html)
- [Adobe Acrobat — Paramètres des PDF numérisés et texte consultable](https://helpx.adobe.com/fr/acrobat/desktop/create-documents/scan-documents-to-pdfs/scanned-pdf-settings.html)
