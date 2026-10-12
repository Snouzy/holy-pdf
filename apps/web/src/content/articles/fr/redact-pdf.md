---
section: guides
lang: fr
topics: [metadata, privacy, redaction, security]
slug: comment-caviarder-un-pdf
title: Comment caviarder un PDF sans laisser le texte dessous
description: "Caviardez un PDF sans laisser le texte copiable sous un rectangle noir. Étapes, vérifications et limites à connaître avant de partager le fichier."
h1: Comment caviarder un PDF sans laisser le texte dessous
lead: Un vrai caviardage retire l'information du fichier. Un rectangle noir posé par-dessus ne suffit pas.
author: Mathias
image: /articles/redact-pdf/holy-pdf-redaction-guide-hero.webp
published: 2026-10-12
---

<figure class="article-visual article-visual--hero">
  <img src="/articles/redact-pdf/holy-pdf-redaction-guide-hero.webp" alt="Un document avant caviardage et sa copie protégée par trois zones noires" width="1600" height="900" loading="eager" decoding="async" />
  <figcaption>Le caviardage doit retirer l'information de la copie, pas seulement la recouvrir à l'écran.</figcaption>
</figure>

Pour caviarder un PDF, ouvrez [Noircir un PDF](/fr/noircir-pdf), choisissez une copie du document, puis tracez une zone sur chaque information à retirer. Holy PDF transforme chaque page marquée en image et peint les zones en noir. Le texte et les objets de cette page ne restent donc pas cachés sous un simple rectangle.

## Pourquoi un rectangle noir ne suffit pas

Dans un éditeur classique, un rectangle noir peut n'être qu'une forme placée au-dessus du texte. La phrase reste alors dans le fichier : quelqu'un peut parfois la sélectionner, la copier, la rechercher ou retirer la forme. Le [tribunal fédéral du district du New Jersey](https://www.njd.uscourts.gov/content/personal-identity-and-metadata-redaction-techniques-e-filing) avertit précisément contre les rectangles, le surlignage et les autres caches visuels qui ne retirent pas les données.

En français, **caviarder**, **biffer** et **noircir** sont souvent employés pour la même action. Le mot importe moins que le résultat : l'information visée ne doit plus être récupérable dans la copie partagée.

## Préparez une copie et repérez tout ce qui doit partir

Conservez l'original séparément et travaillez sur une copie. Cette précaution permet de recommencer si une zone est mal placée et d'éviter d'altérer votre seul exemplaire. L'[ICO recommande aussi de travailler sur une copie](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/security/disclosing-documents-to-the-public-securely/how-do-we-avoid-an-accidental-breach-when-redacting-information/) et de relire le document destiné à être communiqué.

Avant d'ouvrir l'outil, parcourez toutes les pages. Cherchez les noms, adresses, signatures, numéros de téléphone, courriels, identifiants, références de dossier et informations visibles dans les formulaires ou les annotations.

## Caviardez le PDF dans Holy PDF

1. Ouvrez [Noircir un PDF](/fr/noircir-pdf) et cliquez sur **Choisir un PDF**.
2. Faites glisser le pointeur sur la première information à retirer. Une zone noire apparaît.
3. Ajoutez autant de zones que nécessaire, sur toutes les pages concernées.
4. Déplacez une zone avec sa poignée ou retirez-la avec la croix. **Vider cette page** efface toutes les zones de la page courante.
5. Cliquez sur **Noircir le PDF**, puis téléchargez la copie obtenue.

<figure class="article-visual">
  <img src="/articles/redact-pdf/holy-pdf-redaction-ui-fr.webp" alt="Interface française de Holy PDF avec deux zones noires tracées sur un document fictif" width="1400" height="900" loading="lazy" decoding="async" />
  <figcaption>Deux zones sont marquées dans l'interface réelle de Holy PDF, avant la création de la copie noircie.</figcaption>
</figure>

Le fichier est traité dans votre navigateur : Holy PDF ne l'envoie pas sur un serveur. Le fonctionnement local est détaillé dans [Vos PDF restent sur votre appareil](/fr/blog/vos-pdf-restent-sur-votre-appareil).

## Ce que Holy PDF retire réellement

Pour chaque page portant au moins une zone, l'outil :

- affiche la page à 200 ppp ;
- peint les zones marquées en noir ;
- remplace le contenu de la page par une image JPEG de ce rendu.

