import { describe, expect, it } from "vitest";
import { documentOf, release } from "../../src/board/document";
import type { Made } from "../../src/board/flow";

const made: Made = { files: [{ name: "a-compressed.pdf", bytes: new Uint8Array([1, 2]) }], zipName: "a.zip", type: "application/pdf", count: 1, before: 2, after: 2, pages: 0 };

describe("documentOf", () => {
  it("carries the sources while nothing was made", () => {
    const source = new File([], "a.pdf");
    expect(documentOf([source], null, null)).toEqual({ files: [source], unsaved: false });
  });

  it("carries the result as files, unsaved until that result was saved", () => {
    const document = documentOf([new File([], "a.pdf")], made, null);
    expect(document.unsaved).toBe(true);
    expect(document.files.map((file) => [file.name, file.type, file.size])).toEqual([["a-compressed.pdf", "application/pdf", 2]]);
    expect(documentOf([], made, made).unsaved).toBe(false);
  });
});

describe("release", () => {
  it("closes every document and the overlay layer, and revokes the previews", () => {
    const closed: string[] = [];
    const revoked: string[] = [];
    const revoke = URL.revokeObjectURL;
    URL.revokeObjectURL = (url) => {
      revoked.push(url);
    };
    try {
      release({ close: (id) => closed.push(id) }, { docs: [{ id: "a" }, { id: "b" }], layer: { docId: "layer" }, previews: ["blob:1"] });
    } finally {
      URL.revokeObjectURL = revoke;
    }
    expect(closed).toEqual(["a", "b", "layer"]);
    expect(revoked).toEqual(["blob:1"]);
  });
});
