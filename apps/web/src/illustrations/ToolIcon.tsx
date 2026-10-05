import {
  ArrowDownUp, Bandage, BookOpen, Bookmark, Camera, Combine, Crop, Droplet, EyeOff, FileImage, FileMinus, FileOutput, FileText, FoldVertical,
  Globe, Grid2x2, Grid3x3, Hash, Images, Layers, Lock, LockOpen, type LucideIcon, PenLine, RotateCw, ScanText, Scissors, Shrink, Signature,
} from "lucide-preact";
import type { UpcomingId } from "../cast";
import type { ToolId } from "../tools";

const icons: Record<ToolId | UpcomingId, LucideIcon> = {
  merge: Combine,
  split: Scissors,
  organize: ArrowDownUp,
  "delete-pages": FileMinus,
  "extract-pages": FileOutput,
  rotate: RotateCw,
  "jpg-to-pdf": FileImage,
  "pdf-to-jpg": Images,
  compress: Shrink,
  sign: Signature,
  watermark: Droplet,
  "page-numbers": Hash,
  protect: Lock,
  unlock: LockOpen,
  flatten: FoldVertical,
  "pages-per-sheet": Grid2x2,
  "split-in-half": BookOpen,
  pixelize: Grid3x3,
  redact: EyeOff,
  ocr: ScanText,
  "pdf-to-word": FileText,
  scan: Camera,
  overlay: Layers,
  bookmarks: Bookmark,
  crop: Crop,
  edit: PenLine,
  repair: Bandage,
  "web-to-pdf": Globe,
};

/** A tool's line icon, from Lucide: the same stroke as `Icon.tsx`, which started from Feather. */
export function ToolIcon({ id, size = 22 }: { id: ToolId | UpcomingId; size?: number }) {
  const Glyph = icons[id];
  return <Glyph size={size} />;
}
