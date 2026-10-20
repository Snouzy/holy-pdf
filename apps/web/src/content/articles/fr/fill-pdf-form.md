---
section: guides
lang: fr
topics: [administrative-documents, edit, forms, privacy]
slug: remplir-un-formulaire-pdf
title: Remplir un formulaire PDF et garder ses réponses
description: "Remplissez un formulaire PDF dans le navigateur, puis enregistrez une copie qui garde vos réponses. Les étapes, le cas du Mac, le Cerfa et les limites."
h1: Remplir un formulaire PDF et garder ses réponses
lead: Cliquez dans un champ, tapez, enregistrez une copie. Les réponses vont dans les champs du formulaire lui-même, et tout lecteur PDF les affiche.
author: Mathias
image: /articles/fill-pdf-form/holy-pdf-fill-form-hero.webp
published: 2026-10-20
---

<figure class="article-visual article-visual--hero">
  <img src="/articles/fill-pdf-form/holy-pdf-fill-form-hero.webp" alt="Un formulaire papier avec des champs vides et une case à cocher, et un stylo-plume qui écrit un trait d'encre bleue dans l'un des champs" width="1600" height="900" loading="eager" decoding="async" />
  <figcaption>Un formulaire rempli ne sert que si les réponses restent dans le fichier.</figcaption>
</figure>

Pour remplir un formulaire PDF, ouvrez [Modifier un PDF](/fr/modifier-pdf), choisissez le fichier et cliquez dans le premier champ. Tapez votre réponse, validez avec Entrée, passez au suivant. Une case se coche d'un clic, une liste déroulante ouvre son menu. Quand tout est rempli, cliquez sur **Enregistrer les modifications** et téléchargez la copie. Holy PDF écrit chaque réponse dans le champ du formulaire lui-même : Acrobat, Aperçu ou un navigateur l'affichent, sans réglage.

## Votre PDF est-il un vrai formulaire ?

Un PDF remplissable contient des champs interactifs : des zones de texte, des cases à cocher, des listes. Beaucoup de « formulaires » n'en sont pas. Ce sont des scans ou des exports d'un formulaire papier, avec des cadres imprimés et rien derrière.

