import { useEffect, useRef } from "preact/hooks";
import { dropTracker } from "./dropTracker";

/** Files dropped anywhere in the window. One island per page calls it; Base.astro draws the veil while `data-dropping` is set. */
export function useFileDrop(onFiles: (files: File[]) => void): void {
  const latest = useRef(onFiles);
  latest.current = onFiles;
  useEffect(() => {
    const root = document.documentElement;
    const tracker = dropTracker(
      (over) => root.toggleAttribute("data-dropping", over),
      (files) => latest.current(files),
    );
    const types = ["dragenter", "dragleave", "dragover", "drop"] as const;
    for (const type of types) window.addEventListener(type, tracker[type]);
    return () => {
      for (const type of types) window.removeEventListener(type, tracker[type]);
      root.removeAttribute("data-dropping");
    };
  }, []);
}
