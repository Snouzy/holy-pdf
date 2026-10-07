import type { TargetedPointerEvent } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import type { DocumentSkeleton } from "../board/DocumentSkeleton";
import type { Engine } from "../engine/client";
import { arrowHead, ascent, keepsFont, lineHeight, oneLine, stampLayout, stampWords, textWidth, wrapped, writable } from "../engine/editMetrics";
import { type FieldEdit, type FormField, type Box, type EditFont, type EditImage, type EditItem, type EditText, noteSize, type OriginalEdit, type PageFont, type PageObject, type PageObjects, type PageSize, type Picture, plainPicture, type Point, type Rgb } from "../engine/types";
import { Icon } from "../illustrations/Icon";
import { useActionHeight } from "../signature/actionHeight";
import { previewWidth } from "../signature/geometry";
import type { Lang } from "../tools";
import { boundsOf, composedCrop, created, croppedPicture, type EditDraft, edited, fieldKey, fieldName, fieldsValid, filled, flippedPicture, fractionsIn, framed, type Handle, hit, markupTools, type Measure, moved, narrowest, originalKey, parseFieldKey, parseOriginalKey, picked, pictureOf, quadsOf, redone, rekinded, reordered, resized, resizedBox, restyled, revised, rotatedPicture, spanned, type Style, styleOf, type Tool, toolForKey, toolKeys, turnedBox, undone, validLink } from "./model";
import "../signature/signature.css";
import "./edit.css";

export { canSave, emptyEdit } from "./model";

const en = {
  tools: "Tools", style: "Style", selection: "Selected addition", original: "Object of the document",
  kinds: { text: "Text", image: "Image", path: "Drawing", form: "Group", shading: "Gradient" },
  tool: { select: "Select", text: "Text", rectangle: "Rectangle", ellipse: "Ellipse", line: "Line", arrow: "Arrow", ink: "Pen", highlight: "Highlighter", note: "Note", markHighlight: "Highlight text", underline: "Underline", strikeout: "Strike through", link: "Link", stamp: "Stamp", field: "Field" },
  fieldKinds: { text: "Text", checkbox: "Checkbox", combo: "Dropdown" }, fieldName: "Field", fieldLabel: "Name", fieldMultiline: "Several lines", fieldOptions: "Options, one per line",
  fieldHint: "Click where the field goes, or drag its frame; name it in the panel.", fieldNames: (page: number) => `Page ${page}: each field needs a name of its own, without a period, and a list needs options.`,
  fieldTurned: "This page is turned: fields go on an upright page.",
  stampWord: "Word", stampCustom: "Other text", stampDate: "Add today's date", stampHint: "Click where the stamp goes, or drag its frame.",
  noteText: "Note", selectedNote: "Selected note", author: "Author", selectedLink: "Selected link", target: "Target", webAddress: "Web address", documentPage: "Page of the document", url: "https://…", linkPage: "Page",
  invalidLink: "The address starts with https:// or mailto:.", linkMissing: (page: number) => `A link on page ${page} has no address yet.`,
  markupHint: "Drag over the words to mark.", noteHint: "Click where the note goes.",
  picture: "Picture", turnLeft: "Turn left", turnRight: "Turn right", mirrorAcross: "Mirror left-right", mirrorDown: "Mirror top-bottom",
  crop: "Crop", applyCrop: "Apply the crop", cancelCrop: "Cancel the crop", cropHint: "Drag the frame's corners, then apply.",
  image: "Image", color: "Colour", width: "Thickness", widths: ["Thin", "Medium", "Thick"], fill: "Fill", outline: "Outline", filled: "Filled",
  font: "Font", bold: "Bold", size: "Size", front: "Bring to front", back: "Send to back", remove: "Delete", undo: "Undo", redo: "Redo",
  colors: ["Black", "Blue", "Red", "Green", "Yellow", "White"], typeHere: "Your text",
  hint: "Pick a tool, then click or drag on the page. Drag with the Text tool for a text box whose lines wrap. Double-click a text to change it, yours or the document's.",
  originalHint: "Drag to move it. Double-click a text to correct it.",
  fieldsHint: "Click a form field to fill it.",
  pageIsPicture: "This page is a picture, like a scan: its text cannot be corrected, but it can be covered with a white rectangle and a new text. Brother Inkpot removes a passage for good.",
  unwritable: "A text has characters the PDF's fonts cannot write (some Eastern European letters, emojis, non-Latin alphabets).", imageError: "This image could not be read.",
  fontChanges: (family: string) => `The PDF's font does not have all these letters: the text will switch to ${family}.`,
  cannotWrite: "Some of these letters cannot be written in this PDF: the correction will not be kept.",
  refused: "The correction was not kept: some of its letters cannot be written in this PDF.",
  previous: "Previous page", next: "Next page", page: "Page", of: "of", zoomIn: "Zoom in", zoomOut: "Zoom out", resetZoom: "Normal size",
  preview: "PDF page preview", loading: "Loading the page…", previewError: "This page could not be displayed.", retry: "Retry preview",
};
const fr: typeof en = {
  tools: "Outils", style: "Style", selection: "Ajout sélectionné", original: "Objet du document",
  kinds: { text: "Texte", image: "Image", path: "Tracé", form: "Groupe", shading: "Dégradé" },
  tool: { select: "Sélection", text: "Texte", rectangle: "Rectangle", ellipse: "Ellipse", line: "Ligne", arrow: "Flèche", ink: "Crayon", highlight: "Surligneur", note: "Note", markHighlight: "Surligner le texte", underline: "Souligner", strikeout: "Barrer", link: "Lien", stamp: "Tampon", field: "Champ" },
  fieldKinds: { text: "Texte", checkbox: "Case à cocher", combo: "Liste déroulante" }, fieldName: "Champ", fieldLabel: "Nom", fieldMultiline: "Plusieurs lignes", fieldOptions: "Options, une par ligne",
  fieldHint: "Cliquez là où poser le champ, ou tirez son cadre ; nommez-le dans le panneau.", fieldNames: (page: number) => `Page ${page} : chaque champ a besoin d'un nom à lui, sans point, et une liste de ses options.`,
  fieldTurned: "Cette page est tournée : les champs se posent sur une page droite.",
  stampWord: "Mot", stampCustom: "Autre texte", stampDate: "Ajouter la date du jour", stampHint: "Cliquez là où poser le tampon, ou tirez son cadre.",
  noteText: "Note", selectedNote: "Note sélectionnée", author: "Auteur", selectedLink: "Lien sélectionné", target: "Cible", webAddress: "Adresse web", documentPage: "Page du document", url: "https://…", linkPage: "Page",
  invalidLink: "L'adresse commence par https:// ou mailto:.", linkMissing: (page) => `Un lien de la page ${page} n'a pas encore d'adresse.`,
  markupHint: "Tirez sur les mots à marquer.", noteHint: "Cliquez là où poser la note.",
  picture: "Image", turnLeft: "Pivoter à gauche", turnRight: "Pivoter à droite", mirrorAcross: "Retourner gauche-droite", mirrorDown: "Retourner haut-bas",
  crop: "Recadrer", applyCrop: "Appliquer le recadrage", cancelCrop: "Annuler le recadrage", cropHint: "Tirez les coins du cadre, puis appliquez.",
  image: "Image", color: "Couleur", width: "Épaisseur", widths: ["Fine", "Moyenne", "Épaisse"], fill: "Remplissage", outline: "Contour", filled: "Plein",
  font: "Police", bold: "Gras", size: "Taille", front: "Premier plan", back: "Arrière-plan", remove: "Supprimer", undo: "Annuler", redo: "Rétablir",
  colors: ["Noir", "Bleu", "Rouge", "Vert", "Jaune", "Blanc"], typeHere: "Votre texte",
  hint: "Choisissez un outil, puis cliquez ou tirez sur la page. Tirez avec l'outil Texte pour une zone dont les lignes reviennent à la ligne. Double-cliquez sur un texte pour le modifier, le vôtre ou celui du document.",
  originalHint: "Tirez pour le déplacer. Double-cliquez sur un texte pour le corriger.",
  fieldsHint: "Cliquez dans un champ du formulaire pour le remplir.",
  pageIsPicture: "Cette page est une image, comme un scan : son texte ne se corrige pas, mais se recouvre d'un rectangle blanc et d'un texte neuf. Frère Encrier retire un passage pour de bon.",
  unwritable: "Un texte contient des caractères que les polices du PDF ne savent pas écrire (certaines lettres d'Europe de l'Est, émojis, alphabets non latins).", imageError: "Cette image n'a pas pu être lue.",
  fontChanges: (family) => `La police du PDF n'a pas toutes ces lettres : le texte passera en ${family}.`,
  cannotWrite: "Certaines de ces lettres ne peuvent pas être écrites dans ce PDF : la correction ne sera pas gardée.",
  refused: "La correction n'a pas été gardée : certaines de ses lettres ne peuvent pas être écrites dans ce PDF.",
  previous: "Page précédente", next: "Page suivante", page: "Page", of: "sur", zoomIn: "Agrandir", zoomOut: "Réduire", resetZoom: "Taille normale",
  preview: "Aperçu de la page PDF", loading: "Chargement de la page…", previewError: "Cette page n'a pas pu être affichée.", retry: "Réessayer l'aperçu",
};
const ptBR: typeof en = {
  tools: "Ferramentas", style: "Estilo", selection: "Adição selecionada", original: "Objeto do documento",
  kinds: { text: "Texto", image: "Imagem", path: "Traço", form: "Grupo", shading: "Degradê" },
  tool: { select: "Selecionar", text: "Texto", rectangle: "Retângulo", ellipse: "Elipse", line: "Linha", arrow: "Seta", ink: "Caneta", highlight: "Marca-texto", note: "Nota", markHighlight: "Destacar o texto", underline: "Sublinhar", strikeout: "Riscar", link: "Link", stamp: "Carimbo", field: "Campo" },
  fieldKinds: { text: "Texto", checkbox: "Caixa de seleção", combo: "Lista suspensa" }, fieldName: "Campo", fieldLabel: "Nome", fieldMultiline: "Várias linhas", fieldOptions: "Opções, uma por linha",
  fieldHint: "Clique onde o campo deve ficar ou arraste a moldura dele; dê um nome a ele no painel.", fieldNames: (page) => `Página ${page}: cada campo precisa de um nome próprio, sem ponto, e uma lista precisa de opções.`,
  fieldTurned: "Esta página está girada: os campos devem ficar em uma página sem rotação.",
  stampWord: "Palavra", stampCustom: "Outro texto", stampDate: "Adicionar a data de hoje", stampHint: "Clique onde o carimbo deve ficar ou arraste a moldura dele.",
  noteText: "Nota", selectedNote: "Nota selecionada", author: "Autor", selectedLink: "Link selecionado", target: "Destino", webAddress: "Endereço web", documentPage: "Página do documento", url: "https://…", linkPage: "Página",
  invalidLink: "O endereço começa com https:// ou mailto:.", linkMissing: (page) => `Um link da página ${page} ainda não tem endereço.`,
  markupHint: "Arraste sobre as palavras a marcar.", noteHint: "Clique onde a nota deve ficar.",
  picture: "Imagem", turnLeft: "Girar à esquerda", turnRight: "Girar à direita", mirrorAcross: "Espelhar esquerda-direita", mirrorDown: "Espelhar cima-baixo",
  crop: "Recortar", applyCrop: "Aplicar o recorte", cancelCrop: "Cancelar o recorte", cropHint: "Arraste os cantos da moldura e depois aplique.",
  image: "Imagem", color: "Cor", width: "Espessura", widths: ["Fina", "Média", "Grossa"], fill: "Preenchimento", outline: "Contorno", filled: "Preenchido",
  font: "Fonte", bold: "Negrito", size: "Tamanho", front: "Trazer para a frente", back: "Enviar para trás", remove: "Excluir", undo: "Desfazer", redo: "Refazer",
  colors: ["Preto", "Azul", "Vermelho", "Verde", "Amarelo", "Branco"], typeHere: "Seu texto",
  hint: "Escolha uma ferramenta e clique ou arraste na página. Arraste com a ferramenta Texto para uma caixa cujas linhas quebram. Dê um clique duplo em um texto para alterá-lo, o seu ou o do documento.",
  originalHint: "Arraste para mover. Dê um clique duplo em um texto para corrigi-lo.",
  fieldsHint: "Clique em um campo do formulário para preenchê-lo.",
  pageIsPicture: "Esta página é uma imagem, como uma digitalização: seu texto não pode ser corrigido, mas pode ser coberto com um retângulo branco e um texto novo. O Frei Tinteiro remove um trecho de vez.",
  unwritable: "Um texto tem caracteres que as fontes do PDF não conseguem escrever (algumas letras do leste europeu, emojis, alfabetos não latinos).", imageError: "Esta imagem não pôde ser lida.",
  fontChanges: (family) => `A fonte do PDF não tem todas essas letras: o texto passará para ${family}.`,
  cannotWrite: "Algumas destas letras não podem ser escritas neste PDF: a correção não será mantida.",
  refused: "A correção não foi mantida: algumas de suas letras não podem ser escritas neste PDF.",
  previous: "Página anterior", next: "Próxima página", page: "Página", of: "de", zoomIn: "Ampliar", zoomOut: "Reduzir", resetZoom: "Tamanho normal",
  preview: "Visualização da página do PDF", loading: "Carregando a página…", previewError: "Esta página não pôde ser exibida.", retry: "Tentar a visualização novamente",
};
const texts = { en, fr, "pt-br": ptBR };

