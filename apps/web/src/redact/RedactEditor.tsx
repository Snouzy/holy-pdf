import type { TargetedKeyboardEvent, TargetedPointerEvent } from "preact";
import { useRef, useState } from "preact/hooks";
import type { DocumentSkeleton } from "../board/DocumentSkeleton";
import type { Engine } from "../engine/client";
import type { PageSize, RedactZone } from "../engine/types";
import { Icon } from "../illustrations/Icon";
import { useActionHeight } from "../signature/actionHeight";
import { usePagePreview } from "../signature/pagePreview";
import type { Lang } from "../tools";
import "../signature/signature.css";
import "./redact.css";

const en = {
  note: "Each covered page becomes a picture: its text can no longer be selected. The document's title, bookmarks and metadata are not checked.",
  remove: "Remove this zone", move: "Move this zone", clearPage: "Clear this page", previous: "Previous page", next: "Next page", page: "Page", of: "of",
  preview: "PDF page preview", loading: "Loading the page…", previewError: "This page could not be displayed.", retry: "Retry preview",
};
const fr: typeof en = {
  note: "Chaque page noircie devient une image : son texte ne se sélectionne plus. Le titre, les signets et les métadonnées du document ne sont pas relus.",
  remove: "Retirer cette zone", move: "Déplacer cette zone", clearPage: "Vider cette page", previous: "Page précédente", next: "Page suivante", page: "Page", of: "sur",
  preview: "Aperçu de la page PDF", loading: "Chargement de la page…", previewError: "Cette page n'a pas pu être affichée.", retry: "Réessayer l'aperçu",
};
const ptBR: typeof en = {
  note: "Cada página ocultada vira uma imagem: seu texto não pode mais ser selecionado. O título, os marcadores e os metadados do documento não são verificados.",
  remove: "Remover esta área", move: "Mover esta área", clearPage: "Limpar esta página", previous: "Página anterior", next: "Próxima página", page: "Página", of: "de",
  preview: "Visualização da página do PDF", loading: "Carregando a página…", previewError: "Esta página não pôde ser exibida.", retry: "Tentar a visualização novamente",
};
const texts = { en, fr, "pt-br": ptBR };

/** A drag shorter than this, in either direction and as a share of the page, is a click. */
const smallest = 0.01;

export type RedactProps = {
  docId: string; sizes: PageSize[]; lang: Lang; zones: RedactZone[]; onZones: (zones: RedactZone[]) => void; disabled: boolean;
  /** Passed by Board, not imported: a module shared with Board's chunk becomes one more request before LCP on every tool page. */
  engine: Pick<Engine, "thumbnail">; Skeleton: typeof DocumentSkeleton;
};

