import {
  type Announcements,
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { a4 } from "../engine/imagePage";
import type { PageSize } from "../engine/types";
import type { Dictionary } from "../i18n/fr";
import { Icon } from "../illustrations/Icon";
import type { Lang, Tool } from "../tools";
import { FilePicker } from "./FilePicker";
import { fileColor } from "./FileList";
import type { Action, Board, PageRef } from "./state";
import { formatSize } from "./size";
import { useThumbnail } from "./thumbnails";

/** CSS pixels. Thumbnails render at twice this size, for sharp screens. */
const cellSize = 150;

type Props = {
  board: Board;
  tool: Tool;
  t: Dictionary;
  lang: Lang;
  sizes: Map<string, number>;
  dispatch: (action: Action) => void;
  onFiles: (files: File[]) => void;
};

export function PageGrid({ board, tool, t, lang, sizes, dispatch, onFiles }: Props) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const names = new Map(board.docs.map((doc) => [doc.id, doc.name]));
  const pageSizes = new Map(board.docs.flatMap((doc) => (doc.status.kind === "ready" ? [[doc.id, doc.status.sizes] as const] : [])));
  const colors = new Map(board.docs.map((doc, index) => [doc.id, fileColor(index)]));
  const images = tool.accepts === "image";
  const severalFiles = board.docs.length > 1;
  const labels = new Map(
    board.pages.map((page) => {
      const name = names.get(page.docId) ?? "";
      const number = page.index + 1;
      return [page.id, images ? name : severalFiles ? t.board.pageOfFile(name, number) : t.board.page(number)];
    }),
  );
  const tipOf = (page: PageRef) => {
    const label = labels.get(page.id) ?? "";
    return images ? [label, formatSize(sizes.get(page.docId) ?? 0, lang, t.sizes)] : [label];
  };
  const labelOf = (id: UniqueIdentifier) => labels.get(String(id)) ?? String(id);
  const announcements: Announcements = {
    onDragStart: ({ active }) => t.board.pickedUp(labelOf(active.id)),
    onDragOver: ({ active, over }) =>
      over && over.id !== active.id ? t.board.movedOver(labelOf(active.id), labelOf(over.id)) : undefined,
    onDragEnd: ({ active, over }) =>
      over ? t.board.dropped(labelOf(active.id), labelOf(over.id)) : t.board.cancelled(labelOf(active.id)),
    onDragCancel: ({ active }) => t.board.cancelled(labelOf(active.id)),
  };

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    dispatch({ type: "pageMoved", pageId: String(active.id), toIndex: board.pages.findIndex((page) => page.id === over.id) });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{ announcements, screenReaderInstructions: { draggable: t.board.dragInstructions } }}
    >
      <SortableContext items={board.pages.map((page) => page.id)} strategy={rectSortingStrategy}>
        <ol class="pages">
          {board.pages.map((page, position) => (
              <PageCell
                key={page.id}
                page={page}
                size={pageSizes.get(page.docId)?.[page.index] ?? a4}
                label={labelOf(page.id)}
                tip={tipOf(page)}
                position={position}
                tool={tool}
                t={t}
                selected={board.selected.includes(page.id)}
                cut={board.cuts.includes(page.id)}
                last={position === board.pages.length - 1}
                dispatch={dispatch}
                color={colors.get(page.docId) ?? 1}
              />
          ))}
          {board.docs
            .filter((doc) => doc.status.kind === "opening")
            .map((doc) => (
              <li key={doc.id} class="page skeleton" aria-busy="true" data-file={colors.get(doc.id) ?? 1}>
                <div class="thumb" />
                <p class="caption" title={doc.name}>{doc.name}</p>
                <span class="visually-hidden">{t.board.opening}</span>
              </li>
            ))}
          <li class="add-tile">
            <FilePicker tool={tool} label={tool.multipleFiles ? (tool.accepts === "image" ? t.board.addImages : t.board.addPdf) : t.board.replaceFile} onFiles={onFiles} />
          </li>
        </ol>
      </SortableContext>
    </DndContext>
  );
}

type CellProps = {
  page: PageRef;
  size: PageSize;
  label: string;
  tip: string[];
  position: number;
  tool: Tool;
  t: Dictionary;
  selected: boolean;
  cut: boolean;
  last: boolean;
  dispatch: (action: Action) => void;
  color: number;
};

function PageCell({ page, size, label, tip, position, tool, t, selected, cut, last, dispatch, color }: CellProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id });
  // dnd-kit types `role` as string; Preact wants an ARIA role. Its value is always "button".
  const { role: _role, ...handle } = attributes;
  const renderWidth = Math.round(cellSize * 2 * Math.min(1, size.width / size.height));
  const [thumbRef, url] = useThumbnail(page.docId, page.index, renderWidth, position);

  return (
    <li
      ref={setNodeRef}
      class={isDragging ? "page dragging" : selected ? "page selected" : "page"}
      data-file={color}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div class="thumb" ref={thumbRef} role="button" {...handle} {...listeners} aria-label={label}>
        {url && (
          <span class="page-sheet" style={{ transform: `rotate(${page.rotation}deg)` }}>
            <img src={url} alt="" decoding="async" />
          </span>
        )}
      </div>
      <div class="caption-box">
        <p class="caption">{label}</p>
        <span class="caption-tip" aria-hidden="true">
          {tip.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </span>
      </div>
      <div class="controls">
        <button type="button" aria-label={`${t.board.rotate}, ${label}`} onClick={() => dispatch({ type: "pageRotated", pageId: page.id })}>
          <Icon name="rotate" size={18} />
        </button>
        <button type="button" class="remove" aria-label={`${t.board.remove}, ${label}`} onClick={() => dispatch({ type: "pageRemoved", pageId: page.id })}>
          <Icon name="delete" size={18} />
        </button>
        {tool.output === "selection" && (
          <input
            type="checkbox"
            aria-label={`${t.board.select}, ${label}`}
            checked={selected}
            onChange={() => dispatch({ type: "selectionToggled", pageId: page.id })}
          />
        )}
      </div>
      {tool.output === "split" && !last && (
        <button
          type="button"
          class={cut ? "cut on" : "cut"}
          aria-pressed={cut}
          aria-label={`${t.board.cutAfter}, ${label}`}
          onClick={() => dispatch({ type: "cutToggled", afterPageId: page.id })}
        >
          <Icon name="cut" size={22} />
        </button>
      )}
    </li>
  );
}
