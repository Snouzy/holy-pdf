type DragLike = {
  readonly defaultPrevented?: boolean;
  dataTransfer: { readonly types: readonly string[]; readonly files: Iterable<File>; dropEffect: DataTransfer["dropEffect"] } | null;
  preventDefault(): void;
};

/**
 * Follows files dragged over the whole window. A drag carrying text or a link is left to the browser.
 * `dragenter` and `dragleave` fire again for every element the pointer crosses, so a depth count, not a flag, says when the drag has gone.
 */
export function dropTracker(onOver: (over: boolean) => void, onFiles: (files: File[]) => void) {
  let depth = 0;
  const carriesFiles = (event: DragLike) => event.dataTransfer?.types.includes("Files") ?? false;
  const stop = () => {
    depth = 0;
    onOver(false);
  };
  return {
    dragenter(event: DragLike) {
      if (!carriesFiles(event)) return;
      depth += 1;
      onOver(true);
    },
    dragleave(event: DragLike) {
      if (!carriesFiles(event)) return;
      depth -= 1;
      if (depth <= 0) stop();
    },
    dragover(event: DragLike) {
      if (!event.dataTransfer || !carriesFiles(event)) return;
      // Without it the browser opens the file in the tab, and the board is lost.
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    },
    drop(event: DragLike) {
      if (!event.dataTransfer || !carriesFiles(event)) return;
      // A nested importer has already consumed the file, but the window veil still needs to close.
      const handled = event.defaultPrevented;
      event.preventDefault();
      stop();
      if (!handled) onFiles([...event.dataTransfer.files]);
    },
  };
}
