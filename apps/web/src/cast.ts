import type { Accessory, Mood } from "./illustrations/Monk";
import type { SceneKind } from "./illustrations/Scene";
import { type ToolId, toolIds } from "./tools";

export const categories = ["organize", "convert", "edit", "optimize", "security"] as const;
export type Category = (typeof categories)[number];

export type ToolMonk = { accessory: Accessory; mood: Mood; scene: SceneKind; category: Category; emoji: string };

export const cast: Record<ToolId, ToolMonk> = {
  merge: { accessory: "stapler", mood: "joy", scene: "merge", category: "organize", emoji: "📎" },
  split: { accessory: "scissors", mood: "focus", scene: "split", category: "organize", emoji: "✂️" },
  organize: { accessory: "sheet", mood: "happy", scene: "organize", category: "organize", emoji: "🗂️" },
  "delete-pages": { accessory: "eraser", mood: "focus", scene: "delete", category: "organize", emoji: "🗑️" },
  "extract-pages": { accessory: "loupe", mood: "happy", scene: "extract", category: "organize", emoji: "🔍" },
  rotate: { accessory: "arrows", mood: "joy", scene: "rotate", category: "organize", emoji: "🔄" },
  "jpg-to-pdf": { accessory: "frame", mood: "happy", scene: "images", category: "convert", emoji: "📸" },
  "pdf-to-jpg": { accessory: "frame", mood: "happy", scene: "pdf-to-jpg", category: "convert", emoji: "🖼️" },
  compress: { accessory: "book", mood: "focus", scene: "compress", category: "optimize", emoji: "🗜️" },
  sign: { accessory: "quill", mood: "focus", scene: "sign", category: "edit", emoji: "✍️" },
  watermark: { accessory: "stamp", mood: "focus", scene: "watermark", category: "edit", emoji: "💧" },
  "page-numbers": { accessory: "sheet", mood: "focus", scene: "page-numbers", category: "edit", emoji: "🔢" },
  protect: { accessory: "lock", mood: "focus", scene: "protect", category: "security", emoji: "🔒" },
  unlock: { accessory: "lock", mood: "happy", scene: "unlock", category: "security", emoji: "🔓" },
  flatten: { accessory: "book", mood: "happy", scene: "flatten", category: "optimize", emoji: "📄" },
  "pages-per-sheet": { accessory: "sheet", mood: "happy", scene: "pages-per-sheet", category: "organize", emoji: "🔲" },
  "split-in-half": { accessory: "scissors", mood: "focus", scene: "split-in-half", category: "organize", emoji: "📖" },
  pixelize: { accessory: "frame", mood: "focus", scene: "pixelize", category: "convert", emoji: "🎞️" },
  redact: { accessory: "eraser", mood: "focus", scene: "redact", category: "edit", emoji: "⬛" },
  ocr: { accessory: "loupe", mood: "focus", scene: "ocr", category: "optimize", emoji: "🔤" },
  "pdf-to-word": { accessory: "quill", mood: "happy", scene: "pdf-to-word", category: "convert", emoji: "📝" },
  scan: { accessory: "phone", mood: "happy", scene: "scan", category: "optimize", emoji: "📸" },
  overlay: { accessory: "stamp", mood: "joy", scene: "overlay", category: "edit", emoji: "📑" },
  bookmarks: { accessory: "book", mood: "joy", scene: "bookmarks", category: "organize", emoji: "🔖" },
  crop: { accessory: "frame", mood: "joy", scene: "crop", category: "edit", emoji: "📐" },
  edit: { accessory: "quill", mood: "joy", scene: "edit", category: "edit", emoji: "✏️" },
  repair: { accessory: "stapler", mood: "focus", scene: "repair", category: "optimize", emoji: "🩹" },
};

export const upcomingIds = [
  "web-to-pdf",
] as const;
export type UpcomingId = (typeof upcomingIds)[number];

export const upcoming: Record<UpcomingId, { accessory: Accessory; category: Category }> = {
  "web-to-pdf": { accessory: "book", category: "convert" },
};

export function byCategory(): { category: Category; ready: ToolId[]; sleeping: UpcomingId[] }[] {
  return categories.map((category) => ({
    category,
    ready: toolIds.filter((id) => cast[id].category === category),
    sleeping: upcomingIds.filter((id) => upcoming[id].category === category),
  }));
}

export const titleEmoji = { home: "🙏", atWork: "🤲", uses: "📜", privacy: "🤫", story: "📖", done: "🙌", cta: "😇", oops: "🙈" } as const;
