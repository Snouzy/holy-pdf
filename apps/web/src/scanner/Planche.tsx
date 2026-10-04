import { DndContext, type DragEndEvent, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { useEffect, useState } from "preact/hooks";
import { Icon } from "../illustrations/Icon";
import { needsCheck, useBlobUrl } from "./pages";
import { type Doc, movePage, type Op, type Page, type Session } from "./session";
import type { ScannerTexts } from "./texts";

type Props = {
  session: Session; t: ScannerTexts; onlyToCheck: boolean; canUndo: boolean; canRedo: boolean; busy: boolean;
  onOp: (op: Op) => void; onUndo: () => void; onRedo: () => void; onCorrect: (pageId: string) => void;
  onDownload: (docs: Doc[]) => void; onOnlyToCheck: (on: boolean) => void; onPhotos: (files: File[]) => void;
  searchable: boolean; onSearchable: (on: boolean) => void; readingCount: number;
};

export function Planche(props: Props) {
  const { session, t, onlyToCheck, onOp } = props;
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }));
  const toCheck = Object.values(session.pages).filter((page) => session.documents.some((doc) => doc.pageIds.includes(page.id)) && needsCheck(page)).length;
  useEffect(() => {
    if (toCheck === 0 && onlyToCheck) props.onOnlyToCheck(false);
  }, [toCheck]);

  function dropped({ active, over }: DragEndEvent) {
    const pageId = String(active.id);
    const [where, id] = String(over?.id ?? "").split(":") as [string, string];
    if (!id) return;
    const doc = session.documents.find((each) => (where === "page" ? each.pageIds.includes(id) : each.id === id));
    if (!doc || id === pageId) return;
    if (where === "new") onOp(movePage(session, pageId, { newDocAfter: doc.id, docId: crypto.randomUUID(), name: `${doc.name}-2` }));
    else onOp(movePage(session, pageId, { docId: doc.id, index: where === "page" ? doc.pageIds.indexOf(id) : doc.pageIds.length }));
  }

  return (
    <div class="planche">
      <div class="planche-bar">
        <button type="button" onClick={props.onUndo} disabled={!props.canUndo} aria-label={t.undo} title={t.undo}><Icon name="undo" size={18} /></button>
        <button type="button" class="redo" onClick={props.onRedo} disabled={!props.canRedo} aria-label={t.redo} title={t.redo}><Icon name="undo" size={18} /></button>
        {toCheck > 0 && <button type="button" class="planche-filter" aria-pressed={onlyToCheck} onClick={() => props.onOnlyToCheck(!onlyToCheck)}>{t.toCheck(toCheck)}</button>}
        <label class="button secondary">
          <Icon name="plus" size={18} />{t.addPhotos}
          <input class="visually-hidden" type="file" accept="image/*,.heic,.heif" multiple onChange={(event) => {
            props.onPhotos([...(event.currentTarget.files ?? [])]);
            event.currentTarget.value = "";
          }} />
        </label>
        {props.readingCount > 0 && <span class="planche-reading" role="status">{t.reading(props.readingCount)}</span>}
        <button type="button" class="switch" role="switch" aria-checked={props.searchable} onClick={() => props.onSearchable(!props.searchable)}>
          <span class="track" />{t.searchable}
        </button>
        <button type="button" class="primary" disabled={props.busy || session.documents.length === 0} onClick={() => props.onDownload(session.documents)}>
          <Icon name="download" size={18} />{t.downloadAll}
        </button>
      </div>
      <DndContext sensors={sensors} onDragEnd={dropped}>
        {session.documents.map((doc) => <Row key={doc.id} doc={doc} {...props} />)}
      </DndContext>
    </div>
  );
}

function Row({ doc, session, t, onlyToCheck, busy, onOp, onCorrect, onDownload }: Props & { doc: Doc }) {
  const [name, setName] = useState(doc.name);
  useEffect(() => setName(doc.name), [doc.name]);
  const end = useDroppable({ id: `end:${doc.id}` });
  const fresh = useDroppable({ id: `new:${doc.id}` });
  const pages = doc.pageIds.map((id) => session.pages[id]!).filter((page) => !onlyToCheck || needsCheck(page));
  if (onlyToCheck && pages.length === 0) return null;
  const commit = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== doc.name) onOp({ kind: "rename", docId: doc.id, name: trimmed });
    else setName(doc.name);
  };
  return (
    <section class="planche-row" aria-label={doc.name}>
      <header>
        <input class="planche-name" aria-label={t.rename} value={name} onInput={(event) => setName(event.currentTarget.value)} onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              setName(doc.name);
              event.currentTarget.blur();
            }
          }} />
        <span class="planche-count">{t.pages(doc.pageIds.length)}{doc.reason ? ` · ${doc.reason}` : ""}</span>
        <button type="button" disabled={busy} onClick={() => onDownload([doc])}><Icon name="download" size={18} />{t.download}</button>
        <button type="button" aria-label={t.removeDocument} title={t.removeDocument} onClick={() => {
          if (confirm(t.confirmRemove(doc.name, doc.pageIds.length))) onOp({ kind: "removeDocument", docId: doc.id });
        }}><Icon name="delete" size={18} /></button>
      </header>
      <ol class="planche-pages" ref={end.setNodeRef} data-over={end.isOver || undefined}>
        {pages.map((page) => <Tile key={page.id} page={page} t={t} onOp={onOp} onCorrect={onCorrect} />)}
        {doc.pageIds.length >= 2 && <li class="planche-new" ref={fresh.setNodeRef} data-over={fresh.isOver || undefined}>{t.newDocument}</li>}
      </ol>
    </section>
  );
}

function Tile({ page, t, onOp, onCorrect }: { page: Page; t: ScannerTexts; onOp: (op: Op) => void; onCorrect: (pageId: string) => void }) {
  const drag = useDraggable({ id: page.id });
  const { role: _role, ...handle } = drag.attributes;
  const drop = useDroppable({ id: `page:${page.id}` });
  const thumbnail = useBlobUrl(page.status.kind === "ready" ? page.status.result.thumbnail : undefined);
  const reasons = page.status.kind === "ready" && needsCheck(page) ? page.status.result.detection.reasons.map((reason) => t.reasons[reason]) : [];
  return (
    <li class="planche-page" ref={drop.setNodeRef} data-over={drop.isOver || undefined} data-dragging={drag.isDragging || undefined}
      style={drag.transform ? { transform: `translate(${drag.transform.x}px, ${drag.transform.y}px)` } : undefined}>
      <button type="button" class="planche-open" ref={drag.setNodeRef} {...drag.listeners} {...handle} onClick={() => onCorrect(page.id)}
        aria-label={`${t.correct} · ${page.file.name}`} title={reasons.join("\n") || page.file.name}>
        {thumbnail ? <img src={thumbnail} alt="" draggable={false} /> : page.status.kind === "failed" ? <span role="alert">{t.failures[page.status.error]}</span> : <span class="planche-skeleton" role="status" aria-label={t.waiting} />}
        {reasons.length > 0 && <span class="planche-warning" aria-label={reasons.join(" ")}>⚠</span>}
      </button>
      <button type="button" class="planche-remove" aria-label={t.removePage} title={t.removePage} onClick={() => onOp({ kind: "removePage", pageId: page.id })}>
        <Icon name="close" size={16} />
      </button>
    </li>
  );
}
