import type { UpcomingId } from "../cast";
import type { CompressLevel, EngineError, NumberFormat, NumberPosition } from "../engine/types";
import type { ToolId } from "../tools";

/** A title with one part on the yellow highlighter. */
export type Title = { before: string; highlight: string; after: string };

export type TitleRule = { count?: number; files?: number; title: Title };

export type MonkTexts = {
  name: string;
  intro: string;
  line: string;
  /** What to do, said while the tool waits. */
  hint: string;
  working: string;
  verb: string;
  /** The first rule whose `count` and `files` match gives the result's title; `{count}` stands for the count. `count`: parts, pages, images or percent saved, by tool. `files`: how many files were made. */
  result: TitleRule[];
  again: string;
};

type Kind = "pdf" | "images" | "word";

export const fr = {
  toolPage: {
    privacy: "Aucun fichier ne quitte votre appareil, de l'import jusqu'au téléchargement.",
    otherMonks: "Les autres moines",
    below: "Comment faire, questions fréquentes",
  },
  sizes: { kilo: "Ko", mega: "Mo" },
  drop: {
    choosePdfs: "Choisir des PDF",
    choosePdf: "Choisir un PDF",
    chooseImages: "Choisir des images",
    choosePhotos: "Choisir des photos",
    takePhoto: "Prendre une photo",
    orDropThem: "ou déposez-les ici",
    orDropIt: "ou déposez-le ici",
    trust: "Aucun fichier ne quitte votre appareil, de l'import jusqu'au téléchargement.",
    release: "Lâchez, je m'en occupe.",
  },
  board: {
    page: (n: number) => `Page ${n}`,
    pageCount: (n: number) => (n === 1 ? "1 page" : `${n} pages`),
    rotate: "Pivoter de 90°",
    rotateAll: "Tout pivoter",
    remove: "Supprimer la page",
    select: "Sélectionner la page",
    cutAfter: "Couper après cette page",
    cutEvery: "Couper toutes les",
    cutEveryUnit: "pages",
    apply: "Appliquer",
    replaceFile: "Choisir un autre fichier",
    addPdf: "Ajouter un PDF",
    addImages: "Ajouter des images",
    undo: "Annuler",
    undoHint: "Annuler (Ctrl ou ⌘ + Z)",
    removeConfirm: (name: string) => `Toutes les pages de ${name} seront retirées de l'aperçu.`,
    keep: "Garder",
    removeConfirmed: "Retirer",
    pageOfFile: (name: string, n: number) => `${name}, page ${n}`,
    dragInstructions: "Pour déplacer une page, appuyez sur Espace, utilisez les flèches, puis appuyez sur Espace pour la poser ou sur Échap pour annuler.",
    pickedUp: (page: string) => `${page} prise.`,
    movedOver: (page: string, target: string) => `${page} déplacée sur ${target}.`,
    dropped: (page: string, target: string) => `${page} posée à la place de ${target}.`,
    cancelled: (page: string) => `Déplacement de ${page} annulé.`,
    removeFile: "Retirer ce fichier",
    opening: "Ouverture…",
  },
  fileSuffix: {
    merge: "fusionne",
    split: "divise",
    organize: "organise",
    "delete-pages": "modifie",
    "extract-pages": "extrait",
    rotate: "pivote",
    "jpg-to-pdf": "converti",
    "pdf-to-jpg": "images",
    compress: "compresse",
    sign: "signe",
    protect: "protege",
    unlock: "deverrouille",
    flatten: "aplati",
    "pages-per-sheet": "par-feuille",
    "split-in-half": "coupe",
    pixelize: "pixellise",
    redact: "noirci",
    ocr: "ocr",
    "pdf-to-word": "word",
    scan: "scan",
    overlay: "superpose",
    bookmarks: "signets",
    repair: "repare",
    edit: "modifie",
    crop: "rogne",
    "page-numbers": "numerote",
    watermark: "filigrane",
  } satisfies Record<ToolId, string>,
  errors: {
    unsupportedFormat: "Ce format n'est pas pris en charge.",
    passwordRequired: "Ce PDF est protégé par un mot de passe.",
    wrongPassword: "Mot de passe incorrect.",
    damaged: "Ce fichier est endommagé et ne peut pas être ouvert.",
    outOfMemory: "Ce fichier est trop gros pour cet appareil.",
    engineUnavailable: "Le moteur PDF n'a pas pu être chargé. Vérifiez votre connexion.",
    noImages: "Ce PDF ne contient pas de photo. Essayez « Pages en JPG ».",
    alreadySigned: "Ce PDF contient déjà une signature numérique et ne peut pas être modifié ici.",
    fieldNameTaken: "Un champ du document porte déjà le nom d'un des champs ajoutés.",
    xfaForm: "Ce PDF est un formulaire XFA : ses données ne peuvent pas être effacées pour de bon ici.",
    textAlready: "Toutes les pages ont déjà leur texte : il n'y a rien à lire.",
    noTextRead: "Aucun texte n'a pu être lu dans les pages.",
    invalidSignature: "La signature ou son placement n'est pas valide. Recréez-la ou replacez-la sur la page.",
  } satisfies Record<EngineError["kind"], string>,
  password: {
    label: "Mot de passe",
    submit: "Ouvrir",
    notice: "Le fichier produit ne sera pas protégé par un mot de passe.",
  },
  retry: "Réessayer",
  bubble: {
    reading: (name: string) => `Je lis ${name}…`,
    images: (n: number) => (n === 1 ? "1 image." : `${n} images.`),
    counts: (files: number, pages: number) =>
      `${files} ${files === 1 ? "fichier" : "fichiers"}, ${pages} ${pages === 1 ? "page" : "pages"}.`,
  },
  flow: {
    backToPages: "Revenir aux pages",
    backToSettings: "Changer les réglages",
    done: "Alléluia, c'est fait",
    progress: (percent: number) => `En cours… ${percent} %`,
    downloadOne: { pdf: "Télécharger le PDF", images: "Télécharger l'image", word: "Télécharger le document Word" } satisfies Record<Kind, string>,
    downloadMany: {
      pdf: (n: number) => `Télécharger les ${n} PDF`,
      images: (n: number) => `Télécharger les ${n} images`,
      word: (n: number) => `Télécharger les ${n} documents Word`,
    } satisfies Record<Kind, (n: number) => string>,
    saveMany: {
      pdf: (n: number) => `Enregistrer les ${n} PDF`,
      images: (n: number) => `Enregistrer les ${n} images`,
      word: (n: number) => `Enregistrer les ${n} documents Word`,
    } satisfies Record<Kind, (n: number) => string>,
    zipHint: {
      pdf: "Ils arrivent dans un dossier .zip : ouvrez-le pour voir les fichiers.",
      images: "Elles arrivent dans un dossier .zip : ouvrez-le pour voir les images.",
      word: "Ils arrivent dans un dossier .zip : ouvrez-le pour voir les documents.",
    } satisfies Record<Kind, string>,
    shareHint: "Dans Photos, ou dans Fichiers.",
    view: "Voir",
    chosen: (n: number) => (n === 1 ? "1 page choisie" : `${n} pages choisies`),
    dropMore: "Vous pouvez aussi glisser d'autres PDF dans cette zone.",
    more: (n: number) => `et ${n} autres`,
  },
  toJpg: {
    what: "Que voulez-vous ?",
    pages: { name: "Pages en JPG", note: "Chaque page devient une image." },
    extract: {
      name: "Extraire les images",
      note: "Seulement les photos du PDF.",
      helpLabel: "Extraire les images : aide",
      help: "Le texte est laissé de côté : vous récupérez seulement les photos, telles qu'elles sont dans le PDF.",
    },
    count: (pages: number) => (pages === 1 ? "1 page, donc 1 image JPG." : `${pages} pages, donc ${pages} images JPG.`),
    quality: "Qualité de l'image",
    normal: { name: "Normale", note: "conseillée" },
    high: { name: "Élevée", note: "plus nette" },
    qualityHint: "Élevée : images plus nettes, mais plus lourdes.",
  },
  compress: {
    legend: "Niveau de compression",
    levels: {
      extreme: { name: "Extrême", note: "Compression forte. Les images perdent du détail." },
      recommended: { name: "Recommandée", note: "Un équilibre entre taille et qualité d'image." },
      low: { name: "Basse", note: "Qualité mieux préservée. Compression plus douce." },
    } satisfies Record<CompressLevel, { name: string; note: string }>,
    advised: "Conseillé",
    textStays: "Le texte reste sélectionnable, à tous les niveaux.",
    before: "Avant",
    after: "Après",
  },
  protect: {
    legend: "Mot de passe",
    password: "Mot de passe",
    confirm: "Confirmez le mot de passe",
    mismatch: "Les deux mots de passe ne sont pas identiques.",
    note: "Notez-le bien : sans lui, personne ne pourra ouvrir le PDF, pas même Holy PDF.",
  },
  watermark: {
    text: "Texte du filigrane",
    defaultText: "CONFIDENTIEL",
    unwritable: "Ce texte contient des caractères que la police du filigrane ne sait pas écrire (émojis, alphabets non latins).",
    color: "Couleur",
    colors: { red: "Rouge tampon", gray: "Gris", blue: "Bleu" },
    opacity: "Opacité",
    angle: "Angle",
    width: "Largeur, en part de la page",
  },
  repair: {
    unreadable: "Ce PDF est trop abîmé : rien ne s'y relit.",
  },
  overlay: {
    choose: "Choisir le PDF à poser",
    change: "Changer de PDF",
    pages: (count: number) => (count === 1 ? "1 page" : `${count} pages`),
    locked: "Ce PDF est protégé : déverrouillez-le d'abord avec Frère Passe-partout.",
    legend: "Position",
    over: { name: "Par-dessus les pages", note: "Une mention ou un tampon sur chaque page." },
    under: { name: "Sous les pages", note: "Un papier à en-tête ou un fond, visible là où la page est vide." },
  },
  pixelize: {
    legend: "Résolution",
    150: { name: "Normale, 150 ppp", note: "Lisible à l'écran et à l'impression, fichier léger." },
    300: { name: "Élevée, 300 ppp", note: "Plus net pour imprimer, fichier plus lourd." },
  },
  halves: {
    legend: "Coupe",
    vertical: { name: "Gauche | droite", note: "Pour un livre scanné ouvert : chaque page à part." },
    horizontal: { name: "Haut | bas", note: "Pour une feuille pliée en deux dans la hauteur." },
  },
  perSheet: {
    legend: "Pages par feuille",
    title: (count: number) => `${count} pages`,
    note: (count: number): string => (count === 2 || count === 6 ? "Feuille A4 à l'italienne." : "Feuille A4 à la française."),
  },
  pageNumbers: {
    format: "Format",
    formats: {
      number: { name: "1", note: "Le numéro seul." },
      of: { name: "1 / 12", note: "Le numéro et le total." },
      page: { name: "Page 1", note: "Le mot « Page », puis le numéro." },
    } satisfies Record<NumberFormat, { name: string; note: string }>,
    position: "Position",
    positions: {
      "top-left": "En haut à gauche",
      "top-center": "En haut au centre",
      "top-right": "En haut à droite",
      "bottom-left": "En bas à gauche",
      "bottom-center": "En bas au centre",
      "bottom-right": "En bas à droite",
    } satisfies Record<NumberPosition, string>,
    first: "Premier numéro",
    size: "Taille, en points",
    pages: "Pages",
    all: "Toutes les pages",
    allNote: (pages: number) => (pages === 1 ? "1 page." : `${pages} pages.`),
    range: "Une plage de pages",
    rangeNote: "La première page de la plage porte le premier numéro.",
    from: "De la page",
    to: "À la page",
  },
};

