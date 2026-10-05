# Mac: Protect and Unlock

_Written 2 October 2026. Status: Swift app removed on 5 October 2026 (tag `mac-final`); at the time, shipped in `apps/mac`. Second of the six tools ordered on 2 October (before: [Page numbers](2026-10-02-mac-page-numbers-design.md); after: Compress, OCR, Redact)._

## Goal

Two tools in Holy PDF for Mac. **Protect** saves a copy that opens only with a password. **Unlock** saves a copy without a password of a PDF whose password you know. PDFKit only, no new engine.

The spec succeeds when:

- the protected copy asks for the chosen password, and no other password opens it;
- the unlocked copy is not encrypted at all any more (no `/Encrypt` dictionary);
- the text, the links, the form fields and the bookmarks stay;
- the original file is never modified;
- the package, app and string tests pass, with no compiler warning.

## What PDFKit can do (probes of 2 October)

| Question | Measured answer |
|---|---|
| Which encryption? | AES-128 (`/V 4 /R 4 /AESV2`), PDF 1.6. A key length of 256 is refused: the write fails |
| Is a user password alone enough? | No: without an owner password, the copy is not encrypted. Both options are passed, with the same value |
| Which characters? | Printable ASCII only. With "é", "€" or an ideogram, the write fails. Quartz uses only the first 32 bytes: 40 "a" open with 32 "a" |
| Protect a PDF that is already protected? | Yes: the new password replaces the old one |
| Does a rewrite of a PDF opened with its password decrypt it? | No. Without an option, the copy keeps its password; with two empty passwords, it opens without a prompt but stays encrypted |
| How to get a copy without encryption? | Move the pages into a new document, like Organize: no `/Encrypt` any more, forms, links, bookmarks and title kept |
| Duration | 0.1 to 0.2 s for 1 to 2 MB. The two known large files stay slow (see Known limits) |

## Decisions

| Topic | Decision | Reason |
|---|---|---|
| Protect | `PDFProtection.protected`: PDFKit rewrites the whole document with the password as the user password and as the owner password | The whole document is kept. One single password: the person who opens the file has all rights, no false promise on printing or copying |
| Accepted password | 1 to 32 printable ASCII characters, checked before the write; typed twice | What Quartz can write. The screen says so during typing, not at save time |
| Check | After the write, the engine opens the copy again with the password; if that does not work, the engine fails | A copy that its password does not open is worse than no copy |
| Fields cleared | The two fields are cleared after a successful save and when another PDF opens. A refused or cancelled save keeps them | A password left in the fields would lock the next PDF without the user typing it |
| Unlock | `PDFProtection.unlocked`: the Organize engine, all pages kept in their order | The only PDFKit path to a copy that is really without encryption |
| Known password only | A PDF that asks for a password opens only with that password: the tool guesses nothing. A PDF that opens without a password but limits printing or copying is unlocked too | The rule of the roadmap. For limits without a password: Organize, Extract and the other tools already write a free copy; a refusal here would be inconsistent. To tighten if the author decides so |
| A PDF without a password | The screen says that there is nothing to unlock; the button is inactive | No useless copy |
| Screen | The shared session and screen (`PDFCopySession`, `CopyToolView`), a `ProtectionSession` with two modes and a `ProtectionView` | The two tools differ only by their panel |
| Monks | "Brother Padlock" and "Brother Passkey" (« Frère Cadenas » and « Frère Passe-partout » in French), in their poses from the site, exported from the site drawing | The site gives the same accessory to the two tools: the mood tells them apart |

## What changes in the shared building blocks

- `PDFCopySession.Maker` becomes asynchronous: Unlock goes through the actor of Organize.
- `PDFCopySession.onSaved` and `onClosed` tell the tool after a successful save and when the document closes: Protect then clears its fields.
- `PDFCopySession.inspect` lets the tool look at the document on opening: the tool refuses it, or returns notes that the screen shows (`notices`).
- `CopyToolView` gets `canSave` (button and ⌘E inactive) and `passwordNote`: the sentence "The saved copy will not require a password" no longer appears in these two tools, which say themselves what happens to the password.

## Flow

**Protect.** Open or drop a PDF; type the password twice; "Save a protected copy…" suggests `nom-protégé.pdf`. The screen reminds you to keep the password and names the encryption.

**Unlock.** Open or drop a protected PDF; type its password; "Save an unlocked copy…" suggests `nom-déverrouillé.pdf`.

## Known limits

- AES-128, not AES-256: PDFKit does not write better. With a short password, the copy is quick to crack; the screen recommends a long password.
- No accent and no emoji in the password, 32 characters at most.
- Protect rewrites the whole document: the PDFKit slowness and bloated files described in the Watermark spec apply (IRS publication of 142 pages: 113 s, 3 MB → 14 MB; book scanned in JBIG2: 119 s, 17 MB → 468 MB).
- Unlock has the limits of Organize: on opening, it refuses the PDFs that Organize refuses (attachments, layers, dynamic forms), and the screen warns when the accessibility tags or the PDF/A profile will not be kept.
- PDFKit rewrites the document catalog. Probe of 2 October: the two tools lose the page labels ("i, ii…"), and page "i" becomes "1"; the unlocked copy also loses the document language, the open mode and the display preferences.
- The two tools refuse a digitally signed PDF: the copy would lose the signature.
- No fine-grained permissions (forbid printing or copying): a reader can ignore them.

## Tests

| Level | What | Where |
|---|---|---|
| Engine | The protected copy opens only with its password, in AES, with text, bookmark title and field value readable; new password on a protected PDF; passwords refused and accepted; signed PDF refused; unlocked copy without `/Encrypt`, with text, links, bookmark and field | `PDFProtectionTests` |
| Tool | The button waits for a password typed twice; protected copy, original intact, fields cleared; new password on a protected PDF; unlocked copy; nothing to unlock; printing and copying limits lifted; password forgotten when another PDF opens; refusals and notes of Organize on opening | `ProtectionSessionTests` |
| Screens | Start, workshop, passwords that differ, password refused, copy saved; password asked, ready, nothing to unlock; light, dark, English | `ProtectionSnapshots` |
| Real files | The 38 PDFs of `fixtures-private/pdfs`: 35 protected (2 unreadable ones and 1 with an unknown password refused), then 33 of them unlocked; pages, fields, links and bookmarks counted before and after, all kept | Probe of 2 October, not kept |
| Strings | All translated, never the informal « tu » | `check-strings.py` |
