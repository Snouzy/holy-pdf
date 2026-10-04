import { describe, expect, it } from "vitest";
import { distinct, outputName, partName } from "../../src/board/fileName";

describe("file names", () => {
  it("adds the action to the first file's name", () => {
    expect(outputName("facture.pdf", "fusionne", "pdf")).toBe("facture-fusionne.pdf");
    expect(outputName("scan.2026.pdf", "split", "zip")).toBe("scan.2026-split.zip");
  });

  it("falls back to 'document' when the name has no stem", () => {
    expect(outputName(".pdf", "merged", "pdf")).toBe("document-merged.pdf");
    expect(outputName("   ", "merged", "pdf")).toBe("document-merged.pdf");
  });

  it("numbers the parts of a split", () => {
    expect(partName("facture.pdf", 2)).toBe("facture-2.pdf");
  });
});

describe("distinct", () => {
  it("numbers the names that come back, so no file overwrites another in a .zip", () => {
    expect(distinct(["scan", "scan", "notes", "scan"])).toEqual(["scan", "scan-2", "notes", "scan-3"]);
  });

  it.each([
    [["a", "a", "a-2"], ["a", "a-3", "a-2"]],
    [["course-2", "course", "course"], ["course-2", "course", "course-3"]],
  ])("never gives a number that another file already has as its name: %j", (stems, names) => {
    expect(distinct(stems)).toEqual(names);
    expect(new Set(distinct(stems)).size).toBe(stems.length);
  });
});
