export type SearchEntry = { id: string; ready: boolean; names: string[]; terms: string[] };
export type Match = { id: string; score: number; via: string | null };
/** What `/{lang}/search.json` holds. `label` names the tool in the status line. */
export type SearchIndex = (SearchEntry & { label: string })[];

const stopWords = new Set([
  "pdf", "pdfs", "de", "des", "du", "d", "un", "une", "le", "la", "les", "l", "en", "mon", "ma", "mes", "a", "au", "aux", "et", "pour", "sur",
  "the", "an", "my", "to", "of", "and", "for", "into", "file", "files", "fichier", "fichiers", "document", "documents", "page", "pages",
  "gratuit", "gratuite", "gratuitement", "ligne", "comment", "deux", "free", "online", "how", "two",
  "o", "os", "as", "um", "uma", "em", "no", "na", "nos", "nas", "do", "da", "dos", "das", "e", "ou", "para", "pra", "por", "com", "meu", "minha", "meus", "minhas",
  "arquivo", "arquivos", "pagina", "paginas", "gratis", "gratuito", "gratuita", "como", "dois", "duas",
]);

const formats = new Set(["jpg", "jpeg", "png", "image", "images", "photo", "photos", "picture", "pictures", "word", "docx", "doc", "web", "html"]);

function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function words(text: string): string[] {
  return normalize(text).split(" ")
    .filter((word) => word !== "" && !stopWords.has(word))
    .map((word) => word.endsWith("s") && formats.has(word.slice(0, -1)) ? word.slice(0, -1) : word);
}

/** Optimal string alignment: insertions, deletions, substitutions, and two neighbours swapped, each costs 1. */
function distance(a: string, b: string): number {
  let before: number[] = [];
  let above = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      let best = Math.min((above[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (above[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) best = Math.min(best, (before[j - 2] ?? 0) + 1);
      row[j] = best;
    }
    [before, above] = [above, row];
  }
  return above[b.length] ?? 0;
}

function wordScore(asked: string, word: string): number {
  if (asked === word) return 3;
  if (word.startsWith(asked)) return 2;
  const typos = asked.length >= 7 ? 2 : asked.length >= 4 ? 1 : 0;
  if (typos === 0) return 0;
  // A word still being typed is also compared with the start of the word, at the same length.
  return Math.min(distance(asked, word), distance(asked, word.slice(0, asked.length))) <= typos ? 1 : 0;
}

/** True when « pdf » comes before an image or format word, false when it comes after, null without both. */
function pdfFirst(text: string): boolean | null {
  const all = normalize(text).split(" ");
  const pdf = all.findIndex((word) => word === "pdf" || word === "pdfs");
  const format = all.findIndex((word) => formats.has(word));
  return pdf === -1 || format === -1 ? null : pdf < format;
}

function bestHit(asked: string, phrases: string[]): { points: number; phrase: string } {
  let hit = { points: 0, phrase: "" };
  for (const phrase of phrases) {
    for (const candidate of words(phrase)) {
      const points = wordScore(asked, candidate);
      if (points > hit.points) hit = { points, phrase };
    }
  }
  return hit;
}

function rank(query: string, entries: SearchEntry[]): Match[] {
  const asked = words(query);
  if (asked.length === 0) return entries.map((entry) => ({ id: entry.id, score: 0, via: null }));
  const hits = entries.map((entry) => asked.map((word) => bestHit(word, [...entry.names, ...entry.terms])));
  // A word no tool knows (« gratuitement », « online ») would empty the result: it is left out.
  const known = asked.map((_, index) => hits.some((entryHits) => (entryHits[index]?.points ?? 0) > 0));
  // Stop words stay in: « pdf en jpg » and « jpg en pdf » differ only by them.
  const whole = normalize(query);
  const direction = pdfFirst(query);
  const matches: (Match & { weakest: number; agrees: boolean })[] = [];
  for (const [index, entry] of entries.entries()) {
    const entryHits = (hits[index] ?? []).filter((_, word) => known[word]);
    const weakest = Math.min(...entryHits.map((hit) => hit.points));
    if (entryHits.length === 0 || weakest === 0) continue;
    const phrases = [...entry.names, ...entry.terms];
    let score = (entry.ready ? 0.5 : 0) + entryHits.reduce((sum, hit) => sum + hit.points, 0);
    if (whole.includes(" ") && phrases.some((phrase) => normalize(phrase).includes(whole))) score += 2;
    const first = entryHits[0]?.phrase ?? "";
    const agrees = direction !== null && entry.names.map(pdfFirst).find((order) => order !== null) === direction;
    matches.push({ id: entry.id, score, via: entry.terms.includes(first) ? first : null, weakest, agrees });
  }
  // A typo is only a fallback: « conv » must not bring « concaténer » when « convertir » starts with it.
  const exact = matches.filter((match) => match.weakest >= 2);
  return (exact.length > 0 ? exact : matches).sort((a, b) => b.score - a.score || Number(b.agrees) - Number(a.agrees));
}

export function searchTools(query: string, entries: SearchEntry[]): Match[] {
  const found = rank(query, entries);
  const text = normalize(query);
  const typed = text.slice(text.lastIndexOf(" ") + 1);
  // « pd » on the way to « pdf » finds nothing yet: a last word that starts a stop word waits for the next letter.
  if (found.length > 0 || typed === "" || ![...stopWords].some((word) => word.startsWith(typed))) return found;
  return rank(text.slice(0, -typed.length), entries);
}