Holy PDF vous l'indique. Ouvrez le fichier dans [Modifier un PDF](/fr/modifier-pdf) : quand la page contient des champs à remplir, l'indication sous les outils affiche **Cliquez dans un champ du formulaire pour le remplir.** Si cette phrase n'apparaît pas, avec l'outil Sélection actif et rien de sélectionné, la page n'a pas de champ, et c'est la section [si le PDF n'est pas remplissable](#si-le-pdf-nest-pas-remplissable) qui s'applique.

## Remplir le formulaire dans Holy PDF

1. Ouvrez [Modifier un PDF](/fr/modifier-pdf) et cliquez sur **Choisir un PDF**. La première page s'affiche.
2. Cliquez dans un champ de texte. Une zone de saisie s'ouvre par-dessus, avec la valeur actuelle du champ. Tapez votre réponse, puis validez avec la touche Entrée ou un clic ailleurs.
3. Cliquez sur une case à cocher pour la cocher, et de nouveau pour la décocher. Cliquez sur un bouton radio pour le choisir.
4. Cliquez sur une liste déroulante : un menu s'ouvre avec les options du formulaire. Choisissez-en une.
5. Passez à la page suivante avec les flèches de la barre de pages, et remplissez-la de la même façon.
6. Cliquez sur **Enregistrer les modifications**, puis sur **Télécharger le PDF**.

<figure class="article-visual">
  <img src="/articles/fill-pdf-form/holy-pdf-fill-form-ui-fr.webp" alt="L'outil Modifier un PDF de Holy PDF avec une demande d'adhésion fictive : nom, adresse e-mail et date de naissance remplis, un type d'adhésion choisi dans une liste, une case cochée" width="1400" height="900" loading="lazy" decoding="async" />
  <figcaption>Un formulaire fictif rempli dans l'outil actuel, avant l'enregistrement de la copie.</figcaption>
</figure>

Chaque réponse validée est une étape de l'historique : Ctrl+Z, ou ⌘Z sur Mac, annule la dernière. L'aperçu de la page est redessiné avec vos valeurs au fur et à mesure, dans la police et la couleur prévues par le formulaire : ce que vous voyez est ce que le fichier montrera.

Le fichier est traité dans votre navigateur, sans être envoyé à Holy PDF. [Vos PDF restent sur votre appareil](/fr/blog/vos-pdf-restent-sur-votre-appareil) explique comment.

## Remplir un formulaire PDF sur Mac

Sur Mac, Aperçu ouvre aussi les formulaires PDF. Le guide d'Apple indique de [cliquer sur un champ du formulaire, puis de saisir le texte](https://support.apple.com/fr-afri/guide/preview/prvw35725/11.0/mac/26), et d'ajouter une zone de texte quand un PDF refuse la saisie.

Holy PDF fait le même travail dans votre navigateur, sans rien installer, et la copie téléchargée est un PDF ordinaire. Prenez ce que vous avez sous la main.

## Et pour un Cerfa ?

Un Cerfa remplissable est un formulaire PDF avec des champs. Si la phrase **Cliquez dans un champ du formulaire pour le remplir.** apparaît quand vous l'ouvrez dans Modifier un PDF, les étapes ci-dessus s'y appliquent. L'aide d'un formulaire de service-public.fr décrit le même geste, [« enregistrez le formulaire PDF à partir du navigateur sur votre ordinateur, puis ouvrez le document avec Adobe Reader »](https://www.service-public.gouv.fr/particuliers/vosdroits/R74938/aide-remarque). La [fiche de l'ANCT sur le même sujet](https://lesbases.anct.gouv.fr/ressources/comment-remplir-et-signer-un-formulaire-au-format-pdf) montre ce geste avec Adobe Acrobat Reader. Dans Holy PDF, téléchargez le Cerfa, ouvrez-le dans [Modifier un PDF](/fr/modifier-pdf), remplissez, enregistrez la copie, puis vérifiez-la dans un autre lecteur, comme pour tout formulaire.

Nous n'avons pas essayé chaque Cerfa. Si le formulaire utilise le format XFA, Holy PDF ne le remplit pas, comme l'explique la section [les limites à connaître](#les-limites-à-connaître). Et certaines démarches se font uniquement en ligne, sur le site de l'administration, le PDF n'y servant que de modèle : la notice de la démarche fait foi.

## Enregistrer le formulaire sans perdre les réponses

Holy PDF n'enregistre pas « par-dessus » le fichier d'origine : **Enregistrer les modifications** fabrique un nouveau fichier où chaque champ modifié porte sa valeur et son apparence redessinée. Les lecteurs n'ont besoin d'aucun réglage pour l'afficher.

Gardez la copie téléchargée, et l'original intact : vous pourrez recommencer si une réponse était fausse.

## Si le PDF n'est pas remplissable

Si le formulaire n'a pas de champ, vous pouvez quand même écrire dessus. Dans le même outil, choisissez **Texte**, cliquez là où va la réponse, et tapez. Faites glisser au lieu de cliquer pour dessiner une zone : le texte y revient à la ligne automatiquement. Le texte ajouté reste du vrai texte : il se sélectionne, se copie et se trouve par la recherche dans tous les lecteurs.

Pour un formulaire sorti d'un scanner ou d'un appareil photo, la page est une image. L'outil Texte fonctionne dessus de la même façon. Si vous voulez que les mots imprimés du scan deviennent eux aussi cherchables, [OCR PDF](/fr/ocr-pdf) ajoute cette couche ; ce n'est pas nécessaire pour écrire vos réponses.

L'outil **Champ** va un cran plus loin et ajoute de vrais champs à une page : un champ de texte, une case à cocher ou une liste déroulante. Un champ ajouté se remplit après l'enregistrement, pas dans la même session : c'est fait pour préparer un formulaire que d'autres rempliront.

## Vérifier la copie, la signer, la figer

Ouvrez le fichier téléchargé dans un autre lecteur et regardez chaque page : les réponses doivent être là, dans les champs. Si le formulaire part chez un tiers, [Signer un PDF](/fr/signer-pdf) ajoute une signature visible sur la page.

Si vous voulez que les réponses ne soient plus modifiables, passez la copie dans [Aplatir un PDF](/fr/aplatir-pdf). Les champs font désormais partie du contenu de la page : un lecteur ne peut plus les changer, et le texte reste sélectionnable. Un champ laissé vide peut disparaître de la page aplatie si le formulaire n'avait pas enregistré d'apparence pour lui. Gardez la copie non aplatie, au cas où une réponse devrait être corrigée.

## Les limites à connaître

- **Les formulaires XFA.** Holy PDF ne propose aucun champ sur un formulaire XFA, et l'outil Champ refuse d'y en ajouter. Ouvrez ces formulaires dans Adobe Acrobat Reader.
- **Les scripts.** Un formulaire peut contenir des scripts qui mettent une date en forme, calculent un total ou vérifient une valeur. Holy PDF ne les exécute pas. Tapez la valeur finale vous-même, et vérifiez les totaux.
- **La longueur.** Un champ de texte garde au plus le nombre de caractères que son auteur a autorisé ; taper au-delà ne change rien.
- **Les champs en lecture seule, les boutons et les champs de signature** ne réagissent pas au clic : Holy PDF ne les remplit pas.
- **Les PDF signés** sont refusés : une copie modifiée invaliderait la signature. Un PDF protégé par mot de passe s'ouvre avec son mot de passe, et la copie le garde.

## Questions fréquentes

### Peut-on remplir un formulaire PDF gratuitement, sans Adobe ?

Oui. L'outil Modifier un PDF est gratuit, sans compte ni installation, dans un navigateur récent. La copie téléchargée est un PDF standard, qu'Adobe Reader et tous les autres lecteurs ouvrent.

### Pourquoi mon PDF rempli s'ouvre-t-il vide ailleurs ?

Un lecteur affiche un champ à partir de l'apparence enregistrée dans le fichier. Holy PDF écrit la valeur et une apparence neuve pour chaque champ que vous modifiez : il s'affiche sans réglage. Si une copie faite ailleurs s'ouvre vide, ouvrez-la dans Holy PDF, retapez chaque réponse et téléchargez le nouveau fichier.

### Et sur iPhone ou Android ?

Oui, dans le navigateur du téléphone : ouvrez [Modifier un PDF](/fr/modifier-pdf), choisissez le fichier, touchez un champ et tapez avec le clavier. Le fichier reste sur le téléphone.

### Peut-on s'arrêter en cours et finir plus tard ?

Enregistrez la copie avec **Enregistrer les modifications**, puis rouvrez cette copie dans l'outil : les réponses déjà données sont là, et vous remplissez le reste.

### Comment savoir si un PDF est un formulaire XFA ?

Aucun champ n'est proposé sur ses pages, et l'indication « Cliquez dans un champ du formulaire pour le remplir. » n'apparaît pas. Si vous tentez d'y ajouter un champ avec l'outil Champ, l'enregistrement est refusé par un message qui le dit. Ces formulaires sont faits pour Adobe Acrobat Reader.

### Mes données sont-elles envoyées quelque part ?

Non. Le fichier est ouvert, rempli et enregistré dans votre navigateur. Aucun fichier n'est envoyé ni stocké.

## Sources officielles

- [Spécification de l'outil Modifier un PDF de Holy PDF, section Forms](https://github.com/Snouzy/holy-pdf/blob/main/wiki/specs/2026-10-04-web-edit-design.md)
- [Assistance Apple, Remplir et signer des formulaires PDF dans Aperçu sur Mac](https://support.apple.com/fr-afri/guide/preview/prvw35725/11.0/mac/26)
- [Service-Public.fr, aide au remplissage d'un formulaire PDF](https://www.service-public.gouv.fr/particuliers/vosdroits/R74938/aide-remarque)
- [Les Bases du numérique d'intérêt général (ANCT), Comment remplir et signer un formulaire au format pdf](https://lesbases.anct.gouv.fr/ressources/comment-remplir-et-signer-un-formulaire-au-format-pdf)