export function RedactWorkspace({ docId, sizes, lang, zones, onZones, disabled, engine, Skeleton }: RedactProps) {
  const t = texts[lang];
  const [pageIndex, setPageIndex] = useState(0);
  const size = sizes[pageIndex];
  const { shown, retry } = usePagePreview(engine, docId, pageIndex, size);
  const [draft, setDraft] = useState<RedactZone | null>(null);
  const press = useRef<{ id: number; x: number; y: number } | null>(null);
  const grip = useRef<{ id: number; x: number; y: number; index: number; zone: RedactZone } | null>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const workspace = useRef<HTMLDivElement>(null);
  useActionHeight(workspace);
  const live = useRef(zones);
  live.current = zones;

  function point(event: PointerEvent) {
    const rect = sheet.current!.getBoundingClientRect();
    const clamp = (value: number) => Math.min(1, Math.max(0, value));
    return { x: clamp((event.clientX - rect.left) / rect.width), y: clamp((event.clientY - rect.top) / rect.height) };
  }

  function spanned(event: PointerEvent): RedactZone | null {
    const from = press.current;
    if (!from || from.id !== event.pointerId) return null;
    const to = point(event);
    return { pageIndex, x: Math.min(from.x, to.x), y: Math.min(from.y, to.y), width: Math.abs(to.x - from.x), height: Math.abs(to.y - from.y) };
  }

  function down(event: TargetedPointerEvent<HTMLDivElement>) {
    if (disabled || event.button !== 0 || !shown?.url) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    press.current = { id: event.pointerId, ...point(event) };
  }

  function up(event: TargetedPointerEvent<HTMLDivElement>) {
    const zone = spanned(event);
    press.current = null;
    setDraft(null);
    if (zone && zone.width >= smallest && zone.height >= smallest) onZones([...live.current, zone]);
  }

  function cancel() {
    press.current = null;
    setDraft(null);
  }

  function shift(index: number, zone: RedactZone, dx: number, dy: number) {
    const moved = { ...zone, x: Math.min(1 - zone.width, Math.max(0, zone.x + dx)), y: Math.min(1 - zone.height, Math.max(0, zone.y + dy)) };
    onZones(live.current.map((other, at) => (at === index ? moved : other)));
  }

  function grab(event: TargetedPointerEvent<HTMLButtonElement>, index: number) {
    event.stopPropagation();
    const zone = live.current[index];
    if (disabled || event.button !== 0 || !zone) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    grip.current = { id: event.pointerId, ...point(event), index, zone };
  }

  function drag(event: TargetedPointerEvent<HTMLButtonElement>) {
    const from = grip.current;
    if (!from || from.id !== event.pointerId) return;
    const to = point(event);
    shift(from.index, from.zone, to.x - from.x, to.y - from.y);
  }

  function nudge(event: TargetedKeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.shiftKey ? 0.03 : 0.005;
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const arrow = arrows[event.key];
    const zone = live.current[index];
    if (disabled || !arrow || !zone) return;
    event.preventDefault();
    shift(index, zone, ...arrow);
  }

  function goTo(index: number) {
    cancel();
    setPageIndex(index);
  }

  const onPage = zones.flatMap((zone, index) => (zone.pageIndex === pageIndex ? [{ zone, index }] : []));
  const box = (zone: RedactZone) => ({ left: `${zone.x * 100}%`, top: `${zone.y * 100}%`, width: `${zone.width * 100}%`, height: `${zone.height * 100}%` });
  return <div class="signature-workspace redact-workspace" ref={workspace}>
    {shown && !shown.url && <p role="alert">{t.previewError} <button type="button" onClick={retry}>{t.retry}</button></p>}
    {size && <div class="redact-sheet" ref={sheet} style={{ aspectRatio: `${size.width} / ${size.height}`, "--page-ratio": size.width / size.height }} aria-busy={!shown}
      onPointerDown={down} onPointerMove={(event) => press.current && setDraft(spanned(event))} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={cancel}>
      {shown?.url ? <img src={shown.url} alt={`${t.preview} ${pageIndex + 1}`} draggable={false} /> : !shown && <Skeleton label={t.loading} />}
      {shown?.url && onPage.map(({ zone, index }) => <div class="redact-zone" key={index} style={box(zone)}>
        <button type="button" class="redact-move" aria-label={t.move} title={t.move} disabled={disabled}
          onPointerDown={(event) => grab(event, index)} onPointerMove={drag} onLostPointerCapture={() => { grip.current = null; }}
          onKeyDown={(event) => nudge(event, index)}><Icon name="move" size={12} /></button>
        <button type="button" class="redact-remove" aria-label={t.remove} title={t.remove} disabled={disabled}
          onPointerDown={(event) => event.stopPropagation()} onClick={() => onZones(live.current.filter((other) => other !== zone))}><Icon name="close" size={12} /></button>
      </div>)}
      {draft && <div class="redact-zone is-draft" style={box(draft)} />}
    </div>}
    <p class="signature-hint">{t.note}</p>
    <div class="signature-pagination">
      <div class="signature-toolbar-group">
        <button type="button" disabled={disabled || pageIndex === 0} onClick={() => goTo(pageIndex - 1)} aria-label={t.previous}>←</button>
        <label>{t.page} <select aria-label={t.page} value={pageIndex} disabled={disabled} onChange={(event) => goTo(Number(event.currentTarget.value))}>
          {sizes.map((_, index) => <option value={index} key={index}>{index + 1}{zones.some((zone) => zone.pageIndex === index) ? " ■" : ""}</option>)}
        </select> {t.of} {sizes.length}</label>
        <button type="button" disabled={disabled || pageIndex >= sizes.length - 1} onClick={() => goTo(pageIndex + 1)} aria-label={t.next}>→</button>
      </div>
      <button type="button" disabled={disabled || onPage.length === 0} onClick={() => onZones(live.current.filter((zone) => zone.pageIndex !== pageIndex))}>{t.clearPage}</button>
    </div>
  </div>;
}
