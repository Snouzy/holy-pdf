import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { upcomingIds } from "../../src/cast";
import { dictionaries, searchTexts } from "../../src/i18n";
import { languages, toolIds } from "../../src/tools";

// The home of the Mac app searches like the site: « alléger » finds Compress on both. This test writes the site's
// search index (the names and the words of each tool, as `src/home/index.ts` builds it) into the app,
// and fails when the app's copy no longer matches the site.
const update = "run UPDATE_MAC_ASSETS=1 pnpm test";
const copy = join(import.meta.dirname, "../../../../apps/mac/PDFToolbox/App/SearchTerms.json");

type Entry = [id: string, { names: string[]; terms: string[] }];

function index(): string {
  const byLanguage = [...languages].sort().map((lang) => {
    const t = dictionaries[lang];
    const entries: Entry[] = [
      ...toolIds.map((id): Entry => [id, { names: [t.toolNames[id], t.toolShort[id], t.monks[id].name], terms: searchTexts[lang].terms[id] }]),
      ...upcomingIds.map((id): Entry => [id, { names: [t.upcoming[id]], terms: searchTexts[lang].terms[id] }]),
    ];
    return [lang, Object.fromEntries(entries.sort(([a], [b]) => (a < b ? -1 : 1)))];
  });
  return `${JSON.stringify(Object.fromEntries(byLanguage), null, 2)}\n`;
}

if (process.env["UPDATE_MAC_ASSETS"]) writeFileSync(copy, index());

describe("Mac search index", () => {
  it("matches the site's names and words", () => {
    expect(existsSync(copy) ? readFileSync(copy, "utf8") : undefined, update).toBe(index());
  });
});
