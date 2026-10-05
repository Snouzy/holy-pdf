# Web: Overlay two PDFs

_Written and delivered on 3 October 2026. Follows [Overlay on Mac](2026-10-02-mac-overlay-design.md): same rules for pages, position and size._

Brother Layer (`/fr/superposer-pdf`, `/en/overlay-pdf`) lays the pages of one PDF on the pages of one or more other PDFs: a letterhead under a letter, a notice on a whole file.

## Decisions

| Topic | Decision | Reason |
|---|---|---|
| Engine | `engine/overlay.ts`: each page of the overlay PDF becomes a form XObject (`FPDF_NewXObjectFromPage`), placed over the page content or under it (`FPDFPage_InsertObjectAtIndex(…, 0)`) | Both texts stay text; one XObject serves as many pages as needed, so the repeated header is stored once |
| Pages | Page for page; the last page of the overlay PDF goes on all the remaining pages | As on Mac |
| Size | Fitted to the page as the viewer shows it, and centered, with no distortion | As on Mac. Probe of 3 October: the PDFium XObject already shows the overlay page as the viewer shows it (rotation in its `/Matrix`, box moved back to the origin); it is enough to fit its displayed size |
| Receiving PDF | If it is signed, it is refused (`alreadySigned`) | Any rewrite invalidates the signature |
| Overlay PDF | Only read: if it is signed, it is accepted; if it is protected, it is refused with the steps to follow (Brother Passkey); it stays selected from one document to the next | As on Mac |
| Several PDFs | The site accepts several receiving PDFs: the same PDF is laid on each one | One header serves several letters |
| Preview | No preview before; "View" on the result, like the other file tools | The site's workspace for several PDFs shows no page |
| Monk | "Brother Layer" (« Frère Calque »), the stamp, joyful | The Mac name |

## Known limits

- No setting for size, position or opacity, and no choice of pages.
- The annotations, fields and links of the overlay PDF do not follow: only its drawing is laid.
- Underneath, it stays hidden wherever the page paints a background, even a white one (a scan).
- A cropped overlay page also shows what extends past its box: the PDFium XObject keeps the whole page.

## Tests

- Engine (`tests/engine/overlay.test.ts`): page for page and last page repeated, both texts kept; on top covers the page, underneath lets the page show; fitted and centered, rotated overlay page, rotated receiving page; signed receiving PDF refused, signed overlay PDF accepted.
- Browser (`tests/e2e/overlay.spec.ts`): header laid under a two-page letter, texts kept; protected overlay PDF refused with its message.
