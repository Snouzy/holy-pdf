# Mac app: Holy PDF design system, design

_Written on 1 October 2026. Status: Swift app removed on 5 October 2026 (tag `mac-final`); at the time, shipped in `apps/mac`._

## Context

The Mac app (`apps/mac`) ships the Scanner v1 ([spec](2026-09-29-scanner-mac-v1-design.md)). Its interface is the interface of the system: the provisional name "PDF Toolbox", one SF icon per tool, no app icon, and French texts that use the informal « tu ».

The site already carries the Holy PDF brand: see [Brand identity](../product/brand.md) and the [Web design system spec](2026-09-30-web-design-system-design.md). Its monks are Preact components that produce SVG (`apps/web/src/illustrations/`), and its colors are in `apps/web/src/styles/tokens.css`.

This spec applies the brand to the Mac app. It reuses the drawings and the colors of the site, without copying them by hand.

## Goal and success criteria

At opening, you recognize Holy PDF as on the site: the name, the icon, the monks, the blue, the title font and the voice. The app stays a Mac app: menus, shortcuts, dark mode, VoiceOver and accessibility settings work as before.

The spec succeeds when:

- the Dock, the app menu, the window and "About" say "Holy PDF", with the brand icon;
- the home screen shows the available tools in a grid with their monks, and the upcoming tools as sleeping monks;
- the start screen, the tips banner and the toasts have their monk;
- all the French texts use the formal « vous »;
- the images of the app are produced from the components of the site, and a test fails if they are no longer up to date;
- the tests of the package, the app and the site pass, and the manual checklist passes in light, in dark, in French and in English.

## Scope

**In the spec:**

- the name Holy PDF in the app;
- the app icon;
- the accent color;
- the font of the large titles, the highlighter and the title emojis;
- the Scanner monk, "Brother Snap", and his scene, drawn in the components of the site;
- the home screen "The monastery", the start screen, the tips banner, the toasts;
- the switch to « vous » in all the French texts of the app;
- the export of the site images to the app, and its test.

**Out of the spec:** the board and the correction screen (they take only the accent color), a monk bubble that comments on the board, Figtree in the app, the iPhone app, the Scanner tool on the site, the final illustrations by an illustrator.

## Decisions

| Topic | Decision | Reason |
|---|---|---|
| Source of the drawings | The Preact components of the site stay the only drawing. A Vitest test renders them as SVG for the app, with the colors resolved in light and in dark, and compares the result to the files of the image catalog. `UPDATE_MAC_ASSETS=1 pnpm test` rewrites the files | A drawing changed on the site breaks the test until the app is up to date: the two never diverge silently |
| Rejected | Redraw the monks in SwiftUI | Two drawings to keep identical |
| Rejected | Copy the SVGs once by hand | The two diverge and nobody sees it |
| Image format | SVG in the image catalog of the app (`Assets.xcassets`), "Preserve Vector Data", one dark variant per image | Sharp at all sizes, with no PNG to regenerate. The catalog chooses the variant from the appearance |
| Exported SVG | Only `path`, `circle`, `ellipse`, `rect`, `polygon`, `g` (with `transform`), `clipPath`. No CSS variable, no `text`, no nested `svg` | The Apple SVG engine does not read CSS variables, and its other limits are not documented: we give it the simplest subset |
| Voice | « Vous » in all the French texts | A single voice for the brand, the voice of the site and of the monks. Choice of the author |
| Monks | Home screen, start screen, tips banner, toasts. Nothing on the board or in the correction screen | Users work there: the monks stay at the entrance and in the messages. Choice of the author |
| Fonts | Bricolage Grotesque 800 for the large titles only. The rest in the system font | The controls stay native and follow the accessibility settings. Choice of the author |
| Home screen | The available tools in an adaptive grid of compact cards, the upcoming tools as sleeping avatars, not clickable | Two tools side by side from 960 points, then more columns as the width grows. Correction requested by the author on 1 October 2026 |
| Colors | The accent color of the app becomes the main color of the brand. The backgrounds and the texts stay those of the system. The orange of the pages to check does not change | The brand shows on the buttons, the selection and the focus, without repainting a Mac app |
| Name | The product is called "Holy PDF". The identifier `com.snouzy.pdftoolbox` and the Swift module `PDFToolbox` do not change | The name shows everywhere, and we do not lose the sandbox folder or rename the code |
| Icon | The haloed head of the favicon, on a yellow background, full frame. First an Icon Composer file (`.icon`); if it does not give an icon on macOS 15, a classic full-frame `AppIcon` | See "Icon" |
| Trademarks | The name enters the app before the INPI, EUIPO and USPTO check | The app is not published. The check is still to do before any publication ([Brand identity](../product/brand.md)) |

## Structure

