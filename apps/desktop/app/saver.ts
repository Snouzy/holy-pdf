import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import type { Saver } from "../../web/src/board/deliver";
import { platform } from "./shell";

const folderKey = "holy.saveFolder";
const names: Record<string, string> = { "application/pdf": "PDF", "application/zip": "ZIP", "image/jpeg": "JPEG" };

export const saver: Saver = {
  kind: "save",
  platform,
  async save(bytes, name, type) {
    const folder = localStorage.getItem(folderKey);
    const extension = name.slice(name.lastIndexOf(".") + 1);
    const path = await save({ defaultPath: folder ? `${folder}/${name}` : name, filters: [{ name: names[type] ?? extension.toUpperCase(), extensions: [extension] }] });
    if (!path) return { kind: "cancelled" };
    await writeFile(path, bytes);
    localStorage.setItem(folderKey, path.slice(0, Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"))));
    return { kind: "saved", path };
  },
  open: (path) => openPath(path),
  reveal: (path) => revealItemInDir(path),
};
