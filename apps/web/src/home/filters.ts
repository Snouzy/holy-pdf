import { type SearchEntry, type SearchIndex, searchTools } from "./search";

let refresh = () => {};

function setup() {
  const section = document.querySelector<HTMLElement>(".monastery");
  const input = section?.querySelector("input");
  const status = section?.querySelector<HTMLElement>(".search-status");
  const pills = section?.querySelector<HTMLElement>(".categories");
  const sleepers = section?.querySelector('[role="switch"]');
  const list = section?.querySelector(".cards");
  const empty = section?.querySelector<HTMLElement>(".no-result");
  if (!section || !input || !status || !pills || !sleepers || !list || !empty || section.dataset.live !== undefined) return;
  section.dataset.live = "";
  let index: SearchIndex | undefined;
  const counts = (status.dataset.count ?? "").split("|");
  const tools = [...section.querySelectorAll<HTMLElement>("[data-tool]")];
  const strips = [pills, ...section.querySelectorAll<HTMLElement>(".compact ul")];
  const fade = (strip: HTMLElement) => strip.classList.toggle("more", strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 1);
  const ready = (tool: Element) => tool.querySelector("a") !== null;
  const categoryOf = (tool: Element) => tool.closest<HTMLElement>("[data-category]")?.dataset.category;
  const readyIn = new Set(tools.filter(ready).map(categoryOf));
  const order = [...list.children];
  const more = section.querySelector(".more-soon")?.closest("li");
  const note = section.querySelector<HTMLElement>(".section-tools p");
  // Until the word lists arrive, or when they fail to, the search knows the names on the cards.
  const names: SearchEntry[] = [...list.querySelectorAll<HTMLElement>("[data-tool]")].map((tool) => ({
    id: tool.dataset.tool ?? "",
    ready: ready(tool),
    names: [tool.querySelector("h3")?.textContent ?? ""],
    terms: [],
  }));

  const update = () => {
    const category = pills.querySelector<HTMLElement>('[aria-pressed="true"]')?.dataset.filter ?? "all";
    const awake = sleepers.getAttribute("aria-checked") === "true";
    const matches = searchTools(input.value, index ?? names);
    // An empty query, or one of stop words only, gives every tool a score of 0.
    const browsing = matches.length > 0 && matches.every((match) => match.score === 0);
    const found = new Map(matches.map((match, place) => [match.id, place]));
    const wakeAll = awake || (category !== "all" && !readyIn.has(category));
    const view = document.documentElement.dataset.view === "compact" ? ".compact" : ".cards";
    const shown = new Set<string>();
    let count = 0;
    for (const tool of tools) {
      const id = tool.dataset.tool ?? "";
      const kept = browsing ? ready(tool) || wakeAll || tool.closest(".compact") !== null : found.has(id);
      tool.hidden = !kept || (category !== "all" && categoryOf(tool) !== category);
      if (tool.hidden) continue;
      shown.add(id);
      if (tool.closest(view)) count++;
    }
    for (const row of section.querySelectorAll<HTMLElement>(".compact-row")) row.hidden = !row.querySelector("[data-tool]:not([hidden])");
    if (more) more.hidden = !browsing || category !== "all" || awake;
    if (note) note.hidden = !browsing || category !== "all" || awake;
    const place = (item: Element) => found.get(item.getAttribute("data-tool") ?? "") ?? order.length;
    const sorted = browsing ? order : [...order].sort((a, b) => place(a) - place(b));
    if (sorted.some((item, at) => list.children[at] !== item)) list.append(...sorted);
    empty.hidden = count > 0;
    for (const strip of strips) fade(strip);
    const best = browsing ? undefined : matches.find((match) => shown.has(match.id));
    const label = index?.find((entry) => entry.id === best?.id)?.label ?? "";
    const via = best?.via ? (status.dataset.via ?? "").replace("{word}", best.via).replace("{tool}", label) : "";
    const text = [counts[count] ?? "", via].filter(Boolean).join(" · ");
    if (status.textContent !== text) status.textContent = text;
  };

  // The index is fetched when the column is first used: in the page, it weighed 1.4 KB of the home document budget.
  let loading: Promise<void> | undefined;
  const load = () => {
    loading ??= fetch(section.dataset.index ?? "")
      .then((response) => response.json())
      .then(
        (loaded: SearchIndex) => {
          index = loaded;
          update();
        },
        () => {
          loading = undefined;
        },
      );
  };
  const column = section.querySelector(".filters");
  column?.addEventListener("pointerover", load);
  column?.addEventListener("focusin", load);

  const choose = (category: string) => {
    for (const button of pills.querySelectorAll("button")) button.setAttribute("aria-pressed", String(button.dataset.filter === category));
    update();
  };
  input.addEventListener("input", () => {
    load();
    update();
  });
  pills.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    if (button?.dataset.filter) choose(button.dataset.filter);
  });
  sleepers.addEventListener("click", () => {
    sleepers.setAttribute("aria-checked", String(sleepers.getAttribute("aria-checked") !== "true"));
    update();
  });
  more?.querySelector("button")?.addEventListener("click", () => {
    sleepers.setAttribute("aria-checked", "true");
    update();
  });
  empty.querySelector("button")?.addEventListener("click", () => {
    input.value = "";
    choose("all");
    input.focus();
  });
  for (const strip of strips) {
    strip.addEventListener("scroll", () => fade(strip), { passive: true });
    new ResizeObserver(() => fade(strip)).observe(strip);
  }
  refresh = update;
  update();
}

// Registered after the head script's own click handler, so the view is already switched when this one runs.
document.addEventListener("click", (event) => {
  if (event.target instanceof Element && event.target.closest('[data-toggle="view"]')) refresh();
});
// A module runs once per page load: a later visit to the home, through the router, gets new elements to set up.
document.addEventListener("astro:page-load", setup);
setup();
