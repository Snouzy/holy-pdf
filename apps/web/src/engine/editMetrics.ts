import { standardWidths } from "./standardWidths";
import type { Box, EditFont, PageFont, Point } from "./types";

/** From the top of a line to its baseline, per point of size: the Ascender of each standard font's metrics. */
export const ascent: Record<EditFont, number> = { Helvetica: 0.718, Times: 0.683, Courier: 0.629 };
export const lineHeight = 1.2;
export const pdfFont: Record<EditFont, [regular: string, bold: string]> = {
  Helvetica: ["Helvetica", "Helvetica-Bold"],
  Times: ["Times-Roman", "Times-Bold"],
  Courier: ["Courier", "Courier-Bold"],
};

/** The signs WinAnsi keeps at 0x80–0x9F, where Latin-1 has control codes. */
const highSigns = "€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ";

export function winAnsiCode(char: string): number | null {
  const code = char.codePointAt(0) ?? 0;
  if ((code >= 32 && code <= 126) || (code >= 160 && code <= 255)) return code;
  const high = highSigns.indexOf(char);
  return high >= 0 ? 0x80 + high : null;
}

/** The width of a line in points, with the advances of the standard font: what PDFium will lay out. */
export function textWidth(text: string, font: EditFont, bold: boolean, size: number): number {
  if (font === "Courier") return [...text].length * 0.6 * size;
  const table = standardWidths[pdfFont[font][bold ? 1 : 0] as keyof typeof standardWidths];
  let total = 0;
  for (const char of pdfText(text)) {
    const code = winAnsiCode(char);
    total += code === null ? 500 : table[code - 32] ?? 500;
  }
  return total * size / 1000;
}

/** Greedy on blanks; a word wider than the box is cut by letters; a line break typed by hand stays. No width: the lines as typed. */
export function wrapped(text: string, font: EditFont, bold: boolean, size: number, width: number | undefined): string[] {
  if (width === undefined) return pdfText(text).split("\n");
  const fits = (line: string) => textWidth(line, font, bold, size) <= width;
  const lines: string[] = [];
  for (const paragraph of pdfText(text).split("\n")) {
    let line = "";
    // `fresh` and not `line === ""`: a line that starts with blanks keeps them, as typed.
    let fresh = true;
    for (const word of paragraph.split(" ")) {
      const joined = fresh ? word : `${line} ${word}`;
      if (fits(joined)) {
        line = joined;
        fresh = false;
        continue;
      }
      if (!fresh) lines.push(line);
      line = "";
      fresh = false;
      for (const char of word) {
        if (line === "" || fits(line + char)) line += char;
        else {
          lines.push(line);
          line = char;
        }
      }
    }
    lines.push(line);
  }
  return lines;
}

export const stampWords: Record<"fr" | "en", string[]> = {
  fr: ["APPROUVÉ", "REFUSÉ", "BROUILLON", "CONFIDENTIEL", "URGENT", "PAYÉ", "REÇU", "COPIE", "ANNULÉ", "SIGNER ICI"],
  en: ["APPROVED", "REJECTED", "DRAFT", "CONFIDENTIAL", "URGENT", "PAID", "RECEIVED", "COPY", "VOID", "SIGN HERE"],
};

export type StampLayout = { stroke: number; radius: number; title: { size: number; x: number; y: number }; date: { size: number; x: number; y: number } | null };

/** The word fills the frame, the date sits under it; both are centred. Sizes in points, `y` a baseline from the page's top. */
export function stampLayout(box: Box, text: string, date: string | null): StampLayout {
  const inner = box.width * 0.84;
  const fit = (value: string, bold: boolean, tallest: number) => Math.max(1, Math.min(tallest, value ? inner / textWidth(value, "Helvetica", bold, 1) : tallest));
  const title = fit(text, true, (date ? 0.46 : 0.6) * box.height);
  const centre = box.x + box.width / 2;
  const dateSize = date ? fit(date, false, 0.2 * box.height) : 0;
  const side = Math.min(box.width, box.height);
  return {
    stroke: Math.max(1.5, side * 0.06),
    radius: side * 0.18,
    title: { size: title, x: centre - textWidth(text, "Helvetica", true, title) / 2, y: box.y + (date ? box.height * 0.37 : box.height / 2) + title * 0.36 },
    date: date ? { size: dateSize, x: centre - textWidth(date, "Helvetica", false, dateSize) / 2, y: box.y + box.height * 0.86 } : null,
  };
}

/** One of the standard 14: `Times-BoldItalic`, `Courier-Oblique`… */
export function standardFont(family: EditFont, bold: boolean, italic: boolean): string {
  if (!italic) return pdfFont[family][bold ? 1 : 0];
  return `${family}-${bold ? "Bold" : ""}${family === "Times" ? "Italic" : "Oblique"}`;
}

/** PDFium's WinAnsi table has no entry for the no-break space: it would come out as « ÿ ». */
export const pdfText = (value: string) => value.replaceAll("\u00a0", " ");
/** A PDF text object is one line. */
export const oneLine = (value: string) => pdfText(value).replace(/\s*\n\s*/g, " ");

/** Whether a corrected text can stay in its font; otherwise it goes to a standard font, which writes WinAnsi only. */
export function keepsFont(font: PageFont | undefined, value: string): boolean {
  if (!font?.usable) return false;
  return font.embedded ? [...oneLine(value)].every((char) => font.chars.includes(char)) : writable(value);
}

/** What the standard fonts can write: their WinAnsi encoding is Latin-1 plus these signs. */
export const outsideWinAnsi = /[^\x20-\x7E\xA0-\xFF€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/u;
export const writable = (text: string) => !outsideWinAnsi.test(text.replaceAll("\n", " "));

/** The shaft ends at `base`; the head is a triangle from the tip to the two wings. */
export function arrowHead(from: Point, to: Point, lineWidth: number): { base: Point; wings: [Point, Point] } {
  const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const along = { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
  const head = Math.min(length, Math.max(10, lineWidth * 5));
  const base = { x: to.x - along.x * head, y: to.y - along.y * head };
  const wing = (side: number) => ({ x: base.x - along.y * head * 0.6 * side, y: base.y + along.x * head * 0.6 * side });
  return { base, wings: [wing(1), wing(-1)] };
}
