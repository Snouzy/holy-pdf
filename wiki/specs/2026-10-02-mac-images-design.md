# Mac: Images to PDF and PDF to images

_Written on 2 October 2026. Status: Swift app removed on 5 October 2026 (tag `mac-final`); at the time, shipped in `apps/mac`. Requested by the author on 2 October to finish phase 1 of the [roadmap](../product/roadmap.md), before the home screen by categories._

## Goal

Two tools in Holy PDF for Mac, with the rules of the site (`jpg-to-pdf` and `pdf-to-jpg`). **Images to PDF** binds images into one PDF, one page per image. **PDF to images** writes one JPG image per page into a folder. ImageIO, Core Graphics and PDFKit, with no new engine.

The spec succeeds when:

- each image takes an A4 page, in portrait or in landscape from its shape, fitted and centered, in the order set on the screen;
- a photo taken sideways is turned upright; a JPEG that is already upright enters the PDF as it is, without a second compression;
- each page of a PDF becomes a JPG as the reader sees it, at 150 or 300 dpi;
- no file of the chosen folder is replaced, and neither the images nor the original PDF are modified;
- the tests of the package, the app and the texts pass, with no compiler warning.

## Decisions

| Topic | Decision | Reason |
|---|---|---|
| Page of an image | A4 (595.28 × 841.89 points), turned to landscape if the image is wider than it is tall; image fitted and centered, with no margin and no option | The rule of the site (`placeOnA4`). No option on the site either |
| Formats read | All that ImageIO reads: JPEG, PNG, HEIC, TIFF… | The Mac does it with no dependency; the site is limited to JPG and PNG |
| Upright JPEG | Its compressed pixels enter the PDF as they are, through the `PDFWriter` of the Scanner | No loss, no added weight |
| Photo data | The location (GPS), the date, the author and the other EXIF and XMP blocks are not copied into the PDF. ImageIO removes them without recompressing | People share a PDF: it must not tell where the photo was taken. Probe of 2 October: same pixels, color profile kept |
| Multi-page TIFF | One row and one page per page of the TIFF, named "file (2)" | Desktop scanners and faxes write multi-page TIFFs; to keep only the first page would be a silent loss |
| Other images | Decoded, turned from their EXIF orientation, put on white, then encoded as JPEG quality 0.9 | `PDFWriter` writes only JPEG. The transparency of a PNG becomes white |
| List | One row per image: number, thumbnail, name, size. Dragging a row or clicking its arrows changes the order; a cross removes it; "Remove all the images" asks for confirmation if the PDF is not saved | The native macOS list can reorder; the arrows are for people who do not drag. The files are read when they are added, except those over 512 MB |
| Limits | 200 images, 512 MB in total | The images stay in memory until the save, like the PDFs of Merge |
| Refused file | A file that is not a readable image is left aside and named in the message; the others enter | One bad file does not block a batch |
| Image of a page | The page as the reader sees it (crop, rotation, annotations), as JPEG. Normal: 150 dpi, quality 0.85. High: 300 dpi, quality 0.92 | The two qualities of the site. The long side is capped at 6,000 pixels, as in Redact |
| Image names | `name-1.jpg`, `name-2.jpg`… in the chosen folder; `name.jpg` for a single page; `-2` added if the name exists | A file is never replaced, as in Split |
| Signed PDF | PDF to images opens it: no PDF is written, and the signature is not at risk | The other tools refuse it because they rewrite the PDF |
| Progress | "Page 4 of 12…" with "Cancel", through the cancelable task of the shared session | A long PDF in high quality takes time: 40 s for 500 pages at 300 dpi |
| Interrupted conversion | Canceled or failed, it removes the images that it had just written | Half a conversion is of no use, and these files are always new files |
| Panels | The session is busy while a save panel or a folder panel is open | A drop does not replace the document under the panel |
| Monks | "Brother Frame" in his pose from the site; "Brother Illuminator" with the frame, with the focused look | The site gives the same pose to both: on one home screen, two faces are necessary |

## What changes in the shared building blocks

- `PDFOpenedDocument` and `PDFCopySession` take `allowsSigned`, for a tool that does not write a PDF.
- `CopyToolView`: `saveTitle` and `savedTitle` become optional. A tool that saves from its own panel (several files in a folder) does not have the shared button.
- `jpegData` is shared by Redact and by the two tools.

## User flow

**Images to PDF.** Choose or drop images; drag the rows into the order you want; "Create the PDF…" proposes the name of the first image.

**PDF to images.** Open or drop a PDF; choose the quality; "Convert to JPG…" asks for a folder, then shows the number of images and the folder.

## Known limits

- No choice of page size or margin: A4 only, as on the site.
- JPG only as output. The "Extract images" mode arrived on 3 October (see below).
- A screenshot PNG becomes a JPEG: the text in it is a little less sharp than in PNG.
- A photo taken sideways (portraits on the phone) is decoded and recompressed once, quality 0.9: 0.5 s per photo of 36 megapixels, with no progress and no cancel during the save.
- An animated GIF gives its first image.
- HEIC and multi-page TIFF were tried on synthetic files and on the system wallpapers, not on files from a camera.
- Row drag in the list is still to check by hand: it is the first native reorderable list of the app.

