# Web : pages du pied de page — design

_Rédigé le 2 octobre 2026. Statut : livré dans `apps/web/`. Modèle : les pages « À propos », « Confidentialité » et « Conditions » de workout.cool (`content/<page>/<langue>.mdx`, gabarit centré, texte en `prose`), adaptées au site Astro._

## Contexte

Le pied de page a cinq colonnes de liens (voir la [spec du design system](2026-09-30-web-design-system-design.md)). Treize liens pointent vers `#`, parce que leurs pages n'existent pas encore (choix du 1er octobre 2026) : Nouveautés, FAQ, Blog, Guides PDF, Appli Mac, Appli iPhone, Confidentialité, Conditions d'utilisation, Mentions légales, Cookies, À propos, Contact, Presse.

Le 2 octobre, il a été décidé de faire toutes ces pages, comme sur workout.cool, en reprenant ses éléments : l'éditeur, l'hébergeur, l'adresse de contact, la trame de l'« À propos ».

Ce que Holy PDF ne reprend pas de workout.cool : les comptes, le paiement, les conditions générales de vente, la publicité Ezoic et ses cookies. Holy PDF n'a rien de tout cela. Le site ne dépose aucun cookie et ne charge aucun outil d'analyse ; il garde seulement deux clés dans `localStorage` (`theme`, `view`).

## Objectif et critères de réussite

Chaque lien du pied de page, réseaux sociaux mis à part, mène à une vraie page, en français et en anglais.

La spec est réussie quand :

- les 12 pages et les 2 premiers articles existent dans les deux langues ;
- le pied de page n'a plus de `#`, sauf sur les icônes des réseaux sociaux ;
- ajouter une page, un article ou une langue ne demande de toucher qu'aux fichiers décrits dans la section « Ajouter du contenu » ;
- ces pages ne chargent aucun JavaScript en plus de celui de `Base.astro` ;
- les tests de la section Tests passent.

## Portée

**Dans la spec :** les 12 pages, les 2 articles, le gabarit, les deux collections, les deux routes, les liens du pied de page, les tests et le wiki.

**Hors spec :** les liens des réseaux sociaux (comptes à créer), un formulaire de contact ou d'inscription (aucun serveur), un flux RSS, d'autres articles, la recherche dans ces pages, l'achat du domaine et le routage des e-mails.

## Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Format | Markdown avec frontmatter, collections Astro | Même modèle que `content/tools`. MDX ajouterait `@astrojs/mdx` sans besoin : aucune page ne met de composant dans son texte. |
| Slugs | Dans `src/sitePages.ts`, comme `tools.ts` | Les liens sont typés : `pagePath("privacy", lang)` ne compile pas pour une page inconnue. Une langue de plus force un slug pour chaque page. |
| Mac et iPhone | Une seule page « Applis », sections `#mac` et `#iphone` | Deux pages « bientôt » seraient deux pages maigres. |
| Contenu manquant | Un vrai contenu minimal partout | Choix de l'auteur : pas de page vide « en méditation ». |
| Adresse e-mail | `hello@holy-pdf.com` | Comme `hello@workout.cool`. Elle marche une fois le domaine acheté et Cloudflare Email Routing réglé. |
| Éditeur | Snouzylabs S.R.L., société de droit roumain qui édite aussi workout.cool, Mathias BRADICEANU directeur de la publication (décision du 5 octobre 2026) | LCEN, art. 6-III-1 : un éditeur professionnel donne sa dénomination, son siège, son téléphone, son capital social, son immatriculation (CUI) et le nom du directeur de la publication. Siège, téléphone, capital et CUI à ajouter dès que l'auteur les transmet |
| Libellés du gabarit | `src/i18n/pages.ts`, à part de `fr.ts` et `en.ts` | `Board.tsx` importe les dictionnaires entiers : ces libellés n'ont rien à faire dans le JavaScript des pages outils (même piège que `frSearch`). |

## Adresses

`src/sitePages.ts` exporte `pageIds`, la table `sitePages` (slug par langue, émoji) et `pagePath(id, lang)`.

