import type { TargetedPointerEvent } from "preact";
import { useRef } from "preact/hooks";
import type { DocumentSkeleton } from "../board/DocumentSkeleton";
import type { Engine } from "../engine/client";
import type { Box, PageSize, Point } from "../engine/types";
import { useActionHeight } from "../signature/actionHeight";
import { usePagePreview } from "../signature/pagePreview";
import type { Lang } from "../tools";
import { type CropDraft, type CropHandle, drawn, shifted, startBox, stretched } from "./box";
import "../signature/signature.css";
import "./crop.css";

const en = {
  pages: "Pages", all: "All pages", only: (page: number) => `Page ${page} only`, reset: "Reset the zone",
  size: (width: number, height: number) => `Cropped page: ${width} × ${height} mm`,
  hint: "Draw the area to keep, then adjust it by its handles. What lies outside stays in the file, hidden: to remove it, use Brother Inkpot.",
  zone: "Area to keep", previous: "Previous page", next: "Next page", page: "Page", of: "of",
  preview: "PDF page preview", loading: "Loading the page…", previewError: "This page could not be displayed.", retry: "Retry preview",
};
const fr: typeof en = {
  pages: "Pages", all: "Toutes les pages", only: (page) => `Page ${page} seulement`, reset: "Réinitialiser la zone",
  size: (width, height) => `Page rognée : ${width} × ${height} mm`,
  hint: "Tracez la zone à garder, puis ajustez-la par ses poignées. Ce qui est hors du cadre reste dans le fichier, invisible : pour le retirer, utilisez Frère Encrier.",
  zone: "Zone à garder", previous: "Page précédente", next: "Page suivante", page: "Page", of: "sur",
  preview: "Aperçu de la page PDF", loading: "Chargement de la page…", previewError: "Cette page n'a pas pu être affichée.", retry: "Réessayer l'aperçu",
};
const ptBR: typeof en = {
  pages: "Páginas", all: "Todas as páginas", only: (page) => `Somente a página ${page}`, reset: "Redefinir a área",
  size: (width, height) => `Página cortada: ${width} × ${height} mm`,
  hint: "Desenhe a área a manter e ajuste-a pelas alças. O que fica fora continua no arquivo, oculto: para removê-lo, use o Frei Tinteiro.",
  zone: "Área a manter", previous: "Página anterior", next: "Próxima página", page: "Página", of: "de",
  preview: "Visualização da página do PDF", loading: "Carregando a página…", previewError: "Esta página não pôde ser exibida.", retry: "Tentar a visualização novamente",
};
const texts = { en, fr, "pt-br": ptBR };
const handles: CropHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const millimetres = (points: number) => Math.round(points * 25.4 / 72);

export const cropStart = (docId: string): CropDraft => ({ docId, pageIndex: 0, box: startBox, page: false });

export type CropProps = {
  sizes: PageSize[]; lang: Lang; value: CropDraft; onChange: (update: (draft: CropDraft) => CropDraft) => void; disabled: boolean;
  /** Passed by Board, not imported: a module shared with Board's chunk becomes one more request before LCP on every tool page. */
  engine: Pick<Engine, "thumbnail">; Skeleton: typeof DocumentSkeleton;
};

type Drag = { pointer: number; start: Point; box: Box; mode: "draw" | "move" | CropHandle };

export function CropWorkspace({ sizes, lang, value, onChange, disabled, engine, Skeleton }: CropProps) {
  const t = texts[lang];
  const { docId, pageIndex, box } = value;
  const size = sizes[pageIndex];
  const { shown, retry } = usePagePreview(engine, docId, pageIndex, size);
  const workspace = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  useActionHeight(workspace);

  function point(event: PointerEvent): Point {
    const rect = sheet.current!.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  }

  function down(event: TargetedPointerEvent<HTMLDivElement>) {
    if (disabled || event.button !== 0 || !shown?.url) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const at = point(event);
    const handle = (event.target as Element).closest("[data-handle]")?.getAttribute("data-handle") as CropHandle | null;
    const inside = at.x >= box.x && at.x <= box.x + box.width && at.y >= box.y && at.y <= box.y + box.height;
    drag.current = { pointer: event.pointerId, start: at, box, mode: handle ?? (inside ? "move" : "draw") };
  }

  function move(event: TargetedPointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    const at = point(event);
    const next = current.mode === "draw" ? drawn(current.start, at)
      : current.mode === "move" ? shifted(current.box, at.x - current.start.x, at.y - current.start.y)
      : stretched(current.box, current.mode, at);
    if (next) onChange((draft) => ({ ...draft, box: next }));
  }

  function release() {
    drag.current = null;
  }

  const goTo = (index: number) => onChange((draft) => ({ ...draft, pageIndex: index }));
  const percent = (value: number) => `${value * 100}%`;
  const zone = { left: percent(box.x), top: percent(box.y), width: percent(box.width), height: percent(box.height) };
  return <div class="signature-workspace" ref={workspace}>
    {shown && !shown.url && <p role="alert">{t.previewError} <button type="button" onClick={retry}>{t.retry}</button></p>}
    {size && <div class="crop-sheet" ref={sheet} style={{ aspectRatio: `${size.width} / ${size.height}`, "--page-ratio": size.width / size.height }} aria-busy={!shown}
      onPointerDown={down} onPointerMove={move} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>
      {shown?.url ? <img src={shown.url} alt={`${t.preview} ${pageIndex + 1}`} draggable={false} /> : !shown && <Skeleton label={t.loading} />}
      {shown?.url && <>
        <div class="crop-shade"><div style={zone} /></div>
        <div class="crop-zone" role="img" aria-label={t.zone} style={zone}>
          {handles.map((handle) => <span key={handle} class="crop-handle" data-handle={handle} />)}
        </div>
      </>}
    </div>}
    <div class="signature-pagination">
      <div class="signature-toolbar-group">
        <button type="button" disabled={disabled || pageIndex === 0} onClick={() => goTo(pageIndex - 1)} aria-label={t.previous}>←</button>
        <label>{t.page} <select aria-label={t.page} value={pageIndex} disabled={disabled} onChange={(event) => goTo(Number(event.currentTarget.value))}>
          {sizes.map((_, index) => <option value={index} key={index}>{index + 1}</option>)}
        </select> {t.of} {sizes.length}</label>
        <button type="button" disabled={disabled || pageIndex >= sizes.length - 1} onClick={() => goTo(pageIndex + 1)} aria-label={t.next}>→</button>
      </div>
    </div>
  </div>;
}

export function CropOptions({ sizes, lang, value, onChange, disabled }: CropProps) {
  const t = texts[lang];
  const size = sizes[value.pageIndex];
  return <div class="crop-options">
    <div class="crop-segments" role="radiogroup" aria-label={t.pages}>
      <span>{t.pages}</span>
      <div>
        {[false, true].map((page) => <button key={String(page)} type="button" role="radio" aria-checked={value.page === page} disabled={disabled}
          onClick={() => onChange((draft) => ({ ...draft, page }))}>{page ? t.only(value.pageIndex + 1) : t.all}</button>)}
      </div>
    </div>
    {size && <p class="crop-size">{t.size(millimetres(size.width * value.box.width), millimetres(size.height * value.box.height))}</p>}
    <button type="button" disabled={disabled} onClick={() => onChange((draft) => ({ ...draft, box: startBox }))}>{t.reset}</button>
    <p class="signature-hint">{t.hint}</p>
  </div>;
}
