# Scanner algorithm

_Language-independent reference. Worked out on 29 September 2026 with the Python/OpenCV prototype (`tools/prototype/scan.py`), on a real batch of 17 photos. It served as the model for the Swift implementation (removed on 5 October 2026, tag `mac-final`) and serves as the model for the site's Scanner._

## Steps for one page

```
photo → loading → detection → perspective correction → turning upright → cleaning → eraser → JPEG + OCR
```

All positions are in normalized page coordinates (0 to 1, origin at the top left).

## 1. Loading

- EXIF orientation applied;
- reduced to 4,096 px on the long side;
- capture date read from the EXIF (`DateTimeOriginal`).

## 2. Detection

1. Document detector of the platform (Vision `VNDetectDocumentSegmentationRequest` on Apple; on the site, the largest four-sided outline found with OpenCV, `apps/web/src/scan/detect.ts`): an approximate quadrilateral. On Apple, an observation with a confidence below 0.5 counts as a failure. On the site, no four-sided outline between 20% and 95% of the photo counts as a failure. With no result, the quadrilateral is the whole photo, and the page is to be checked.
2. Refinement of each edge, on the grayscale image reduced to a quarter and then blurred (binomial kernel 1-4-6-4-1):

| Parameter | Value |
|---|---|
| Samples per edge | 80, from 6% to 94% of the length |
| Profile | along the outward normal, ±3% of the short side of the reduced image |
| Drop | `I(s) − I(s+3)`; outside the image, `I = 0` |
| Sample kept if | maximum drop > 12 (out of 255) |
| Position kept | the outermost one whose drop exceeds 60% of the maximum |
| Line | total least squares, 4 passes, rejection beyond max(1.5, 2.5 × median of the residuals) |
| Corners | intersections of the neighboring lines |

The "outermost" position, and not the "maximum drop": on an invoice, the bold header just under the edge dropped more than the edge of the paper, and the top of the document was cropped.

3. Page to check if: the ratio of the sides is more than 6% from √2 and from US Letter (11/8.5), an edge keeps less than 70% valid samples, or a refined corner is more than 1% of the diagonal away from the detected corner.

## 3. Perspective correction

- Perspective correction to a rectangle.
- Size: width = mean of the top and bottom edges, height = mean of the left and right edges. If the ratio is less than 6% from √2, it is set to √2, with a long side of 2,339 px (A4 at 200 dpi). If not, the short side is 1,654 px. The long side is never more than 7,016 px: above that, the two sides are reduced in the same ratio.

## 4. Turning upright

Fast OCR on a reduced version (1,200 px), in the 4 orientations. Score of an orientation: sum of confidence × number of characters. The best orientation wins, 0 without text. Rotation by quarter turns, clockwise.

## 5. Cleaning

Calculations on the encoded sRGB values (gamma), between 0 and 1.

**Document mode:**

| Step | Parameter |
|---|---|
| Paper estimate, fine | dilation, disk of radius 7 px |
| If watermark kept: closing | dilation then erosion, radius 45 px, applied to the fine estimate |
| If watermark kept: shadow mask | `m = clamp((0.92 · L − g) / (0.1 · L))`, blur σ 10, where `g` = gray of the closing and `L` = local lit paper (dilation of radius 200 px, calculated at quarter resolution, blur σ 40) |
| If watermark kept: blend | `m · fine + (1 − m) · closing` |
| Smoothing | 21 px median in the prototype; Gaussian blur on Apple (Core Image has no large median) and on the site |
| Division | page ÷ estimate |
| Levels | black 0.12, white 0.86, then power 1.35 |
| Sharpness | 1.5 × image − 0.5 × blur σ 1.2 |
| Margin | 24 white px around the edge |

Why the blend: the closing fills the wide strokes of the watermark, which otherwise come out hollow. But in a shadow, it also fills the narrow streak between two shadow areas, which then stays gray. The mask gives the fine estimate back to the shadow areas.

**Color mode** (security background, photo): each channel is stretched between its 0.5 and 99 percentiles.

**Watermark kept or not:** kept if more than 2.4% of the pixels inside the page (excluding 10% margins, calculated at quarter resolution) have a closing that is more than 0.08 above the fine estimate, outside shadow (shadow mask < 0.5).

## 6. Eraser

White areas painted after the cleaning: polygons, or brush strokes (radius as a fraction of the page width).

## 7. Output

- JPEG quality 80 on the libjpeg scale (the OpenCV scale), without metadata. ImageIO has its own scale: 0.8 gives the libjpeg 94 tables there, 0.53 gives the libjpeg 80 to 81 tables (ImageMagick estimate). In Chromium and Firefox, quality 0.8 is libjpeg 80. Safari encodes through ImageIO: not measured;
- PDF: one page per image, JPEG embedded without recompression, invisible OCR text under the image;
- page size: A4 for √2, otherwise the pixel size at 200 dpi; A5 or Letter as an option.

## Document suggestions

