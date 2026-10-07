import textLatin from "../fonts/figtree.woff2?url";
import titleLatin from "../fonts/bricolage-grotesque.woff2?url";

/** The letters of French, English and Portuguese, and the signs the texts use. scripts/subset-fonts.py cuts the fonts to this list. */
const latin =
  "U+0020-007E, U+00A0, U+00AA-00AB, U+00B0, U+00B7, U+00BA-00BB, U+00C0-00C3, U+00C7-00CB, U+00CD-00CF, U+00D3-00D5, U+00D9-00DC, U+00E0-00E3, U+00E7-00EB, U+00ED-00EF, U+00F3-00F5, U+00F9-00FC, U+00FF, U+0152-0153, U+2013-2014, U+2019, U+201C-201D, U+2026, U+202F, U+2192-2193";

/**
 * `optional` never swaps a font in after the first paint: text never moves. It needs the preload to show on a first visit.
 * A letter outside the list, in a file name for example, takes the system font.
 */
function face(family: string, weight: string, url: string, range: string): string {
  return `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};font-display:optional;src:url(${url}) format("woff2");unicode-range:${range}}`;
}

export const fontFaces = [
  face("Bricolage Grotesque", "800", titleLatin, latin),
  face("Figtree Variable", "300 900", textLatin, latin),
].join("");

export const preloadedFonts = [titleLatin, textLatin];