## Tests

| Level | What | Where |
|---|---|---|
| Engine, images to PDF | A4 page turned from the shape; JPEG pixels kept without a second compression; location and author of the photo absent from the PDF; one page per page of a TIFF, only one for an animated GIF; image fitted and centered; sideways photo turned upright; transparent PNG on white; empty list and unreadable file refused | `PDFImagePagesTests` |
| Engine, PDF to images | One JPEG per page at the two resolutions; page as the reader sees it, rotation included; signed PDF accepted; stop if an image cannot be written; password | `PDFPageImagesTests` |
| Tools | Order set, image removed, PDF saved, unreadable file named; TIFF of three pages, row arrows; one JPG per page without a replaced file, high quality, single page, folder refused, canceled conversion with nothing left, other PDF | `ImagesSessionTests`, `PageImagesSessionTests` |
| Screens | Start, list, PDF ready; start, ready, images ready; light, dark, English | `ImagesSnapshots` |
| Real files | Four PDFs from `fixtures-private/pdfs`: 15 pages in 0.4 s (normal) and 0.9 s (high); three images bound into a PDF again | Probe of 2 October, not kept |
| Texts | All translated, without the informal « tu » | `check-strings.py` |

## Extract images (3 October 2026)

At the request of the author, PDF to images offers the second mode of the site: "What do you want? Pages to JPG, or Extract images". This mode gives only the photos of the PDF, as they are in the PDF.

| Topic | Decision | Reason |
|---|---|---|
| What counts | The images of the document from 64 to 30,000 pixels per side and 50 megapixels at most; the images placed on the same frame of a page (the background and the sharp layer of a scanner, even as an `/ImageMask true` mask: the adaptive compression of Acrobat) are one photo, and a mask alone is not a photo; the same group of images drawn on several pages, or the same photo stored twice, comes out once (same objects, or same file byte for byte); an image that the page does not show (off the page, smaller than one point, or that the page cannot decode: the frame stays white) is not written, and counts for the next page that shows it | The rules of the site. The images written in the content itself (`BI … EI`) are bullets: left out |
| Pixels | A JPEG comes out as it is in the PDF, byte for byte, when a JPEG reader would see it as the page shows it: bare `/DCTDecode` stream, device colors or an ICC profile that leaves the primaries, the mid gray and the white where sRGB puts them (profile of 64 KB at most), no mask and no decode array, and a full decode that proves that it reads at the announced pixel size; everything else (painted image, Flate, wide profile like Adobe RGB or Display P3, CMYK, JPEG 2000, mask, palette, layers) is cut out: only the frame of the image is drawn, within its outline (a rotated image does not take its neighbors into its corners), at the resolution of the image along its sides, 6,000 pixels and 16 megapixels at most, on white. No other stream is copied out of the document: a Flate stream of 64 × 64 can inflate to 3 GB | Better than the site for JPEGs, which get no second compression; for the rest, the page can draw what Core Graphics does not read back |
| Count | `PDFPhotos.count` after the document opens, in the background (`PDFCopySession.read`), without decoding an image: the screen says "Counting the photos…" then "Photos in this PDF: 4", and with no photo the choice goes back to pages | Probe of 3 October: 15 pages counted in 0.1 s, but 1.8 s for 142 pages: the opening must not wait |
| Files | `name-photo-1.jpg`, `name-photo-2.jpg`… in the chosen folder, in page order; the progress tells the page being read; the cancel acts between two images; a run with no file says so: "No photo could be taken out of this PDF: convert its pages instead" | Like the pages |

Probe of 3 October on `fixtures-private/pdfs`: the NASA sheet gives its 4 photos in 84 ms (1,771 × 1,271 at most), the arXiv article its 3 figures, the W-9 form nothing; after the review, the scanned cookbook (296 pages, two layers per page, JBIG2 and JPEG 2000) gives 296 photos of 2,400 × 3,600 in 97 s, with the text sharp on its yellowed background.

Review of 3 October: three crashes on false sizes (integer overflow, scale of 10⁻¹⁵) and wrong outputs (CMYK JPEG in negative; ICC profile lost, since the photos of the NASA sheet are in Adobe RGB and not in sRGB; `/ImageMask false` taken for a mask; two-layer scan in two files; text of a scan in a mask lost; cutout cropped by the whole page at 6,000 pixels; neighbors in the corners of a rotated image; image lost when it shows alone after it was covered; truncated JPEG copied as it is; Flate stream inflated to 6.5 GB in memory; cancel ignored on the pages without an image; mode changed while the folder panel was open). All fixed, with tests on PDFs written by hand (`PDFPhotosTests`).

Limits: what the page draws over a cut-out image, within its outline, stays on top; an image with identical pixels but encoded in another way comes out twice; a scanned PDF gives the photo of each page; a cut-out image comes out in the orientation in which the page shows it and with the proportions of its frame (stretched on the page, stretched in the file), while a JPEG kept as it is comes out in its own; the count can be higher than the number of files (an image that the page does not show, or with the pixels of another image); the part of a cut-out image that goes past the page or its clipping comes out white; an ICC profile that Core Graphics does not read, or that is larger than 64 KB, sends the JPEG to the cutout.