- **Grouping**: a page joins the previous one if their markers follow each other (`x/n`, `Pagina x din n`, `Page x of n`, `Page x sur n` in the top 10% or the bottom 12%, or a lone number centered at the bottom).
- **Title**: the tallest line (box height) in the top 40% of the first page, among the lines of at most 4 words, at least 3 letters and an OCR confidence of at least 0.5, without the lines that come back in at least max(2, ⌈n/3⌉) of the n documents of the batch. Logos come back from the OCR as words with confidence 0.3; on a skewed page, the box of a long line of text is taller than the box of the title; two documents of the same type share their title.
- **Date**: the most recent one that is not after the capture date of the first photo, ignoring dates before 1990 and validity lines (text folded without accents or case that contains `valabil`, `valable`, `valid until`, `valid till`, `valid through`, `valid to` or `expir`; `valid` alone would also catch "validat" or "invalid"): an end of validity can come before the photo, but it is never the issue date.
- **Name**: `YYYY-MM-DD_Title`, title in ASCII, 6 words at most.

## Measurements

### Python prototype, 29 September 2026, private batch of 17 photos

| Measurement | Value |
|---|---|
| Pages with wrong auto corners | 9 (sheet that covers a corner, folded corner) |
| Pages lying on their side | 7 |
| Pages with a watermark | 4 |
| Pages in Color mode | 1 (certificate with a security background) |
| Mean size of a PDF page | ≈ 390 KB |

### Swift implementation, private batch of 17 photos

_Measured on 30 September 2026, MacBook Pro M1 Pro (10 cores), macOS 26.4, release build, machine in use (load average from 5 to 22, given next to the times)._

| Spec criterion | Expected | Measured |
|---|---|---|
| Pages with wrong corners flagged | all (9 in the prototype) | 10 / 10. A page is wrong if an auto corner is more than 1.5% of the diagonal away from the corrected corner: the wrong ones are between 6.8 and 13.3%, the correct ones at 0.2% at most |
| Good pages flagged by mistake | ≤ 2 | 1 (photo 01) |
| Pages turned upright | 17 / 17 | 17 / 17 |
| Watermark detected correctly | 16 / 16 (excluding Color mode) | 16 / 16 |
| Documents grouped correctly | ≥ 10 / 11 | 10 / 11 |
| Correct dates | ≥ 9 / 11 | 9 / 11 (8 / 11 before validity lines were ignored) |
| Time per page | < 1 s | 0.61, 0.79 and 0.77 s on the 3 pages of the test (minimum of 3 runs, load 5 to 8). On the 17 pages in series: 0.79 s on average, 0.96 s at worst (best of 2 passes). An isolated pass goes up to 1.47 s under load. At a load average of 16 to 22 (browser), a single pass measures 1.3 to 3.0 s |
| Whole batch | < 20 s | 9.7 to 12.4 s; 10.0 s at the last measurement (load 5 to 8); 14.6 and 18.2 s at a load of 16 to 22 |
| Mean size per page | < 500 KB | 412 KB (prototype JPEG: 402 KB); two PDFs are above 500 KB per page: the certificate in Color mode (592 KB) and the first 3 pages of the contract (518 KB) |
| Mean difference from the prototype (gray levels) | < 10 | min 0.5 / max 8.1 (photo 06, Color mode); the 16 pages in Document mode are at 4.8 at most |

Thresholds kept: `weakEdgeRatio` 0.7 (unchanged), `maxCornerShift` 0.01 (instead of 0.02), `minCoverage` 0.024 (instead of 0.015), `fillThreshold` 0.08 (unchanged), smoothing: Gaussian blur σ 5 (unchanged), ImageIO JPEG quality 0.53 (instead of 0.8).

- `maxCornerShift`: at 0.02, photos 06 and 14 (a corner under another sheet) were not flagged. On them, the refinement moves a corner by 1.1% and 1.5% of the diagonal. On the good pages, it moves it by 0.7% at most, except photo 01 (1.3%: Vision was wrong, the refinement corrects it). 0.01 flags the 10 wrong pages. `weakEdgeRatio` was not sufficient: at 0.85, it flagged a good page (photo 17, 0.79) and let photo 13 through.
- `minCoverage`: the threshold of 0.015 already separated the pages, but photo 02, without a watermark, went up to 0.0144 with the automatic corners. 0.024 is the middle of the gap measured with the corrected corners (0.0121 / 0.0360).
- JPEG quality: 0.8 in ImageIO gives the libjpeg 94 tables, and 608 KB per page. 0.53 gives the libjpeg 80 to 81 tables (the prototype: 80), and 412 KB per page. The difference from the prototype does not move (+0.1 at most).

