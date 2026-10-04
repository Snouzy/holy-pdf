import { describe, expect, it, vi } from "vitest";
import { dropTracker } from "../../src/board/dropTracker";

const file = new File(["%PDF-"], "a.pdf", { type: "application/pdf" });
const drag = (types = ["Files"]) => ({
  dataTransfer: { types, files: types.includes("Files") ? [file] : [], dropEffect: "none" as DataTransfer["dropEffect"] },
  preventDefault: vi.fn(),
});

function tracked() {
  const seen: { over: boolean; dropped: File[][] } = { over: false, dropped: [] };
  const tracker = dropTracker(
    (over) => {
      seen.over = over;
    },
    (files) => seen.dropped.push(files),
  );
  return { seen, tracker };
}

describe("dropTracker", () => {
  it("closes the veil without importing a file already handled by a nested importer", () => {
    const { seen, tracker } = tracked();
    tracker.dragenter(drag());
    tracker.drop({ ...drag(), defaultPrevented: true });
    expect(seen).toEqual({ over: false, dropped: [] });
    tracker.dragenter(drag());
    tracker.dragleave(drag());
    expect(seen.over).toBe(false);
  });
  it("lights up when a drag carrying files enters", () => {
    const { seen, tracker } = tracked();
    tracker.dragenter(drag());
    expect(seen.over).toBe(true);
  });

  it("leaves a drag that carries no file to the browser", () => {
    const { seen, tracker } = tracked();
    const text = drag(["text/plain"]);
    tracker.dragenter(text);
    tracker.dragover(text);
    tracker.drop(text);
    expect(seen).toEqual({ over: false, dropped: [] });
    expect(text.preventDefault).not.toHaveBeenCalled();
  });

  it("stays lit while the pointer crosses a child", () => {
    const { seen, tracker } = tracked();
    tracker.dragenter(drag());
    tracker.dragenter(drag());
    tracker.dragleave(drag());
    expect(seen.over).toBe(true);
  });

  it("goes dark once the drag has left for good", () => {
    const { seen, tracker } = tracked();
    tracker.dragenter(drag());
    tracker.dragleave(drag());
    expect(seen.over).toBe(false);
  });

  it("takes the drop from the browser, hands the files over and goes dark", () => {
    const { seen, tracker } = tracked();
    tracker.dragenter(drag());
    const hovering = drag();
    tracker.dragover(hovering);
    expect(hovering.preventDefault).toHaveBeenCalled();
    expect(hovering.dataTransfer.dropEffect).toBe("copy");
    const dropping = drag();
    tracker.drop(dropping);
    expect(dropping.preventDefault).toHaveBeenCalled();
    expect(seen).toEqual({ over: false, dropped: [[file]] });
  });
});
