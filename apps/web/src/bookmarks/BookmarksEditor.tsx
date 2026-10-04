import { useRef, useState } from "preact/hooks";
import type { DocumentSkeleton } from "../board/DocumentSkeleton";
import type { Engine } from "../engine/client";
import type { PageSize } from "../engine/types";
import { Icon } from "../illustrations/Icon";
import { useActionHeight } from "../signature/actionHeight";
import { usePagePreview } from "../signature/pagePreview";
import type { Lang } from "../tools";
import { added, type BookmarksDraft, removed, type Row, settled } from "./outline";
import "../signature/signature.css";
import "./bookmarks.css";

export { canSave } from "./outline";

const en = {
  title: "Title of the bookmark", add: (page: number) => `Add a bookmark to page ${page}`, defaultTitle: (page: number) => `Page ${page}`,
  hint: "Show a page with the arrows under the preview, then add its bookmark.",
  count: (count: number) => `Bookmarks: ${count}`, none: "This PDF has no bookmark yet.",
  skipped: (count: number) => `Bookmarks that lead to no page of this PDF: ${count}. The copy does not keep them.`,
  show: "Show this page", deeper: "Put under the bookmark above", shallower: "Move up one level", remove: "Remove this bookmark",
  previous: "Previous page", next: "Next page", page: "Page", of: "of",
  preview: "PDF page preview", loading: "Loading the page…", previewError: "This page could not be displayed.", retry: "Retry preview",
};
const fr: typeof en = {
  title: "Titre du signet", add: (page) => `Ajouter un signet à la page ${page}`, defaultTitle: (page) => `Page ${page}`,
  hint: "Affichez une page avec les flèches sous l'aperçu, puis ajoutez son signet.",
  count: (count) => `Signets : ${count}`, none: "Ce PDF n'a pas encore de signet.",
  skipped: (count) => `Signets qui ne mènent à aucune page de ce PDF : ${count}. La copie ne les garde pas.`,
  show: "Afficher cette page", deeper: "Ranger sous le signet du dessus", shallower: "Remonter d'un niveau", remove: "Retirer ce signet",
  previous: "Page précédente", next: "Page suivante", page: "Page", of: "sur",
  preview: "Aperçu de la page PDF", loading: "Chargement de la page…", previewError: "Cette page n'a pas pu être affichée.", retry: "Réessayer l'aperçu",
};
const texts = { en, fr };

export type BookmarksProps = {
  sizes: PageSize[]; lang: Lang; value: BookmarksDraft; onChange: (update: (draft: BookmarksDraft) => BookmarksDraft) => void; disabled: boolean;
  /** Passed by Board, not imported: a module shared with Board's chunk becomes one more request before LCP on every tool page. */
  engine: Pick<Engine, "thumbnail">; Skeleton: typeof DocumentSkeleton;
};

export function BookmarksWorkspace({ sizes, lang, value, onChange, disabled, engine, Skeleton }: BookmarksProps) {
  const t = texts[lang];
  const { docId, pageIndex } = value;
  const size = sizes[pageIndex];
  const { shown, retry } = usePagePreview(engine, docId, pageIndex, size);
  const workspace = useRef<HTMLDivElement>(null);
  useActionHeight(workspace);
  const goTo = (index: number) => onChange((draft) => ({ ...draft, pageIndex: index }));
  const marked = new Set(value.rows.map((row) => row.bookmark.pageIndex));
  return <div class="signature-workspace" ref={workspace}>
    {shown && !shown.url && <p role="alert">{t.previewError} <button type="button" onClick={retry}>{t.retry}</button></p>}
    {size && <div class="bookmarks-sheet" style={{ aspectRatio: `${size.width} / ${size.height}`, "--page-ratio": size.width / size.height }} aria-busy={!shown}>
      {shown?.url ? <img src={shown.url} alt={`${t.preview} ${pageIndex + 1}`} /> : !shown && <Skeleton label={t.loading} />}
    </div>}
    <div class="signature-pagination">
      <div class="signature-toolbar-group">
        <button type="button" disabled={disabled || pageIndex === 0} onClick={() => goTo(pageIndex - 1)} aria-label={t.previous}>←</button>
        <label>{t.page} <select aria-label={t.page} value={pageIndex} disabled={disabled} onChange={(event) => goTo(Number(event.currentTarget.value))}>
          {sizes.map((_, index) => <option value={index} key={index}>{index + 1}{marked.has(index) ? " •" : ""}</option>)}
        </select> {t.of} {sizes.length}</label>
        <button type="button" disabled={disabled || pageIndex >= sizes.length - 1} onClick={() => goTo(pageIndex + 1)} aria-label={t.next}>→</button>
      </div>
    </div>
  </div>;
}

