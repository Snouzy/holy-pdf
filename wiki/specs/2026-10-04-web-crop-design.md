# Web: Crop a PDF

_Written and shipped on 4 October 2026. Requested on 4 October, after the comparison with iLovePDF. The Mac app, removed on 5 October 2026, never had this tool._

Brother Framer (`/fr/rogner-pdf`, `/en/crop-pdf`) keeps the chosen area of one page, or of all pages, and saves the copy.

## Goal

The spec succeeds when:

- you draw the area to keep on the displayed page, then move it or resize it by its handles;
- the area applies to all pages, or to the displayed page only;
- the copy shows exactly the drawn area, rotated pages included;
- nothing else changes in the file.

## Decisions

| Topic | Decision | Reason |
|---|---|---|
| Engine | `engine/crop.ts` sets the CropBox of each target page (`FPDFPage_SetCropBox`) to the area, converted from the axes of the page as the viewer shows it (`pageFrame`) to the axes of the file | It is the box that viewers display and print. A page that is already cropped is cropped within its visible box |
| Content outside the area | It stays in the file, hidden. The pages and the FAQ say so, and point to Redact to remove it | To remove the content, the page would have to be redrawn as an image, like Redact does |
| Area | In fractions of the displayed page, from its top left corner. On all pages, the same fraction of each page | Pages of different sizes lose the same share of their margins |
| Drawing | Dragging on the page, outside the area, draws a new area; dragging inside the area moves it; eight handles resize it. At least 2% of the page in each direction, with a rounding tolerance on the engine side. Below 64 px on screen, the area keeps only its four corners, with no enlarged touch zone | Like iLovePDF. A handle pushed to the minimum gave 0.019999… and the engine refused the area. A small area covered with handles could no longer be moved |
| Start | The area leaves a 5% margin on each side | You see the box and its handles at once |
| Pages | "All pages" (default) or "Page N only" | Like iLovePDF |
| Size | The panel shows the size of the cropped page in millimeters | You know what you get before you save |
| Signed PDF | Refused (`alreadySigned`) | Any rewrite invalidates the signature |
| Protected PDF | Opened with its password; the copy keeps it | Like Bookmarks and Edit |
| Monk | "Brother Framer" (« Frère Cadreur »), the frame, joyful, Edit category | To frame is to choose what you keep |

## Known limits

- No automatic crop to the content.
- One area per save: to crop two pages differently, save twice.
- The content outside the area comes back if you enlarge the box again in another program.

## Tests

- Engine (`tests/engine/crop.test.ts`): box reread by pdf.js on all pages or on one page; page rotated by 90° and by 270°; page already cropped; the mark left in the area stays at the same relative place; area pushed to the minimum by a handle accepted; impossible area refused; signed PDF refused, protected PDF that stays protected.
- Model (`tests/unit/cropBox.test.ts`): area drawn in both directions, moved without leaving the page, resized by each handle, minimum size.
- Browser (`tests/e2e/crop.spec.ts`): area drawn, all pages or one page, copy reread. The displayed size can vary by one millimeter from one browser to another: the test accepts it.