```
apps/web/
  src/illustrations/
    Monk.tsx              + the "phone" accessory
    Scene.tsx             + the "scan" scene
  src/cast.ts             the upcoming "scan" tool takes the "phone" accessory
  scripts/subset-fonts.py + the Bricolage Grotesque 800 TTF for the app
  tests/unit/macAssets.test.ts   renders the app images, compares them, rewrites them on request
apps/mac/
  PDFToolbox/
    Assets.xcassets/      AccentColor, brand colors, exported images
    HolyPDF.icon/         the icon (or AppIcon in Assets.xcassets, see "Icon")
    Fonts/                BricolageGrotesque-ExtraBold.ttf and its OFL license
    App/Brand.swift       font registration, title font, highlighter
    App/RootView.swift    the home screen "The monastery"
    Features/Scanner/     start screen, tips banner and toasts with their monk
  PDFToolboxTests/BrandTests.swift
  scripts/check-strings.py  + flags the informal « tu »
```

The project uses synchronized folders: a file added under `PDFToolbox/` enters the target without a change to the project. Only the name (`PRODUCT_NAME`, `PRODUCT_MODULE_NAME`, `INFOPLIST_KEY_CFBundleDisplayName`) and, if necessary, the icon name change in `project.pbxproj`.

## Exported images

The test `macAssets.test.ts` renders each image with `preact-render-to-string`, replaces each `var(--…)` with its value from `tokens.css` (light block, then dark block), and writes one `.imageset` folder per image, with its two SVGs and its `Contents.json`. It owns the `Assets.xcassets/Generated/` folder: it also writes there the colors of the "Colors" section, and any file there that it did not produce is an error. Last, it writes the head of the icon, `HolyPDF.icon/Assets/head.svg`, from `apps/web/public/favicon.svg`.

| Image | Content |
|---|---|
| `monk-scanner` | Brother Snap in full, "happy" mood, "phone" accessory |
| `scene-scan` | the Scanner scene, color of the "Optimize" category |
| `avatar-scanner-happy`, `-focus`, `-joy`, `-oops` | the avatar of Brother Snap in four moods, "Optimize" tint |
| `sleep-<accessory>-<category>` | one sleeping avatar per pair of accessory and category of the site (`cast.ts`, ready and upcoming tools) |

The avatar is composed in pure SVG, with the same measurements as `Avatar.tsx`: the tinted disk, the monk clipped by the path of `avatarClip` (a `clipPath`), then the accessory and the hand on top. The nested monk becomes a group with `transform` (its `viewBox` of 200 × 220, scaled).

The test also fails if an exported SVG contains `var(`, `<text` or a nested `<svg`.

## Brother Snap and his scene

- **"phone" accessory**: a yellow phone (`--rope`) held in the right hand, its back toward the viewer, its lens circled in ink, and three "click" lines. It is drawn over the hand, like the other accessories.
- **"scan" scene**: on the left, a gray photo with a skewed sheet and its four corners marked in the category color; an arrow; on the right, the sheet, straight and white, with its lines of text.
- **Texts**: « Frère Déclic » ("Brother Snap"). Card sentence: "Your document photos become clean PDFs."
- On the site, the sleeping avatar of the "scan" tool takes the phone instead of the sheet.

The current Web branch (`feat/web-parcours`) also modifies the list of scenes (`SceneKind`) and the end of `SceneDrawing`. The branch merged second will have a conflict in these two places. Resolve it by keeping both additions.

## Colors

In `Assets.xcassets/Generated/`, each color has its light value and its dark value, written by the export test from `tokens.css`:

| Color | Light | Dark | Use |
|---|---|---|---|
| `AccentColor` | `#2346D8` | `#8FA2FF` | buttons, selection, focus, links |
| `Highlight` | `#FFE45C` | `#FFD84A` | the highlighter of a title |
| `OnHighlight` | `#141A2E` | `#111527` | the highlighted text |
| `Stamp` | `#C8321B` | `#FF6B57` | the "Soon" stamp |

As on the site, the highlighter band covers the bottom of the letters in light mode (from 55 to 92% of the height) and the whole word in dark mode (from 8 to 92%). At most one highlighted group of words per screen.

## Fonts

- `subset-fonts.py` also writes `apps/mac/PDFToolbox/Fonts/BricolageGrotesque-ExtraBold.ttf`: the same source and the same letters as the site, without WOFF2 compression, because macOS loads TTF fonts. The OFL license is copied next to it.
- `Brand.registerFonts()` registers the font at launch (`CTFontManagerRegisterFontsForURL`). Its PostScript name is `BricolageGrotesque96ptExtraBold-ExtraBold`.
- `Font.brandTitle(size:)` gives Bricolage Grotesque 800, relative to `.largeTitle`. A letter that is not in the subset takes the system font.
- Titles concerned: the home screen, the start screen, the export sheet.

## Screens

### Name and menus

The app menu says "Holy PDF" ("About Holy PDF", "Quit Holy PDF"), like the Dock and the window of the home screen.

### Home screen, "The monastery"