| Page | Id | FR | EN | Émoji |
|---|---|---|---|---|
| Nouveautés | `news` | `/fr/nouveautes` | `/en/whats-new` | 🔔 |
| FAQ | `faq` | `/fr/faq` | `/en/faq` | 🙋 |
| Blog | `blog` | `/fr/blog` | `/en/blog` | ✍️ |
| Guides PDF | `guides` | `/fr/guides` | `/en/guides` | 🧭 |
| Applis | `apps` | `/fr/applis` | `/en/apps` | 🕯️ |
| Confidentialité | `privacy` | `/fr/confidentialite` | `/en/privacy` | 🤫 |
| Conditions d'utilisation | `terms` | `/fr/conditions-utilisation` | `/en/terms` | 📜 |
| Mentions légales | `notice` | `/fr/mentions-legales` | `/en/legal-notice` | ⚖️ |
| Cookies | `cookies` | `/fr/cookies` | `/en/cookies` | 🍪 |
| À propos | `about` | `/fr/a-propos` | `/en/about` | 🙏 |
| Contact | `contact` | `/fr/contact` | `/en/contact` | ✉️ |
| Presse | `press` | `/fr/presse` | `/en/press` | 📰 |

Un article vit sous la page de sa section : `/{lang}/{slug de blog ou guides}/{slug de l'article}`.

| Article | Section | FR | EN |
|---|---|---|---|
| `local-processing` | blog | `/fr/blog/vos-pdf-restent-sur-votre-appareil` | `/en/blog/your-pdfs-stay-on-your-device` |
| `paperwork` | guides | `/fr/guides/preparer-un-dossier-administratif-en-pdf` | `/en/guides/prepare-paperwork-as-one-pdf` |

Aucun slug de page ne doit égaler un slug d'outil ni `search.json` : un test le vérifie.

## Collections

`src/content.config.ts` ajoute deux collections à `tools`.

**`pages`** : `src/content/pages/{fr,en}/<id>.md`.

| Champ | Type | Rôle |
|---|---|---|
| `page` | `z.enum(pageIds)` | la page |
| `lang` | `z.enum(languages)` | la langue |
| `title` | chaîne, 60 caractères au plus | `<title>` |
| `description` | chaîne, de 70 à 160 caractères | `<meta name="description">` |
| `h1` | chaîne | le titre visible, sans émoji |
| `lead` | chaîne | le sous-titre sous le titre |
| `updated` | date, facultative | « Mis à jour le … », sur les pages juridiques |

**`articles`** : `src/content/articles/{fr,en}/<id>.md`. Les deux langues d'un article ont le même nom de fichier : c'est ainsi qu'elles s'apparient pour le changement de langue.

| Champ | Type | Rôle |
|---|---|---|
| `section` | `"blog"` ou `"guides"` | la liste qui le montre |
| `lang` | `z.enum(languages)` | la langue |
| `slug` | chaîne en minuscules, chiffres et tirets | la fin de l'adresse |
| `title`, `description`, `h1`, `lead` | comme `pages` | |
| `published` | date | la date de l'article |
| `updated` | date, facultative | la date de la dernière retouche |

## Routes

- `src/pages/[lang]/[page].astro` construit les 24 pages. Astro 7 garde les deux routes `[lang]/[tool]` et `[lang]/[page]` : chacune construit les chemins de son `getStaticPaths`, et le serveur de développement passe à la suivante quand la première ne connaît pas le chemin (`matchAllRoutes`). Pour `blog` et `guides`, la page ajoute sous son texte la liste des articles de sa section et de sa langue, du plus récent au plus ancien.
- `src/pages/[lang]/[section]/[article].astro` construit les articles.

Le changement de langue (`paths` de `Base.astro`) mène à la même page dans l'autre langue ; pour un article, à son pendant.

## Gabarit

`src/layouts/ContentPage.astro`, sur `Base.astro`. La barre du haut, le pied de page, le thème et la langue restent ceux du site.