const palette: Rgb[] = [[0, 0, 0], [29, 78, 216], [220, 38, 38], [22, 163, 74], [250, 204, 21], [255, 255, 255]];
const widths = [1, 3, 6];
const sizes = [8, 10, 12, 14, 16, 20, 24, 32, 48, 72, 96];
const families: Record<EditFont, string> = { Helvetica: "Helvetica, Arial, sans-serif", Times: "'Times New Roman', Times, serif", Courier: "'Courier New', Courier, monospace" };
const glyphs: Record<Tool | "image", string> = {
  select: "M6 3l12 8-5.5 1.5L9.5 18z",
  text: "M5 5h14 M12 5v14 M9 19h6",
  image: "M4 5h16v14H4z M4 16l5-5 4 4 3-3 4 4",
  rectangle: "M4 6h16v12H4z",
  ellipse: "M12 5c4.4 0 8 3.1 8 7s-3.6 7-8 7-8-3.1-8-7 3.6-7 8-7z",
  line: "M5 19L19 5",
  arrow: "M5 19L19 5 M10 5h9v9",
  ink: "M4 16c3-6 5 2 8-3s5-6 8-4",
  highlight: "M4 20h16 M7 16l9-9 3 3-9 9H7z",
  note: "M4 5h16v11H11l-4 4v-4H4z M8 9h8 M8 12h5",
  markHighlight: "M5 17h14 M7 14V8h10v6 M5 20h14",
  underline: "M7 5v6a5 5 0 0 0 10 0V5 M5 20h14",
  strikeout: "M7 5v3a5 5 0 0 0 10 0V5 M7 19v-3a5 5 0 0 1 10 0v3 M4 12h16",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  stamp: "M5 15h14v4H5z M9 15v-5a3 3 0 0 1 6 0v5",
  field: "M3 8h18v8H3z M6 11v2",
};
const toolOrder: Tool[] = ["select", "text", "rectangle", "ellipse", "line", "arrow", "ink", "highlight", "note", "markHighlight", "underline", "strikeout", "link", "stamp", "field"];
const isMarkupTool = (tool: Tool): tool is keyof typeof markupTools => tool in markupTools;
const css = (color: Rgb) => `rgb(${color.join(" ")})`;

let context: CanvasRenderingContext2D | null | undefined;
function fontContext(item: EditText): CanvasRenderingContext2D | null {
  context ??= document.createElement("canvas").getContext("2d");
  if (context) context.font = `${item.bold ? "bold " : ""}${item.size}px ${families[item.font]}`;
  return context;
}
/** Measured with the PDF fonts' advances, not the browser's: the layout then matches the file, whatever font the screen shows. */
const measure: Measure = (item) => Math.max(item.size * 0.5, ...linesOf(item).map((line) => textWidth(line, item.font, item.bold, item.size)));
const linesOf = (item: EditText) => wrapped(item.text, item.font, item.bold, item.size, item.width);
/** What the browser's font needs: a letter outside WinAnsi, which the PDF advances count as a half em, may be wider in the field. */
function fieldWidth(item: EditText): number {
  if (item.width) return item.width;
  const font = fontContext(item);
  const shown = Math.max(0, ...linesOf(item).map((line) => font?.measureText(line).width ?? 0));
  return Math.max(measure(item), shown) + item.size * 2;
}

/** Where the textarea starts, so that its first baseline, set by the browser's font, falls on the baseline of the PDF text. */
function typingTop(item: EditText): number {
  const metrics = fontContext(item)?.measureText("Hg");
  const [above, below] = [metrics?.fontBoundingBoxAscent || item.size * 0.9, metrics?.fontBoundingBoxDescent || item.size * 0.25];
  return item.at.y + ascent[item.font] * item.size - ((lineHeight * item.size - above - below) / 2 + above);
}

const retouch = (edits: OriginalEdit[], pageIndex: number, index: number) => edits.find((edit) => edit.pageIndex === pageIndex && edit.index === index);
/** The listing already shows the page as retouched; an image's box may be ahead of it, between a gesture and the next listing. */
const shownBox = (object: PageObject, edits: OriginalEdit[], pageIndex: number): Box => retouch(edits, pageIndex, object.index)?.box ?? object.box;
const contains = (box: Box, point: Point, slack: number) => point.x >= box.x - slack && point.x <= box.x + box.width + slack && point.y >= box.y - slack && point.y <= box.y + box.height + slack;
const resizable = (object: PageObject) => object.kind === "image" || object.kind === "path";
const fillable = (field: FormField) => !field.readOnly && field.kind !== "other";

/**
 * A field's text as it is typed: several lines start at the field's top; one line sits where PDFium draws it, its
 * font box (Helvetica: 0.931 em above the baseline, 0.225 em below) centred in the field.
 */
function asFieldText(field: FormField, text: string): EditText {
  const size = field.size > 0 ? field.size : Math.min(field.multiline ? 12 : field.box.height / lineHeight, 24);
  const top = field.multiline ? field.box.y + 2 : field.box.y + field.box.height / 2 + (0.353 - ascent.Helvetica) * size;
  return { kind: "text", at: { x: field.box.x + 2, y: top }, text, font: "Helvetica", bold: false, size, color: field.color, ...(field.multiline ? { width: field.box.width - 4 } : {}) };
}
/** A picture as large as the page is the page: a scan, or a design flattened to pixels. */
const coversPage = (object: PageObject, page: PageSize) => object.kind === "image" && object.box.width >= 0.9 * page.width && object.box.height >= 0.9 * page.height;

/** The document's text as an addition would be typed: the same textarea serves both. The baseline follows a move. */
function asTyped(object: PageObject, box: Box, text: string): EditText & { italic: boolean } {
  const [font, size] = [object.family ?? "Helvetica", object.size ?? 12];
  const baseline = (object.baseline?.y ?? object.box.y + object.box.height) + box.y - object.box.y;
  return { kind: "text", at: { x: box.x, y: baseline - ascent[font] * size }, text, font, bold: object.bold ?? false, italic: object.italic ?? false, size, color: object.color ?? [0, 0, 0] };
}

export type EditProps = {
  sizes: PageSize[]; lang: Lang; value: EditDraft; onChange: (update: (draft: EditDraft) => EditDraft) => void; disabled: boolean;
  /** Passed by Board, not imported: a module shared with Board's chunk becomes one more request before LCP on every tool page. */
  engine: Pick<Engine, "thumbnail" | "objects" | "fonts" | "fieldNames">; Skeleton: typeof DocumentSkeleton;
};

