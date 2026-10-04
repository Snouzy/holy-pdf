import { useEffect, useState } from "preact/hooks";
import type { Engine } from "../engine/client";
import type { PageSize } from "../engine/types";
import { previewWidth } from "./geometry";

/** `shown`: null while the page loads; its `url` null when it could not be drawn. */
export function usePagePreview(engine: Pick<Engine, "thumbnail">, docId: string, pageIndex: number, size: PageSize | undefined) {
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState<{ key: string; url: string | null } | null>(null);
  const key = `${docId}:${pageIndex}:${attempt}`;

  useEffect(() => {
    const width = size && previewWidth(size);
    if (!width) {
      setPreview({ key, url: null });
      return;
    }
    let active = true, url: string | undefined;
    engine.thumbnail(docId, pageIndex, width).then((result) => {
      if (!active) return;
      if (result.ok) url = URL.createObjectURL(result.value);
      setPreview({ key, url: url ?? null });
    }, () => active && setPreview({ key, url: null }));
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [key]);

  return { shown: preview?.key === key ? preview : null, retry: () => setAttempt((count) => count + 1) };
}
