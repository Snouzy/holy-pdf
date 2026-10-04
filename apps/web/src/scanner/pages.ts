import { useEffect, useMemo } from "preact/hooks";
import type { Page } from "./session";

/** Every reason to check is about the automatic corners: corners set by hand clear them. */
export function needsCheck(page: Page): boolean {
  return page.status.kind === "ready" && page.edits.quad === undefined && page.status.result.detection.reasons.length > 0;
}

export function useBlobUrl(blob: Blob | undefined): string | undefined {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : undefined), [blob]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  return url;
}
