# Mac: Home by categories, with search

_Written on 2 October 2026. Status: Swift app removed on 5 October 2026 (tag `mac-final`); at the time, shipped in `apps/mac`. Requested by the author on 2 October, after [Images to PDF and PDF to images](2026-10-02-mac-images-design.md): the home screen had fifteen cards in a flat list._

## Goal

Find a tool on the Holy PDF for Mac home screen as on the site: by its category, or by typing what you want to do.

The spec succeeds when:

- the tools are grouped under the five categories of the site, in the site's order;
- typing « alléger » finds Compress, « mot de passe » finds Protect and Unlock, « fusioner » (with the typo) finds Merge;
- the Mac search and the site search give the same answers to the same cases;
- the search words are written in one place only: the site;
- the app and string tests pass, with no compiler warning.

## Decisions

| Topic | Decision | Reason |
|---|---|---|
| Categories | Organize, Convert, Edit, Optimize, Security: the site's categories (`apps/web/src/cast.ts`), in its order, with its names | One single way to group the tools for the brand |
| Grouping | Organize: Merge, Organize pages, Split, Extract pages. Convert: Images to PDF, PDF to images. Edit: Sign, Watermark, Page numbers, Redact. Optimize: Scanner, Compress, OCR. Security: Protect, Unlock | The site's grouping, Scanner included |
| Upcoming tools | Their sleeping monks sit under the cards of their category | The separate "Soon" section goes away: it had only two tools (only one since PDF to Word, shipped on the evening of 2 October) |
| Search | The window search field (`searchable`, ⌘F). As soon as a useful word is typed, the categories give way to the monks found. While the query says nothing (empty, stop words, "pd" on its way to "pdf"), the categories stay | The native macOS field, with nothing to draw. The site also keeps its normal view in this case |
| Rules | The site's rules (`apps/web/src/home/search.ts`), ported to Swift in `ToolSearch`: accents and case ignored, word being typed, one typo from 4 letters and two from 7, stop words ignored (« pdf », « de », « fichier »), direction of a conversion (« pdf en jpg » before « jpg en pdf »), ready tools before upcoming tools | The two searches must give the same answers |
| Names and words | The site's search index (the names of each tool and its words, as `search.json.ts` builds it), copied into `App/SearchTerms.json` by `apps/web/tests/unit/macSearch.test.ts`: `pnpm test` fails if the copy is out of date, `UPDATE_MAC_ASSETS=1 pnpm test` rewrites it. Each Mac tool is found by its title, its monk, and the site's names and words | One single source, and the same mechanism as the monk drawings. A separate script had let the copy go stale on the same day (2 October). The site's names carry words that the Mac titles do not have: « convertir », "add". Without them, « convertir pdf en jpg » found the opposite tool (review of 2 October) |
| Language | The interface language (`Bundle.main.preferredLocalizations`), not the region | A Mac set to France with the app in English must search in English |
| Mapping | Each Mac tool names the site tools whose words it takes. Organize pages also takes the words of Delete pages and Rotate, which it does on Mac | « tourner » must find Organize pages |
| Nothing found | "No monk does that… yet", a tip, and "See all the monks" | The site's texts |
| Outside this milestone | Favorites and recent tools | Planned in the roadmap, to do when usage asks for them |

## Flow

1. The home screen shows the five categories, each with its cards.
2. ⌘F or a click in the toolbar field; type a word.
3. The home screen shows the monks found, the best match first, and their number.
4. Clearing the field, or "See all the monks", brings back the categories.

## Known limits

- The site says which word found a tool (« alléger » → Compress); the Mac does not.
- No category filter and no compact view, which the site has.
- The words follow the app language: French, otherwise English.
- "ß" and ligatures ("ﬁ") are read as "ss" and "fi"; the site turns them into spaces. This is the only difference measured over 443 queries.

## Tests

| Level | What | Where |
|---|---|---|
| Search | The cases of `apps/web/tests/unit/search.test.ts`: synonym, accents, word being typed, typos, unknown word, stop words, direction of a conversion, monk, ready tools first | `ToolSearchTests` |
| Catalog | Each tool has its category, its names and its words in both languages; « alléger », « mot de passe », « caviarder », « supprimer une page », « tourner », "shrink", "word"; the site's 22 cases on its built index, plus "add page numbers" and « convertir » | `ToolCatalogTests` |
| Window | The search field is in the toolbar of the real window | `HomeSearchFieldTests` |
| Screens | Home by categories in light, in dark and narrow; monks found; upcoming tool found; nothing found | `ScreenSnapshots` |
| Up-to-date index | The copy of the site's search index, checked by the site's unit tests: whoever changes a word on the site is warned by `pnpm verify` | `apps/web/tests/unit/macSearch.test.ts` |
| Strings | All translated, never the informal « tu » | `check-strings.py` |
