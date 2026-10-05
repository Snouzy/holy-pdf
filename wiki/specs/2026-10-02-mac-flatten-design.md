# Mac: Flatten

_Written on 2 October 2026. Status: Swift app removed on 5 October 2026 (tag `mac-final`); at the time, shipped in `apps/mac`. Requested by the author on 2 October, after the [home by categories](2026-10-02-mac-home-design.md): the site has had the tool since the same day ([site spec](2026-10-02-web-flatten-design.md))._

## Goal

Freeze a filled or annotated PDF in Holy PDF for Mac: the filled form fields and the annotations move into the page content, then you save the copy. They keep their look and can no longer be edited. PDFKit only.

The spec succeeds when:

- the value of a filled field becomes page text, and the field disappears;
- the page looks the same before and after;
- text stays text, bookmarks stay, and links stay links;
- a PDF with no field and no annotation is refused when it opens, with the reason;
- the original file is never modified;
- the package, app and string tests pass, with no compiler warning.

## Decisions

| Topic | Decision | Reason |
|---|---|---|
| Engine | `PDFFlattening.flattened`: the PDFKit write option `burnInAnnotationsOption` | Probe of 2 October: the value of a field of the W-9 form ends up in the page text, and less than 0.02% of the pixels change |
| Links | PDFKit burns in all annotations, links included; a link has nothing to draw and would stop working. The links are recorded first, then put back on the flattened copy: address, or page and destination point | The site loses the links (PDFium removes all annotations). A table of contents that no longer leads anywhere would be a silent loss. Probe: 113 links out of 113 found again |
| What the reader does not see | Before the burn-in, the engine removes the hidden annotations (Hidden flag) and the note pop-ups. PDFKit would burn them in: the value of a hidden field would appear on the page, and a pop-up left open would put an opaque box over the text | Two defects proven by the review of 2 October. The site's engine (PDFium) also skips both |
| Nothing to flatten | `PDFFlattening.survey` counts the fields and the visible annotations, without links or pop-ups. At zero, the PDF is refused when it opens: "This PDF has no field or annotation to flatten" | An identical copy makes no sense, and saying so before the save panel avoids a detour |
| Screen | The shared session and screen, with no setting; the screen says how many fields and annotations will be flattened | As on the site: no setting |
| Monk | "Brother Roller", the book, smiling: the site's pose | Same character as on the site |

## Flow

1. Open or drop a filled or annotated PDF. A protected file asks for its password.
2. The screen says how many fields and annotations it found.
3. "Save the flattened copy…" suggests `nom-aplati.pdf`.

## Known limits

- An empty field or a field with no appearance has nothing to draw: it disappears without a trace.
- The text of a note (its pop-up) is not written into the page: only its icon is burned in.
- A file attached to a page by an annotation is not kept in the copy: the screen says so when the PDF opens.
- An empty form flattens into empty boxes that can no longer be filled: the screen does not warn.
- An annotation that does not print (a "Print" button) is burned in and will print.
- Two PDFKit writes run one after the other when the PDF has links: three minutes without "Cancel" on the 142-page IRS publication with 2,955 links.
- A link that launches something other than an address or a jump in the document (a script, a file) is not put back.
- The PDFKit write limits apply (Watermark spec, Protect spec for page labels).
- The copy of a protected PDF opens without a password, and the screen says so.

## Tests

| Level | What | Where |
|---|---|---|
| Engine | Field value in the page text, field and square annotation gone, bookmark kept; same look; both links (address and jump) still work; hidden field, open pop-up and hidden link neither drawn nor counted; attached file counted; count of fields and annotations; signed PDF refused, protected PDF opened | `PDFFlatteningTests` |
| Tool | Count shown, flattened copy saved, original intact; PDF with nothing to flatten refused when it opens | `FlattenSessionTests` |
| Screens | Start, ready in light, in dark and in English, copy saved, nothing to flatten | `FlattenSnapshots` |
| Real files | Seven PDFs from `fixtures-private/pdfs`: the 23 fields of the W-9 flattened, highlight and stamp burned in, 113 links kept | Probe of 2 October, not kept |
| Strings | All translated, never the informal « tu » | `check-strings.py` |
