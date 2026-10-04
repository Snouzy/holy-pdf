# Web : refonte de l'accueil et FAQ par outil

_2 octobre 2026. Statut : livré dans `apps/web/`._

Maquettes : non publiées. La proposition complète montre le monastère et les sections du bas ; le haut retenu est la piste « Hero I · la phrase à trous ».

## Décisions

- Le monastère ne change pas : cartes, recherche, catégories, interrupteur, vue compacte.
- Le haut et le bas changent. La zone d'import de l'accueil disparaît « dans un premier temps ». Pour le haut, la phrase à trous est retenue.
- La vue compacte garde une ligne par catégorie, qui défile de côté.
- La vidéo de présentation va à deux endroits : un bouton « Voir Holy PDF en 30 secondes » sous la phrase du haut, avec un aperçu rond, qui l'ouvre dans une fenêtre ; et la première question de la FAQ, « Comment ça marche ? », dont la réponse est la vidéo dans une bulle. Chaque langue a sa vidéo, en français et en anglais.
- La page 404 suit la piste A : Frère Loupe a cherché partout, puis la phrase « Je veux [verbe] mes PDF. » pour repartir vers un outil. Elle existe en français et en anglais.
- La FAQ de l'accueil prend la forme d'une conversation, comme iMessage, avec des bulles qui apparaissent au défilement.
- La section sur la confidentialité parle à quelqu'un qui ne connaît pas les outils de développement : une promesse et quatre garanties, pas d'onglet Réseau.

## Accueil

Ordre de la page :

1. **Haut I, la phrase à trous.** Le titre du site en petit, et juste dessous « Gratuit · aucun fichier envoyé · sans compte ». Puis « Je veux [fusionner ▾] mes PDF. » : un menu de douze verbes, fait maison parce que le menu natif reprenait la taille géante de la phrase. Sa liste est à taille de texte, avec le moine et son nom pour chaque verbe ; elle suit le modèle « combobox » des listes de choix (flèches, Entrée, Échap, Début, Fin, premières lettres). Sous la phrase, le moine du verbe choisi, « s'en occupe, dans votre navigateur », et le bouton « C'est parti → » qui mène à son outil. Dessous, seul et centré, le bouton de la vidéo. Les garanties étaient à côté de ce bouton ; le 4 octobre, elles sont montées sous le titre, et les pistes A à D de cette ligne sont écartées. Sans JavaScript, le bouton mène à Fusionner. Sur un écran de 1280 × 800, la première rangée de cartes reste visible dès l'arrivée. Les pistes D, E, C, F, G et H ont été écartées.
2. **Le monastère**, inchangé. La carte « Et N moines en méditation » devient un bouton « Les montrer », qui allume l'interrupteur.
3. **Trois gestes, et c'est fait** : choisir un moine, déposer ses fichiers, récupérer le résultat. En frise, sans cartes, pour ne pas enchaîner deux rangées de cartes avec les cas d'usage (piste A, retenue le 3 octobre) : chaque geste a son moine dans un disque teinté, son numéro en tampon, et un trait pointillé relie les trois disques. Sur téléphone, les gestes s'empilent et le trait disparaît.
4. **Pour vos papiers de tous les jours** : quatre cas, chacun avec ses moines et un lien. Le dossier administratif mène au guide ; les trois autres mènent à Signer, Compresser et Protéger.
5. **Vos PDF ne quittent jamais votre appareil.** Une feuille lignée, « Promesse du monastère », signée par Frère Plume, qui se tient à côté (au-dessus sur téléphone) : le titre et une phrase, « Beaucoup de sites PDF envoient votre fichier sur leurs ordinateurs. Ici, c'est l'inverse ». Juste en dessous, une bande sombre : les quatre garanties et le lien vers l'article qui explique comment le vérifier. Retenu le 3 octobre (piste F, puis la bande) ; le dessin « ailleurs ou ici » et les pistes A à E sont écartés.
6. **Pourquoi des moines ?** Les copistes, et « Ici, le monastère, c'est votre navigateur ». Le moine au livre porte l'auréole (`halo` de `Monk`), depuis le 4 octobre.
7. **Questions fréquentes**, en conversation. Six questions courtes, puis un lien vers la page FAQ.
8. **Un moine vous attend** : un bandeau bleu avec des rayons qui partent de la tête de Frère Agrafe, auréolé, à droite. Sous le titre, six raccourcis avec leur moine : Fusionner, Compresser, Modifier, Signer, Organiser et Créer (qui mène à JPG en PDF), en 3, 2 ou 1 colonne selon la place ; puis « Voir tous les moines → », qui ramène au monastère. Retenu le 4 octobre (piste E, le soleil de D et les raccourcis de B) ; le moine passe sous les raccourcis sur téléphone.

« Au monastère, bientôt » et l'ancien encart des garanties disparaissent.

L'accueil n'hydrate plus aucun îlot. `HomeDrop`, l'orientation des fichiers (`orient.ts`) et leur passage à la planche (`handoff.ts`) sont supprimés : un fichier lâché sur l'accueil n'est plus pris en charge. Pour remettre la zone d'import, partir du commit qui les supprime.

Les bulles de la FAQ apparaissent avec une animation CSS liée au défilement (`animation-timeline: view()`). Chrome, Edge et Safari 26 la jouent. Firefox montre les bulles sans animation. Elle ne se joue pas quand le système demande moins d'animations.

## FAQ par outil

- Chaque question d'une page d'outil a une ancre, tirée de son texte sans accents ni ponctuation (`questionId`, `src/faq.ts`). Une adresse en `#ancre` ouvre la question.
- La page FAQ garde ses questions générales en Markdown. En dessous, elle liste les questions de chaque outil, rangées par outil, chacune liée à sa réponse sur la page de l'outil. Les questions viennent du champ `faq` des fichiers `src/content/tools/<lang>/*.md` : elles ne sont jamais recopiées.
- JSON-LD `FAQPage` sur chaque page d'outil, et sur la page FAQ pour ses questions générales, lues dans son Markdown (`faqFromMarkdown`). L'accueil n'en a pas : ses questions reprennent celles de la page FAQ.

## Vidéo et page 404

- `src/films.ts` liste les vidéos par langue : `public/videos/holy-pdf-fr.mp4` et `holy-pdf-en.mp4` (30 s, 4,8 Mo chacune), avec leurs affiches `.webp` (13 Ko). Une langue sans vidéo n'affiche ni bouton ni bulle. La vidéo se charge au clic (`preload="none"`) ; l'affiche sert aussi à l'aperçu rond.
- La fenêtre est un `<dialog>` natif : Échap, le bouton ou un clic à côté la ferment, et la vidéo s'arrête.
- La phrase du haut est un composant, `src/home/Pick.astro`, que la page 404 reprend en version compacte, sans la pastille du moine.
- Cloudflare sert le `404.html` le plus proche de l'adresse : le build déplace `fr/404/index.html` et `en/404/index.html` vers `fr/404.html` et `en/404.html`, et copie l'anglaise à la racine. L'ancienne grille de tous les outils sur la 404 disparaît.

## Hors périmètre

- Le tableau comparatif avec les autres sites PDF. Il reste en option sur le canevas : ses affirmations sur les autres sites devraient pouvoir se vérifier.
- La zone d'import, qui pourra revenir plus tard.
