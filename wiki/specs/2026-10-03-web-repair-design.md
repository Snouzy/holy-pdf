# Web: Repair a PDF

_Written and delivered on 3 October 2026. The Mac app, removed on 5 October 2026, never had this tool._

Brother Mender (`/fr/reparer-pdf`, `/en/repair-pdf`) rereads damaged PDFs and writes a clean copy, which opens everywhere.

## Decisions

| Topic | Decision | Reason |
|---|---|---|
| Engine | qpdf rebuilds the file (`repairPdf` in `engine/compact.ts`, the same disposable worker as Compress), without object streams. If qpdf reports the file as damaged, or does not load, PDFium rereads and rewrites it (`engine/repair.ts`); if PDFium fails too, the qpdf error shows ("Try again" when qpdf did not load). A copy with no page is refused | Probe of 3 October on nine broken files: PDFium opens neither a truncated file nor a file without an `xref` table; qpdf rereads them. Without object streams, the copy opens in old viewers |
| When | At opening, on this page only: the worker keeps the repaired copy, the card shows its pages, the button returns it | Otherwise the file you came to repair would be refused at opening ("damaged") |
| End of file | A `%%EOF` comment is added before the reread | qpdf loses the last object of a file that stops just after it ("EOF after endobj"): this is what a program leaves when it stops before it writes its table |
| Unreadable | "This PDF is too damaged: nothing in it can be read." on the card | The general message ("damaged and cannot be opened") says nothing new on this page |
| Protected PDF | The password is asked for (qpdf says "invalid password", translated into password required or password incorrect), qpdf receives it, and the copy keeps it. A protected PDF cut before its trailer is refused: the copy that lost `/Encrypt` is rejected | qpdf keeps the original encryption. Without a trailer, it no longer knows that the file is encrypted and copies the encrypted streams as they are: all the pages came out blank |
| Signed PDF | Refused (`alreadySigned`) | Any rewrite invalidates the signature |
| Monk | "Brother Mender" (« Frère Ravaudeur »), the stapler, focused, Optimize category | « Ravauder » means « raccommoder »: to mend |

## Known limits

- What the file lacks does not come back: a cut file loses its last pages, and a page whose tree is erased is lost.
- A healthy file is rewritten too; the screen does not say if there was something to repair.
- 128 MB at most, like Compress: above that, PDFium does not take over, because two copies would not fit.
- A protected PDF whose end is lost cannot be repaired.

## Tests

- Engine (`tests/engine/repair.test.ts`): file cut at 80% and 60%, lost `xref` table, healthy file rewritten, PDFium fallback when qpdf fails, unreadable file refused, password asked for, refused if wrong, then kept; cut protected PDF refused; qpdf not loaded or file too large; copy with no page refused; signed PDF refused. Reread with pdf.js.
- qpdf (`tests/engine/qpdf.test.ts`): the rewrite is returned even when it is heavier, in repair mode.
- Browser (`tests/e2e/repair.spec.ts`): cut PDF repaired with its three pages; unreadable file reported, button disabled.
