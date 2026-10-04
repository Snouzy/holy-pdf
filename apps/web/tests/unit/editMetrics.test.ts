import { describe, expect, it } from "vitest";
import { stampLayout, textWidth, winAnsiCode, wrapped } from "../../src/engine/editMetrics";

describe("text metrics of the standard fonts", () => {
  it("measures a line with the standard fonts' advances", () => {
    expect(textWidth("a", "Helvetica", false, 1000)).toBe(556);
    expect(textWidth("W", "Times", true, 10)).toBe(10);
    expect(textWidth("abc", "Courier", false, 10)).toBe(18);
    expect(textWidth("a a", "Helvetica", false, 1000)).toBe(556 * 2 + 278);
    expect(textWidth("a a", "Helvetica", false, 1000)).toBe(556 * 2 + 278);
    expect([winAnsiCode("€"), winAnsiCode("’"), winAnsiCode("é"), winAnsiCode("ș")]).toEqual([0x80, 0x92, 0xe9, null]);
    // The high signs are measured by their own glyphs, not by WinAnsi's control codes: PDFium's advances, which lay the file out.
    expect([textWidth("—", "Helvetica", false, 1000), textWidth("…", "Helvetica", false, 1000), textWidth("€", "Helvetica", false, 1000), textWidth("’", "Times", false, 1000)]).toEqual([1000, 1000, 667, 333]);
  });

  it("wraps on blanks at the width, cuts a word too wide by letters, keeps typed breaks, and leaves a text without width alone", () => {
    // Courier at 10 points: 6 points a letter, 20 letters in 120 points.
    expect(wrapped("The quick brown fox jumps over the lazy dog", "Courier", false, 10, 120)).toEqual(["The quick brown fox", "jumps over the lazy", "dog"]);
    expect(wrapped("Supercalifragilistic word", "Courier", false, 10, 60)).toEqual(["Supercalif", "ragilistic", "word"]);
    expect(wrapped("one\ntwo three", "Courier", false, 10, 60)).toEqual(["one", "two three"]);
    expect(wrapped("one two\n\nthree", "Courier", false, 10, undefined)).toEqual(["one two", "", "three"]);
    expect(wrapped("", "Helvetica", false, 12, 100)).toEqual([""]);
    expect(wrapped("  item one  two", "Courier", false, 10, 600)).toEqual(["  item one  two"]);
    expect(wrapped("  item", "Courier", false, 10, undefined)).toEqual(["  item"]);
  });
});

describe("stampLayout", () => {
  it("fits the word and the date in the frame, and keeps the frame's corners on a narrow box", () => {
    const box = { x: 0, y: 0, width: 160, height: 50 };
    const dated = stampLayout(box, "CONFIDENTIEL", "4 oct. 2026");
    expect(textWidth("CONFIDENTIEL", "Helvetica", true, dated.title.size)).toBeLessThanOrEqual(160 * 0.84 + 0.01);
    expect(dated.title.y - dated.title.size * 0.72).toBeGreaterThan(dated.stroke);
    expect(dated.title.y).toBeLessThan(dated.date!.y - dated.date!.size);
    expect(dated.date!.y).toBeLessThan(50 - dated.stroke);
    const alone = stampLayout(box, "OK", null);
    expect(alone.title.size).toBeCloseTo(30, 5);
    expect(alone.title.y).toBeCloseTo(25 + 30 * 0.36, 5);
    const narrow = stampLayout({ x: 0, y: 0, width: 40, height: 150 }, "A", null);
    expect(narrow.radius).toBeLessThanOrEqual(20);
    expect(narrow.stroke).toBeCloseTo(2.4, 5);
  });
});
