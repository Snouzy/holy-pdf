import { useEffect, useRef, useState } from "preact/hooks";
import type { EngineError } from "../engine/types";
import type { Dictionary } from "../i18n/fr";
import { Icon } from "../illustrations/Icon";
import type { Lang } from "../tools";
import { formatSize } from "./size";
import type { Doc } from "./state";

type Actions = {
  onPassword: (docId: string, password: string) => void;
  onRetry: (docId: string) => void;
  onRemove: (docId: string) => void;
};

type Props = { docs: Doc[]; sizes: Map<string, number>; lang: Lang; t: Dictionary } & Actions;

/** The six file colors, in turn. A file's tab and its pages share one. */
export function fileColor(index: number): number {
  return (index % 6) + 1;
}

export function FileList({ docs, sizes, lang, t, ...actions }: Props) {
  const [asking, setAsking] = useState<Doc | null>(null);

  const row = useRef<HTMLUListElement>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const list = row.current;
    if (!list) return;
    const check = () => setMore(list.scrollLeft + list.clientWidth < list.scrollWidth - 1);
    check();
    list.addEventListener("scroll", check, { passive: true });
    const resize = new ResizeObserver(check);
    resize.observe(list);
    for (const tab of list.children) resize.observe(tab);
    return () => {
      list.removeEventListener("scroll", check);
      resize.disconnect();
    };
  }, [docs]);

  return (
    <>
    <ul ref={row} class={more ? "file-tabs more" : "file-tabs"}>
      {docs.map((doc, index) => (
        <li key={doc.id} class={`file-tab ${doc.status.kind}`} data-file={fileColor(index)}>
          <span class="file-name" title={doc.name}>
            {doc.status.kind === "failed" && isPassword(doc.status.error) && <Icon name="lock" size={16} />}
            {doc.name}
          </span>
          {doc.status.kind === "ready" && (
            <span class="file-meta">
              {t.board.pageCount(doc.status.pageCount)} · {formatSize(sizes.get(doc.id) ?? 0, lang, t.sizes)}
            </span>
          )}
          {doc.status.kind === "opening" && <span class="file-shimmer" aria-hidden="true" />}
          <button type="button" class="file-close" aria-label={`${t.board.removeFile}, ${doc.name}`} onClick={() => (doc.status.kind === "ready" ? setAsking(doc) : actions.onRemove(doc.id))}>
            <Icon name="close" size={16} />
          </button>
          {doc.status.kind === "failed" && <Failure docId={doc.id} error={doc.status.error} t={t} {...actions} />}
        </li>
      ))}
    </ul>
    <RemoveDialog asking={asking} t={t} onClose={() => setAsking(null)} onRemove={actions.onRemove} />
    </>
  );
}

export function RemoveDialog({ asking, t, onClose, onRemove }: { asking: Doc | null; t: Dictionary; onClose: () => void; onRemove: (docId: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (asking) dialog.current?.showModal();
  }, [asking]);
  return (
    <dialog ref={dialog} class="confirm" onClose={onClose}>
      {asking && (
        <form method="dialog">
          <p>{t.board.removeConfirm(asking.name)}</p>
          <div class="confirm-actions">
            <button type="submit">{t.board.keep}</button>
            <button type="submit" class="primary" onClick={() => onRemove(asking.id)}>
              {t.board.removeConfirmed}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}

function isPassword(error: EngineError): boolean {
  return error.kind === "passwordRequired" || error.kind === "wrongPassword";
}

export function Failure({ docId, error, t, onPassword, onRetry }: { docId: string; error: EngineError; t: Dictionary } & Actions) {
  const [password, setPassword] = useState("");
  const canRetry = error.kind === "engineUnavailable" || error.kind === "outOfMemory";
  return (
    <>
      <span class="error" role="alert">{t.errors[error.kind]}</span>
      {isPassword(error) && (
        <form
          class="password"
          onSubmit={(event) => {
            event.preventDefault();
            onPassword(docId, password);
          }}
        >
          <label>
            {t.password.label}{" "}
            <input type="password" autocomplete="off" value={password} onInput={(event) => setPassword(event.currentTarget.value)} />
          </label>
          <button type="submit">{t.password.submit}</button>
          <small>{t.password.notice}</small>
        </form>
      )}
      {canRetry && (
        <button type="button" onClick={() => onRetry(docId)}>
          {t.retry}
        </button>
      )}
    </>
  );
}