type Drag = {
  pointer: number; start: Point; tool: Tool; mode: "move" | "resize" | "create" | "ink" | "original" | "crop" | "textbox"; recorded: boolean; points: Point[];
  item?: EditItem; handle?: Handle; object?: PageObject; from?: Box; within?: Box;
};
type Typing = { kind: "item"; id: string } | { kind: "original"; index: number; text: string; base: string } | { kind: "field"; index: number; text: string; base: string };
/** A moved original between the gesture and the next render: the old picture, cut out and carried. */
type Ghost = { from: Box; to: Box };

/** Shared by the workspace and the panel, so a page is listed once; the last listing of the page stays while the next one comes. */
const listings = new Map<string, PageObjects>();
const listing = new Map<string, Promise<void>>();
const keptListings = 12;

function useObjects(engine: Pick<Engine, "objects">, docId: string, pageIndex: number, edits: OriginalEdit[], fields: FieldEdit[]): PageObjects | null {
  return useListing(engine, docId, pageIndex, edits, fields).found;
}

/** `fresh`: the listing matches the page's current retouches; stale while the next one loads. */
function useListing(engine: Pick<Engine, "objects">, docId: string, pageIndex: number, edits: OriginalEdit[], fields: FieldEdit[]): { found: PageObjects | null; fresh: boolean } {
  const own = edits.filter((edit) => edit.pageIndex === pageIndex);
  const ownFields = fields.filter((field) => field.pageIndex === pageIndex);
  const page = `${docId}:${pageIndex}`;
  const key = `${page}:${JSON.stringify(own)}:${JSON.stringify(ownFields)}`;
  const [, bump] = useState(0);
  const last = useRef<{ page: string; value: PageObjects } | null>(null);
  useEffect(() => {
    if (listings.has(key)) return;
    let active = true;
    const pending = listing.get(key) ?? engine.objects(docId, pageIndex, own, ownFields).then((result) => {
      if (!result.ok) return;
      listings.set(key, result.value);
      for (const old of [...listings.keys()].slice(0, Math.max(0, listings.size - keptListings))) listings.delete(old);
    }, () => undefined).finally(() => listing.delete(key));
    listing.set(key, pending);
    void pending.then(() => active && bump((count) => count + 1));
    return () => { active = false; };
  }, [key]);
  const found = listings.get(key);
  if (found) last.current = { page, value: found };
  return { found: found ?? (last.current?.page === page ? last.current.value : null), fresh: Boolean(found) };
}

const fontsByDoc = new Map<string, Record<string, PageFont>>();

/** Asked for once a text is being corrected: scanning every page of the document is not worth it before. */
function useFonts(engine: Pick<Engine, "fonts">, docId: string, wanted: boolean): Record<string, PageFont> | null {
  const [, bump] = useState(0);
  useEffect(() => {
    if (!wanted || fontsByDoc.has(docId)) return;
    let active = true;
    engine.fonts(docId).then((result) => {
      if (!active || !result.ok) return;
      fontsByDoc.set(docId, result.value);
      bump((count) => count + 1);
    }, () => undefined);
    return () => { active = false; };
  }, [docId, wanted]);
  return fontsByDoc.get(docId) ?? null;
}

const namesByDoc = new Map<string, string[]>();

/** The names of the document's own fields, read once the Field tool comes out: a new field must not take one. */
function useFieldNames(engine: Pick<Engine, "fieldNames">, docId: string, wanted: boolean): string[] | null {
  const [, bump] = useState(0);
  useEffect(() => {
    if (!wanted || namesByDoc.has(docId)) return;
    let active = true;
    engine.fieldNames(docId).then((result) => {
      if (!active || !result.ok) return;
      namesByDoc.set(docId, result.value);
      bump((count) => count + 1);
    }, () => undefined);
    return () => { active = false; };
  }, [docId, wanted]);
  return namesByDoc.get(docId) ?? null;
}

/** The page drawn with its retouches. The last picture stays while the next one is drawn, so the page never blinks. */
function usePreview(engine: Pick<Engine, "thumbnail">, docId: string, pageIndex: number, size: PageSize | undefined, edits: OriginalEdit[], fields: FieldEdit[], zoom: number) {
  const [state, setState] = useState<{ page: string; url: string | null; failed: boolean; stale: boolean }>({ page: "", url: null, failed: false, stale: false });
  const [attempt, setAttempt] = useState(0);
  const current = useRef<string | null>(null);
  const page = `${docId}:${pageIndex}`;
  const own = edits.filter((edit) => edit.pageIndex === pageIndex);
  const ownFields = fields.filter((field) => field.pageIndex === pageIndex);
  const editsKey = JSON.stringify([own, ownFields]);
  // Zoomed in, the picture is drawn larger too, or the small print the zoom is for would blur.
  const base = size ? previewWidth(size) : null;
  const width = base === null ? null : Math.min(4000, Math.round(base * zoom / 100));
  useEffect(() => {
    let active = true;
    setState((previous) => (previous.page === page ? { ...previous, stale: true } : { page, url: null, failed: false, stale: false }));
    if (!width) {
      setState({ page, url: null, failed: true, stale: false });
      return;
    }
    engine.thumbnail(docId, pageIndex, width, own, ownFields).then((result) => {
      if (!active) return;
      const url = result.ok ? URL.createObjectURL(result.value) : null;
      if (current.current) URL.revokeObjectURL(current.current);
      current.current = url;
      setState({ page, url, failed: !url, stale: false });
    }, () => active && setState({ page, url: null, failed: true, stale: false }));
    return () => { active = false; };
  }, [page, width, editsKey, attempt]);
  useEffect(() => () => { if (current.current) URL.revokeObjectURL(current.current); }, []);
  return { shown: state.page === page ? state : null, retry: () => setAttempt((count) => count + 1) };
}