- Title in Bricolage: "Your PDFs, on your Mac 🙏", with "on your Mac" highlighted. Under the title: "Everything runs here: nothing is sent."
- "The monastery" section: an adaptive grid (`LazyVGrid`, columns of 340 points minimum, spacing of 16 points) shows the available tools. Two cards fit side by side in the minimum window of 960 points. The illustrations take 112 × 112 points, the Bricolage titles 22 points, and the descriptions stay readable. The whole card opens its tool. On hover, it lifts and the pointer becomes a hand, like a page of the board.
- "Soon 🕯️" section: the tools of the site that the app does not have, as sleeping avatars with their name and the "Soon" stamp. They are not clickable. VoiceOver reads "Split, coming soon".
- The list is written in Swift, in the order of the site: each tool of `cast.ts`, ready or upcoming, except "scan". Each tool has its name in the string catalog and its image `sleep-<accessory>-<category>`. When the site adds a tool, the app shows it only after it is added to this list.
- The monks are decorative: VoiceOver does not read them.

### Start screen

- Brother Snap at the top of the drop zone, in place of the icon.
- Title in Bricolage: "Drop your document photos 📸". The three steps do not change.

### Tips banner and toasts

- The "happy" avatar replaces the light bulb of the tips banner.
- The save toast takes the "focus" avatar during the write, "joy" when the file is saved, "oops" on an error. The texts of the toasts do not change, apart from the switch to « vous ».

### Export sheet

Title in Bricolage, without emoji.

## Voice

All the French texts of the app switch to the formal « vous », for example:

- « Dépose tes photos de documents ici » → « Déposez vos photos de documents 📸 »;
- « Tu pourras l'annuler avec ⌘Z. » → « Vous pourrez l'annuler avec ⌘Z. »;
- « Ces coins ne forment pas une page : garde les quatre coins dans l'ordre, autour de la page. » → « … gardez les quatre coins dans l'ordre, autour de la page. »

The English texts do not change. The Scanner spec and the manual checklist, which quote these texts, change in the same commit.

`check-strings.py` also flags a French text that contains « tu », « te », « toi », « ton », « ta » or « tes ». An imperative in the « tu » form (« Glisse ») cannot be found from one word: the review checks it.

## Icon

The haloed head of `apps/web/public/favicon.svg`, enlarged on a yellow background (`#FFE45C`) that fills the whole square: macOS 26 cuts the icon into a squircle and does not put it in a gray frame.

1. **First**: an Icon Composer file `HolyPDF.icon`, written by hand (`icon.json` and an SVG layer), selected in the target settings. `ictool` renders it to check the drawing. The build must also give an icon to macOS 15: we check in the built app that a classic icon is present (`AppIcon.icns` or its renders in `Assets.car`).
2. **If not**: a classic `AppIcon` in `Assets.xcassets`, full frame, from 16 to 1,024 px, rendered by `ictool` from the same `.icon`. macOS 26 cuts it into a squircle; macOS 15 shows it square. This is accepted until Xcode can produce both.

Choice made: option 1, the Icon Composer file `apps/mac/PDFToolbox/HolyPDF.icon`, declared in the target settings (`ASSETCATALOG_COMPILER_APPICON_NAME = HolyPDF`). Checked on 1 October 2026 on a Mac.

## Tests

| Level | What | Where |
|---|---|---|
| Images | The images of the catalog are the images that the site components render; no SVG has a CSS variable, text or a nested `svg` | `apps/web/tests/unit/macAssets.test.ts` |
| Site drawings | The existing illustration tests pass with the new accessory and the new scene | `apps/web/tests/unit/illustrations.test.ts` |
| Font | The font registers and `NSFont(name:size:)` finds it | `apps/mac/PDFToolboxTests/BrandTests.swift` |
| App images | Each image and each color named in the code exists in the catalog | `BrandTests.swift` |
| Screens | The screenshots of the home screen, the start screen and the banner are made again and reviewed | `ScreenSnapshots.swift` |
| Texts | No text without French, no misplaced space, no « tu » | `check-strings.py` |
| By hand | Three more steps in `wiki/development/tests.md` | see below |

Steps added to the manual checklist:

1. In dark mode, the monks of the home screen, the start screen, the banner and the toasts take their dark colors.
2. On macOS 26, the icon in the Dock and in the Finder has no gray frame; the app menu says "Holy PDF".
3. In French, no text uses « tu ».

## Technical rules

The rules of the [technical guide](../development/technical-guide.md). One exception, to write there: the accent color of the app is the color of the brand, not the color of the system. The other colors stay system colors and semantic colors.


### Control hover: 2 October 2026

The buttons of Scanner, Sign and Merge share `.buttonHover()`: lighter in dark mode, darker in light mode, and a link pointer. The effect respects disabled controls and Reduce motion. It keeps the dimensions, the keyboard focus and the native behavior of the buttons.
