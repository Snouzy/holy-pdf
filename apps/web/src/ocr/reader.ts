import { tesseractWorker } from "./tesseract";
import type { Engine } from "../engine/client";
import type { Progress } from "../engine/protocol";
import type { OcrLine, OcrPage, PageSize, Result } from "../engine/types";

/** About 200 ppi on an A4 page: a sharper picture reads hardly better and takes longer. */
const longestSide = 2400;

/** Reads each page's picture with Tesseract, in French and English. */
export async function readPages(
  engine: Pick<Engine, "thumbnail">,
  docId: string,
  pages: { index: number; size: PageSize }[],
  onProgress: (progress: Progress) => void,
): Promise<Result<OcrPage[]>> {
  const worker = await tesseractWorker(["fra", "eng"]);
  try {
    const read: OcrPage[] = [];
    for (const [done, { index, size }] of pages.entries()) {
      onProgress({ done, total: pages.length });
      const width = Math.max(1, Math.round(size.width * longestSide / Math.max(size.width, size.height)));
      const height = Math.max(1, Math.round(width * size.height / size.width));
      const picture = await engine.thumbnail(docId, index, width);
      if (!picture.ok) return picture;
      const { data } = await worker.recognize(picture.value, {}, { blocks: true });
      const lines: OcrLine[] = (data.blocks ?? []).flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines)).map(({ text, bbox }) => ({
        text: text.trim(),
        x: bbox.x0 / width,
        y: bbox.y0 / height,
        width: (bbox.x1 - bbox.x0) / width,
        height: (bbox.y1 - bbox.y0) / height,
      })).filter((line) => line.text !== "");
      read.push({ pageIndex: index, lines });
    }
    onProgress({ done: pages.length, total: pages.length });
    return { ok: true, value: read };
  } finally {
    await worker.terminate();
  }
}
