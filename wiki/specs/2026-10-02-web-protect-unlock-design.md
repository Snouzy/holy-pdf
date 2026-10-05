# Web: Protect and Unlock a PDF

_Written and shipped on 2 October 2026._

## What the tools do

- **Protect** (Brother Padlock, `/fr/proteger-pdf`, `/en/protect-pdf`): one or more PDFs get the same password. You must type it twice, identically, before the button turns on. The password opens the file. Once open, the PDF prints and copies normally (all permissions granted, owner password equal to the open password).
- **Unlock** (Brother Passkey, `/fr/deverrouiller-pdf`, `/en/unlock-pdf`): the board asks for the password of each protected PDF, as for the other tools, then saves a copy with no encryption. A PDF that opens without a password but restricts printing or copying also comes out with no restriction.

No password is guessed, sent or stored: it stays in the page's memory. Since 5 October 2026, "View" on the result opens the protected copy with the password just typed.

## Engine

A single generic Worker request, `transform`, applies an operation to a copy of each document (`engine/transform.ts`): `EPDF_SetEncryption` for Protect, `EPDF_RemoveEncryption` for Unlock, on a second handle of the original (`reopenPdf`), then `savePdf`. The open document stays intact for the previews and the next run. The next "one file in, one file out" tools (Flatten, Pixelize…) add their operation to `TransformOp` and to `transformPdf`, with no new plumbing in the board. Later, Pixelize, Redact, PDF to Word and Overlay stayed out of `transformPdf`: they encode JPEGs or read a second document, so the worker runs them on their own.

A PDF that carries a digital signature is refused ("This PDF already contains a digital signature…"): any rewrite would invalidate the signature.

## Tests

- Engine (`tests/engine/transform.test.ts`): the protected file requires its password in PDFium and in pdf.js, a wrong password is refused, the unlocked copy opens without a password, a signed PDF is refused for both operations.
- Browser (`tests/e2e/protect-unlock.spec.ts`): the button stays grayed out while the two passwords differ, the downloaded copy is named `<name>-protected.pdf`, "View" shows its page, and it opens only with the password; the unlocked copy is named `<name>-unlocked.pdf` and opens without it.
