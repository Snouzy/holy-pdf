import { ga4, type Ga4 } from "./ga4";

export function startConsent(): void {
  const root = document.documentElement;
  const banner = () => document.querySelector<HTMLElement>(".consent");
  const id = banner()?.dataset.measurementId;
  if (!id) return;
  let tool: Ga4 | null = null;
  let opener: HTMLElement | null = null;

  const apply = (choice: string | undefined) => {
    if (choice === "granted") {
      if (tool) tool.consent(true);
      else tool = ga4(id);
      globalThis.holyPdfAnalytics = tool;
    } else if (choice === "denied") {
      tool?.consent(false);
      globalThis.holyPdfAnalytics = undefined;
    }
  };

  apply(root.dataset.consent);
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-consent-choice], [data-consent-open]") : null;
    if (!target) return;
    const choice = target.dataset.consentChoice;
    if (choice === undefined) {
      opener = target;
      root.dataset.consent = "ask";
      banner()?.querySelector("button")?.focus();
      return;
    }
    // The inline script of Consent.astro reads this format before the first paint.
    try {
      localStorage.setItem("analytics", `${choice}:${Date.now()}`);
    } catch {}
    root.dataset.consent = choice;
    apply(choice);
    opener?.focus();
    opener = null;
  });
  document.addEventListener("astro:before-swap", (event) => {
    if (root.dataset.consent) event.newDocument.documentElement.dataset.consent = root.dataset.consent;
  });
}