| Photo | Document | Auto corners | Watermark | Filled share (corrected / auto corners) | Difference from the prototype |
|---|---|---|---|---|---|
| photo 01 | deed, p. 1 | correct, flagged | no | 0.0036 / 0.0035 | 2.4 |
| photo 02 | deed, p. 2 | wrong, flagged | no | 0.0121 / 0.0144 | 0.8 |
| photo 03 | report, p. 1 | wrong, flagged | yes | 0.0412 / 0.0543 | 3.0 |
| photo 04 | report, p. 2 | wrong, flagged | yes | 0.0360 / 0.0419 | 2.7 |
| photo 05 | report, p. 3 | wrong, flagged | yes | 0.0361 / 0.0420 | 2.7 |
| photo 06 | certificate (security background) | wrong, flagged | Color mode | — | 8.1 |
| photo 07 | certificate | wrong, flagged | no | 0.0067 / 0.0058 | 1.8 |
| photo 08 | certificate | wrong, flagged | no | 0.0059 / 0.0042 | 1.6 |
| photo 09 | attestation | correct | yes | 0.0519 / 0.0521 | 2.7 |
| photo 10 | declaration | correct | no | 0.0012 / 0.0024 | 3.4 |
| photo 11 | contract, p. 1 | correct | no | 0.0019 / 0.0023 | 3.2 |
| photo 12 | contract, p. 2 | wrong, flagged | no | 0.0014 / 0.0017 | 4.8 |
| photo 13 | contract, p. 3 | wrong in Swift, flagged | no | 0.0000 / 0.0000 | 4.7 |
| photo 14 | contract, p. 4 | wrong, flagged | no | 0.0107 / 0.0085 | 4.5 |
| photo 15 | declaration | correct | no | 0.0000 / 0.0000 | 0.5 |
| photo 16 | invoice | correct | no | 0.0030 / 0.0029 | 4.1 |
| photo 17 | invoice | correct | no | 0.0019 / 0.0016 | 3.6 |

Time for one page, per step (mean in series): accurate OCR 36%, turning upright (4 fast OCR passes) 20%, HEIC loading 18%, watermark 11%, detection and refinement 10%, cleaning 5%, JPEG 1%. The edge refinement does not dominate: moving it to Accelerate would gain almost nothing.

Determinism: two batches in parallel and one batch in series give identical `report.json` files on each field (orientation, reasons, corners, watermark, grouping, names, bytes). The batch with 13 PDFs, seen once during development, does not occur again.

Romanian OCR: Vision correctly reads, at confidence 1, the titles in capitals with their diacritics (Î, Ă, Ș, Ț) and the ș, ț of the headers. In the body text, ă sometimes comes out as ä or å, and i as ı. The IQNET certification logo of the headers comes out as "IQNET", "IONET", "LIQNET" or ":IQNET", always at confidence 0.3, like an invoice logo read as a random word. The markers "Pagina x din 3" and "1/2" are read correctly. The lone numbers centered at the bottom are read at confidence 0.3 to 1, and one is missing (photo 14). The dates `dd.mm.yyyy` and `dd/mm/yyyy` are read correctly on the 17 pages, except one year (2026 read as 2125, discarded because it is in the future). The confidence of Vision takes only three values: 0.3, 0.5 and 1.

Turning upright: the fast OCR score in the correct orientation is above the score of the opposite orientation by 4% (photo 17) to 87% (photo 02), median 21%. The two fallbacks considered do not work. Accurate OCR on the best orientation and its opposite prefers the upside-down orientation on 5 pages. The corner order of the Vision observations does not tell anything either: Vision returns upright boxes for upside-down text.

Known gaps:

- **Dates, 2 wrong.** Report (photos 03 to 05): the rule takes a later date cited in the body text, not the issue date of the report. Contract: split (next point), its first 3 pages now carry only a date cited in the text. The attestation (photo 09), which took its end of validity ("valabilă până la data"), is correct since the rule ignores validity lines.
- **Grouping, 1 wrong.** Contract split into 3 + 1: Vision does not read the lone "4" at the bottom of photo 14, whose auto crop is wrong (7.5% of the diagonal at one corner). Lone numbers are fragile: with the auto corners, Vision reads 1, 2 and 3; with the corrected corners, it reads 2 and 4, and no longer 1 or 3.
- **Corners.** 10 pages have wrong auto corners in Swift, against 9 in the prototype: on photo 13, the corner under another sheet is off by 6.8% of the diagonal, where the refinement of the prototype found it. On photos 02, 12, 13 and 14, the refinement moves the hidden corner further from its true place than Vision does. All these pages are flagged. Photo 01 is flagged although its final corners are correct.
- **Titles**, outside the criteria: 7 correct out of 12 (2 with the old rule, which also put an address in two names). Wrong: the titles of the deed and of the contract are printed smaller than the headers above them, the report takes the name of the city, the invoice its number.
- **Time**: the margin is thin on M1 Pro, and an isolated pass is above 1 s under load.
- **Watermark**: the test summary page now has 4 strokes, at 0.0338 (0.0253 with 3 strokes, too close to the threshold of 0.024). The detector also triggers on thick solid black bars. On the real pages without a watermark, it stays below 0.0144.
