import type { ToolId } from "../tools";

/** What the site may tell a measurement tool. Never a file name, a size, a page count or a text: see SECURITY.md. */
export type Measure = { name: "tool_done"; tool: ToolId };

export type Analytics = { track(measure: Measure): void };

declare global {
  /** A global, not a shared module: a module that the board's island and a page script both import becomes one more request before LCP. */
  var holyPdfAnalytics: Analytics | undefined;
}

export function track(measure: Measure): void {
  globalThis.holyPdfAnalytics?.track(measure);
}