Les tests du moteur placent des données factices dans le texte de la page, un objet de formulaire, une annotation, un lien et des champs. Après caviardage, ces données testées sont absentes des flux bruts et décompressés de la sortie. Les pages sans zone conservent leur texte. Les signets et les liens qui menaient vers une page noircie continuent de mener vers cette page.

Cette méthode a une conséquence volontaire : **tout le texte de la page noircie** devient une image. Il n'est plus sélectionnable et une recherche ne le retrouve plus, même en dehors des zones noires. Les champs, notes et liens présents sur cette page disparaissent aussi.

## Vérifiez la copie avant de la partager

Ne vous fiez pas uniquement à l'aperçu. Contrôlez le fichier téléchargé :

- rouvrez la copie dans un autre lecteur PDF ;
- recherchez les mots, noms et numéros retirés ;
- essayez de sélectionner et de copier du texte autour des zones ;
- relisez chaque page, y compris celles sans caviardage ;
- vérifiez le titre du document, les signets et les métadonnées ;
- confirmez que vous partagez la copie noircie, pas l'original.

[Adobe distingue le caviardage visible du nettoyage des informations cachées](https://helpx.adobe.com/acrobat/desktop/protect-documents/redact-pdfs/redacting-sanitizing.html). Holy PDF ne présente pas sa sortie comme un PDF « assaini » : son outil de caviardage ne contrôle pas complètement toutes les métadonnées ni toutes les structures cachées.

## Limites à connaître

Holy PDF refuse les PDF signés et les formulaires XFA. Il ne vérifie pas complètement le titre, les signets, les métadonnées, les textes de remplacement de la structure balisée, certaines valeurs par défaut de champs ni les miniatures de pages. Contrôlez ces éléments séparément avant une diffusion sensible.

Une page transformée en image peut alourdir le fichier, autour d'un mégaoctet pour une page A4 dans le cas décrit par la spécification actuelle. Si nécessaire, utilisez ensuite [Compresser un PDF](/fr/compresser-pdf), puis recommencez les vérifications. [Protéger un PDF](/fr/proteger-pdf) peut limiter l'ouverture de votre copie par mot de passe, mais ne remplace pas le caviardage.

Si votre objectif est seulement de rendre tout le texte d'un document non sélectionnable, [Pixelliser un PDF](/fr/pixelliser-pdf) traite les pages entières. Pour pouvoir rechercher du texte dans un document numérisé, [l'OCR PDF](/fr/ocr-pdf) ajoute au contraire une couche de texte : ce n'est pas une étape nécessaire pour tracer et appliquer des zones de caviardage.

## Questions fréquentes

### Quelle différence entre caviarder, biffer et noircir un PDF ?

Dans l'usage courant, les trois verbes peuvent désigner le fait de masquer des informations. Pour un partage sûr, vérifiez surtout que l'outil retire l'information du fichier au lieu d'ajouter un cache visuel.

### Puis-je caviarder un PDF gratuitement ?

Oui. L'outil Holy PDF est gratuit et ne demande pas de compte. Le traitement se déroule sur votre appareil.

### Peut-on caviarder un PDF en ligne sans l'envoyer ?

Oui avec Holy PDF : l'interface s'ouvre dans le navigateur, mais le fichier est traité localement. Une page web n'implique pas forcément un envoi du document.

### Le caviardage supprime-t-il les métadonnées ?

Non, pas automatiquement. Holy PDF ne contrôle pas complètement le titre et les métadonnées. Inspectez-les séparément avant de communiquer un document sensible.

### Puis-je noircir un PDF scanné ?

Oui. Les zones sont appliquées à l'image visible de la page. Vous n'avez pas besoin de lancer un OCR pour tracer ces zones.

## Sources officielles

- [Spécification de l'outil de caviardage Holy PDF](https://github.com/Snouzy/holy-pdf/blob/main/wiki/specs/2026-10-02-web-redact-design.md)
- [Adobe — Caviardage et nettoyage des informations cachées](https://helpx.adobe.com/acrobat/desktop/protect-documents/redact-pdfs/redacting-sanitizing.html)
- [US District Court, District of New Jersey — Personal identity and metadata redaction techniques](https://www.njd.uscourts.gov/content/personal-identity-and-metadata-redaction-techniques-e-filing)
- [ICO — How to avoid an accidental breach when redacting information](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/security/disclosing-documents-to-the-public-securely/how-do-we-avoid-an-accidental-breach-when-redacting-information/)
