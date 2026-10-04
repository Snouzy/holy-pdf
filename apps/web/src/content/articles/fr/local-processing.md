---
section: blog
lang: fr
slug: vos-pdf-restent-sur-votre-appareil
title: Comment Holy PDF traite vos PDF sans les envoyer
description: "PDFium en WebAssembly, un Worker, et aucun fichier envoyé : comment Holy PDF travaille vos PDF dans le navigateur, et comment le vérifier."
h1: Comment Holy PDF traite vos PDF sans les envoyer
lead: Vos fichiers restent sur votre appareil. Voici comment, et comment le vérifier vous-même.
published: 2026-10-02
---

Beaucoup d'outils PDF en ligne fonctionnent ainsi : votre fichier part sur leur serveur, il y est traité, puis le résultat revient. Holy PDF fait l'inverse : le moteur vient à votre fichier.

## Le moteur vient à votre fichier

Quand vous déposez votre premier fichier, votre navigateur télécharge un moteur PDF : PDFium, le moteur libre qui affiche aussi les PDF dans Chrome. Il est compilé en WebAssembly, un format que le navigateur exécute rapidement.

Le navigateur lit votre fichier sur votre appareil et le confie à ce moteur. Le moteur tourne dans un Worker, un fil d'exécution à part : la page reste fluide pendant qu'il travaille. Le résultat est fabriqué en mémoire, puis le navigateur vous le propose en téléchargement. À aucun moment votre fichier ne passe par le réseau.

## Ce que le réseau transporte quand même

Le site utilise le réseau pour vous envoyer ses pages et son moteur, jamais pour recevoir vos fichiers. Votre navigateur télécharge :

- les pages du site, leurs styles et leurs polices ;
- le moteur PDF, un fichier d'environ 4,6 Mo avant compression, au premier fichier déposé.

Chaque requête dit au serveur quelle page vous demandez, comme sur tout site. Aucune ne contient vos fichiers.

## Le vérifier vous-même

1. Ouvrez un outil, par exemple [Fusionner des PDF](/fr/fusionner-pdf).
2. Ouvrez les outils de développement du navigateur (F12 sous Windows, Option + Commande + I sur Mac), puis l'onglet Réseau. Dans Safari, activez d'abord les fonctions pour les développeurs, dans les réglages, onglet Avancés.
3. Déposez un PDF et lancez l'outil.

Vous verrez arriver le moteur et des fichiers du site, mais aucune requête qui envoie votre document. Les lignes qui commencent par « blob: » sont des fichiers fabriqués dans votre navigateur, comme les vignettes et le résultat : ils ne passent pas par le réseau.

## Pourquoi c'est important

Une carte d'identité, une fiche de paie, un avis d'imposition : ce sont souvent eux qu'on doit fusionner ou alléger. Avec Holy PDF, ils restent chez vous.