- **En-tête centré**, comme sur workout.cool : le `h1`, avec l'émoji de la page collé au dernier mot (règle de marque) ; le `lead` dessous, en `--ink-soft`, à la taille de l'intro des outils ; sur les pages juridiques, « Mis à jour le 2 octobre 2026 ».
- **Le texte** : une colonne `.prose` de 48 rem centrée, comme sous les outils ; `h2` à gauche ; liens en `--accent`, soulignés ; tableaux simples.
- **Les moines** : sur « À propos », un moine content, sans auréole (l'auréole est réservée au logo) ; sur « Applis », le moine endormi et le tampon « Bientôt » des outils à venir. Les autres pages n'en ont pas.
- **Blog et Guides** : chaque article en carte (titre, date, `lead`), la carte entière est un lien.
- **Article** : sous le titre, « 2 octobre 2026 · Mathias Bradiceanu » ; à la fin, un lien vers sa liste.
- **Dates** : formatées au build par `Intl.DateTimeFormat(lang, { dateStyle: "long" })`.

Le gabarit ne charge aucun îlot Preact ni aucun script en plus de ceux de `Base.astro`.

## Données structurées

- Chaque page : `BreadcrumbList` (Holy PDF › la page).
- Chaque article : `BreadcrumbList` (Holy PDF › Blog ou Guides › l'article) et `BlogPosting` (`headline`, `description`, `datePublished`, `dateModified`, `author` de type `Person`, `inLanguage`, `url`).
- Pas de `FAQPage` : la FAQ générale n'en a pas plus que les pages outils.

Les pages entrent dans le sitemap. Elles n'entrent pas dans la recherche d'outils de l'accueil.

## Pied de page

`SiteFooter.astro` garde `later` pour les seules icônes des réseaux sociaux. Les autres liens appellent `pagePath` ; « Appli Mac (bientôt) » et « Appli iPhone (bientôt) » mènent à `pagePath("apps", lang)` suivi de `#mac` et `#iphone`.

## Contenu

Chaque page existe en français et en anglais. Les faits viennent du wiki. Aucun chiffre inventé : ni nombre d'utilisateurs, ni date de lancement, ni durée de développement. Pas de nombre d'outils dans les textes : il changerait à chaque outil livré.

Les textes juridiques sont une base sérieuse, pas un avis d'avocat : ils restent dans « Textes à relire » de la [marque](../product/brand.md).

### Juridique

- **Mentions légales** : éditeur Snouzylabs S.R.L., directeur de la publication Mathias BRADICEANU ; contact `hello@holy-pdf.com` ; hébergeur Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, États-Unis ; propriété intellectuelle : les textes, le code et les fichiers des illustrations sous AGPL-3.0-or-later, le nom, le logo et le moine réservés ([BRAND.md](../../BRAND.md)) ; crédits : Bricolage Grotesque et Figtree (SIL Open Font License), Simple Icons (CC0), PDFium et qpdf, avec un lien vers `/licenses/`.
- **Confidentialité** : responsable du traitement Snouzylabs S.R.L., représentée par Mathias BRADICEANU ; les fichiers sont traités dans le navigateur et le site ne les reçoit jamais ; pas de compte, pas d'outil d'analyse ; Cloudflare traite les données techniques des requêtes (adresse IP, navigateur, page demandée) pour servir le site et le protéger, et transfère ces données aux États-Unis sous le Data Privacy Framework, auquel il est certifié ; les e-mails reçus servent seulement à répondre, puis sont supprimés ; droits d'accès, de rectification, d'effacement et d'opposition ; réclamation à la CNIL.
- **Conditions d'utilisation** : service gratuit, sans compte, fourni « en l'état », sans garantie de disponibilité ; l'utilisateur garde ses droits sur ses documents et en reste responsable (usage licite, droits sur le contenu) ; Signer pose une image de signature, qui n'est ni une signature électronique avancée ni une signature qualifiée au sens du règlement eIDAS, faute de certificat ; garder ses originaux ; les moines, les textes et le code appartiennent au projet, les composants tiers suivent leur licence ; conditions modifiables, date en tête ; droit français.
- **Cookies** : aucun cookie ; un tableau des deux clés de `localStorage` (`theme` : le thème choisi ; `view` : la vue compacte de l'accueil), qui restent sur l'appareil et ne sont jamais envoyées ; comment les effacer depuis le navigateur.

### Holy PDF

- **À propos**, sur la trame de workout.cool : pourquoi Holy PDF ; l'histoire, reprise de l'[histoire de Holy PDF](../product/story.md) et de ses repères ; le principe du traitement local ; qui est derrière, Mathias Bradiceanu, aussi créateur de Workout.cool ; écrire au monastère.
- **Contact** : l'adresse ; pour un bug, le navigateur, l'outil et les étapes ; **ne jamais joindre un document personnel** ; un renvoi vers la Presse.
- **Presse** : Holy PDF en un paragraphe ; les faits (gratuit, traitement local, sans compte, les familles d'outils) ; le fondateur et un lien vers « À propos » ; le logo à télécharger (`/favicon.svg`) ; le contact, avec « Presse » en objet.

### Produit

- **Nouveautés** : un journal daté, du plus récent au plus ancien, tiré de l'historique git : les outils Organiser, puis Compresser et PDF en JPG, puis Signer (entrée ajoutée au rebase, voir Risques). Chaque entrée renvoie vers ses outils.
- **FAQ** : sept questions générales (gratuit, compte, fichiers envoyés, navigateurs, téléphone, taille des fichiers, appli), plus la valeur de la signature au rebase ; puis la liste des outils, construite depuis `toolList`.
- **Applis** : `#mac` présente le scanner Mac d'après sa [spec](2026-09-29-scanner-mac-v1-design.md) (des photos de documents deviennent des PDF propres, redressés, un PDF par document) ; `#iphone` dit qu'il viendra après. Les deux sont « Bientôt », et invitent à écrire pour être prévenu.

### Ressources

- **Blog**, premier article, « Comment Holy PDF traite vos PDF sans les envoyer » : PDFium compilé en WebAssembly, dans un Worker ; ce que le réseau charge malgré tout (les pages, le moteur) et ce qu'il ne transporte jamais (les fichiers) ; comment le vérifier soi-même dans l'onglet Réseau des outils de développement. Il suit les repères de [Version Web](../development/web-version.md) : ne pas dire que le site ne fait aucune requête.
- **Guides**, premier guide, « Préparer un dossier administratif en un seul PDF » : les photos des papiers avec JPG en PDF, Fusionner, Organiser, Compresser sous la taille demandée, puis Signer. C'est le besoin du récit fondateur, et il ne fait doublon avec aucune page outil.

## Ajouter du contenu

- **Un article** : un fichier `.md` par langue, même nom, dans `src/content/articles/<lang>/`. Aucun fichier TS à toucher.
- **Une page** : un id et ses slugs dans `sitePages.ts`, un `.md` par langue, un lien dans `SiteFooter.astro` si elle y figure.
- **Une langue** : la langue dans `languages` (`tools.ts`) ; TypeScript demande alors un slug pour chaque page et chaque outil, et un libellé dans `i18n/pages.ts` ; puis un `.md` par page et par article.

## Tests

- **Unitaire** : `tests/unit/sitePages.test.ts` vérifie que les slugs sont sûrs dans une adresse, uniques dans une langue, et qu'aucun n'égale un slug d'outil ni `search.json` ; il vérifie aussi les dates, à l'ouest de UTC comme ailleurs. Les fichiers de chaque page et de chaque article dans chaque langue sont vérifiés dans `tests/unit/content.test.ts`, à côté de ceux des outils. `tests/unit/fonts.test.ts` couvre aussi ces textes.
- **Navigateur** (`tests/e2e/pages.spec.ts`) :
  - en français et en anglais, chaque lien du pied de page, réseaux sociaux mis à part, répond 200 et montre un `h1` ;
  - chaque lien interne du texte des pages et des articles répond 200 ;
  - le changement de langue mène de `/fr/confidentialite` à `/en/privacy`, et d'un article à son pendant ;
  - `/fr/applis#mac` et `#iphone` existent ;
  - un article renvoie vers sa liste, et sa liste vers lui ;
  - à 390 px, aucune de ces pages ne défile de côté.
- **SEO** (`tests/seo/pages.test.ts`, `pnpm test:seo`) : la suite vérifie déjà chaque page construite (titre, description d'au moins 70 caractères, un seul `h1` avec son émoji collé, langue, `canonical`, `hreflang`, fil d'Ariane, sitemap). Son décompte ajoute les fichiers de `content/pages` et `content/articles`, et un test vérifie que ces pages n'hydratent aucun îlot.
- **Vérifications** : `pnpm check`, le build, les suites existantes. Pas de nouveau budget Lighthouse (cycle léger voulu par l'auteur) ; une mesure ponctuelle d'une page juridique confirme qu'elle pèse moins que l'accueil.

## Wiki

Dans le même commit que le code :

- [Version Web](../development/web-version.md) : une section « Pages de contenu », avec « Ajouter du contenu » ;
- la [spec du design system](2026-09-30-web-design-system-design.md) : le pied de page n'a plus de `#` hors réseaux sociaux ;
- la [marque](../product/brand.md) : les textes des pages et des articles entrent dans « Textes à relire » ;
- [Tests](../development/tests.md) et l'[index](../index.md).

## Risques

- **Cookies de Cloudflare** : le site statique n'en pose pas, mais une option de protection contre les robots peut ajouter `__cf_bm`. Vérifier les en-têtes `Set-Cookie` après le premier déploiement, et corriger la page Cookies si besoin.
- **Signer** : en ligne depuis le 2 octobre 2026. Les pages le citent : son entrée des Nouveautés, sa question de FAQ, la section Signature des Conditions, le fait de la Presse, et les crédits de qpdf et des fichiers tiers.
- **Adresse e-mail** : elle ne reçoit rien tant que le domaine n'est pas acheté. Le site n'est pas en ligne d'ici là.
