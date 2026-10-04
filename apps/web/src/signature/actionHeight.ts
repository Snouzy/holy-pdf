import type { RefObject } from "preact";
import { useLayoutEffect } from "preact/hooks";

/** On a narrow screen the action bar sticks to the bottom: the page toolbar sticks just above it. */
export function useActionHeight(workspace: RefObject<HTMLElement>): void {
  useLayoutEffect(() => {
    const element = workspace.current;
    const action = element?.closest(".board")?.querySelector<HTMLElement>(".go");
    if (!element || !action) return;
    const measure = () => element.style.setProperty("--signature-action-height", `${action.getBoundingClientRect().height}px`);
    const observer = new ResizeObserver(measure);
    observer.observe(action);
    measure();
    return () => observer.disconnect();
  }, []);
}
