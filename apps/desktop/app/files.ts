import type { Tool } from "../../web/src/tools";

const image = /\.(jpe?g|png|heic|heif)$/i;

/** Files read from a path carry no MIME type: the name decides. */
export function accepted(tool: Tool, files: File[]): File[] {
  const kept = files.filter((file) =>
    tool.accepts === "pdf" ? file.type === "application/pdf" || /\.pdf$/i.test(file.name) : file.type.startsWith("image/") || image.test(file.name),
  );
  return tool.multipleFiles ? kept : kept.slice(0, 1);
}
