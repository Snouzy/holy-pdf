import { useState } from "preact/hooks";
import type { Dictionary } from "../i18n/fr";
import { Icon } from "../illustrations/Icon";
import type { Lang, Tool } from "../tools";
import { Failure, RemoveDialog } from "./FileList";
import { FilePicker } from "./FilePicker";
import { formatSize } from "./size";
import type { Doc } from "./state";
import { useThumbnail } from "./thumbnails";

type Props = {
  tool: Tool;
  docs: Doc[];
  sizes: Map<string, number>;
  lang: Lang;
  t: Dictionary;
  onFiles: (files: File[]) => void;
  onPassword: (docId: string, password: string) => void;
  onRetry: (docId: string) => void;
  onRemove: (docId: string) => void;
};

/** For the tools that work on whole files: one card per file, with its first page. */
export function FileCards({ tool, docs, sizes, lang, t, onFiles, ...actions }: Props) {
  const [asking, setAsking] = useState<Doc | null>(null);
  return (
    <div class="file-cards">
      <FilePicker tool={tool} label={t.board.addPdf} onFiles={onFiles} />
      <ul>
        {docs.map((doc, position) => (
          <li key={doc.id} class={`file-card ${doc.status.kind}`}>
            {doc.status.kind === "ready" ? <FirstPage docId={doc.id} position={position} /> : <div class="thumb" />}
            <span class="file-name" title={doc.name}>
              {doc.name}
            </span>
            {doc.status.kind === "ready" && (
              <span class="file-meta">
                {t.board.pageCount(doc.status.pageCount)} · {formatSize(sizes.get(doc.id) ?? 0, lang, t.sizes)}
              </span>
            )}
            {doc.status.kind === "failed" && <Failure docId={doc.id} error={doc.status.error} t={t} {...actions} />}
            <button
              type="button"
              class="file-close"
              aria-label={`${t.board.removeFile}, ${doc.name}`}
              onClick={() => (doc.status.kind === "ready" ? setAsking(doc) : actions.onRemove(doc.id))}
            >
              <Icon name="close" size={16} />
            </button>
          </li>
        ))}
      </ul>
      <p class="drop-more">{t.flow.dropMore}</p>
      <RemoveDialog asking={asking} t={t} onClose={() => setAsking(null)} onRemove={actions.onRemove} />
    </div>
  );
}

function FirstPage({ docId, position }: { docId: string; position: number }) {
  const [ref, url] = useThumbnail(docId, 0, 400, position);
  return (
    <div class="thumb" ref={ref}>
      {url && (
        <span class="page-sheet">
          <img src={url} alt="" decoding="async" />
        </span>
      )}
    </div>
  );
}