export type BoardTexts = typeof fr;
/** The board's texts with its own tool's monk, which the tool page hands over. */
export type Dictionary = BoardTexts & { monks: Record<ToolId, MonkTexts> };

/** The home's search. Outside `fr`: the tool pages bundle the whole dictionary, and never search. */
export const frSearch = {
  label: "Chercher un outil",
  categories: "Catégories",
  all: "Tous les moines",
  sleeping: "Montrer les moines en méditation",
  soonTag: "Bientôt · en méditation",
  count: (n: number) => (n === 0 ? "Aucun moine" : n === 1 ? "1 moine" : `${n} moines`),
  via: (word: string, tool: string) => `« ${word} » → ${tool}`,
  emptyTitle: "Aucun moine ne fait ça… pour l'instant",
  emptyText: "Essayez un autre mot, comme « fusionner », « réduire » ou « signer ».",
  reset: "Voir tous les moines",
  terms: {
    crop: ["rogner", "recadrer", "marges", "enlever les marges", "couper les bords", "cadrer", "crop"],
    edit: ["modifier", "éditer", "annoter", "ajouter du texte", "écrire sur un pdf", "surligner", "dessiner sur un pdf", "edit"],
    repair: ["réparer", "réparation", "corrompu", "endommagé", "abîmé", "ne s'ouvre pas", "fichier cassé", "récupérer un pdf", "repair"],
    bookmarks: ["signets", "signet", "sommaire", "chapitres", "plan du document", "marque-page", "navigation", "bookmarks"],
    overlay: ["superposer", "calque", "papier à en-tête", "en-tête", "arrière-plan", "fond de page", "poser un pdf sur un autre", "overlay"],
    pixelize: ["pixelliser", "rastériser", "convertir en image", "empêcher la copie", "texte non sélectionnable", "aplatir en image", "image seule"],
    "split-in-half": ["couper en deux", "page en deux", "livre scanné", "double page", "séparer les pages", "scinder la page", "moitié"],
    "pages-per-sheet": ["pages par feuille", "plusieurs pages", "imposition", "deux pages par feuille", "quatre pages", "n-up", "économiser le papier", "livret"],
    flatten: ["aplatir", "figer", "formulaire", "champs", "annotations", "verrouiller le formulaire", "flatten"],
    merge: ["fusionner", "fusion", "assembler", "combiner", "joindre", "réunir", "regrouper", "rassembler", "concaténer", "mettre ensemble", "un seul fichier", "merge", "combine", "join"],
    split: ["diviser", "séparer", "découper", "couper", "scinder", "fractionner", "une page par fichier", "plusieurs fichiers", "split", "cut"],
    organize: ["organiser", "réorganiser", "trier", "ranger", "ordonner", "réordonner", "classer", "changer l'ordre", "ordre des pages", "déplacer des pages", "organize", "reorder", "sort"],
    "delete-pages": ["supprimer", "effacer", "retirer", "enlever", "ôter", "page blanche", "pages en trop", "delete", "remove"],
    "extract-pages": ["extraire", "sélectionner", "récupérer", "garder", "isoler", "copier des pages", "certaines pages", "extract", "select"],
    rotate: ["pivoter", "tourner", "rotation", "retourner", "redresser", "à l'endroit", "à l'envers", "paysage", "portrait", "rotate", "turn"],
    "jpg-to-pdf": ["image en pdf", "photo en pdf", "jpg", "jpeg", "png", "images", "photos", "convertir des photos", "image to pdf", "picture"],
    "pdf-to-jpg": ["pdf en image", "jpg", "jpeg", "image", "photo", "extraire les images", "capture", "pdf to jpg", "pdf to image"],
    compress: ["compresser", "compression", "réduire", "alléger", "diminuer", "rapetisser", "optimiser", "poids", "taille", "plus léger", "trop lourd", "trop gros", "envoyer par mail", "compress", "reduce", "shrink", "smaller"],
    "pdf-to-word": ["word", "docx", "doc", "éditable", "modifiable", "modifier le texte", "pdf to word"],
    "web-to-pdf": ["page web", "site web", "site", "url", "html", "internet", "lien", "web to pdf"],
    sign: ["signer", "signature", "parapher", "paraphe", "e-signature", "sign"],
    watermark: ["filigrane", "tampon", "marquer", "confidentiel", "brouillon", "logo", "watermark", "stamp"],
    "page-numbers": ["numéroter", "numéros", "numérotation", "pagination", "numéro de page", "page numbers"],
    redact: ["noircir", "caviarder", "masquer", "cacher", "anonymiser", "censurer", "flouter", "redact"],
    ocr: ["ocr", "reconnaissance de texte", "texte", "copier le texte", "rechercher dans le pdf", "texte sélectionnable"],
    scan: ["scanner", "numériser", "scan", "photo de document", "appareil photo", "document papier"],
    protect: ["protéger", "mot de passe", "chiffrer", "crypter", "verrouiller", "sécuriser", "password", "encrypt", "protect"],
    unlock: ["déverrouiller", "enlever le mot de passe", "supprimer le mot de passe", "débloquer", "décrypter", "déchiffrer", "unlock"],
  } satisfies Record<ToolId | UpcomingId, string[]>,
};

export type SearchTexts = typeof frSearch;