export function EditWorkspace({ sizes: pages, lang, value, onChange, disabled, engine, Skeleton }: EditProps) {
  const t = texts[lang];
  const { docId, pageIndex } = value;
  const size = pages[pageIndex];
  const [typing, setTyping] = useState<Typing | null>(null);
  const [zoom, setZoom] = useState(100);
  const hidden = typing?.kind === "original" ? withHidden(value.edits, pageIndex, typing.index) : value.edits;
  // The field being typed is drawn empty: its old value would show under the typing.
  const shownFields = typing?.kind === "field" ? [...value.fields.filter((field) => !(field.pageIndex === pageIndex && field.index === typing.index)), { pageIndex, index: typing.index, value: "" }] : value.fields;
  const { shown, retry } = usePreview(engine, docId, pageIndex, size, hidden, shownFields, zoom);
  const found = useObjects(engine, docId, pageIndex, value.edits, value.fields);
  const fonts = useFonts(engine, docId, typing?.kind === "original");
  const taken = useFieldNames(engine, docId, value.tool === "field" || value.items.some((item) => item.kind === "field"));
  useEffect(() => {
    if (taken && taken !== value.taken) onChange((draft) => (draft.docId === docId ? { ...draft, taken } : draft));
  }, [taken]);
  const [refused, setRefused] = useState(false);
  const workspace = useRef<HTMLDivElement>(null);
  const layer = useRef<SVGSVGElement>(null);
  const typingField = useRef<HTMLTextAreaElement>(null);
  const drag = useRef<Drag | null>(null);
  const before = useRef<EditItem[] | null>(null);
  const live = useRef({ value, found, fonts });
  live.current = { value, found, fonts };
  const busy = useRef(disabled);
  busy.current = disabled;
  const [sketch, setSketch] = useState<EditItem | null>(null);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [settling, setSettling] = useState<Ghost | null>(null);
  const [unit, setUnit] = useState(1);
  useActionHeight(workspace);

  useLayoutEffect(() => {
    const element = layer.current;
    if (!element || !size) return;
    const observer = new ResizeObserver(() => setUnit(size.width / Math.max(1, element.getBoundingClientRect().width)));
    observer.observe(element);
    return () => observer.disconnect();
    // The layer exists once the page's picture is there, not once the preview state is: a null url has no layer to measure.
  }, [size?.width, Boolean(shown?.url)]);

  useEffect(() => {
    if (shown && !shown.stale) setSettling(null);
  }, [shown?.url, shown?.stale]);

  // The browser's font may wrap a box's text on one more line than the PDF's: the field grows rather than scroll its first line away.
  useLayoutEffect(() => {
    const field = typingField.current;
    if (!field || !typing) return;
    if (field.scrollHeight > field.clientHeight) field.style.height = `${field.scrollHeight}px`;
  });

  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (busy.current || (event.target instanceof HTMLElement && event.target.closest("input, textarea, select"))) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        onChange(event.shiftKey ? redone : undone);
      } else if ((event.key === "Delete" || event.key === "Backspace") && live.current.value.selectedId) {
        event.preventDefault();
        onChange(removeSelected);
      } else if (event.key === "Escape") onChange((draft) => ({ ...draft, selectedId: null, cropping: null }));
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, []);

  function point(event: PointerEvent): Point {
    const box = layer.current!.getBoundingClientRect();
    return { x: (event.clientX - box.left) / box.width * size!.width, y: (event.clientY - box.top) / box.height * size!.height };
  }

  /** Focused here, during the tap: iOS opens its keyboard only for a focus inside the gesture. */
  function startTyping(next: Typing, itemsBefore: EditItem[], id: string) {
    before.current = itemsBefore;
    setRefused(false);
    typingField.current?.focus({ preventScroll: true });
    onChange((draft) => ({ ...draft, selectedId: id, tool: "select" }));
    setTyping(next);
  }

  /** One undo step for the whole typing, and none when nothing changed: an empty text leaves. */
  function stopTyping() {
    const [current, start] = [typing, before.current];
    if (!current) return;
    setTyping(null);
    before.current = null;
    if (current.kind === "field") {
      const field = live.current.found?.fields.find((each) => each.index === current.index);
      const text = field?.multiline ? current.text : oneLine(current.text);
      if (text === current.base) return onChange((draft) => ({ ...draft, selectedId: null }));
      return onChange((draft) => ({ ...filled(draft, { pageIndex, index: current.index, value: text }), selectedId: null }));
    }
    if (current.kind === "original") {
      const text = oneLine(current.text.replaceAll("\t", " "));
      if (text === oneLine(current.base)) return;
      if (text.trim() === "") return onChange((draft) => ({ ...revised(draft, { pageIndex, index: current.index, deleted: true }), selectedId: null }));
      const object = live.current.found?.objects.find((each) => each.index === current.index);
      const commit = (fonts: Record<string, PageFont> | null) => {
        if (!keepsFont(fonts?.[object?.font ?? ""], text) && !writable(text)) return setRefused(true);
        onChange((draft) => ({ ...revised(draft, { pageIndex, index: current.index, text }), selectedId: null }));
      };
      // The fonts' letters may still be on their way: a letter outside WinAnsi waits for them before it is refused.
      if (live.current.fonts || writable(text)) commit(live.current.fonts);
      else void engine.fonts(docId).then((result) => commit(result.ok ? result.value : null));
      return;
    }
    if (!start) return;
    onChange((draft) => {
      const item = draft.items.find((each) => each.id === current.id);
      const items = item?.kind === "text" && item.text.trim() === "" ? draft.items.filter((each) => each !== item) : draft.items;
      const unchanged = items.length === start.length && items.every((each, index) => each === start[index]);
      const next = unchanged ? { ...draft, items } : edited(draft, items, start);
      return items === draft.items ? next : { ...next, selectedId: null };
    });
  }

  function down(event: TargetedPointerEvent<SVGSVGElement>) {
    if (disabled || event.button !== 0 || !size) return;
    event.preventDefault();
    if (typing) typingField.current?.blur();
    // A panel field commits on blur: it must do so before the gesture records its own step.
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && focused !== typingField.current && focused.matches("input, textarea, select")) focused.blur();
    const at = point(event);
    const { tool, items, selectedId, style, edits, cropping } = live.current.value;
    const objects = live.current.found?.objects ?? [];
    const base = { pointer: event.pointerId, start: at, tool, recorded: false, points: [at] };
    event.currentTarget.setPointerCapture(event.pointerId);
    const within = cropping ? pictureBox() : null;
    if (cropping && !within) onChange((draft) => ({ ...draft, cropping: null }));
    if (cropping && within) {
      // While a frame is drawn, the page takes nothing else: a touch outside the frame is a slip, not a new selection.
      const handle = (event.target as Element).closest("[data-handle]")?.getAttribute("data-handle") as Handle | null;
      if (handle) drag.current = { ...base, mode: "crop", handle, from: cropping, within };
      else if (contains(cropping, at, 0)) drag.current = { ...base, mode: "crop", from: cropping, within };
      return;
    }
    if (tool === "select" || tool === "text") {
      const handle = (event.target as Element).closest("[data-handle]")?.getAttribute("data-handle") as Handle | null;
      const selected = items.find((item) => item.id === selectedId);
      const original = parseOriginalKey(selectedId);
      const selectedObject = original?.pageIndex === pageIndex ? objects.find((object) => object.index === original.index) : undefined;
      if (handle && selected) {
        drag.current = { ...base, mode: "resize", item: selected, handle };
        return;
      }
      if (handle && selectedObject) {
        const from = shownBox(selectedObject, edits, pageIndex);
        drag.current = { ...base, mode: "original", object: selectedObject, handle, from };
        setGhost({ from, to: from });
        return;
      }
      const target = hit(items, pageIndex, at, measure, 4 * unit);
      if (target && tool === "text" && target.kind === "text") return startTyping({ kind: "item", id: target.id }, items, target.id);
      if (target) {
        onChange((draft) => ({ ...draft, selectedId: target.id }));
        drag.current = { ...base, mode: "move", item: target };
        return;
      }
      const field = live.current.found?.fields.findLast((each) => fillable(each) && contains(each.box, at, 0));
      if (field) return engage(field);
      // The Text tool draws over a scan or a table's fill: only a text of the document stops it.
      const object = objects.findLast((each) => (tool === "select" || each.kind === "text") && !retouch(edits, pageIndex, each.index)?.deleted && contains(shownBox(each, edits, pageIndex), at, 2 * unit));
      if (object && tool === "text" && object.kind === "text") return startTypingOriginal(object);
      if (object) {
        const from = shownBox(object, edits, pageIndex);
        onChange((draft) => ({ ...draft, selectedId: originalKey(pageIndex, object.index) }));
        drag.current = { ...base, mode: "original", object, from };
        setGhost({ from, to: from });
        return;
      }
      if (tool === "select") return onChange((draft) => ({ ...draft, selectedId: null }));
      // A drag draws a text box; the text itself comes when the pointer lifts, so that typing starts inside the gesture.
      drag.current = { ...base, mode: "textbox" };
      return;
    }
    if (tool === "field" && live.current.found?.rotation !== 0) return;
    if (tool === "note") {
      const note = created("note", crypto.randomUUID(), pageIndex, at, at, style);
      return onChange((draft) => ({ ...edited(draft, [...draft.items, note]), selectedId: note.id, tool: "select" }));
    }
    drag.current = { ...base, mode: tool === "ink" ? "ink" : "create" };
    setSketch(sketched(drag.current, at, style));
  }

  /** A box or a radio button takes the click; a text field takes the typing; a list opens its menu. */
  function engage(field: FormField) {
    const key = fieldKey(pageIndex, field.index);
    const set = (value: string) => onChange((draft) => ({ ...filled(draft, { pageIndex, index: field.index, value }), selectedId: null }));
    // The listing may still be the one before the last click: the draft knows the value already given.
    const pending = live.current.value.fields.find((each) => each.pageIndex === pageIndex && each.index === field.index);
    const checked = pending ? pending.value !== "Off" : field.checked;
    if (field.kind === "checkbox") return set(checked ? "Off" : field.exportValue || "Yes");
    if (field.kind === "radio") return checked ? undefined : set(field.exportValue);
    const text = pending?.value ?? field.value;
    if (field.kind === "text") return startTyping({ kind: "field", index: field.index, text, base: text }, live.current.value.items, key);
    onChange((draft) => ({ ...draft, selectedId: key, tool: "select" }));
  }

  function startTypingOriginal(object: PageObject) {
    const current = retouch(live.current.value.edits, pageIndex, object.index)?.text ?? object.text ?? "";
    startTyping({ kind: "original", index: object.index, text: current, base: current }, live.current.value.items, originalKey(pageIndex, object.index));
  }

  const isBoxDrag = (box: Box) => box.width >= Math.max(narrowest, 8 * unit);

  function sketched(current: Drag, at: Point, style: Style, square = false): EditItem | null {
    if (current.mode === "ink") return { id: "sketch", pageIndex, kind: "ink", points: current.points, color: style.color, lineWidth: style.lineWidth };
    if (isMarkupTool(current.tool)) {
      const quads = quadsOf(live.current.found?.words ?? [], spanned(current.start, at));
      return quads.length > 0 ? { id: "sketch", pageIndex, kind: "markup", style: markupTools[current.tool], quads, color: style.color } : null;
    }
    if (current.tool === "select" || current.tool === "text" || current.tool === "ink" || current.tool === "note") return null;
    return created(current.tool, "sketch", pageIndex, current.start, at, style, square);
  }

  function move(event: TargetedPointerEvent<SVGSVGElement>) {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    const at = point(event);
    if (current.mode === "create") return setSketch(sketched(current, at, live.current.value.style, event.shiftKey));
    if (current.mode === "textbox") {
      const box = spanned(current.start, at);
      return setSketch(isBoxDrag(box) ? { id: "sketch", pageIndex, kind: "rectangle", box, stroke: [29, 78, 216], fill: null, lineWidth: 1 } : null);
    }
    if (current.mode === "ink") {
      const last = current.points.at(-1)!;
      if (Math.hypot(at.x - last.x, at.y - last.y) < 2 * unit) return;
      current.points = [...current.points, at];
      return setSketch(sketched(current, at, live.current.value.style));
    }
    if (!current.recorded && Math.hypot(at.x - current.start.x, at.y - current.start.y) < 2 * unit) return;
    const record = !current.recorded;
    current.recorded = true;
    if (current.mode === "crop") {
      const [from, within] = [current.from!, current.within!];
      // A corner stops at the picture's edge; only a move slides the whole frame.
      const inside = { x: Math.min(Math.max(at.x, within.x), within.x + within.width), y: Math.min(Math.max(at.y, within.y), within.y + within.height) };
      const frame = current.handle ? resizedBox(from, current.handle, inside) : { ...from, x: from.x + at.x - current.start.x, y: from.y + at.y - current.start.y };
      return onChange((draft) => ({ ...draft, cropping: framed(frame, within) }));
    }
    if (current.mode === "original") {
      const from = current.from!;
      const to = current.handle && resizable(current.object!) ? resizedBox(from, current.handle, at, current.object!.kind === "image") : { ...from, x: from.x + at.x - current.start.x, y: from.y + at.y - current.start.y };
      return setGhost({ from, to });
    }
    const changed = current.mode === "move" ? moved(current.item!, at.x - current.start.x, at.y - current.start.y) : resized(current.item!, current.handle!, at, measure, event.shiftKey || (current.item!.kind === "field" && current.item!.field === "checkbox"));
    onChange((draft) => {
      const items = draft.items.map((item) => (item.id === changed.id ? changed : item));
      return record ? edited(draft, items) : { ...draft, items };
    });
  }

  function up(event: TargetedPointerEvent<SVGSVGElement>) {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    drag.current = null;
    setSketch(null);
    if (current.mode === "crop") return;
    if (current.mode === "textbox") {
      const items = live.current.value.items;
      const end = point(event);
      // A shaky tap is not a box: the drag must be wide on screen, not only in page points.
      const text = created("text", crypto.randomUUID(), pageIndex, current.start, isBoxDrag(spanned(current.start, end)) ? end : current.start, live.current.value.style);
      onChange((draft) => ({ ...draft, items: [...draft.items, text] }));
      return startTyping({ kind: "item", id: text.id }, items, text.id);
    }
    if (current.mode === "original") {
      const carried = ghost;
      setGhost(null);
      if (!current.recorded || !carried) return;
      setSettling(carried);
      const { index } = current.object!;
      if (resizable(current.object!)) return onChange((draft) => revised(draft, { pageIndex, index, box: carried.to }));
      onChange((draft) => {
        const sofar = retouch(draft.edits, pageIndex, index)?.move ?? { x: 0, y: 0 };
        return revised(draft, { pageIndex, index, move: { x: sofar.x + carried.to.x - carried.from.x, y: sofar.y + carried.to.y - carried.from.y } });
      });
      return;
    }
    const drawn = current.mode === "create" || (current.mode === "ink" && current.points.length > 1);
    const added = drawn ? sketched(current, point(event), live.current.value.style, event.shiftKey) : null;
    if (!added) return;
    const item = { ...added, id: crypto.randomUUID(), ...(added.kind === "field" ? { name: fieldName(t.fieldName, live.current.value.items, live.current.value.taken) } : {}) };
    const keep = current.tool === "ink" || current.tool === "highlight" || isMarkupTool(current.tool);
    onChange((draft) => ({ ...edited(draft, [...draft.items, item]), selectedId: keep ? null : item.id, tool: keep ? draft.tool : "select" }));
  }

  function cancel() {
    drag.current = null;
    setSketch(null);
    setGhost(null);
  }

  function open(event: MouseEvent) {
    if (disabled || !size) return;
    const at = point(event as PointerEvent);
    const { items, edits } = live.current.value;
    const target = hit(items, pageIndex, at, measure, 4 * unit);
    if (target?.kind === "text") return startTyping({ kind: "item", id: target.id }, items, target.id);
    if (target || live.current.found?.fields.some((field) => fillable(field) && contains(field.box, at, 0))) return;
    const object = (live.current.found?.objects ?? []).findLast((each) => each.kind === "text" && !retouch(edits, pageIndex, each.index)?.deleted && contains(shownBox(each, edits, pageIndex), at, 2 * unit));
    if (object) startTypingOriginal(object);
  }

  const goTo = (index: number) => onChange((draft) => ({ ...draft, pageIndex: index, selectedId: null, cropping: null }));

  /** The box of the selected picture, an addition's or the document's. */
  function pictureBox(): Box | null {
    const { items, selectedId, edits } = live.current.value;
    const item = items.find((each) => each.id === selectedId);
    if (item?.kind === "image") return item.box;
    const original = parseOriginalKey(selectedId);
    const object = original?.pageIndex === pageIndex ? live.current.found?.objects.find((each) => each.index === original.index) : undefined;
    return object?.kind === "image" ? shownBox(object, edits, pageIndex) : null;
  }
  const onPage = value.items.filter((item) => item.pageIndex === pageIndex);
  const selected = onPage.find((item) => item.id === value.selectedId);
  const selectedOriginal = parseOriginalKey(value.selectedId);
  const selectedObject = selectedOriginal?.pageIndex === pageIndex ? found?.objects.find((object) => object.index === selectedOriginal.index) : undefined;
  const typedItem = typing?.kind === "item" ? value.items.find((item): item is EditItem & EditText => item.id === typing.id && item.kind === "text") : undefined;
  const typedObject = typing?.kind === "original" ? found?.objects.find((object) => object.index === typing.index) : undefined;
  const typedField = typing?.kind === "field" ? found?.fields.find((field) => field.index === typing.index) : undefined;
  const typed = typedItem ?? (typedObject && typing?.kind === "original" ? asTyped(typedObject, shownBox(typedObject, value.edits, pageIndex), typing.text) : undefined)
    ?? (typedField && typing?.kind === "field" ? asFieldText(typedField, typing.text) : undefined);
  const selectedFieldKey = parseFieldKey(value.selectedId);
  const selectedField = selectedFieldKey?.pageIndex === pageIndex ? found?.fields.find((field) => field.index === selectedFieldKey.index) : undefined;
  const typedFont = typedObject && typing?.kind === "original" ? fonts?.[typedObject.font ?? ""] : undefined;
  const marked = new Set([...value.items.map((item) => item.pageIndex), ...value.edits.map((edit) => edit.pageIndex), ...value.fields.map((field) => field.pageIndex)]);
  const carried = ghost ?? settling;
  return <div class="signature-workspace" ref={workspace}>
    {shown?.failed && <p role="alert">{t.previewError} <button type="button" onClick={retry}>{t.retry}</button></p>}
    {size && <div class="edit-scroll"><div class="edit-sheet" style={{ aspectRatio: `${size.width} / ${size.height}`, "--page-ratio": size.width / size.height, "--zoom": zoom / 100 }} aria-busy={!shown}>
      {shown?.url ? <img src={shown.url} alt={`${t.preview} ${pageIndex + 1}`} draggable={false} /> : !shown && <Skeleton label={t.loading} />}
      {shown?.url && <svg ref={layer} class="edit-layer" data-tool={value.tool} data-objects={found ? "ready" : "loading"} viewBox={`0 0 ${size.width} ${size.height}`}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={cancel} onDblClick={open}>
        {found?.fields.filter(fillable).map((field) => <rect key={field.index} class="edit-field" {...field.box} />)}
        {carried && <Carried ghost={carried} url={shown.url} size={size} />}
        {onPage.map((item) => (typing?.kind !== "item" || item.id !== typing.id) && <Drawn key={item.id} item={item} previews={value.previews} images={value.images} />)}
        {sketch && <Drawn item={sketch} previews={value.previews} images={value.images} />}
        {selected && !value.cropping && (typing?.kind !== "item" || selected.id !== typing.id) && <Selection item={selected} unit={unit} />}
        {selectedObject && !value.cropping && typing?.kind !== "original" && <OriginalSelection box={carried?.to ?? shownBox(selectedObject, value.edits, pageIndex)} resizable={resizable(selectedObject)} unit={unit} />}
        {value.cropping && pictureBox() && <CropFrame frame={value.cropping} box={pictureBox()!} unit={unit} />}
      </svg>}
      {shown?.url && <textarea ref={typingField} class={typed ? (typed.width ? "edit-typing is-box" : "edit-typing") : "edit-typing is-idle"} value={typed?.text ?? ""} placeholder={t.typeHere}
        rows={typed ? linesOf(typed).length : 1} maxlength={typedField?.maxLength ?? undefined} spellcheck={false} tabIndex={typed ? 0 : -1} aria-hidden={!typed} wrap={typed?.width ? "soft" : "off"}
        style={typed && {
          left: `${typed.at.x / size.width * 100}%`, top: `${typingTop(typed) / size.height * 100}%`, color: css(typed.color),
          font: `${"italic" in typed && typed.italic ? "italic " : ""}${typed.bold ? "bold " : ""}${typed.size / unit}px/${lineHeight} ${families[typed.font]}`,
          width: `${fieldWidth(typed) / unit}px`, height: `${Math.max(1, linesOf(typed).length) * lineHeight * typed.size / unit}px`,
        }}
        onInput={(event) => {
          const text = event.currentTarget.value.replaceAll("\t", " ");
          if (typing?.kind === "original" || typing?.kind === "field") setTyping({ ...typing, text });
          else if (typedItem) onChange((draft) => ({ ...draft, items: draft.items.map((item) => (item.id === typedItem.id ? { ...item, text } : item)) }));
        }}
        onBlur={stopTyping} onKeyDown={(event) => {
          // A line of the document stays one line: Enter ends the typing.
          if (event.key === "Escape" || (event.key === "Enter" && (typing?.kind === "original" || (typing?.kind === "field" && !typedField?.multiline)))) {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }} />}
      {shown?.url && selectedField && (selectedField.kind === "combo" || selectedField.kind === "list") && <select class="edit-choice" ref={(element) => element?.focus()} value={selectedField.value}
        size={selectedField.kind === "list" ? Math.max(2, Math.min(6, selectedField.options.length)) : undefined}
        style={{ left: `${selectedField.box.x / size.width * 100}%`, top: `${selectedField.box.y / size.height * 100}%`, width: `${selectedField.box.width / unit}px`, minHeight: `${selectedField.box.height / unit}px`, fontSize: `${(selectedField.size || 10) / unit}px` }}
        onChange={(event) => { const [value, option] = [event.currentTarget.value, event.currentTarget.selectedIndex]; onChange((draft) => ({ ...filled(draft, { pageIndex, index: selectedField.index, value, option }), selectedId: null })); }}
        onBlur={() => onChange((draft) => (draft.selectedId === fieldKey(pageIndex, selectedField.index) ? { ...draft, selectedId: null } : draft))}>
        {selectedField.options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>}
    </div></div>}
    {typing?.kind === "original" && typedObject && fonts && oneLine(typing.text) !== oneLine(typing.base) && !keepsFont(typedFont, typing.text) &&
      <p class="edit-font-note" role="status">{writable(typing.text) ? t.fontChanges(typedObject.family ?? "Helvetica") : t.cannotWrite}</p>}
    {refused && <p class="error" role="alert">{t.refused}</p>}
    <div class="signature-pagination">
      <div class="signature-toolbar-group">
        <button type="button" disabled={disabled || pageIndex === 0} onClick={() => goTo(pageIndex - 1)} aria-label={t.previous}>←</button>
        <label>{t.page} <select aria-label={t.page} value={pageIndex} disabled={disabled} onChange={(event) => goTo(Number(event.currentTarget.value))}>
          {pages.map((_, index) => <option value={index} key={index}>{index + 1}{marked.has(index) ? " •" : ""}</option>)}
        </select> {t.of} {pages.length}</label>
        <button type="button" disabled={disabled || pageIndex >= pages.length - 1} onClick={() => goTo(pageIndex + 1)} aria-label={t.next}>→</button>
      </div>
      <div class="signature-toolbar-group edit-zoom">
        <button type="button" aria-label={t.zoomOut} title={t.zoomOut} disabled={zoom <= 50} onClick={() => setZoom(Math.max(50, zoom - 25))}><Icon name="minus" size={18} /></button>
        <button type="button" class="signature-zoom" aria-label={t.resetZoom} title={t.resetZoom} onClick={() => setZoom(100)}>{zoom}%</button>
        <button type="button" aria-label={t.zoomIn} title={t.zoomIn} disabled={zoom >= 200} onClick={() => setZoom(Math.min(200, zoom + 25))}><Icon name="plus" size={18} /></button>
      </div>
    </div>
  </div>;
}

function withHidden(edits: OriginalEdit[], pageIndex: number, index: number): OriginalEdit[] {
  const current = retouch(edits, pageIndex, index);
  return current ? edits.map((edit) => (edit === current ? { ...edit, deleted: true } : edit)) : [...edits, { pageIndex, index, deleted: true }];
}

function removeSelected(draft: EditDraft): EditDraft {
  const original = parseOriginalKey(draft.selectedId);
  if (original) return { ...revised(draft, { ...original, deleted: true }), selectedId: null, cropping: null };
  return { ...edited(draft, draft.items.filter((item) => item.id !== draft.selectedId)), selectedId: null, cropping: null };
}

function Carried({ ghost, url, size }: { ghost: Ghost; url: string; size: PageSize }) {
  const { from, to } = ghost;
  const id = `carried-${Math.round(from.x)}-${Math.round(from.y)}`;
  return <g class="edit-ghost">
    <defs><clipPath id={id}><rect {...from} /></clipPath></defs>
    <rect {...from} fill="white" />
    <image href={url} x={0} y={0} width={size.width} height={size.height} preserveAspectRatio="none" clip-path={`url(#${id})`} opacity={0.92}
      transform={`translate(${to.x} ${to.y}) scale(${to.width / from.width} ${to.height / from.height}) translate(${-from.x} ${-from.y})`} />
  </g>;
}

function Drawn({ item, previews, images }: { item: EditItem; previews: Record<string, string>; images: Record<string, EditImage> }) {
  switch (item.kind) {
    case "text":
      return <text class="edit-text" font-family={families[item.font]} font-weight={item.bold ? "bold" : "normal"} font-size={item.size} fill={css(item.color)}>
        {linesOf(item).map((line, index) => <tspan key={index} x={item.at.x} y={item.at.y + item.size * (ascent[item.font] + index * lineHeight)}>{line}</tspan>)}
      </text>;
    case "image": {
      const source = images[item.imageId];
      if (!item.picture || !source) return <image href={previews[item.imageId]} {...item.box} preserveAspectRatio="none" />;
      // The source is drawn whole, turned and mirrored about the crop's centre; the inner viewBox shows the crop alone.
      const crop = item.picture.crop ?? { x: 0, y: 0, width: 1, height: 1 };
      const [cx, cy, cw, ch] = [crop.x * source.width, crop.y * source.height, crop.width * source.width, crop.height * source.height];
      const turned = item.picture.rotate % 180 !== 0;
      const [vw, vh] = turned ? [ch, cw] : [cw, ch];
      const transform = `translate(${vw / 2} ${vh / 2}) scale(${item.picture.flipX ? -1 : 1} ${item.picture.flipY ? -1 : 1}) rotate(${item.picture.rotate}) translate(${-cw / 2} ${-ch / 2}) translate(${-cx} ${-cy})`;
      return <svg {...item.box} viewBox={`0 0 ${vw} ${vh}`} preserveAspectRatio="none" class="edit-picture">
        <g transform={transform}><image href={previews[item.imageId]} width={source.width} height={source.height} preserveAspectRatio="none" /></g>
      </svg>;
    }
    case "rectangle":
      return <rect {...item.box} fill={item.fill ? css(item.fill) : "none"} stroke={item.stroke ? css(item.stroke) : "none"} stroke-width={item.lineWidth} />;
    case "ellipse": {
      const { x, y, width, height } = item.box;
      return <ellipse cx={x + width / 2} cy={y + height / 2} rx={width / 2} ry={height / 2} fill={item.fill ? css(item.fill) : "none"} stroke={item.stroke ? css(item.stroke) : "none"} stroke-width={item.lineWidth} />;
    }
    case "line":
      return <line x1={item.from.x} y1={item.from.y} x2={item.to.x} y2={item.to.y} stroke={css(item.color)} stroke-width={item.lineWidth} stroke-linecap="round" />;
    case "arrow": {
      const { base, wings } = arrowHead(item.from, item.to, item.lineWidth);
      return <g fill={css(item.color)} stroke={css(item.color)}>
        <line x1={item.from.x} y1={item.from.y} x2={base.x} y2={base.y} stroke-width={item.lineWidth} stroke-linecap="round" />
        <polygon points={[item.to, ...wings].map(({ x, y }) => `${x},${y}`).join(" ")} stroke="none" />
      </g>;
    }
    case "ink":
      return <polyline points={item.points.map(({ x, y }) => `${x},${y}`).join(" ")} fill="none" stroke={css(item.color)} stroke-width={item.lineWidth} stroke-linecap="round" stroke-linejoin="round" />;
    case "highlight":
      return <rect class="edit-highlight" {...item.box} fill={css(item.color)} />;
    case "note": {
      const { x, y } = item.at;
      return <g class="edit-note" transform={`translate(${x} ${y})`}>
        <path d={`M1 1h${noteSize - 2}v${noteSize * 0.6}H${noteSize * 0.45}l-${noteSize * 0.2} ${noteSize * 0.22}v-${noteSize * 0.22}H1z`} fill={css(item.color)} stroke="rgb(60 50 20)" stroke-width="1" />
        <path d={`M5 ${noteSize * 0.28}h${noteSize - 10} M5 ${noteSize * 0.45}h${noteSize * 0.5}`} stroke="rgb(60 50 20)" stroke-width="1.2" />
      </g>;
    }
    case "markup":
      return <g>{item.quads.map((quad, index) => item.style === "highlight"
        ? <rect key={index} class="edit-highlight" {...quad} fill={css(item.color)} />
        : <line key={index} x1={quad.x} x2={quad.x + quad.width} y1={quad.y + (item.style === "underline" ? quad.height : quad.height / 2)} y2={quad.y + (item.style === "underline" ? quad.height : quad.height / 2)} stroke={css(item.color)} stroke-width={Math.max(1, quad.height * 0.08)} />)}</g>;
    case "link":
      return <rect class="edit-link" {...item.box} />;
    case "field":
      return <g class="edit-added-field"><rect {...item.box} rx={1} />
        {item.field !== "checkbox" && <svg {...item.box} overflow="hidden"><text x={3} y={item.box.height / 2} dominant-baseline="middle" font-size={Math.min(10, item.box.height * 0.5)} font-family={families.Helvetica}>{item.field === "combo" ? `${item.name} ▾` : item.name}</text></svg>}
      </g>;
    case "stamp": {
      const layout = stampLayout(item.box, item.text, item.date);
      return <g class="edit-stamp" fill={css(item.color)} font-family={families.Helvetica}>
        <rect {...item.box} rx={layout.radius} fill="none" stroke={css(item.color)} stroke-width={layout.stroke} />
        <text x={layout.title.x} y={layout.title.y} font-size={layout.title.size} font-weight="bold">{item.text}</text>
        {item.date && layout.date && <text x={layout.date.x} y={layout.date.y} font-size={layout.date.size}>{item.date}</text>}
      </g>;
    }
  }
}

function CropFrame({ frame, box, unit }: { frame: Box; box: Box; unit: number }) {
  const outer = `M${box.x} ${box.y}h${box.width}v${box.height}h${-box.width}z`;
  const inner = `M${frame.x} ${frame.y}h${frame.width}v${frame.height}h${-frame.width}z`;
  return <g class="edit-crop">
    <path d={`${outer} ${inner}`} fill="rgb(20 26 46 / 0.45)" fill-rule="evenodd" />
    <rect class="edit-original" {...frame} />
    <Handles box={frame} unit={unit} />
  </g>;
}

function Handles({ box, unit }: { box: Box; unit: number }) {
  const size = 10 * unit;
  const corners = [["nw", box.x, box.y], ["ne", box.x + box.width, box.y], ["sw", box.x, box.y + box.height], ["se", box.x + box.width, box.y + box.height]] as const;
  return <>{corners.map(([name, x, y]) => <rect key={name} class="edit-handle" data-handle={name} x={x - size / 2} y={y - size / 2} width={size} height={size} />)}</>;
}

function Selection({ item, unit }: { item: EditItem; unit: number }) {
  const box = boundsOf(item, measure);
  const pad = 3 * unit, size = 10 * unit;
  const handle = (name: Handle, { x, y }: Point) => <rect key={name} class="edit-handle" data-handle={name} x={x - size / 2} y={y - size / 2} width={size} height={size} />;
  return <g>
    <rect class="edit-selection" x={box.x - pad} y={box.y - pad} width={box.width + 2 * pad} height={box.height + 2 * pad} />
    {"box" in item && <Handles box={box} unit={unit} />}
    {(item.kind === "line" || item.kind === "arrow") && [handle("from", item.from), handle("to", item.to)]}
    {item.kind === "text" && [handle("w", { x: box.x, y: box.y + box.height / 2 }), handle("e", { x: box.x + box.width, y: box.y + box.height / 2 })]}
  </g>;
}

function OriginalSelection({ box, resizable, unit }: { box: Box; resizable: boolean; unit: number }) {
  const pad = 3 * unit;
  return <g>
    <rect class="edit-original" x={box.x - pad} y={box.y - pad} width={box.width + 2 * pad} height={box.height + 2 * pad} />
    {resizable && <Handles box={box} unit={unit} />}
  </g>;
}

export function EditOptions({ sizes: pages, lang, value, onChange, disabled, engine }: EditProps) {
  const t = texts[lang];
  const [imageError, setImageError] = useState(false);
  const selected = value.items.find((item) => item.id === value.selectedId);
  const original = parseOriginalKey(value.selectedId);
  const { found, fresh } = useListing(engine, value.docId, value.pageIndex, value.edits, value.fields);
  const hasFields = (found?.fields ?? []).some(fillable);
  const badField = value.items.find((item, index, all) => item.kind === "field"
    && (!fieldsValid([item], value.taken) || all.some((other, otherIndex) => otherIndex < index && other.kind === "field" && other.name.trim() === item.name.trim())));
  const selectedObject = original?.pageIndex === value.pageIndex ? found?.objects.find((object) => object.index === original.index) : undefined;
  const kind = selected?.kind ?? (original ? "original" : value.tool);
  const style = selected ? styleOf(selected, value.style) : value.style;

  function setStyle(change: Partial<Style>) {
    onChange((draft) => {
      const target = draft.items.find((item) => item.id === draft.selectedId);
      const style = { ...draft.style, ...change };
      return target ? { ...edited(draft, draft.items.map((item) => (item === target ? restyled(item, change) : item))), style } : { ...draft, style };
    });
  }

  const pick = (tool: Tool) => onChange((draft) => picked(draft, tool));
  const imageInput = useRef<HTMLInputElement>(null);
  const busy = useRef(disabled);
  busy.current = disabled;

  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (busy.current || event.metaKey || event.ctrlKey || event.altKey || event.key.length !== 1) return;
      // Only on the editor's own ground: a key typed into a field, or anywhere else on the page, is not a tool change.
      if (!(event.target instanceof HTMLElement) || event.target.closest("input, textarea, select, [contenteditable]")) return;
      if (event.target !== document.body && !event.target.closest(".board")) return;
      const tool = toolForKey(event.key);
      if (!tool) return;
      event.preventDefault();
      if (tool === "image") imageInput.current?.click();
      else pick(tool);
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, []);

  const snapshot = useRef<EditItem[] | null>(null);
  const patch = (change: Partial<EditItem>) => onChange((draft) => ({ ...draft, items: draft.items.map((item) => (item.id === draft.selectedId ? { ...item, ...change } as EditItem : item)) }));
  /** One undo step for a whole field edit: the items as they were when the field took focus. */
  const commitField = () => {
    const before = snapshot.current;
    snapshot.current = null;
    if (before) onChange((draft) => (draft.items === before ? draft : edited(draft, draft.items, before)));
  };

  async function addImage(file: File | undefined) {
    if (!file) return;
    setImageError(false);
    const page = pages[value.pageIndex];
    const imported = await importImage(file).catch(() => null);
    if (!imported || !page) return setImageError(true);
    const scale = Math.min(page.width * 0.4 / imported.image.width, page.height * 0.4 / imported.image.height);
    const [width, height] = [imported.image.width * scale, imported.image.height * scale];
    const id = crypto.randomUUID();
    const item: EditItem = { id, pageIndex: value.pageIndex, kind: "image", imageId: id, box: { x: (page.width - width) / 2, y: (page.height - height) / 2, width, height } };
    onChange((draft) => ({
      ...edited(draft, [...draft.items, item]), selectedId: id, tool: "select", cropping: null,
      images: { ...draft.images, [id]: imported.image }, previews: { ...draft.previews, [id]: imported.preview },
    }));
  }

  const shaped = kind === "rectangle" || kind === "ellipse";
  const missingLink = value.items.find((item) => item.kind === "link" && !validLink(item));

  function pictureBoxOf(draft: EditDraft): Box | null {
    const item = draft.items.find((each) => each.id === draft.selectedId);
    if (item?.kind === "image") return item.box;
    return selectedObject ? shownBox(selectedObject, draft.edits, draft.pageIndex) : null;
  }

  /** A turn or a mirror of the selected picture: an addition's own settings, or a retouch of the document's image. */
  function repicture(change: (picture: Picture) => Picture, turnBox: boolean) {
    onChange((draft) => {
      const item = draft.items.find((each) => each.id === draft.selectedId);
      if (item?.kind === "image") {
        return edited(draft, draft.items.map((each) => (each === item ? { ...item, picture: change(pictureOf(item)), box: turnBox ? turnedBox(item.box) : item.box } : each)));
      }
      if (!original) return draft;
      const current = retouch(draft.edits, original.pageIndex, original.index);
      return revised(draft, { ...original, picture: change(current?.picture ?? plainPicture), ...(turnBox && current?.box ? { box: turnedBox(current.box) } : {}) });
    });
  }
  const turn = (quarters: 1 | -1) => repicture((picture) => rotatedPicture(picture, quarters), true);
  const mirror = (axis: "x" | "y") => repicture((picture) => flippedPicture(picture, axis), false);

  /** An added picture's crop is cut in the browser and becomes a new image: the engine shares and places whole images only. */
  async function applyCrop() {
    const frame = value.cropping;
    if (!frame) return;
    if (selected?.kind === "image") {
      const source = value.images[selected.imageId];
      const crop = croppedPicture(pictureOf(selected), selected.box, frame).crop;
      const cut = source && crop ? await cropImage(source, crop).catch(() => null) : null;
      if (!cut) return onChange((draft) => ({ ...draft, cropping: null }));
      const id = crypto.randomUUID();
      return onChange((draft) => ({
        ...edited(draft, draft.items.map((item) => (item.id === selected.id ? { ...item, imageId: id, box: frame, picture: { ...pictureOf(item), crop: null } } : item))),
        images: { ...draft.images, [id]: cut.image }, previews: { ...draft.previews, [id]: cut.preview }, cropping: null,
      }));
    }
    onChange((draft) => {
      const fractions = original && selectedObject?.corners ? fractionsIn(selectedObject.corners, frame) : null;
      if (!original || !fractions) return { ...draft, cropping: null };
      const current = retouch(draft.edits, original.pageIndex, original.index);
      const picture = { ...(current?.picture ?? plainPicture), crop: composedCrop(current?.picture?.crop ?? null, fractions) };
      return { ...revised(draft, { ...original, picture, box: frame }), cropping: null };
    });
  }
  return <div class="edit-options">
    <fieldset class="edit-group" disabled={disabled}>
      <legend>{t.tools}</legend>
      <div class="edit-tools">
        {toolOrder.map((tool) => <button key={tool} type="button" aria-pressed={value.tool === tool} aria-keyshortcuts={toolKeys[tool]} onClick={() => pick(tool)}>
          <ToolGlyph path={glyphs[tool]} />{t.tool[tool]}<kbd class="edit-key" aria-hidden="true">{toolKeys[tool]}</kbd>
        </button>)}
        <label class="button">
          <input ref={imageInput} class="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
            void addImage(event.currentTarget.files?.[0]);
            event.currentTarget.value = "";
          }} />
          <ToolGlyph path={glyphs.image} />{t.image}<kbd class="edit-key" aria-hidden="true">{toolKeys.image}</kbd>
        </label>
      </div>
      {imageError && <p class="error" role="alert">{t.imageError}</p>}
    </fieldset>
    {original && <fieldset class="edit-group" disabled={disabled}>
      <legend>{t.original}</legend>
      <p class="edit-object">
        {t.kinds[selectedObject?.kind ?? "text"]}
        {selectedObject?.text && <span class="edit-object-text">{selectedObject.text}</span>}
      </p>
      {selectedObject && pages[value.pageIndex] && coversPage(selectedObject, pages[value.pageIndex]!) && <p class="signature-hint" role="status">{t.pageIsPicture}</p>}
    </fieldset>}
    {(selected?.kind === "image" || selectedObject?.kind === "image") && <fieldset class="edit-group" disabled={disabled}>
      <legend>{t.picture}</legend>
      {value.cropping ? <div class="edit-actions">
        <button type="button" disabled={Boolean(selectedObject) && !fresh} onClick={() => void applyCrop()}>{t.applyCrop}</button>
        <button type="button" onClick={() => onChange((draft) => ({ ...draft, cropping: null }))}>{t.cancelCrop}</button>
      </div> : <div class="edit-actions">
        <button type="button" onClick={() => turn(-1)}>{t.turnLeft}</button>
        <button type="button" onClick={() => turn(1)}>{t.turnRight}</button>
        <button type="button" onClick={() => mirror("x")}>{t.mirrorAcross}</button>
        <button type="button" onClick={() => mirror("y")}>{t.mirrorDown}</button>
        <button type="button" disabled={Boolean(selectedObject) && (!selectedObject?.croppable || !fresh)} onClick={() => onChange((draft) => ({ ...draft, cropping: pictureBoxOf(draft) }))}>{t.crop}</button>
      </div>}
      {value.cropping && <p class="signature-hint">{t.cropHint}</p>}
    </fieldset>}
    {selected?.kind === "note" && <fieldset class="edit-group" disabled={disabled}>
      <legend>{t.selectedNote}</legend>
      <div class="edit-fields">
        <label>{t.noteText} <textarea rows={3} value={selected.text} onFocus={() => { snapshot.current = value.items; }} onInput={(event) => patch({ text: event.currentTarget.value })} onBlur={commitField} /></label>
        <label>{t.author} <input type="text" value={selected.author} onFocus={() => { snapshot.current = value.items; }} onInput={(event) => patch({ author: event.currentTarget.value })} onBlur={commitField} /></label>
      </div>
    </fieldset>}
    {selected?.kind === "link" && <fieldset class="edit-group" disabled={disabled}>
      <legend>{t.selectedLink}</legend>
      <Segments label={t.target} options={[t.webAddress, t.documentPage]} chosen={"url" in selected.target ? 0 : 1}
        onChoose={(index) => index !== ("url" in selected.target ? 0 : 1) && onChange((draft) => edited(draft, draft.items.map((item) => (item.id === selected.id ? { ...item, target: index === 0 ? { url: "" } : { page: draft.pageIndex } } as EditItem : item))))} />
      <div class="edit-fields">
        {"url" in selected.target
          ? <label>{t.webAddress} <input type="url" inputMode="url" placeholder={t.url} value={selected.target.url} onFocus={() => { snapshot.current = value.items; }} onInput={(event) => patch({ target: { url: event.currentTarget.value.trim() } })} onBlur={commitField} /></label>
          : <label>{t.linkPage} <select value={selected.target.page} onChange={(event) => onChange((draft) => edited(draft, draft.items.map((item) => (item.id === selected.id ? { ...item, target: { page: Number(event.currentTarget.value) } } as EditItem : item))))}>
            {pages.map((_, index) => <option key={index} value={index}>{index + 1}</option>)}
          </select></label>}
      </div>
      {"url" in selected.target && selected.target.url !== "" && !validLink(selected) && <p class="error" role="alert">{t.invalidLink}</p>}
    </fieldset>}
    {kind !== "select" && kind !== "image" && kind !== "original" && kind !== "link" && <fieldset class="edit-group" disabled={disabled}>
      <legend>{selected ? t.selection : t.style}</legend>
      {kind !== "field" && <div class="edit-swatches" role="radiogroup" aria-label={t.color}>
        {palette.map((color, index) => <button key={index} type="button" role="radio" aria-checked={style.color.join() === color.join()} aria-label={t.colors[index]} title={t.colors[index]}
          style={{ "--swatch": css(color) }} onClick={() => setStyle({ color })} />)}
      </div>}
      {shaped && <Segments label={t.fill} options={[t.outline, t.filled]} chosen={style.fill ? 1 : 0} onChoose={(index) => setStyle({ fill: index === 1 })} />}
      {(kind === "line" || kind === "arrow" || kind === "ink" || (shaped && !style.fill)) &&
        <Segments label={t.width} options={t.widths} chosen={widths.indexOf(style.lineWidth)} onChoose={(index) => setStyle({ lineWidth: widths[index]! })} />}
      {kind === "field" && <div class="edit-fields">
        <div class="edit-swatches edit-words" role="radiogroup" aria-label={t.tool.field}>
          {(["text", "checkbox", "combo"] as const).map((each) => <button key={each} type="button" role="radio" aria-checked={(selected?.kind === "field" ? selected.field : value.style.field) === each}
            onClick={() => onChange((draft) => {
              const target = draft.items.find((item) => item.id === draft.selectedId);
              const style = { ...draft.style, field: each };
              return target?.kind === "field" ? { ...edited(draft, draft.items.map((item) => (item === target ? rekinded(target, each) : item))), style } : { ...draft, style };
            })}>{t.fieldKinds[each]}</button>)}
        </div>
        {selected?.kind === "field" && <>
          <label>{t.fieldLabel} <input type="text" value={selected.name} maxLength={60} onFocus={() => { snapshot.current = value.items; }} onInput={(event) => patch({ name: event.currentTarget.value })} onBlur={commitField} /></label>
          {selected.field === "text" && <label class="edit-check"><input type="checkbox" checked={selected.multiline}
            onChange={(event) => onChange((draft) => edited(draft, draft.items.map((item) => (item.id === selected.id ? { ...item, multiline: event.currentTarget.checked } : item))))} /> {t.fieldMultiline}</label>}
          {selected.field === "combo" && <label>{t.fieldOptions} <textarea rows={3} value={selected.options.join("\n")} onFocus={() => { snapshot.current = value.items; }}
            onInput={(event) => patch({ options: event.currentTarget.value.split("\n") })} onBlur={commitField} /></label>}
        </>}
      </div>}
      {kind === "stamp" && <div class="edit-fields">
        <div class="edit-swatches edit-words" role="radiogroup" aria-label={t.stampWord}>
          {stampWords[lang].map((word) => <button key={word} type="button" role="radio" aria-checked={(selected?.kind === "stamp" ? selected.text : value.style.stamp) === word}
            onClick={() => onChange((draft) => {
              const target = draft.items.find((item) => item.id === draft.selectedId);
              const style = { ...draft.style, stamp: word };
              return target?.kind === "stamp" ? { ...edited(draft, draft.items.map((item) => (item === target ? { ...item, text: word } : item))), style } : { ...draft, style };
            })}>{word}</button>)}
        </div>
        {selected?.kind === "stamp" && <>
          <label>{t.stampCustom} <input type="text" value={selected.text} maxLength={40} onFocus={() => { snapshot.current = value.items; }}
            onInput={(event) => {
              const field = event.currentTarget;
              const [start, end] = [field.selectionStart, field.selectionEnd];
              field.value = field.value.toUpperCase();
              field.setSelectionRange(start, end);
              onChange((draft) => ({ ...draft, style: { ...draft.style, stamp: field.value }, items: draft.items.map((item) => (item.id === draft.selectedId ? { ...item, text: field.value } as EditItem : item)) }));
            }} onBlur={commitField} /></label>
          <label class="edit-check"><input type="checkbox" checked={selected.date !== null}
            onChange={(event) => onChange((draft) => edited(draft, draft.items.map((item) => (item.id === selected.id ? { ...item, date: event.currentTarget.checked ? today(lang) : null } : item))))} /> {t.stampDate}</label>
        </>}
      </div>}
      {kind === "text" && <div class="edit-text-style">
        <label>{t.font} <select value={style.font} onChange={(event) => setStyle({ font: event.currentTarget.value as EditFont })}>
          {(Object.keys(families) as EditFont[]).map((font) => <option key={font} value={font}>{font}</option>)}
        </select></label>
        <label>{t.size} <select value={style.size} onChange={(event) => setStyle({ size: Number(event.currentTarget.value) })}>
          {[...new Set([...sizes, style.size])].sort((a, b) => a - b).map((size) => <option key={size} value={size}>{size}</option>)}
        </select></label>
        <button type="button" aria-pressed={style.bold} onClick={() => setStyle({ bold: !style.bold })}><strong>{t.bold}</strong></button>
      </div>}
    </fieldset>}
    <div class="edit-actions">
      <button type="button" disabled={disabled || value.past.length === 0} onClick={() => onChange(undone)}><Icon name="undo" size={16} />{t.undo}</button>
      <button type="button" disabled={disabled || value.future.length === 0} onClick={() => onChange(redone)}>{t.redo}</button>
      {selected && <>
        <button type="button" disabled={disabled} onClick={() => onChange((draft) => reordered(draft, selected.id, true))}>{t.front}</button>
        <button type="button" disabled={disabled} onClick={() => onChange((draft) => reordered(draft, selected.id, false))}>{t.back}</button>
      </>}
      {(selected || original) && <button type="button" disabled={disabled} onClick={() => onChange(removeSelected)}><Icon name="delete" size={16} />{t.remove}</button>}
    </div>
    {value.items.some((item) => (item.kind === "text" || item.kind === "stamp") && !writable(item.text)) ? <p class="error" role="alert">{t.unwritable}</p>
      : badField ? <p class="error" role="alert">{t.fieldNames(badField.pageIndex + 1)}</p>
      : missingLink && !(selected?.kind === "link") ? <p class="error" role="alert">{t.linkMissing(missingLink.pageIndex + 1)}</p>
      : <p class="signature-hint">{original ? t.originalHint : isMarkupTool(value.tool) ? t.markupHint : value.tool === "note" ? t.noteHint : value.tool === "stamp" ? t.stampHint : value.tool === "field" ? ((found?.rotation ?? 0) !== 0 ? t.fieldTurned : t.fieldHint) : hasFields ? t.fieldsHint : t.hint}</p>}
  </div>;
}

