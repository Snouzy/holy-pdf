import { looksLikeImage, type Tool } from "../../web/src/tools";

const image = /\.(jpe?g|png|heic|heif)$/i;

/** Files read from a path carry no MIME type: the name decides. */
export function accepted(tool: Tool, files: File[]): File[] {
  const isPdf = (file: File) => file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  const isImage = (file: File) => file.type.startsWith("image/") || image.test(file.name);
  const kept = files.filter((file) => (tool.accepts === "pdf" ? isPdf(file) : isImage(file)) || (tool.convertsImages && looksLikeImage(file)));
  return tool.multipleFiles ? kept : kept.slice(0, 1);
}
