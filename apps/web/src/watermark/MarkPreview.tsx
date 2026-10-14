import { useRef, useState } from "preact/hooks";
import type { DocumentSkeleton } from "../board/DocumentSkeleton";
import type { Engine } from "../engine/client";
import { markLines } from "../engine/markLayout";
import type { PageSize, Watermark } from "../engine/types";
import type { Dictionary } from "../i18n/fr";
import { Icon } from "../illustrations/Icon";
import { usePagePreview } from "../signature/pagePreview";
import "./markPreview.css";

type Props = {
  docs: { id: string; name: string; sizes: PageSize[] }[];
  mark: Watermark;
  /** Passed by Board, not imported: a module shared with Board's chunk becomes one more request before LCP on every tool page. */
  engine: Pick<Engine, "thumbnail">;
  t: Dictionary;
  Skeleton: typeof DocumentSkeleton;
};

/** One page as the file will come out, the arrows through every page of every file. */
export function MarkPreview({ docs, mark, engine, t, Skeleton }: Props) {
  const pages = docs.flatMap((doc) => doc.sizes.map((size, pageIndex) => ({ doc, size, pageIndex })));
  const [wanted, setWanted] = useState(0);
  const sheet = useRef<HTMLDivElement>(null);
  const index = Math.min(wanted, pages.length - 1);
  const { doc, size, pageIndex } = pages[index]!;
  const { shown } = usePagePreview(engine, doc.id, pageIndex, size, sheet);
  const marked = pageIndex + 1 >= mark.from && pageIndex + 1 <= mark.to;
  return (
    <div class="mark-preview">
      <div class="mark-sheet" ref={sheet} style={{ aspectRatio: `${size.width} / ${size.height}`, "--page-ratio": size.width / size.height }} aria-busy={!shown}>
        {shown?.url ? <img src={shown.url} alt={t.board.pageOfFile(doc.name, pageIndex + 1)} /> : !shown && <Skeleton label={t.board.opening} />}
        {marked && (
          <svg viewBox={`0 0 ${size.width} ${size.height}`} aria-hidden="true">
            <g fill={`rgb(${mark.color.join(" ")})`} fill-opacity={mark.opacity}>
              {markLines(size, mark).map((line, key) => (
                <text key={key} transform={`translate(${line.origin.x} ${line.origin.y}) rotate(${-mark.angle})`} font-size={line.size} textLength={line.width} lengthAdjust="spacing">{line.text}</text>
              ))}
            </g>
          </svg>
        )}
      </div>
      {pages.length > 1 && (
        <div class="mark-pager">
          <button type="button" aria-label={t.board.previousPage} disabled={index === 0} onClick={() => setWanted(index - 1)}><Icon name="back" size={20} /></button>
          <p>{docs.length > 1 && <span class="file-name">{doc.name}</span>}{t.board.pageOf(pageIndex + 1, doc.sizes.length)}</p>
          <button type="button" aria-label={t.board.nextPage} disabled={index === pages.length - 1} onClick={() => setWanted(index + 1)}><Icon name="arrow" size={20} /></button>
        </div>
      )}
    </div>
  );
}
