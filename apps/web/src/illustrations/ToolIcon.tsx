import type { UpcomingId } from "../cast";
import type { ToolId } from "../tools";

const glyphs: Record<ToolId | UpcomingId, string> = {
  merge: "M3 5h7v9H3z M14 10h7v9h-7z M10 9.5h2.5a1.5 1.5 0 0 1 1.5 1.5v1",
  split: "M6 4.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z M6 14.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z M8.2 8.3L20 18 M8.2 15.7L20 6",
  organize: "M4 4h6v7H4z M14 4h6v7h-6z M4 14h6v7H4z M14 17.5h6 M17.5 15l2.5 2.5-2.5 2.5",
  "delete-pages": "M6 3h9l4 4v14H6z M10 12l5 5 M15 12l-5 5",
  "extract-pages": "M5 3h8l3 3v6 M5 3v18h7 M15 15h6 M18 12l3 3-3 3",
  rotate: "M20 12a8 8 0 1 1-2.3-5.7 M20 4v4.5h-4.5",
  "jpg-to-pdf": "M3 6h9v8H3z M4 13l3-3 2 2 1.5-1.5L12 12 M14 4h5l2 2v13h-7z",
  "pdf-to-jpg": "M3 4h5l2 2v13H3z M12 8h9v8h-9z M13 15l3-3 2 2 1.5-1.5L21 14",
  compress: "M4 9h5V4 M20 9h-5V4 M4 15h5v5 M20 15h-5v5",
  "pdf-to-word": "M4 4h16v16H4z M7.5 9l1.8 6 2.7-5 2.7 5 1.8-6",
  "web-to-pdf": "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M3 12h18 M12 3a14 14 0 0 1 0 18 M12 3a14 14 0 0 0 0 18",
  sign: "M3 17c3-6 5-6 6-2s3 4 5-1 3-5 4-2 M3 21h18",
  watermark: "M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z",
  "page-numbers": "M9 4L7 20 M17 4l-2 16 M4 9h16 M3 15h16",
  redact: "M5 6h14 M5 18h9 M5 10h14v4H5z",
  ocr: "M4 8V5a1 1 0 0 1 1-1h3 M16 4h3a1 1 0 0 1 1 1v3 M20 16v3a1 1 0 0 1-1 1h-3 M8 20H5a1 1 0 0 1-1-1v-3 M8 10h8 M8 14h5",
  scan: "M4 8l2-3h12l2 3v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z M12 9.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z",
  protect: "M5 11h14v10H5z M8 11V8a4 4 0 0 1 8 0v3",
  unlock: "M5 11h14v10H5z M8 11V8a4 4 0 0 1 7.5-2",
  flatten: "M12 4l8 4-8 4-8-4z M4 12l8 4 8-4 M4 16l8 4 8-4",
  "pages-per-sheet": "M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z",
  "split-in-half": "M4 5h16v14H4z M12 3v4 M12 10v4 M12 17v4",
  overlay: "M4 8h11v12H4z M9 4h11v12h-3 M9 4v4",
  bookmarks: "M5 4h14v16H5z M13 4v8l2.5-2 2.5 2V4",
  crop: "M6 2v16h16 M2 6h16v16",
  edit: "M4 20l4-1 11-11-3-3L5 16z M14 6l3 3",
  repair: "M4.5 13.5l9-9a3 3 0 0 1 4.2 0l1.8 1.8a3 3 0 0 1 0 4.2l-9 9a3 3 0 0 1-4.2 0l-1.8-1.8a3 3 0 0 1 0-4.2z M10 10l4 4",
  pixelize: "M4 4h6v6H4z M14 4h6v6h-6z M9 10h6v4H9z M4 14h6v6H4z M14 14h6v6h-6z",
};

export function ToolIcon({ id, size = 22 }: { id: ToolId | UpcomingId; size?: number }) {
  return (
    <svg class="tool-glyph" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d={glyphs[id]} />
    </svg>
  );
}
