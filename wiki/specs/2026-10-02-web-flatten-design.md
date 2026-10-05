# Web: Flatten a PDF

_Written and shipped on 2 October 2026._

Brother Roller (`/fr/aplatir-pdf`, `/en/flatten-pdf`) moves the filled form fields and the annotations of one or more PDFs into the page content: they stay visible and can no longer be changed. No settings.

## Engine

Operation `flatten` of the `transform` request (`engine/flatten.ts`): `FPDFPage_Flatten` on each page of a copy, with the appearance shown on screen (not the print appearance). The page text stays text. A digitally signed PDF is refused, as for the other operations.

## Limit

A field with no stored appearance (`/AP`) has nothing to draw: it disappears and leaves no trace in the page.

## Tests

- Engine (`tests/engine/flatten.test.ts`): a filled field becomes page text, read back by pdf.js, and the annotation disappears.
- Browser (`tests/e2e/flatten.spec.ts`): copy `<name>-flattened.pdf` whose text stays readable.
