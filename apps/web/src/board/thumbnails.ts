import type { RefObject } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { engine } from "./engine";

type Wanted = { key: string; docId: string; index: number; width: number; position: number; deliver: (url: string) => void };

/** Two requests in flight keep the worker busy; more would queue pages that scrolling may take off screen. */
const maxInFlight = 2;

const urls = new Map<string, string>();
const watched = new Map<Element, Wanted>();
const nearScreen = new Map<string, Wanted>();
let inFlight = 0;
let observer: IntersectionObserver | undefined;

export function forgetThumbnails(): void {
  for (const url of urls.values()) URL.revokeObjectURL(url);
  urls.clear();
}

export function useThumbnail(docId: string, index: number, width: number, position: number): [RefObject<HTMLDivElement>, string | null] {
  const ref = useRef<HTMLDivElement>(null);
  const key = `${docId}:${index}:${width}`;
  const [url, setUrl] = useState(() => urls.get(key) ?? null);

  useEffect(() => {
    const element = ref.current;
    if (url || !element) return;
    observer ??= new IntersectionObserver(onIntersection, { rootMargin: "300px 0px" });
    watched.set(element, { key, docId, index, width, position, deliver: setUrl });
    observer.observe(element);
    return () => {
      observer?.unobserve(element);
      watched.delete(element);
      nearScreen.delete(key);
    };
  }, [key, url]);

  return [ref, url];
}

function onIntersection(entries: IntersectionObserverEntry[]): void {
  for (const entry of entries) {
    const wanted = watched.get(entry.target);
    if (!wanted) continue;
    if (entry.isIntersecting) nearScreen.set(wanted.key, wanted);
    else nearScreen.delete(wanted.key);
  }
  requestNext();
}

function requestNext(): void {
  while (inFlight < maxInFlight && nearScreen.size > 0) {
    const next = [...nearScreen.values()].reduce((best, candidate) => (candidate.position < best.position ? candidate : best));
    nearScreen.delete(next.key);
    inFlight++;
    void engine.thumbnail(next.docId, next.index, next.width).then((result) => {
      inFlight--;
      if (result.ok) {
        const url = URL.createObjectURL(result.value);
        urls.set(next.key, url);
        next.deliver(url);
      }
      requestNext();
    });
  }
}
