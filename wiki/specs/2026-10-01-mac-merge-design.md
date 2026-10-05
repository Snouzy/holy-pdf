# Mac: Merge PDF files

_Swift app removed on 5 October 2026: this spec is an archive, the code is at tag `mac-final`._

## Goal

Third native tool: combine several PDFs into one file, in a chosen order, without modifying the originals. Brother Staple joins the home grid. The Web session stays independent. No server, no extra engine, no dependency.

## Flow

1. Choose several PDFs or drop them. The files are read one after another, off the main thread. Each row shows its name, its page count and its size, with a first-page preview that loads when the row appears.
2. A protected file asks for its password in a dedicated sheet. An unreadable or incompatible file stays visible with a message and can be removed. A digitally signed PDF is refused, so that a merge does not look as if it kept its certificate.
3. Change the order of the documents by dragging or with the Move Up/Move Down buttons; remove a file and undo the action. You can still add more files. Moving pages inside a document belongs to the future Organize pages tool.
4. Merge requires at least two valid files, with no file still locked or in error. The macOS panel saves a copy. No source file, and no symbolic link or hard link to a source, can become the destination.
5. The result shows the name of the saved file and offers Show in Finder. A new batch asks for confirmation if the current work was not exported; quitting does too. Closing the window keeps the session.

## Preservation

`PDFMergeCollection`, an actor in `PDFCore`, keeps the immutable source data and their validated information. The export rebuilds the assembly from fresh copies of the source data, by inserting their PDF pages; it does not draw the pages into a new bitmap context. The order in the interface sets the exact export order. Successive exports are independent.

The tests cover selectable text, images, MediaBox/CropBox, rotations, URI links, internal destinations, annotations with appearance, bookmarks and filled fields. Fields from separate documents must stay independent even if their names look alike. PDFKit can require internal fields to be renamed and destinations to be resolved explicitly before insertion. Interactive structures that the engine cannot keep (XFA or calculated forms, scripts, attachments, layers) are refused explicitly. Documents that contain accessibility tags or archiving/print profiles are accepted with a visible notice before export: these structures will not be carried over, and PDF/A conformance and print colors are not guaranteed. Initial view preferences are not carried over into the new document. No promise to keep all PDF profiles or digital certificates.

Copies made from protected sources open without a password, and the interface says so. Passwords and documents are kept only in the local session. The author of a source document is not carried over as the author of the merged document.

## Performance and limits

- No PDF is rendered when a row moves; only the order of identifiers changes.
- First page only, preview bounded to 240 pixels per side; cache of 32 previews at most (under 7.4 MB RGBA, framework overhead excluded). Off-screen requests can be canceled.
- 100 files loaded at most, 256 MiB per file, 512 MiB of source data in total, including the documents kept to undo a removal. This cap does not represent the total PDFKit memory or the export peak.
- 100 undoable operations; release the removed sources when no operation can restore them. A new batch also releases the history.
- Sequential import, PDFKit processing in the actor; file reads and writes off the main actor.
- Measure a merge of 20 documents / 100 synthetic pages and the first preview. Indicative targets: preview < 1 s, export < 3 s on this machine.

## Interface

Home cards in an adaptive grid (two side by side from 960 points). Brother Staple comes from the official Web drawing, exported into a sub-catalog specific to Merge, without modifying Web or Generated. System backgrounds, blue accent, Bricolage for titles, French/English texts and the formal « vous ». The ⌘O, ⌘E and ⌘Z commands follow the displayed tool.

## Validation

PDFCore tests with synthetic fixtures, independent check of the exported PDF, session tests (order, undo, errors, export and source protection), native light/dark captures, string catalog and brand export. No personal photo or document added to the repository.


## Usage feedback of 2 October

A click on a thumbnail opens a preview sheet of the whole document, with previous/next page navigation. Only one page is rendered, on demand, up to 1,600 pixels per side, and it is released on close; the thumbnails stay at 240 pixels. Protected files use the data already opened in the session.

"Preview", next to the save button (4 October 2026), opens the same sheet on the merged PDF: all the pages in the list order, each one rendered from its file, without merging anything. The button follows the save state.

Dropping files from the Finder must work on a row and on empty areas. Reordering uses explicit before/after destinations to reach both ends. Hover marks the active buttons, without changing their size, and does not make disabled buttons look active.