export function BookmarksOptions({ lang, value, onChange, disabled }: BookmarksProps) {
  const t = texts[lang];
  const [title, setTitle] = useState("");
  const page = value.pageIndex + 1;
  const change = (edit: (rows: Row[]) => Row[]) => onChange((draft) => ({ ...draft, rows: settled(edit(draft.rows)), edited: true }));
  const edit = (id: number, update: (row: Row) => Row) => change((rows) => rows.map((row) => (row.id === id ? update(row) : row)));

  function add(event: Event) {
    event.preventDefault();
    const name = title.trim() || t.defaultTitle(page);
    change((rows) => added(rows, value.pageIndex, name, Math.max(-1, ...rows.map((row) => row.id)) + 1));
    setTitle("");
  }

  return <div class="bookmarks-options">
    <form class="bookmarks-add" onSubmit={add}>
      <label class="mark-text">{t.title}
        <input type="text" value={title} placeholder={t.defaultTitle(page)} disabled={disabled} onInput={(event) => setTitle(event.currentTarget.value)} />
      </label>
      <button type="submit" disabled={disabled}><Icon name="plus" size={18} />{t.add(page)}</button>
    </form>
    <p class="signature-hint">{t.hint}</p>
    <h3 class="bookmarks-count">{t.count(value.rows.length)}</h3>
    {value.rows.length === 0 && <p class="signature-hint">{t.none}</p>}
    {value.skipped > 0 && <p class="signature-hint">{t.skipped(value.skipped)}</p>}
    {value.rows.length > 0 && <ol class="bookmarks-list">
      {value.rows.map(({ id, bookmark }, index) => <li key={id} style={{ "--level": bookmark.level }}>
        <input type="text" aria-label={t.title} value={bookmark.title} disabled={disabled} aria-invalid={bookmark.title.trim() === ""}
          onInput={(event) => { const next = event.currentTarget.value; edit(id, (row) => ({ ...row, bookmark: { ...row.bookmark, title: next } })); }} />
        <button type="button" class="bookmarks-page" title={t.show} disabled={disabled}
          onClick={() => onChange((draft) => ({ ...draft, pageIndex: bookmark.pageIndex }))}>p. {bookmark.pageIndex + 1}</button>
        <button type="button" aria-label={t.shallower} title={t.shallower} disabled={disabled || bookmark.level === 0}
          onClick={() => edit(id, (row) => ({ ...row, bookmark: { ...row.bookmark, level: row.bookmark.level - 1 } }))}><Icon name="back" size={16} /></button>
        <button type="button" aria-label={t.deeper} title={t.deeper} disabled={disabled || index === 0 || bookmark.level > value.rows[index - 1]!.bookmark.level}
          onClick={() => edit(id, (row) => ({ ...row, bookmark: { ...row.bookmark, level: row.bookmark.level + 1 } }))}><Icon name="arrow" size={16} /></button>
        <button type="button" aria-label={t.remove} title={t.remove} disabled={disabled}
          onClick={() => change((rows) => removed(rows, id))}><Icon name="delete" size={16} /></button>
      </li>)}
    </ol>}
  </div>;
}
