/** A line read on a page, its box in page coordinates; `confidence` from 0 to 1. */
export type TextLine = { text: string; box: { x: number; y: number; width: number; height: number }; confidence: number };
/** `captureDay`: the ISO day the photo was taken, when the photo says it. */
export type PageText = { id: string; lines: TextLine[]; captureDay?: string | undefined };
export type Evidence = { kind: "pageMarker" | "date" | "title"; text: string };
export type Suggestion = { pageIds: string[]; name: string; evidence: Evidence[] };
type Marker = { index: number; total: number | null; text: string };

const topMarkerZone = 0.1;
const bottomMarkerZone = 0.88;
const titleZone = 0.4;
const maxTitleWords = 4;
const maxSlugWords = 6;
const minTitleConfidence = 0.5;
const earliestDay = "1990-01-01";
/** An end of validity can fall before the photo, yet it is never the day the document was issued. */
const validityKeywords = ["valabil", "valable", "valid until", "valid till", "valid through", "valid to", "expir"];

const folded = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const letters = (text: string) => [...text].filter((char) => /\p{L}/u.test(char)).length;
const words = (text: string) => text.split(/\s+/).filter(Boolean);

/** Groups pages into documents and names them from their text. Rules: wiki/development/algorithm.md. */
export function suggest(pages: PageText[], today: string): Suggestion[] {
  const groups = group(pages);
  const repeated = repeatedHeaderLines(groups);
  let unnamed = 0;
  return groups.map((pagesOfGroup) => {
    const first = pagesOfGroup[0]!;
    const evidence: Evidence[] = [];
    const found = marker(first);
    if (found && (pagesOfGroup.length > 1 || found.total !== null)) evidence.push({ kind: "pageMarker", text: found.text });
    const reference = first.captureDay ?? today;
    const date = latestDate(pagesOfGroup, reference);
    if (date) evidence.push({ kind: "date", text: date.text });
    const day = date?.day ?? reference;
    const heading = title(first, repeated);
    const name = heading ? slug(heading) : "";
    if (name && heading) evidence.push({ kind: "title", text: heading });
    return { pageIds: pagesOfGroup.map((page) => page.id), name: name ? `${day}_${name}` : `${day}_Document-${++unnamed}`, evidence };
  });
}

export function group(pages: PageText[]): PageText[][] {
  const groups: PageText[][] = [];
  let previous: Marker | null = null;
  for (const page of pages) {
    const current = marker(page);
    if (current && previous && groups.length > 0 && current.index === previous.index + 1 && current.total === previous.total) groups.at(-1)!.push(page);
    else groups.push([page]);
    previous = current;
  }
  return groups;
}

export function marker(page: PageText): Marker | null {
  const edge = page.lines.filter((line) => line.box.y < topMarkerZone || line.box.y + line.box.height > bottomMarkerZone);
  // Tesseract, unlike Vision, may drop the space in « din3 » and join « 2/2 » to the words before it on its line.
  for (const line of edge) {
    const counted = /pagina\s*(\d+)\s*din\s*(\d+)/i.exec(line.text) ?? /page\s*(\d+)\s*(?:of|sur)\s*(\d+)/i.exec(line.text) ?? /(?:^|\s)(\d{1,2})\s*\/\s*(\d{1,2})\s*$/.exec(line.text);
    if (!counted) continue;
    const [index, total] = [Number(counted[1]), Number(counted[2])];
    if (index >= 1 && index <= total) return { index, total, text: counted[0].trim() };
  }
  for (const line of edge) {
    if (line.box.y + line.box.height <= bottomMarkerZone || Math.abs(line.box.x + line.box.width / 2 - 0.5) >= 0.1) continue;
    const bare = /^\s*(\d{1,3})\s*$/.exec(line.text);
    if (bare) return { index: Number(bare[1]), total: null, text: bare[1]! };
  }
  return null;
}

/** The most recent date that is not after the reference day (the photo was taken after the document was issued). */
export function latestDate(pages: PageText[], reference: string): { day: string; text: string } | null {
  let latest: { day: string; text: string } | null = null;
  for (const line of pages.flatMap((page) => page.lines)) {
    if (validityKeywords.some((keyword) => folded(line.text).includes(keyword))) continue;
    for (const found of dates(line.text)) {
      if (found.day >= earliestDay && found.day <= reference && (!latest || found.day > latest.day)) latest = found;
    }
  }
  return latest;
}

export function dates(text: string): { day: string; text: string }[] {
  const found: { day: string; text: string }[] = [];
  for (const match of text.matchAll(/\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/g)) {
    const day = isoDay(Number(match[3]), Number(match[2]), Number(match[1]));
    if (day) found.push({ day, text: match[0] });
  }
  for (const match of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    const day = isoDay(Number(match[1]), Number(match[2]), Number(match[3]));
    if (day) found.push({ day, text: match[0] });
  }
  return found;
}

/** `null` for a day that does not exist, such as 31.02. */
function isoDay(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (month < 1 || month > 12 || date.getUTCDate() !== day || date.getUTCMonth() !== month - 1) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Logos are read as low-confidence words. Body lines are long, and on a skewed page their boxes are taller than the title's. */
function headerLines(page: PageText): TextLine[] {
  return page.lines.filter((line) => line.box.y < titleZone && letters(line.text) >= 3 && line.confidence >= minTitleConfidence && words(line.text).length <= maxTitleWords);
}

const key = (text: string) => [...folded(text)].filter((char) => /[\p{L}\p{N}]/u.test(char)).join("");

/**
 * Institution headers repeat across the documents of a batch; they are not titles. Two documents of the same kind share
 * a real title, so a big batch needs more repeats to call a line a header.
 */
export function repeatedHeaderLines(groups: PageText[][]): Set<string> {
  const counts = new Map<string, number>();
  for (const pages of groups) {
    for (const each of new Set(pages.flatMap(headerLines).map((line) => key(line.text)))) counts.set(each, (counts.get(each) ?? 0) + 1);
  }
  const minRepeats = Math.max(2, Math.floor((groups.length + 2) / 3));
  return new Set([...counts].filter(([, count]) => count >= minRepeats).map(([text]) => text));
}

export function title(page: PageText, repeated: Set<string>): string | null {
  let best: TextLine | null = null;
  for (const line of headerLines(page)) {
    if (repeated.has(key(line.text))) continue;
    if (!best || line.box.height > best.box.height || (line.box.height === best.box.height && line.box.y < best.box.y)) best = line;
  }
  return best?.text ?? null;
}

/** ASCII words joined by dashes, only the first capitalized: « INFORMAȚII PUNCTUALE » → « Informatii-punctuale ». */
export function slug(text: string): string {
  const parts = folded(text).split(/[^a-z0-9]+/).filter(Boolean).slice(0, maxSlugWords);
  if (parts.length === 0) return "";
  return [parts[0]!.charAt(0).toUpperCase() + parts[0]!.slice(1), ...parts.slice(1)].join("-");
}
