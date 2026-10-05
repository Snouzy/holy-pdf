import type { Engine } from "../engine/client";
import type { Made } from "./flow";
import { forgetThumbnails } from "./thumbnails";

export type BoardDocument = { files: File[]; unsaved: boolean };

/** What the shell carries to the next tool: the result when there is one, otherwise the sources. */
export function documentOf(sources: File[], made: Made | null, savedMade: Made | null): BoardDocument {
  if (!made) return { files: sources, unsaved: false };
  return { files: made.files.map((file) => new File([file.bytes], file.name, { type: made.type })), unsaved: made !== savedMade };
}

type Held = { docs: { id: string }[]; layer: { docId: string } | null; previews: string[] };

/** The site frees everything by loading the next page; the shell never reloads, so a leaving board must do it. */
export function release(engine: Pick<Engine, "close">, { docs, layer, previews }: Held): void {
  for (const doc of docs) engine.close(doc.id);
  if (layer) engine.close(layer.docId);
  for (const url of previews) URL.revokeObjectURL(url);
  forgetThumbnails();
}