function Segments({ label, options, chosen, onChoose }: { label: string; options: string[]; chosen: number; onChoose: (index: number) => void }) {
  return <div class="edit-segments" role="radiogroup" aria-label={label}>
    <span>{label}</span>
    <div>{options.map((option, index) => <button key={option} type="button" role="radio" aria-checked={index === chosen} onClick={() => onChoose(index)}>{option}</button>)}</div>
  </div>;
}

const dateLocales: Record<Lang, string> = { fr: "fr-FR", en: "en-GB", "pt-br": "pt-BR" };
const today = (lang: Lang) => new Date().toLocaleDateString(dateLocales[lang], { day: "numeric", month: "short", year: "numeric" });

const ToolGlyph = ({ path }: { path: string }) => <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d={path} fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>;

const longest = 2400;

/** Decoded by the browser, upright as the photo was taken; JPEG unless the image has transparency. */
async function importImage(file: File): Promise<{ image: EditImage; preview: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, longest / Math.max(bitmap.width, bitmap.height));
  const [width, height] = [Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale))];
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d")!;
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return encoded(canvas);
}

/** The part of an image's pixels a crop keeps, as a new image. */
async function cropImage(source: EditImage, crop: Box): Promise<{ image: EditImage; preview: string }> {
  const left = Math.round(crop.x * source.width), top = Math.round(crop.y * source.height);
  const width = Math.max(1, Math.min(source.width, Math.round((crop.x + crop.width) * source.width)) - left), height = Math.max(1, Math.min(source.height, Math.round((crop.y + crop.height) * source.height)) - top);
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d")!;
  if (source.kind === "jpeg") {
    const bitmap = await createImageBitmap(new Blob([source.bytes], { type: "image/jpeg" }));
    context.drawImage(bitmap, left, top, width, height, 0, 0, width, height);
    bitmap.close();
  } else {
    context.putImageData(new ImageData(source.pixels, source.width, source.height), -left, -top);
  }
  return encoded(canvas);
}

async function encoded(canvas: OffscreenCanvas): Promise<{ image: EditImage; preview: string }> {
  const { width, height } = canvas;
  const pixels = canvas.getContext("2d")!.getImageData(0, 0, width, height).data;
  const transparent = pixels.some((value, index) => index % 4 === 3 && value < 255);
  const blob = await canvas.convertToBlob(transparent ? { type: "image/png" } : { type: "image/jpeg", quality: 0.9 });
  const image: EditImage = transparent ? { kind: "rgba", width, height, pixels: new Uint8ClampedArray(pixels) } : { kind: "jpeg", bytes: new Uint8Array(await blob.arrayBuffer()), width, height };
  return { image, preview: URL.createObjectURL(blob) };
}
