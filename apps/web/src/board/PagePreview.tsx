import { useEffect, useRef, useState } from "preact/hooks";
import type { PageSize } from "../engine/types";
import type { Dictionary } from "../i18n/fr";
import { Icon } from "../illustrations/Icon";
import { engine } from "./engine";
import type { PageRef } from "./state";

type Props = {
  pages: PageRef[];
  sizeOf: (page: PageRef) => PageSize;
  labelOf: (page: PageRef) => string;
  index: number | null;
  onIndex: (index: number | null) => void;
  t: Dictionary;
};

/** The Swift app's sheet rendered the long side at 1 600 px at most: enough for a screen, cheap enough for a 200-page scan. */
const maxSide = 1600;
/** A held arrow key must not queue one render per page on the worker. */
const settle = 100;

/** One page at a time, as big as the window allows: the click on a thumbnail, the arrows, Échap. */
export function PagePreview({ pages, sizeOf, labelOf, index, onIndex, t }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const urls = useRef(new Map<string, string>());
  const pending = useRef(new Set<string>());
  const failed = useRef(new Set<string>());
  const closing = useRef(false);
  const latest = useRef({ index, count: pages.length });
  latest.current = { index, count: pages.length };
  const [, landed] = useState(0);
  const page = index === null ? undefined : pages[index];
  const key = page ? `${page.docId}:${page.index}:${page.rotation}` : null;
  const url = key ? (urls.current.get(key) ?? null) : null;

  function step(by: number) {
    const { index: current, count } = latest.current;
    if (current === null) return;
    const next = current + by;
    if (next >= 0 && next < count) onIndex(next);
  }

  // Runs after every render and reconciles, because Preact runs the effect it queued last, not one per render:
  // two state changes in one frame would otherwise open the dialog for a state already gone.
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (!page || key === null) {
      if (element.open) {
        closing.current = true;
        element.close();
      }
      for (const made of urls.current.values()) URL.revokeObjectURL(made);
      urls.current.clear();
      failed.current.clear();
      return;
    }
    if (!element.open) element.showModal();
    const sheet = frame.current;
    if (!sheet || urls.current.has(key) || pending.current.has(key) || failed.current.has(key)) return;
    const timer = setTimeout(() => {
      const sideways = page.rotation % 180 !== 0;
      const size = sizeOf(page);
      const box = sideways ? { width: sheet.clientHeight, height: sheet.clientWidth } : { width: sheet.clientWidth, height: sheet.clientHeight };
      const shown = Math.min(box.width, (box.height * size.width) / size.height) * devicePixelRatio;
      const width = Math.round(Math.min(shown, maxSide * Math.min(1, size.width / size.height)));
      pending.current.add(key);
      void engine.thumbnail(page.docId, page.index, width).then((result) => {
        pending.current.delete(key);
        if (result.ok) urls.current.set(key, URL.createObjectURL(result.value));
        else failed.current.add(key);
        landed((count) => count + 1);
      });
    }, settle);
    return () => clearTimeout(timer);
  });

  // On the document: in Chromium a click focuses the button, and a button that turns disabled drops the focus to body.
  useEffect(() => {
    if (index === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") step(-1);
      else if (event.key === "ArrowRight") step(1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index === null]);

  return (
    <dialog
      ref={dialog}
      class="preview"
      aria-label={t.board.preview}
      onCancel={(event) => {
        event.preventDefault();
        onIndex(null);
      }}
      onClose={() => {
        // The close event of a close the effect asked for arrives late, maybe after a reopen: it says nothing new.
        if (closing.current) closing.current = false;
        else onIndex(null);
      }}
    >
      {page && key !== null && index !== null && (
        <>
          <div class="preview-head">
            <p class="preview-title">{labelOf(page)}</p>
            <button type="button" aria-label={t.board.closePreview} onClick={() => onIndex(null)}>
              <Icon name="close" size={20} />
            </button>
          </div>
          <div class="preview-sheet">
            <div ref={frame} class={page.rotation % 180 !== 0 ? "preview-frame sideways" : "preview-frame"}>
              {url ? (
                <img src={url} alt="" style={{ transform: `rotate(${page.rotation}deg)` }} />
              ) : failed.current.has(key) ? (
                <p class="preview-failed">{t.board.previewFailed}</p>
              ) : (
                <span class="preview-loading" />
              )}
            </div>
          </div>
          <div class="preview-nav">
            <button type="button" aria-label={t.board.previousPage} disabled={index === 0} onClick={() => step(-1)}>
              <Icon name="back" size={20} />
            </button>
            <p>{t.board.pageOf(index + 1, pages.length)}</p>
            <button type="button" aria-label={t.board.nextPage} disabled={index === pages.length - 1} onClick={() => step(1)}>
              <Icon name="arrow" size={20} />
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
